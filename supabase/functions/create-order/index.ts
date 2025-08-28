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
        
        // Hitung total pesanan
        let subtotal = 0;
        for (const item of orderItems) {
            subtotal += item.qty * item.price;
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
    
        type OrderItem = {
          order_id: string;
          product_id: string;
          qty: number;
          price: number;
          item_type: string;
          company_id?: string;
        };
        
        type InvoiceItem = {
          invoice_id: string;
          product_id: string;
          description: string;
          quantity: number;
          unit_price: number;
          line_total: number;
        };
    
        const itemsToInsert: OrderItem[] = [];
        const invoiceItemsToInsert: InvoiceItem[] = [];
    
        type StockMovement = {
          order_id: string;
          product_id: string;
          qty: number;
          type: string;
          notes: string;
          company_id?: string;
        };
        const stockMovements: StockMovement[] = [];
    
        for (const item of orderItems) {
          itemsToInsert.push({
            order_id: orderId,
            product_id: item.product_id,
            qty: item.qty,
            price: item.price,
            item_type: item.item_type,
            company_id: orderForm.company_id,
          });
    
          invoiceItemsToInsert.push({
              invoice_id: invoiceId,
              product_id: item.product_id,
              description: item.product_name,
              quantity: item.qty,
              unit_price: item.price,
              line_total: item.qty * item.price,
          });
          
          if (item.item_type === 'beli') {
            stockMovements.push({
              order_id: orderId,
              product_id: item.product_id,
              qty: item.qty,
              type: 'keluar',
              notes: `Galon keluar untuk pesanan #${orderId.slice(0, 8)} (dibeli)`,
              company_id: orderForm.company_id,
            });
          }
        }
        
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(itemsToInsert);
        if (itemsError) throw itemsError;
    
        const { error: invoiceItemsError } = await supabase
          .from('invoice_items')
          .insert(invoiceItemsToInsert);
        if (invoiceItemsError) throw invoiceItemsError;
    
        if (stockMovements.length > 0) {
            const { error: movementError } = await supabase
                .from('stock_movements')
                .insert(stockMovements);
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
    