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
    const { order_id } = await req.json();
    if (!order_id) {
        return new Response(JSON.stringify({ error: 'Order ID is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Ambil data invoice yang lengkap
    
  const { data: invoiceData, error: invoiceError } = await supabase
    .from('invoices')
    .select(`
      *,
      customers:customer_id (name, phone, address),
      companies:company_id (name),
      invoice_items(
        *,
        products:product_id(name)
      )
    `)
    .eq('order_id', order_id)
    .single();

  if (invoiceError) throw invoiceError;

  console.log("Invoice Data:", JSON.stringify(invoiceData, null, 2)); // Tambahkan baris ini


    // 2. Logika pembuatan PDF
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
    page.drawText(`Nomor Invoice: ${invoiceData.invoice_number}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 20;
    page.drawText(`Tanggal: ${new Date(invoiceData.created_at).toLocaleDateString()}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 40;

    page.drawText(`Kepada: ${invoiceData.customers.name}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 20;
    page.drawText(`Alamat: ${invoiceData.customers.address}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
    y -= 20;
    page.drawText(`Telepon: ${invoiceData.customers.phone}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
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

    let totalAmount = 0;
    // Tambahkan pengecekan apakah invoice_items ada dan merupakan array
    if (invoiceData.invoice_items && Array.isArray(invoiceData.invoice_items)) {
      for (const item of invoiceData.invoice_items) {
        // Perbaiki: Gunakan 'quantity' dan 'unit_price' sesuai log
        const qty = item.quantity || 0;
        const price = item.unit_price || 0;
        
        const itemTotal = qty * price;
        page.drawText(`${item.products.name}`, { x: margin, y: y, size: fontSize, font: timesRomanFont });
        page.drawText(`${qty}`, { x: margin + 200, y: y, size: fontSize, font: timesRomanFont });
        page.drawText(`Rp${price.toLocaleString('id-ID')}`, { x: margin + 300, y: y, size: fontSize, font: timesRomanFont });
        page.drawText(`Rp${itemTotal.toLocaleString('id-ID')}`, { x: margin + 450, y: y, size: fontSize, font: timesRomanFont });
        y -= 20;
        totalAmount += itemTotal;
      }
    }
    y -= 20;

    page.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 20;

    // Tambahkan pengecekan nullish coalescing untuk toLocaleString
    page.drawText(`TOTAL: Rp${totalAmount?.toLocaleString('id-ID') ?? '0'}`, { x: margin + 380, y: y, size: 14, font: timesRomanFont, color: rgb(0, 0, 0) });

    const pdfBytes = await pdfDoc.save();
    
    // 3. Unggah PDF ke Supabase Storage
    const fileName = `invoice-${invoiceData.invoice_number}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('invoices')
      .upload(fileName, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (uploadError) throw uploadError;

    // 4. Dapatkan URL publik dari PDF
    const { data: publicUrlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(fileName);
    
    // 5. Perbarui URL publik di tabel invoices
    await supabase.from('invoices').update({ public_link: publicUrlData.publicUrl }).eq('id', invoiceData.id);

    // 6. Kembalikan URL publik
    return new Response(JSON.stringify({ pdfUrl: publicUrlData.publicUrl, invoiceNumber: invoiceData.invoice_number, amount: totalAmount, companyName: invoiceData.companies.name }), {
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