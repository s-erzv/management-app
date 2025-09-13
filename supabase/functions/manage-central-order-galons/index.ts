// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-http-method-override',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { method } = req;
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  try {
    let bodyData = null;
    if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
      bodyData = await req.json();
    }
    
    if (method === 'POST') {
      const { orderId, receivedItems, galonDetails, deliveryDetails, companyId, userId, orderItems } = bodyData;

      // proses barang masuk
      for (const item of receivedItems) {
        const receivedQty = parseFloat(item.received_qty) || 0;
        if (receivedQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: item.product_id,
            qty: receivedQty,
            type: 'masuk_dari_pusat',
            notes: `Barang diterima dari pusat (Nomor Surat: ${deliveryDetails.central_note_number})`,
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });

          await supabase.rpc('update_product_stock', {
            product_id: item.product_id,
            qty_to_add: receivedQty,
          });
        }
      }

      // proses galon
      const returnedMap: Record<string, number> = {};
      const borrowedMap: Record<string, number> = {};
      const soldEmptyMap: Record<string, number> = {};

      for (const [productId, details] of Object.entries(galonDetails)) {
        const returnedQty = parseFloat(details.returned_to_central) || 0;
        const borrowedQty = parseFloat(details.borrowed_from_central) || 0;
        const soldEmptyQty = parseFloat(details.sold_empty_to_central) || 0;
        const soldEmptyPrice = parseFloat(details.sold_empty_price) || 0;

        if (returnedQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: productId,
            qty: returnedQty,
            type: 'galon_dikembalikan_ke_pusat',
            notes: 'Pengembalian Kemasan Returnable ke pusat.',
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });

          await supabase.rpc('update_empty_bottle_stock', {
            product_id: productId,
            qty_to_add: -returnedQty,
          });

          returnedMap[productId] = returnedQty;
        }

        if (borrowedQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: productId,
            qty: borrowedQty,
            type: 'galon_dipinjam_dari_pusat',
            notes: 'Galon dipinjam dari pusat (tidak memengaruhi stok).',
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });

          borrowedMap[productId] = borrowedQty;
        }

        if (soldEmptyQty > 0) {
          await supabase.from('stock_movements').insert({
            product_id: productId,
            qty: soldEmptyQty,
            type: 'galon_kosong_dibeli_dari_pusat',
            notes: 'Kemasan Returnable dibeli dari pusat (tidak memengaruhi stok).',
            company_id: companyId,
            user_id: userId,
            central_order_id: orderId,
          });
          
          await supabase.from('financial_transactions').insert({
            company_id: companyId,
            type: 'expense',
            amount: soldEmptyQty * soldEmptyPrice,
            description: `Pembelian Kemasan Returnable dari pusat pesanan #${orderId.slice(0, 8)}`,
            source_table: 'central_orders',
            source_id: orderId,
          });

          soldEmptyMap[productId] = soldEmptyQty;
        }
      }

      // simpan order + galon details
      await supabase.from('central_orders').update({
        arrival_date: deliveryDetails.arrival_date || null,
        central_note_number: deliveryDetails.central_note_number || null,
        status: 'received',
        returned_to_central: returnedMap,
        borrowed_from_central: borrowedMap,
        sold_empty_to_central: soldEmptyMap
      }).eq('id', orderId);

      // upsert item
      const updatedItemsPayload = receivedItems.map(receivedItem => {
        const originalItem = orderItems.find(
          (item) => item.product_id === receivedItem.product_id
        );
        const galonDetail = galonDetails[receivedItem.product_id];
        const soldEmptyPrice = galonDetail ? (parseFloat(galonDetail.sold_empty_price) || 0) : 0;
        
        return {
          central_order_id: orderId,
          product_id: receivedItem.product_id,
          received_qty: receivedItem.received_qty,
          qty: originalItem ? originalItem.qty : 0,
          price: originalItem ? originalItem.price : 0,
          sold_empty_price: soldEmptyPrice,
        };
      });
      await supabase.from('central_order_items').upsert(updatedItemsPayload, { onConflict: ['central_order_id', 'product_id'] });

      return new Response(JSON.stringify({ message: 'Penerimaan barang berhasil dicatat.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (method === 'PUT') {
      const { oldItems, newItems, orderId, order: updatedOrderDetails } = bodyData;

      for (const oldItem of oldItems) {
        const newItem = newItems.find(i => i.product_id === oldItem.product_id);
        const diff = (newItem?.qty || 0) - oldItem.qty;
        
        if (diff !== 0) {
          await supabase.rpc('update_product_stock', {
            product_id: oldItem.product_id,
            qty_to_add: -diff,
          });
        }
      }

      await supabase.from('central_orders').update(updatedOrderDetails).eq('id', orderId);
      await supabase.from('central_order_items').delete().eq('central_order_id', orderId);
      await supabase.from('central_order_items').insert(newItems.map(item => ({...item, central_order_id: orderId})));

      return new Response(JSON.stringify({ message: 'Pesanan berhasil diperbarui.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else if (method === 'DELETE') {
      const { orderId, companyId } = bodyData;

      // Ambil data order
      const { data: orderData, error: orderFetchError } = await supabase
        .from('central_orders')
        .select('returned_to_central, central_order_items(product_id, received_qty)')
        .eq('id', orderId)
        .single();

      if (orderFetchError) throw orderFetchError;
      
      const { data: receivedItemsData, error: itemsError } = await supabase
        .from('central_order_items')
        .select('product_id, received_qty')
        .eq('central_order_id', orderId);

      if (itemsError) throw itemsError;

      // rollback produk utama
      for (const item of receivedItemsData) {
        if (item.received_qty > 0) {
          await supabase.rpc('update_product_stock', {
            product_id: item.product_id,
            qty_to_add: -item.received_qty,
          });
        }
      }
      
      // rollback galon returnable
      if (orderData.returned_to_central) {
        for (const [productId, returnedQty] of Object.entries(orderData.returned_to_central)) {
          if (parseInt(returnedQty) > 0) {
            await supabase.rpc('update_empty_bottle_stock', {
              product_id: productId,
              qty_to_add: parseInt(returnedQty),
            });
          }
        }
      }
      
      // hapus data terkait
      await supabase.from('central_order_items').delete().eq('central_order_id', orderId);
      await supabase.from('stock_movements').delete().eq('central_order_id', orderId);
      await supabase.from('financial_transactions').delete().eq('source_id', orderId).eq('source_table', 'central_orders');
      await supabase.from('central_orders').delete().eq('id', orderId).eq('company_id', companyId);

      return new Response(JSON.stringify({ message: 'Pesanan berhasil dihapus.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  } catch (error) {
    console.error('Error in manage-central-order-galons:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
