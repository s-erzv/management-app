// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, paymentAmount, returnedQty, borrowedQty, transportCost, proofFileUrl, newPaymentStatus } = await req.json()
    
    // Pastikan Supabase client dibuat dengan service_role_key untuk bypass RLS
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Edge Function called for order:', orderId);
    console.log('Payload:', { paymentAmount, returnedQty, borrowedQty, transportCost, proofFileUrl, newPaymentStatus });

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, qty, price, item_type, products(is_returnable, company_id))')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    const company_id = order.company_id;

    // 1. Tambah pembayaran jika ada
    if (paymentAmount > 0) {
      console.log('Inserting payment...');
      const { error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          amount: paymentAmount,
          method: 'cash',
          paid_at: new Date().toISOString(),
          company_id: company_id,
        });
      if (paymentInsertError) throw paymentInsertError;
      console.log('Payment inserted successfully.');
    }

    // 2. Catat pergerakan stok
    const returnableItem = order.order_items.find(item => item.products?.is_returnable);
    if (returnableItem) {
      const productId = returnableItem.product_id;
      if (returnedQty > 0) {
        console.log('Inserting return stock movement...');
        const { error: returnMovementError } = await supabase.from('stock_movements').insert({
          type: 'pengembalian',
          qty: returnedQty,
          order_id: orderId,
          product_id: productId,
          notes: 'Pengembalian galon kosong dari pelanggan.',
          company_id: company_id,
        });
        if (returnMovementError) throw returnMovementError;
        console.log('Return stock movement inserted successfully.');
      }
      if (borrowedQty > 0) {
        console.log('Inserting borrowed stock movement...');
        const { error: borrowedMovementError } = await supabase.from('stock_movements').insert({
          type: 'pinjam_kembali',
          qty: borrowedQty,
          order_id: orderId,
          product_id: productId,
          notes: 'Galon dipinjam kembali oleh pelanggan.',
          company_id: company_id,
        });
        if (borrowedMovementError) throw borrowedMovementError;
        console.log('Borrowed stock movement inserted successfully.');
      }
    }

    // 3. Update status pesanan
    console.log('Updating order status to completed...');
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_status: newPaymentStatus,
        proof_of_delivery_url: proofFileUrl,
        transport_cost: transportCost,
        delivered_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) throw updateError;
    console.log('Order status updated successfully.');
    
    return new Response(JSON.stringify({ message: 'Delivery completed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Final Catch Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
});