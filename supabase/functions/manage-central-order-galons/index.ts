// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderId, receivedItems, galonDetails, deliveryDetails, companyId, userId, orderItems } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const movementsToInsert = [];

    // Logika untuk mencatat pergerakan stok produk utama
    for (const item of receivedItems) {
      const receivedQty = parseFloat(item.received_qty) || 0;
      if (receivedQty > 0) {
        movementsToInsert.push({
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

    // Logika untuk mencatat pergerakan galon
    for (const [productId, details] of Object.entries(galonDetails)) {
      const returnedQty = parseFloat(details.returned_to_central) || 0;
      const borrowedQty = parseFloat(details.borrowed_from_central) || 0;
      const soldEmptyQty = parseFloat(details.sold_empty_to_central) || 0;
      const soldEmptyPrice = parseFloat(details.sold_empty_price) || 0; // Ambil harga dari payload

      // Galon dikembalikan → stok berkurang
      if (returnedQty > 0) {
        movementsToInsert.push({
          product_id: productId,
          qty: returnedQty,
          type: 'galon_dikembalikan_ke_pusat',
          notes: 'Pengembalian galon kosong ke pusat.',
          company_id: companyId,
          user_id: userId,
          central_order_id: orderId,
        });

        await supabase.rpc('update_empty_bottle_stock', {
          product_id: productId,
          qty_to_add: -returnedQty,
        });
      }

      // Galon dipinjam → catat saja (stok tidak berubah)
      if (borrowedQty > 0) {
        movementsToInsert.push({
          product_id: productId,
          qty: borrowedQty,
          type: 'galon_dipinjam_dari_pusat',
          notes: 'Galon dipinjam dari pusat (tidak memengaruhi stok).',
          company_id: companyId,
          user_id: userId,
          central_order_id: orderId,
        });
      }

      // Galon kosong dibeli → catat saja (stok tidak berubah)
      if (soldEmptyQty > 0) {
        movementsToInsert.push({
          product_id: productId,
          qty: soldEmptyQty,
          type: 'galon_kosong_dibeli_dari_pusat',
          notes: 'Galon kosong dibeli dari pusat (tidak memengaruhi stok).',
          company_id: companyId,
          user_id: userId,
          central_order_id: orderId,
        });
        // Tambahkan transaksi finansial untuk pembelian galon kosong
        await supabase.from('financial_transactions').insert({
          company_id: companyId,
          type: 'expense',
          amount: soldEmptyQty * soldEmptyPrice,
          description: `Pembelian galon kosong dari pusat pesanan #${orderId.slice(0, 8)}`,
          source_table: 'central_orders',
          source_id: orderId,
        });
      }
    }


    // Masukkan semua pergerakan stok dalam satu operasi
    if (movementsToInsert.length > 0) {
      await supabase.from('stock_movements').insert(movementsToInsert);
    }

    // Perbarui status pesanan pusat
    await supabase.from('central_orders').update({
      arrival_date: deliveryDetails.arrival_date || null,
      central_note_number: deliveryDetails.central_note_number || null,
      status: 'received',
    }).eq('id', orderId);

    // Perbarui detail item yang diterima
    const updatedItemsPayload = receivedItems.map(receivedItem => {
      const originalItem = orderItems.find(
        (item) => item.product_id === receivedItem.product_id
      );
      // Dapatkan harga galon kosong dari galonDetails
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
  } catch (error) {
    console.error('Error in manage-central-order-galons:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});