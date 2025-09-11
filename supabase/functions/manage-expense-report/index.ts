// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { reportId, companyId, expenseReport, expenseItems } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    if (req.method === 'PUT') {
      if (!reportId || !expenseReport || !expenseItems) {
        return new Response(JSON.stringify({ error: 'Missing report data for update' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { error: reportUpdateError } = await supabase
        .from('expense_reports')
        .update(expenseReport)
        .eq('id', reportId)
        .eq('status', 'pending');
      
      if (reportUpdateError) throw reportUpdateError;

      const { error: deleteItemsError } = await supabase
        .from('expense_report_items')
        .delete()
        .eq('expense_report_id', reportId);
      if (deleteItemsError) throw deleteItemsError;

      const itemsToInsert = expenseItems.map(item => ({
        ...item,
        expense_report_id: reportId,
      }));

      const { error: insertItemsError } = await supabase
        .from('expense_report_items')
        .insert(itemsToInsert);
      if (insertItemsError) throw insertItemsError;
      
      return new Response(JSON.stringify({ message: 'Laporan pengeluaran berhasil diperbarui!' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else if (req.method === 'DELETE') {
      if (!reportId || !companyId) {
        return new Response(JSON.stringify({ error: 'Report ID and Company ID are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }

      const { data: reportData, error: reportFetchError } = await supabase
        .from('expense_reports')
        .select('status')
        .eq('id', reportId)
        .single();
      if (reportFetchError) throw reportFetchError;

      if (reportData.status === 'paid') {
        const { error: financialDeleteError } = await supabase
          .from('financial_transactions')
          .delete()
          .eq('source_table', 'expense_reports')
          .eq('source_id', reportId);
        if (financialDeleteError) throw financialDeleteError;
      }

      const { error: itemsDeleteError } = await supabase
        .from('expense_report_items')
        .delete()
        .eq('expense_report_id', reportId);
      if (itemsDeleteError) throw itemsDeleteError;

      const { error: reportDeleteError } = await supabase
        .from('expense_reports')
        .delete()
        .eq('id', reportId)
        .eq('company_id', companyId);
      if (reportDeleteError) throw reportDeleteError;
      
      return new Response(JSON.stringify({ message: 'Laporan berhasil dihapus.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('Error in manage-expense-report:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});