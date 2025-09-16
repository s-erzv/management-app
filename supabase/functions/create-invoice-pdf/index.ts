// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { PDFDocument, StandardFonts, rgb, degrees } from 'https://esm.sh/pdf-lib@1.17.1';
import { stripHtml } from 'https://esm.sh/string-strip-html@1.3.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch image as a Uint8Array
async function fetchImage(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    
    // Ambil nama dan logo perusahaan dari database
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name, logo_url')
      .eq('id', orderData.company_id)
      .single();
        
    if (companyError) throw companyError;
    const companyName = companyData.name;
    const companyLogoUrl = companyData.logo_url;

    // Gunakan 'orderData' yang dikirim dari frontend
    const {
      customers,
      invoice_number,
      created_at,
      order_items,
      transport_cost,
      purchased_empty_qty,
      returned_qty,
      borrowed_qty,
      grand_total,
      proof_public_url,
    } = orderData;
    
    // Membuat PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();
    const margin = 30;
    let y = height - margin;

    // Embed fonts
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // --- Header ---
    if (companyLogoUrl) {
        try {
            const imageBytes = await fetchImage(companyLogoUrl);
            const urlParts = companyLogoUrl.split('.');
            const fileExtension = urlParts[urlParts.length - 1].toLowerCase();

            let image;
            if (fileExtension === 'png') {
                image = await pdfDoc.embedPng(imageBytes);
            } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
                image = await pdfDoc.embedJpg(imageBytes);
            } else {
                throw new Error('Tipe file logo perusahaan tidak didukung.');
            }
            
            const logoMaxWidth = 180;
            const logoMaxHeight = 100;

            let scale = 1;
            if (image.width > logoMaxWidth || image.height > logoMaxHeight) {
                scale = Math.min(logoMaxWidth / image.width, logoMaxHeight / image.height);
            }

            const imageDims = image.scale(scale);

            page.drawImage(image, {
                x: margin,
                y: y - imageDims.height / 2 - 20,
                width: imageDims.width,
                height: imageDims.height,
            });
            y -= imageDims.height / 2 + 10;
        } catch (imageError) {
            console.error('Failed to embed company logo:', imageError);
            page.drawText('Gagal memuat logo perusahaan.', {
                x: margin,
                y: y - 20,
                size: 10,
                font: helveticaFont,
                color: rgb(1, 0, 0),
            });
            y -= 30;
        }
    } else {
        y -= 20; 
    }

    // Invoice Title
    page.drawText('INVOICE', {
      x: width - margin - helveticaBoldFont.widthOfTextAtSize('INVOICE', 24),
      y: y - 10,
      size: 24,
      font: helveticaBoldFont,
      color: rgb(0.06, 0.09, 0.17),
    });
    
    y -= 50;

    // Company and Invoice Info
    page.drawText(`${companyName}`, { x: margin, y: y, size: 12, font: helveticaBoldFont });
    page.drawText(`Invoice #${invoice_number}`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Invoice #${invoice_number}`, 12), y: y, size: 12, font: helveticaFont });
    y -= 15;
    page.drawText(`Tanggal Pesanan: ${new Date(created_at).toLocaleDateString()}`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Tanggal Pesanan: ${new Date(created_at).toLocaleDateString()}`, 12), y: y, size: 12, font: helveticaFont });
    y -= 15;
    
    // Customer Info
    y -= 30;
    page.drawText('Tagihan Kepada:', { x: margin, y: y, size: 10, font: helveticaBoldFont });
    y -= 15;
    page.drawText(customers.name, { x: margin, y: y, size: 12, font: helveticaFont });
    y -= 15;
    page.drawText(customers.address, { x: margin, y: y, size: 12, font: helveticaFont });
    y -= 15;
    page.drawText(customers.phone, { x: margin, y: y, size: 12, font: helveticaFont });
    y -= 30;

    // --- Table Header ---
    page.drawRectangle({ x: margin, y: y, width: width - 2 * margin, height: 20, color: rgb(0.06, 0.09, 0.17) });
    page.drawText('Item', { x: margin + 5, y: y + 5, size: 12, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    page.drawText('Kuantitas', { x: margin + 200, y: y + 5, size: 12, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    page.drawText('Harga Satuan', { x: margin + 300, y: y + 5, size: 12, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    page.drawText('Total', { x: width - margin - helveticaBoldFont.widthOfTextAtSize('Total', 12) - 5, y: y + 5, size: 12, font: helveticaBoldFont, color: rgb(1, 1, 1) });
    y -= 10;
    
    // --- Table Content ---
    for (const item of order_items) {
        y -= 25;
        const qty = item.qty || 0;
        const price = item.price || 0;
        const itemTotal = qty * price;
        page.drawText(item.products.name, { x: margin + 5, y: y, size: 12, font: helveticaFont });
        page.drawText(`${qty}`, { x: margin + 200, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp${price.toLocaleString('id-ID')}`, { x: margin + 300, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp${itemTotal.toLocaleString('id-ID')}`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Rp${itemTotal.toLocaleString('id-ID')}`, 12) - 5, y: y, size: 12, font: helveticaFont });
    }
    
    // Tambahkan baris untuk biaya transportasi
    if (transport_cost > 0) {
        y -= 25;
        page.drawText('Biaya Transportasi', { x: margin + 5, y: y, size: 12, font: helveticaFont });
        page.drawText('1', { x: margin + 200, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp${transport_cost.toLocaleString('id-ID')}`, { x: margin + 300, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp${transport_cost.toLocaleString('id-ID')}`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Rp${transport_cost.toLocaleString('id-ID')}`, 12) - 5, y: y, size: 12, font: helveticaFont });
    }
    
    // Tambahkan baris untuk pembelian Kemasan Returnable
    const emptyBottlePrice = order_items.find(item => item.products?.is_returnable)?.products?.empty_bottle_price || 0;
    if (purchased_empty_qty > 0) {
        y -= 25;
        page.drawText('Beli Kemasan Returnable', { x: margin + 5, y: y, size: 12, font: helveticaFont });
        page.drawText(`${purchased_empty_qty}`, { x: margin + 200, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp${emptyBottlePrice.toLocaleString('id-ID')}`, { x: margin + 300, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp${(purchased_empty_qty * emptyBottlePrice).toLocaleString('id-ID')}`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Rp${(purchased_empty_qty * emptyBottlePrice).toLocaleString('id-ID')}`, 12) - 5, y: y, size: 12, font: helveticaFont });
    }
    
    // Tambahkan baris untuk galon kembali dan dipinjam
    if (returned_qty > 0) {
        y -= 25;
        page.drawText('Galon Kembali', { x: margin + 5, y: y, size: 12, font: helveticaFont });
        page.drawText(`${returned_qty}`, { x: margin + 200, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp0`, { x: margin + 300, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp0`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Rp0`, 12) - 5, y: y, size: 12, font: helveticaFont });
    }

    if (borrowed_qty > 0) {
        y -= 25;
        page.drawText('Galon Dipinjam', { x: margin + 5, y: y, size: 12, font: helveticaFont });
        page.drawText(`${borrowed_qty}`, { x: margin + 200, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp0`, { x: margin + 300, y: y, size: 12, font: helveticaFont });
        page.drawText(`Rp0`, { x: width - margin - helveticaFont.widthOfTextAtSize(`Rp0`, 12) - 5, y: y, size: 12, font: helveticaFont });
    }
    
    y -= 20;

    // --- Footer Summary ---
    page.drawLine({
        start: { x: margin, y: y },
        end: { x: width - margin, y: y },
        thickness: 1,
        color: rgb(0, 0, 0),
    });
    y -= 20;
    
    const totalText = `TOTAL: Rp${grand_total?.toLocaleString('id-ID') ?? '0'}`;
    page.drawText(totalText, {
        x: width - margin - helveticaBoldFont.widthOfTextAtSize(totalText, 14),
        y: y,
        size: 14,
        font: helveticaBoldFont,
        color: rgb(0.06, 0.09, 0.17),
    });

    // --- Bukti Pengiriman (di bagian bawah) ---
    if (proof_public_url) {
        y -= 40;
        page.drawText('Bukti Pengiriman:', { x: margin, y: y, size: 12, font: helveticaBoldFont, color: rgb(0, 0, 0) });
        y -= 160;

        try {
            const imageBytes = await fetchImage(proof_public_url);
            const urlParts = proof_public_url.split('.');
            const fileExtension = urlParts[urlParts.length - 1].toLowerCase();

            let image;
            if (fileExtension === 'png') {
                image = await pdfDoc.embedPng(imageBytes);
            } else if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
                image = await pdfDoc.embedJpg(imageBytes);
            } else {
                throw new Error('Tipe file bukti pengiriman tidak didukung (hanya PNG dan JPG).');
            }
            
            const imageDims = image.scale(0.2);
            
            page.drawImage(image, {
                x: margin,
                y: y,
                width: imageDims.width,
                height: imageDims.height,
            });
            y -= imageDims.height;
        } catch (imageError) {
            console.error('Failed to embed delivery proof image:', imageError);
            page.drawText(`Gagal memuat gambar bukti pengiriman. Pesan error: ${imageError.message}`, {
                x: margin,
                y: y + 80,
                size: 10,
                font: helveticaFont,
                color: rgb(1, 0, 0),
            });
        }
    }


    const pdfBytes = await pdfDoc.save();
    
    // Cek apakah invoice sudah ada, jika tidak, insert. Jika ada, update.
    const { data: existingInvoice } = await supabase
      .from('invoices')
      .select('id')
      .eq('order_id', order_id)
      .single();

    let invData;
    let invErr;

    if (existingInvoice) {
      ({ data: invData, error: invErr } = await supabase
        .from('invoices')
        .update({
          customer_id: customers.id,
          invoice_number: invoice_number,
          grand_total: grand_total,
          company_id: orderData.company_id
        })
        .eq('id', existingInvoice.id)
        .select()
        .single());
    } else {
      ({ data: invData, error: invErr } = await supabase
        .from('invoices')
        .insert({
          order_id: order_id,
          customer_id: customers.id,
          invoice_number: invoice_number,
          grand_total: grand_total,
          company_id: orderData.company_id
        })
        .select()
        .single());
    }

    if (invErr) throw invErr;

    // Unggah PDF ke Supabase Storage
     const fileName = `invoice-${invData.id}.pdf`;
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