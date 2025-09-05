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
    
    // Mulai dengan menghapus data dari tabel yang memiliki foreign key ke orders
    // Menghapus payments
    const { error: paymentsError } = await supabase
      .from('payments')
      .delete()
      .eq('order_id', orderId)
      .eq('company_id', companyId);
    if (paymentsError) throw paymentsError;

    // Menghapus order_items
    const { error: orderItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
      .eq('company_id', companyId);
    if (orderItemsError) throw orderItemsError;

    // Menghapus invoices
    const { error: invoicesError } = await supabase
      .from('invoices')
      .delete()
      .eq('order_id', orderId)
      .eq('company_id', companyId);
    if (invoicesError) throw invoicesError;

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