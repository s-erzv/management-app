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
    const {
      orderId,
      paymentAmount,
      paymentMethodId,
      returnedQty,
      borrowedQty,
      purchasedEmptyQty,
      totalPurchaseCost, 
      transportCost,
      proofFileUrl,
      transferProofUrl,
      receivedByUserId,
      receivedByName, // Perbaikan: Menerima nama penerima dari frontend
    } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

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

    // Perhitungan total tagihan baru sesuai dengan permintaan Anda
    const orderItemsTotal = order.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0);
    const newGrandTotal = orderItemsTotal + (parseFloat(transportCost) || 0) + (parseFloat(totalPurchaseCost) || 0);

    // Perbaikan: Pastikan paymentMethodId ada sebelum mencatat pembayaran
    if (paymentAmount > 0 && paymentMethodId) {
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
          received_by_name: receivedByName, // Perbaikan: Menggunakan nama yang diinputkan
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

    const returnableItem = order.order_items.find(item => item.products?.is_returnable);
    if (returnableItem) {
      const productId = returnableItem.product_id;

      const deliveredQty = order.order_items.reduce((sum, item) => {
        return item.products?.is_returnable ? sum + item.qty : sum;
      }, 0);

      const actualReturnedQty = Math.min(returnedQty, deliveredQty);
      const leftoverGalons = returnedQty > deliveredQty ? returnedQty - deliveredQty : 0;

      if (actualReturnedQty > 0) {
        const { error: returnMovementError } = await supabase.from('stock_movements').insert({
          type: 'pengembalian',
          qty: actualReturnedQty,
          order_id: orderId,
          product_id: productId,
          notes: 'Pengembalian galon kosong dari pelanggan.',
          company_id: company_id,
        });
        if (returnMovementError) throw returnMovementError;
      }

      if (leftoverGalons > 0) {
        const { error: debtPaymentError } = await supabase.from('stock_movements').insert({
          type: 'pelunasan_utang',
          qty: leftoverGalons,
          order_id: orderId,
          product_id: productId,
          notes: `Galon kosong (${leftoverGalons}) dikembalikan untuk melunasi utang galon dari pesanan sebelumnya.`,
          company_id: company_id,
        });
        if (debtPaymentError) throw debtPaymentError;
      }

      if (borrowedQty > 0) {
        const { error: borrowedMovementError } = await supabase.from('stock_movements').insert({
          type: 'pinjam_kembali',
          qty: borrowedQty,
          order_id: orderId,
          product_id: productId,
          notes: 'Galon dipinjam kembali oleh pelanggan.',
          company_id: company_id,
        });
        if (borrowedMovementError) throw borrowedMovementError;
      }
      if (purchasedEmptyQty > 0) {
        const { error: purchasedEmptyMovementError } = await supabase.from('stock_movements').insert({
          type: 'galon_dibeli',
          qty: purchasedEmptyQty,
          order_id: orderId,
          product_id: productId,
          notes: 'Galon kosong dibeli oleh perusahaan.',
          company_id: company_id,
        });
        if (purchasedEmptyMovementError) throw purchasedEmptyMovementError;
      }
    }

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
        returned_qty: returnedQty,
        borrowed_qty: borrowedQty,
        purchased_empty_qty: purchasedEmptyQty,
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
    })
  }
});