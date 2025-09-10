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
    const {
      orderId,
      paymentAmount,
      paymentMethodId,
      returnableItems, 
      transportCost,
      proofFileUrl,
      transferProofUrl,
      receivedByUserId,
      receivedByName,
      paymentStatus,
    } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(product_id, qty, price, item_type, products(is_returnable, company_id, empty_bottle_price))')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    const company_id = order.company_id;

    const orderItemsTotal = order.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    let totalPurchaseCost = 0;

    // --- LOGIC FOR UPDATING STOCKS AND GALON MOVEMENTS ---
    for (const item of order.order_items) {
      const deliveredQty = parseFloat(item.qty) || 0;
      if (deliveredQty > 0) {
        // Decrease stock for sold products
        await supabase.rpc('update_product_stock', {
          product_id: item.product_id,
          qty_to_add: -deliveredQty,
        });

        // Log the stock movement
        await supabase.from('stock_movements').insert({
          type: 'keluar',
          qty: deliveredQty,
          order_id: orderId,
          product_id: item.product_id,
          notes: 'Produk keluar untuk pesanan pelanggan.',
          company_id: company_id,
        });
      }
    }

    for (const item of returnableItems) {
        totalPurchaseCost += (parseFloat(item.purchasedEmptyQty) || 0) * (item.empty_bottle_price || 0);

        await supabase.from('order_galon_items').delete().eq('order_id', orderId).eq('product_id', item.product_id);
        
        await supabase.from('order_galon_items').insert({
            order_id: orderId,
            product_id: item.product_id,
            returned_qty: parseFloat(item.returnedQty) || 0,
            borrowed_qty: parseFloat(item.borrowedQty) || 0,
            purchased_empty_qty: parseFloat(item.purchasedEmptyQty) || 0,
        });

        const diff_returned = parseFloat(item.returnedQty) || 0;
        if (diff_returned > 0) {
          // Increase empty bottle stock for galons returned by customer
          await supabase.rpc('update_empty_bottle_stock', {
            product_id: item.product_id,
            qty_to_add: diff_returned,
          });
          await supabase.from('stock_movements').insert({
            type: 'pengembalian',
            qty: diff_returned,
            order_id: orderId,
            product_id: item.product_id,
            notes: 'Pengembalian galon kosong dari pelanggan.',
            company_id: company_id,
          });
        }

        const diff_purchased = parseFloat(item.purchasedEmptyQty) || 0;
        if (diff_purchased > 0) {
          // Increase empty bottle stock for empty galons purchased from customer
          await supabase.rpc('update_empty_bottle_stock', {
            product_id: item.product_id,
            qty_to_add: diff_purchased,
          });
          await supabase.from('stock_movements').insert({
            type: 'galon_dibeli',
            qty: diff_purchased,
            order_id: orderId,
            product_id: item.product_id,
            notes: 'Galon kosong dibeli oleh perusahaan.',
            company_id: company_id,
          });
        }

        const diff_borrowed = parseFloat(item.borrowedQty) || 0;
        if (diff_borrowed > 0) {
          await supabase.from('stock_movements').insert({
            type: 'pinjam_kembali',
            qty: diff_borrowed,
            order_id: orderId,
            product_id: item.product_id,
            notes: 'Galon dipinjam kembali oleh pelanggan.',
            company_id: company_id,
          });
        }
    }

    const newGrandTotal = orderItemsTotal + (parseFloat(transportCost) || 0) + totalPurchaseCost;

    if (paymentStatus === 'paid' || paymentStatus === 'partial') {
      const { error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          amount: paymentAmount,
          payment_method_id: paymentMethodId,
          paid_at: new Date().toISOString(),
          company_id: company_id,
          proof_url: transferProofUrl,
          received_by: receivedByUserId,
          received_by_name: receivedByName,
        });
      if (paymentInsertError) throw paymentInsertError;
    }

    if (transportCost > 0) {
      const { error: financialTransactionError } = await supabase
        .from('financial_transactions')
        .insert({
          company_id: company_id,
          type: 'income',
          amount: transportCost,
          description: `Pemasukan dari biaya transportasi pesanan #${orderId.slice(0, 8)}`,
          payment_method_id: paymentMethodId,
          source_table: 'orders',
          source_id: orderId,
        });
      if (financialTransactionError) throw financialTransactionError;
    }

    if (totalPurchaseCost > 0) {
       const { error: emptyBottlePurchaseError } = await supabase
        .from('financial_transactions')
        .insert({
          company_id: company_id,
          type: 'income',
          amount: totalPurchaseCost,
          description: `Pemasukan dari pembelian galon kosong dari pelanggan pesanan #${orderId.slice(0, 8)}`,
          payment_method_id: paymentMethodId,
          source_table: 'orders',
          source_id: orderId,
        });
      if (emptyBottlePurchaseError) throw emptyBottlePurchaseError;
    }
    
    const totalReturnedQty = returnableItems.reduce((sum, item) => sum + (parseFloat(item.returnedQty) || 0), 0);
    const totalBorrowedQty = returnableItems.reduce((sum, item) => sum + (parseFloat(item.borrowedQty) || 0), 0);
    const totalPurchasedEmptyQty = returnableItems.reduce((sum, item) => sum + (parseFloat(item.purchasedEmptyQty) || 0), 0);
    
    const { data: currentPaymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', orderId);

    if (paymentsError) throw paymentsError;
    const totalPaid = currentPaymentsData.reduce((sum, p) => sum + p.amount, 0);

    let newPaymentStatus = 'unpaid';
    if (totalPaid >= newGrandTotal) {
      newPaymentStatus = 'paid';
    } else if (totalPaid > 0) {
      newPaymentStatus = 'partial';
    }

    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_status: newPaymentStatus,
        proof_of_delivery_url: proofFileUrl,
        transport_cost: transportCost,
        delivered_at: new Date().toISOString(),
        returned_qty: totalReturnedQty,
        borrowed_qty: totalBorrowedQty,
        purchased_empty_qty: totalPurchasedEmptyQty,
        grand_total: newGrandTotal,
      })
      .eq('id', orderId);
    if (updateOrderError) throw updateOrderError;

    const { error: updateInvoiceError } = await supabase
      .from('invoices')
      .update({
        grand_total: newGrandTotal,
        balance_due: newGrandTotal - totalPaid,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);
    if (updateInvoiceError) throw updateInvoiceError;

    return new Response(JSON.stringify({ message: 'Delivery completed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Final Catch Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});