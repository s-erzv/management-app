// supabase/functions/delete-order/index.ts

// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'DELETE, POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, companyId } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!orderId || !companyId) {
      return new Response(JSON.stringify({ error: 'Order ID and Company ID are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    // 1. Ambil item-item pesanan untuk mengetahui produk dan jumlah yang terlibat
    const { data: orderItemsData, error: orderItemsFetchError } = await supabase
        .from('order_items')
        .select('product_id, qty, item_type')
        .eq('order_id', orderId);
        
    if (orderItemsFetchError) throw orderItemsFetchError;
    
    // 2. Periksa apakah pesanan sudah pernah dikirim (status sent atau completed)
    const { data: orderData, error: orderFetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();
        
    if (orderFetchError) throw orderFetchError;
    
    // 3. Jika status pesanan sudah sent atau completed, kembalikan stok
    if (orderData.status === 'sent' || orderData.status === 'completed') {
        for (const item of orderItemsData) {
            // Kita hanya mengembalikan stok untuk item yang memang dijual
            if (item.item_type === 'beli') {
                // Ambil stok saat ini untuk menghindari race condition
                const { data: productData, error: productFetchError } = await supabase
                    .from('products')
                    .select('stock')
                    .eq('id', item.product_id)
                    .single();
                if (productFetchError) throw productFetchError;
    
                const newStock = (productData?.stock || 0) + item.qty;
    
                const { error: stockUpdateError } = await supabase
                    .from('products')
                    .update({ stock: newStock })
                    .eq('id', item.product_id);
                if (stockUpdateError) throw stockUpdateError;
    
                // Catat pergerakan stok
                const { error: movementError } = await supabase
                    .from('stock_movements')
                    .insert({
                        product_id: item.product_id,
                        qty: item.qty,
                        type: 'masuk_hapus_pesanan',
                        notes: `Stok dikembalikan karena pesanan #${orderId.slice(0, 8)} dihapus.`,
                        company_id: companyId,
                        order_id: orderId,
                    });
                if (movementError) throw movementError;
            }
        }
    }


    // --- Hapus data terkait setelah stok dikembalikan ---
    const { error: galonError } = await supabase
      .from('order_galon_items')
      .delete()
      .eq('order_id', orderId);
    if (galonError) throw galonError;
    
    const { error: couriersError } = await supabase
        .from('order_couriers')
        .delete()
        .eq('order_id', orderId);
    if (couriersError) throw couriersError;
    
    const { error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .eq('order_id', orderId);
    if (paymentsError) throw paymentsError;

    const { error: orderItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);
    if (orderItemsError) throw orderItemsError;

    const { error: invoicesError } = await supabase
      .from('invoices')
      .delete()
      .eq('order_id', orderId);
    if (invoicesError) throw invoicesError;

    const { error: stockMovementsError } = await supabase
        .from('stock_movements')
        .delete()
        .eq('order_id', orderId);
    if (stockMovementsError) throw stockMovementsError;

    // Akhirnya, hapus order itu sendiri
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId)
      .eq('company_id', companyId);
    if (orderError) throw orderError;
    
    return new Response(JSON.stringify({ message: 'Order deleted successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error deleting order:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});