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
    console.log('Data yang diterima:', orderForm, orderItems);
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')

    if (!orderForm || !orderItems || orderItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing order data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    // Dapatkan status pelanggan dari database untuk validasi
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .select('customer_status, company_id') // Kolom diperbaiki
      .eq('id', orderForm.customer_id)
      .single();
    
    if (customerError || !customerData) {
      throw new Error('Customer not found or invalid.');
    }
    const customerStatusName = customerData.customer_status; // Nama variabel diperbaiki

    // Hitung total pesanan dan validasi harga
    let subtotal = 0;
    const itemsToInsert = [];
    const invoiceItemsToInsert = [];
    const stockMovements = [];
    
    for (const item of orderItems) {
        // Fetch the correct price from the database for server-side validation
        const { data: priceData, error: priceError } = await supabase
            .from('product_prices')
            .select('price')
            .eq('product_id', item.product_id)
            .eq('customer_status', customerStatusName) // Kolom diperbaiki
            .single();

        if (priceError || !priceData) {
            throw new Error(`Price for product ${item.product_id} and status ${customerStatusName} not found.`);
        }
        
        const validatedPrice = priceData.price;

        subtotal += item.qty * validatedPrice;

        itemsToInsert.push({
            order_id: null,
            product_id: item.product_id,
            qty: item.qty,
            price: validatedPrice,
            item_type: 'beli',
            company_id: orderForm.company_id,
        });

        invoiceItemsToInsert.push({
            invoice_id: null,
            product_id: item.product_id,
            description: item.product_name,
            quantity: item.qty,
            unit_price: validatedPrice,
            line_total: item.qty * validatedPrice,
        });
        
        stockMovements.push({
            order_id: null,
            product_id: item.product_id,
            qty: item.qty,
            type: 'keluar',
            notes: `Galon keluar untuk pesanan (dibeli)`,
            company_id: orderForm.company_id,
        });
    }

    const grand_total = subtotal;

    // Dapatkan nomor invoice yang berurutan
    const { data: nextInvoiceNumber, error: invoiceNumberError } = await supabase.rpc('get_next_invoice_number', { p_company_id: orderForm.company_id });
    if (invoiceNumberError) throw invoiceNumberError;

    // 1. Masukkan pesanan baru
    const { data: insertedOrder, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_id: orderForm.customer_id,
        planned_date: orderForm.planned_date,
        notes: orderForm.notes,
        created_by: orderForm.created_by,
        company_id: orderForm.company_id,
        status: 'draft',
        payment_status: 'unpaid',
        invoice_number: nextInvoiceNumber,
      }])
      .select('id')
      .single();

    if (orderError) throw orderError;
    const orderId = insertedOrder.id;

    // 2. Masukkan invoice baru
    const { data: insertedInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
            order_id: orderId,
            company_id: orderForm.company_id,
            customer_id: orderForm.customer_id,
            invoice_number: nextInvoiceNumber,
            subtotal: subtotal,
            grand_total: grand_total,
            balance_due: grand_total,
            notes: orderForm.notes,
        }])
        .select('id')
        .single();
    if (invoiceError) throw invoiceError;
    const invoiceId = insertedInvoice.id;

    const finalItemsToInsert = itemsToInsert.map(item => ({...item, order_id: orderId}));
    const finalInvoiceItemsToInsert = invoiceItemsToInsert.map(item => ({...item, invoice_id: invoiceId}));
    const finalStockMovements = stockMovements.map(item => ({...item, order_id: orderId}));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(finalItemsToInsert);
    if (itemsError) throw itemsError;

    const { error: invoiceItemsError } = await supabase
      .from('invoice_items')
      .insert(finalInvoiceItemsToInsert);
    if (invoiceItemsError) throw invoiceItemsError;

    if (finalStockMovements.length > 0) {
        const { error: movementError } = await supabase
            .from('stock_movements')
            .insert(finalStockMovements);
        if (movementError) throw movementError;
    }

    return new Response(JSON.stringify({ message: 'Order created successfully', orderId, invoiceId }), {
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