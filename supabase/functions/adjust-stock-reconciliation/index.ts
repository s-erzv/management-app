// supabase/functions/adjust-stock-reconciliation/index.ts
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
    const { reconciliationItems, companyId, userId, stockType } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Simpan rekonsiliasi ke tabel history
    const { data: reconciliationRecord, error: insertError } = await supabase
      .from('stock_reconciliations')
      .insert({
        company_id: companyId,
        user_id: userId,
        items: reconciliationItems,
        reconciliation_date: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Perbarui stok produk dan buat pergerakan stok
    for (const item of reconciliationItems) {
      if (item.difference !== 0) {
        
        // Tentukan kolom yang akan diupdate
        const updateColumn = stockType === 'empty_bottle_stock' ? 'empty_bottle_stock' : 'stock';
        
        const newStock = parseFloat(item.physical_count);
        
        // Perbarui stok produk
        const { error: updateError } = await supabase
          .from('products')
          .update({ [updateColumn]: newStock })
          .eq('id', item.product_id);
          
        if (updateError) throw updateError;

        // Tambahkan catatan pergerakan stok
        const movementTypeBase = item.difference > 0 ? 'masuk' : 'keluar';
        const movementType = `${movementTypeBase}_rekonsiliasi`;
        
        // Deskripsi yang lebih informatif, mencatat jenis stok yang disesuaikan
        const notes = `Penyesuaian otomatis dari rekonsiliasi stok (${updateColumn.replace('_', ' ')}). Selisih: ${item.difference}`;
        
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: item.product_id,
            qty: Math.abs(item.difference),
            type: movementType,
            notes: notes,
            company_id: companyId,
            user_id: userId,
            reconciliation_id: reconciliationRecord.id
          });
          
        if (movementError) throw movementError;
      }
    }

    return new Response(JSON.stringify({ message: 'Stok berhasil disesuaikan secara otomatis.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in adjust-stock-reconciliation:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});