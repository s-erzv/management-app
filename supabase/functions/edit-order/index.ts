// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, orderDetails, orderItems } = await req.json()
    
    // Pisahkan courier_ids dari orderDetails
    const { courier_ids, ...restOfOrderDetails } = orderDetails;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!orderId || !orderDetails || !orderItems || orderItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing order data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Ambil data pesanan lama untuk membandingkan stok
    const { data: oldOrder, error: oldOrderError } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (product_id, qty, price)
        `)
        .eq('id', orderId)
        .single();
    if (oldOrderError) throw oldOrderError;

    // 2. Update tabel orders
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(restOfOrderDetails) // Gunakan objek yang sudah dipisahkan
      .eq('id', orderId);
    if (orderUpdateError) throw orderUpdateError;
    
    // 3. Update tabel order_couriers
    // Hapus semua entri lama
    const { error: deleteCouriersError } = await supabase
        .from('order_couriers')
        .delete()
        .eq('order_id', orderId);
    if (deleteCouriersError) throw deleteCouriersError;

    // Masukkan entri baru jika ada
    if (courier_ids && courier_ids.length > 0) {
        const couriersToInsert = courier_ids.map(courier_id => ({
            order_id: orderId,
            courier_id: courier_id
        }));
        const { error: insertCouriersError } = await supabase
            .from('order_couriers')
            .insert(couriersToInsert);
        if (insertCouriersError) throw insertCouriersError;
    }

    // 4. Update tabel order_items
    // Hapus item-item lama
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);
    if (deleteItemsError) throw deleteItemsError;
    
    // Masukkan item-item baru
    const itemsToInsert = orderItems.map(item => ({
      ...item,
      order_id: orderId,
      company_id: orderDetails.company_id,
    }));
    const { error: insertItemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);
    if (insertItemsError) throw insertItemsError;
    
    // 5. Update tabel invoices
    const newSubtotal = orderItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const { error: invoiceUpdateError } = await supabase
        .from('invoices')
        .update({
            subtotal: newSubtotal,
            grand_total: newSubtotal,
            balance_due: newSubtotal,
            notes: restOfOrderDetails.notes,
        })
        .eq('order_id', orderId);
    if (invoiceUpdateError) throw invoiceUpdateError;

    // 6. Hitung dan catat pergerakan stok
    for (const oldItem of oldOrder.order_items) {
      const newItem = orderItems.find(i => i.product_id === oldItem.product_id);
      if (!newItem) {
        // Item dihapus, kembalikan stok
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            order_id: orderId,
            product_id: oldItem.product_id,
            qty: oldItem.qty,
            type: 'masuk_edit_pesanan',
            notes: `Penyesuaian stok karena item dihapus dari pesanan.`,
            company_id: orderDetails.company_id,
          });
        if (movementError) throw movementError;
      }
    }

    for (const newItem of orderItems) {
      const oldItem = oldOrder.order_items.find(i => i.product_id === newItem.product_id);
      const diff = newItem.qty - (oldItem?.qty || 0);
      if (diff !== 0) {
        const type = diff > 0 ? 'keluar_edit_pesanan' : 'masuk_edit_pesanan';
        const notes = `Penyesuaian stok karena jumlah item diperbarui. Selisih: ${diff}`;
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            order_id: orderId,
            product_id: newItem.product_id,
            qty: Math.abs(diff),
            type,
            notes,
            company_id: orderDetails.company_id,
          });
        if (movementError) throw movementError;
      }
    }

    return new Response(JSON.stringify({ message: 'Order updated successfully', orderId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error updating order:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});