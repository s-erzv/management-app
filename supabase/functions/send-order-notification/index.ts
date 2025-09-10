import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

function createEmailBody(order: any) {
  const customerName = order.customers?.name ?? 'Pelanggan Baru';
  const items = (order.order_items ?? [])
    .map((i: any) => `- ${i.products?.name ?? 'Item'}: ${i.qty} pcs`)
    .join('\n');
  const totalAmount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })
    .format(order.grand_total ?? 0);
  const plannedDate = order.planned_date ? new Date(order.planned_date).toLocaleDateString('id-ID') : '-';

  return `Halo Admin,

Ada pesanan baru yang masuk. Berikut detailnya:

* Nomor Invoice: #${order.invoice_number}
* Pelanggan: ${customerName}
* Tanggal Pengiriman: ${plannedDate}
* Total Harga: ${totalAmount}
* Item Pesanan:
${items}

Silakan cek dashboard untuk detail lebih lanjut.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const secret = req.headers.get('x-webhook-secret')
    if (Deno.env.get('WEBHOOK_SECRET') && secret !== Deno.env.get('WEBHOOK_SECRET')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { record: newOrder } = await req.json()
    if (!newOrder?.id) {
      return new Response(JSON.stringify({ error: 'Missing order id in payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: orderDetails, error: fetchOrderError } = await supabase
      .from('orders')
      .select(`
        id, invoice_number, grand_total, planned_date, company_id,
        customers(name),
        order_items(qty, products(name))
      `)
      .eq('id', newOrder.id)
      .single()

    if (fetchOrderError) throw new Error(`fetchOrderError: ${fetchOrderError.message}`)

    const { data: adminProfile, error: fetchAdminError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', orderDetails.company_id)
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (fetchAdminError) throw new Error(`fetchAdminError: ${fetchAdminError.message}`)
    if (!adminProfile?.id) throw new Error('Admin profile missing id')

    const { data: userRes, error: adminGetUserErr } = await supabase.auth.admin.getUserById(adminProfile.id)
    if (adminGetUserErr) throw new Error(`auth.admin.getUserById error: ${adminGetUserErr.message}`)

    const adminEmail = userRes?.user?.email
    if (!adminEmail) throw new Error('Admin email not found in auth.users')

    // === Kirim email via Gmail SMTP ===
    const client = new SmtpClient()
    await client.connect({
      hostname: "smtp.gmail.com",
      port: 587,
      username: Deno.env.get("SMTP_USER") ?? "",
      password: Deno.env.get("SMTP_PASS") ?? "",
    })

    const fromEmail = Deno.env.get("SMTP_FROM") ?? ""
    const emailBody = createEmailBody(orderDetails)

    await client.send({
      from: fromEmail,
      to: adminEmail,
      subject: "Pesanan Baru Diterima",
      content: emailBody,
    })

    await client.close()

    return new Response(JSON.stringify({ message: 'Notification sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error('Error sending order notification:', error)
    return new Response(JSON.stringify({ error: String(error?.message || error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
