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
    const { expenseReport, expenseItems } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (!expenseReport || !expenseItems || expenseItems.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing expense data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 1. Simpan laporan pengeluaran ke tabel expense_reports
    const { data: newReport, error: reportError } = await supabase
      .from('expense_reports')
      .insert([expenseReport])
      .select('id')
      .single();

    if (reportError) throw reportError;
    const reportId = newReport.id;

    // 2. Siapkan item pengeluaran untuk dimasukkan
    const itemsToInsert = expenseItems.map(item => ({
      ...item,
      expense_report_id: reportId,
    }));

    // 3. Simpan item pengeluaran ke tabel expense_report_items
    const { error: itemsError } = await supabase
      .from('expense_report_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;
    
    return new Response(JSON.stringify({ message: 'Laporan pengeluaran berhasil dibuat', reportId }), {
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