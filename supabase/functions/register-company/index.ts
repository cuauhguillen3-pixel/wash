import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CompanyRegistrationRequest {
  companyData: {
    name: string;
    legal_name?: string;
    tax_id: string;
    address: string;
    phone: string;
    email: string;
  };
  adminData: {
    full_name: string;
    email: string;
    phone: string;
    password: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { companyData, adminData }: CompanyRegistrationRequest = await req.json();

    // Validate required fields
    if (!companyData?.name || !companyData?.tax_id || !companyData?.address || 
        !companyData?.phone || !companyData?.email) {
      return new Response(
        JSON.stringify({ error: 'Missing required company fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!adminData?.full_name || !adminData?.email || !adminData?.phone || !adminData?.password) {
      return new Response(
        JSON.stringify({ error: 'Missing required admin fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service role key for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'register-company-function',
          },
        },
      }
    );

    // Calculate trial end date (30 days from now)
    const startDate = new Date();
    const trialEndDate = new Date();
    trialEndDate.setDate(startDate.getDate() + 30);

    // Step 1: Create the company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyData.name,
        legal_name: companyData.legal_name || null,
        tax_id: companyData.tax_id,
        address: companyData.address,
        phone: companyData.phone,
        email: companyData.email,
        is_active: true,
        subscription_type: 'mensual',
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: trialEndDate.toISOString(),
        subscription_status: 'trialing',
        auto_deactivate: true,
      })
      .select()
      .single();

    if (companyError) {
      console.error('Error creating company:', companyError);
      return new Response(
        JSON.stringify({ error: 'Failed to create company', details: companyError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Create the admin user in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminData.email,
      password: adminData.password,
      email_confirm: true,
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      // Rollback: delete the company
      await supabaseAdmin.from('companies').delete().eq('id', company.id);
      
      return new Response(
        JSON.stringify({ error: 'Failed to create admin user', details: authError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 3: Create the user profile
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: authUser.user.id,
        email: adminData.email,
        full_name: adminData.full_name,
        phone: adminData.phone,
        role: 'admin',
        company_id: company.id,
        is_active: true,
      })
      .select();

    if (profileError) {
      console.error('Error creating user profile:', profileError);
      console.error('Profile error details:', JSON.stringify(profileError, null, 2));
      console.error('Attempted to insert:', {
        id: authUser.user.id,
        email: adminData.email,
        full_name: adminData.full_name,
        phone: adminData.phone,
        role: 'admin',
        company_id: company.id,
        is_active: true,
      });

      // Rollback: delete auth user and company
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from('companies').delete().eq('id', company.id);

      return new Response(
        JSON.stringify({
          error: 'Failed to create user profile',
          details: profileError.message,
          code: profileError.code,
          hint: profileError.hint
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Company and admin user created successfully',
        data: {
          company: {
            id: company.id,
            name: company.name,
          },
          admin: {
            email: adminData.email,
            full_name: adminData.full_name,
          },
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
