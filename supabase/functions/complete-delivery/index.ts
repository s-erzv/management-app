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
        paymentMethod,
        returnedQty, 
        borrowedQty, 
        transportCost, 
        proofFileUrl, 
        transferProofUrl, // Menerima URL bukti transfer
        purchasedEmptyQty
    } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Edge Function called for order:', orderId);
    console.log('Payload:', { paymentAmount, paymentMethod, returnedQty, borrowedQty, transportCost, proofFileUrl, purchasedEmptyQty, transferProofUrl }); // Log transferProofUrl

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
    
    // Hitung total galon yang dikirim pada pesanan ini
    const deliveredQty = order.order_items.reduce((sum, item) => {
        return item.products?.is_returnable ? sum + item.qty : sum;
    }, 0);

    // 1. Tambah pembayaran jika ada
    if (paymentAmount > 0) {
      console.log('Inserting payment...');
      const { error: paymentInsertError } = await supabase
        .from('payments')
        .insert({
          order_id: orderId,
          amount: paymentAmount,
          method: paymentMethod,
          paid_at: new Date().toISOString(),
          company_id: company_id,
          proof_url: transferProofUrl, // Simpan URL bukti transfer di sini
        });
      if (paymentInsertError) throw paymentInsertError;
      console.log('Payment inserted successfully.');
    }

    // 2. Catat pergerakan stok
    const returnableItem = order.order_items.find(item => item.products?.is_returnable);
    if (returnableItem) {
      const productId = returnableItem.product_id;
      
      // Hitung sisa galon setelah pesanan ini
      let actualReturnedQty = Math.min(returnedQty, deliveredQty);
      let leftoverGalons = returnedQty > deliveredQty ? returnedQty - deliveredQty : 0;
      
      // Catat pengembalian untuk pesanan ini
      if (actualReturnedQty > 0) {
        console.log('Inserting return stock movement...');
        const { error: returnMovementError } = await supabase.from('stock_movements').insert({
          type: 'pengembalian',
          qty: actualReturnedQty,
          order_id: orderId,
          product_id: productId,
          notes: 'Pengembalian galon kosong dari pelanggan.',
          company_id: company_id,
        });
        if (returnMovementError) throw returnMovementError;
        console.log('Return stock movement inserted successfully.');
      }
      
      // Jika ada kelebihan galon, catat sebagai pelunasan utang sebelumnya
      if (leftoverGalons > 0) {
        console.log('Inserting leftover galons as previous debt payment...');
        const { error: debtPaymentError } = await supabase.from('stock_movements').insert({
          type: 'pelunasan_utang',
          qty: leftoverGalons,
          order_id: orderId,
          product_id: productId,
          notes: `Galon kosong (${leftoverGalons}) dikembalikan untuk melunasi utang galon dari pesanan sebelumnya.`,
          company_id: company_id,
        });
        if (debtPaymentError) throw debtPaymentError;
        console.log('Leftover galons inserted successfully.');
      }
      
      // Catat galon dipinjam dan dibeli
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
      if (purchasedEmptyQty > 0) {
        console.log('Inserting purchased empty stock movement...');
        const { error: purchasedEmptyMovementError } = await supabase.from('stock_movements').insert({
          type: 'galon_dibeli',
          qty: purchasedEmptyQty,
          order_id: orderId,
          product_id: productId,
          notes: 'Galon kosong dibeli oleh perusahaan.',
          company_id: company_id,
        });
        if (purchasedEmptyMovementError) throw purchasedEmptyMovementError;
        console.log('Purchased empty stock movement inserted successfully.');
      }
    }
    
    // 3. Catat biaya transportasi sebagai pemasukan
    if (transportCost > 0) {
        console.log('Recording transport cost as income...');
        const { error: financialTransactionError } = await supabase
            .from('financial_transactions')
            .insert({
                company_id: company_id,
                type: 'income',
                amount: transportCost,
                description: `Pemasukan dari biaya transportasi pesanan #${orderId.slice(0, 8)}`,
                source_table: 'orders',
                source_id: orderId,
            });
        if (financialTransactionError) throw financialTransactionError;
        console.log('Transport cost recorded as income successfully.');
    }

    // Hitung total pembayaran setelah pembayaran baru ditambahkan
    const { data: currentPaymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('amount')
      .eq('order_id', orderId);

    if (paymentsError) throw paymentsError;

    const totalPaid = currentPaymentsData.reduce((sum, p) => sum + p.amount, 0);
    const orderItemsTotal = order.order_items.reduce((sum, item) => sum + (item.qty * item.price), 0);

    let newPaymentStatus = 'unpaid';
    if (totalPaid >= orderItemsTotal) {
        newPaymentStatus = 'paid';
    } else if (totalPaid > 0) {
        newPaymentStatus = 'partial';
    }

    // 4. Update status pesanan
    console.log('Updating order status to completed...');
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'completed',
        payment_status: newPaymentStatus,
        proof_of_delivery_url: proofFileUrl,
        transport_cost: transportCost,
        delivered_at: new Date().toISOString(),
        returned_qty: returnedQty,
        borrowed_qty: borrowedQty,
        purchased_empty_qty: purchasedEmptyQty
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