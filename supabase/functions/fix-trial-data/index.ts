
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import Stripe from 'npm:stripe@^14.14.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
    });

    // 1. Fetch companies that need fixing
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*') // Select all fields to debug

    if (fetchError) throw fetchError

    // 2. Fetch users
    const { data: users, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
    
    if (userError) throw userError

    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const updates = []
    let updatedCount = 0

    for (const company of companies) {
      let needsUpdate = false
      const updatesForCompany: any = {}
      let syncStatus = 'no-sync-needed';

      // SYNC WITH STRIPE
      if (company.stripe_customer_id) {
         try {
            const subscriptions = await stripe.subscriptions.list({
                customer: company.stripe_customer_id,
                status: 'active',
                limit: 1
            });

            if (subscriptions.data.length > 0) {
                const sub = subscriptions.data[0];
                // Check if we need to update
                if (company.subscription_status !== 'active' || company.stripe_subscription_id !== sub.id) {
                    updatesForCompany.stripe_subscription_id = sub.id;
                    updatesForCompany.subscription_status = 'active';
                    updatesForCompany.subscription_type = 'mensual'; 
                    updatesForCompany.subscription_start_date = new Date(sub.current_period_start * 1000).toISOString();
                    updatesForCompany.subscription_end_date = new Date(sub.current_period_end * 1000).toISOString();
                    needsUpdate = true;
                    syncStatus = 'synced-with-stripe';
                }
            }
         } catch (e) {
             console.error(`Error syncing with Stripe for company ${company.id}:`, e);
             syncStatus = 'error-syncing-stripe';
         }
      }

      // Case 1: No status (only if not synced)
      if (!company.subscription_status && !updatesForCompany.subscription_status) {
        updatesForCompany.subscription_status = 'trialing'
        needsUpdate = true
      }

      // Case 2: Trialing but invalid date (only if not synced and still trialing)
      const currentStatus = updatesForCompany.subscription_status || company.subscription_status;
      if (currentStatus === 'trialing') {
        const endDate = company.subscription_end_date ? new Date(company.subscription_end_date) : null
        
        if (!endDate || endDate < now) {
          updatesForCompany.subscription_end_date = thirtyDaysLater
          needsUpdate = true
        }
      }

      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('companies')
          .update(updatesForCompany)
          .eq('id', company.id)
        
        if (updateError) {
          console.error(`Error updating company ${company.id}:`, updateError)
        } else {
          updatedCount++
          updates.push({
              company: company.name,
              id: company.id,
              changes: updatesForCompany,
              syncStatus
          })
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        version: "v4-stripe-sync",
        message: `Processed ${companies.length} companies. Updated ${updatedCount}.`,
        updates: updates,
        companies: companies, // Return old state
        users: users
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
