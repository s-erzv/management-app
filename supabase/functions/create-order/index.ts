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
    const { orderForm, orderItems } = await req.json()
    console.log('Data yang diterima:', orderForm, orderItems); // Debugging: Log data yang diterima
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    if (!orderForm || !orderItems || orderItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing order data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    // Perbaikan: Tambahkan company_id dari orderForm ke objek insert
    // 1. Masukkan pesanan baru
    const { data: insertedOrder, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: orderForm.customer_id,
        planned_date: orderForm.planned_date,
        notes: orderForm.notes,
        created_by: orderForm.created_by,
        company_id: orderForm.company_id, // <-- company_id ditambahkan di sini
        status: 'draft',
        payment_status: 'unpaid',
      }])
      .select('id')
      .single();

    if (orderError) throw orderError;
    const orderId = insertedOrder.id;

    type OrderItem = {
      order_id: string;
      product_id: string;
      qty: number;
      price: number;
      item_type: string;
      company_id?: string; // <-- Tambahkan company_id
    };

    const itemsToInsert: OrderItem[] = [];
    type StockMovement = {
      order_id: string;
      product_id: string;
      qty: number;
      type: string;
      notes: string;
      company_id?: string; // <-- Tambahkan company_id
    };
    const stockMovements: StockMovement[] = [];

    for (const item of orderItems) {
      itemsToInsert.push({
        order_id: orderId,
        product_id: item.product_id,
        qty: item.qty,
        price: item.price,
        item_type: item.item_type,
        company_id: orderForm.company_id, // <-- company_id ditambahkan di sini
      });

      // Tambahkan pergerakan stok untuk Galon yang dibeli
      if (item.item_type === 'beli') {
        stockMovements.push({
          order_id: orderId,
          product_id: item.product_id,
          qty: item.qty,
          type: 'keluar',
          notes: `Galon keluar untuk pesanan #${orderId.slice(0, 8)} (dibeli)`,
          company_id: orderForm.company_id, // <-- company_id ditambahkan di sini
        });
      }
    }
    
    // 2. Masukkan semua item pesanan
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // 3. Masukkan pergerakan stok
    if (stockMovements.length > 0) {
        const { error: movementError } = await supabase
            .from('stock_movements')
            .insert(stockMovements);
        if (movementError) throw movementError;
    }

    return new Response(JSON.stringify({ message: 'Order created successfully', orderId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});