import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@^14.14.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2023-10-16',
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  let event;
  try {
    if (webhookSecret) {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature!,
        webhookSecret,
        undefined,
        cryptoProvider
      );
    } else {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set, skipping signature verification');
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(err.message, { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  console.log(`🔔 Event received: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const companyId = session.metadata?.company_id;
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        if (companyId) {
           // Get subscription details to get the end date
           const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
           
           await supabaseAdmin
            .from('companies')
            .update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              subscription_status: 'active',
              subscription_type: 'mensual',
              subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
              subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('id', companyId);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        const customerId = invoice.customer;

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
          
          // Try to find company by subscription ID first
          const { data: companyBySub } = await supabaseAdmin
            .from('companies')
            .select('id')
            .eq('stripe_subscription_id', subscriptionId)
            .maybeSingle();

          if (companyBySub) {
             console.log(`Updating subscription for company ${companyBySub.id} via subscription_id`);
             await supabaseAdmin
              .from('companies')
              .update({
                subscription_status: 'active',
                subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
              })
              .eq('id', companyBySub.id);
          } else {
             // Fallback to customer ID
             console.log(`Company not found by subscription_id ${subscriptionId}, trying customer_id ${customerId}`);
             
             // Check if we can find by customer_id
             const { data: companyByCust } = await supabaseAdmin
                .from('companies')
                .select('id')
                .eq('stripe_customer_id', customerId)
                .maybeSingle();

             if (companyByCust) {
                 console.log(`Found company ${companyByCust.id} by customer_id. Updating subscription info.`);
                 await supabaseAdmin
                  .from('companies')
                  .update({
                    subscription_status: 'active',
                    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
                    stripe_subscription_id: subscriptionId, // Save the subscription ID for future
                  })
                  .eq('id', companyByCust.id);
             } else {
                 console.error(`Could not find company for subscription ${subscriptionId} or customer ${customerId}`);
             }
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await supabaseAdmin
          .from('companies')
          .update({
            subscription_status: 'canceled',
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await supabaseAdmin
          .from('companies')
          .update({
            subscription_status: subscription.status,
            subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error(`Error processing webhook: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
