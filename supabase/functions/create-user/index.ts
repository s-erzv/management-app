// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, role, companyName, companyId } = await req.json()
    
    // Inisialisasi Supabase dengan service_role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validasi input
    if (!email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    let profile_company_id = null;

    // Jika membuat admin, buat perusahaan baru
    if (role === 'admin') {
      if (!companyName) {
         return new Response(JSON.stringify({ error: 'Company name is required for admin role' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
      }
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .insert([{ name: companyName }])
        .select()
        .single()
      
      if (companyError) throw companyError;
      profile_company_id = companyData.id;

    } else if (role === 'user') {
      // Jika membuat user, gunakan companyId yang diberikan
      profile_company_id = companyId;
    }

    // Buat pengguna di auth.users dengan email terkonfirmasi
    const { data: { user }, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (userError) throw userError;

    // Buat atau perbarui profil pengguna di tabel public.profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, role, company_id: profile_company_id, full_name: null },
        { onConflict: 'id' }
      )
    
    if (profileError) throw profileError;

    return new Response(JSON.stringify({ message: 'User created successfully', userId: user.id, companyId: profile_company_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})