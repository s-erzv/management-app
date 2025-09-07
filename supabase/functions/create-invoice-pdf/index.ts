// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, orderData } = await req.json();

    if (!order_id || !orderData) {
      return new Response(JSON.stringify({ error: 'Order ID and data are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Ambil nama perusahaan dari database
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name')
      .eq('id', orderData.company_id)
      .single();
        
    if (companyError) throw companyError;
    const companyName = companyData.name;

    // Gunakan 'orderData' yang dikirim dari frontend
    const {
      customers,
      invoice_number,
      updated_at,
      order_items,
      transport_cost,
      purchased_empty_qty,
      grand_total,
    } = orderData;
    
    // Membuat PDF
    const pdfDoc = await PDFDocument.create();
    const timesRomanFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const page = pdfDoc.addPage([600, 800]);

    const { width, height } = page.getSize();
    const fontSize = 12;
    let y = height - 50;
    const margin = 50;

    page.drawText('INVOICE', {
      x: margin,
      y: y,
      size: 24,
      font: timesRomanFont,
      color: rgb(0, 0, 0),
    });
    y -= 30;
    page.drawText(`Nomor Invoice: ${invoice_number}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 20;
    page.drawText(`Tanggal: ${new Date(updated_at).toLocaleDateString()}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 40;

    page.drawText(`Kepada: ${customers.name}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 20;
    page.drawText(`Alamat: ${customers.address}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 20;
    page.drawText(`Telepon: ${customers.phone}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 40;
    
    // Header Tabel
    page.drawText('Item', { x: margin, y: y, size: fontSize, font: timesRomanFont });
    page.drawText('Kuantitas', { x: margin + 200, y: y, size: fontSize, font: timesRomanFont });
    page.drawText('Harga Satuan', { x: margin + 300, y: y, size: fontSize, font: timesRomanFont });
    page.drawText('Total', { x: margin + 450, y: y, size: fontSize, font: timesRomanFont });
    y -= 10;
    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 20;

    // Masukkan item dari order_items
    if (order_items && Array.isArray(order_items)) {
      for (const item of order_items) {
        const qty = item.qty || 0;
        const price = item.price || 0;
        const itemTotal = qty * price;
        
        page.drawText(`${item.products.name}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
        page.drawText(`${qty}`, { x: margin + 200, y: y, size: fontSize, font: timesRomanFont });
        page.drawText(`Rp${price.toLocaleString('id-ID')}`, { x: margin + 300, y: y, size: fontSize, font: timesRomanFont });
        page.drawText(`Rp${itemTotal.toLocaleString('id-ID')}`, { x: margin + 450, y: y, size: fontSize, font: timesRomanFont });
        y -= 20;
      }
    }
    
    // Tambahkan biaya transportasi
    if (transport_cost > 0) {
      page.drawText('Biaya Transportasi', { x: margin, y: y, size: fontSize, font: timesRomanFont });
      page.drawText(`1`, { x: margin + 200, y: y, size: fontSize, font: timesRomanFont });
      page.drawText(`Rp${transport_cost.toLocaleString('id-ID')}`, { x: margin + 300, y: y, size: fontSize, font: timesRomanFont });
      page.drawText(`Rp${transport_cost.toLocaleString('id-ID')}`, { x: margin + 450, y: y, size: fontSize, font: timesRomanFont });
      y -= 20;
    }
    
    // Tambahkan pembelian galon kosong
    const emptyBottlePrice = order_items.find(item => item.products?.is_returnable)?.products?.empty_bottle_price || 0;
    if (purchased_empty_qty > 0) {
      page.drawText('Beli Galon Kosong', { x: margin, y: y, size: fontSize, font: timesRomanFont });
      page.drawText(`${purchased_empty_qty}`, { x: margin + 200, y: y, size: fontSize, font: timesRomanFont });
      page.drawText(`Rp${emptyBottlePrice.toLocaleString('id-ID')}`, { x: margin + 300, y: y, size: fontSize, font: timesRomanFont });
      page.drawText(`Rp${(purchased_empty_qty * emptyBottlePrice).toLocaleString('id-ID')}`, { x: margin + 450, y: y, size: fontSize, font: timesRomanFont });
      y -= 20;
    }

    y -= 20;

    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 20;

    page.drawText(`TOTAL: Rp${grand_total?.toLocaleString('id-ID') ?? '0'}`, { x: margin + 380, y: y, size: 14, font: timesRomanFont, color: rgb(0, 0, 0) });

    const pdfBytes = await pdfDoc.save();
    
    // 1. Cek apakah invoice sudah ada
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('order_id', order_id)
      .single();

    let invData;
    let invErr;

    if (existingInvoice) {
      // 2. Jika sudah ada, lakukan UPDATE
      const { data, error } = await supabase
        .from('invoices')
        .update({
          // data yang ingin di-update
          customer_id: customers.id,
          invoice_number: invoice_number,
          grand_total: grand_total,
          company_id: orderData.company_id
        })
        .eq('id', existingInvoice.id)
        .select()
        .single();
      invData = data;
      invErr = error;
    } else {
      // 3. Jika belum ada, lakukan INSERT
      const { data, error } = await supabase
        .from('invoices')
        .insert({
          order_id: order_id,
          customer_id: customers.id,
          invoice_number: invoice_number,
          grand_total: grand_total,
          company_id: orderData.company_id
        })
        .select()
        .single();
      invData = data;
      invErr = error;
    }

    if (invErr) throw invErr;

    // Unggah PDF ke Supabase Storage
    const fileName = `invoice-${invoice_number}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (uploadError) throw uploadError;

    // Dapatkan URL publik dari PDF
    const { data: publicUrlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(fileName);
    
    // Perbarui URL publik di tabel invoices
    await supabase.from('invoices').update({ public_link: publicUrlData.publicUrl }).eq('id', invData.id);

    // Kembalikan URL publik
    return new Response(JSON.stringify({ pdfUrl: publicUrlData.publicUrl, invoiceNumber: invoice_number, amount: grand_total, companyName: companyName }), {
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