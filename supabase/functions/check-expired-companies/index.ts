import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Buscar empresas que deben ser desactivadas
    const { data: expiredCompanies, error: fetchError } = await supabaseAdmin
      .from('companies')
      .select('id, name, subscription_end_date')
      .eq('is_active', true)
      .eq('auto_deactivate', true)
      .neq('subscription_type', 'indeterminado')
      .not('subscription_end_date', 'is', null)
      .lt('subscription_end_date', new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!expiredCompanies || expiredCompanies.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay empresas expiradas para desactivar',
          deactivated: [],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Desactivar cada empresa expirada
    const deactivatedCompanies = [];
    for (const company of expiredCompanies) {
      const { error: updateError } = await supabaseAdmin
        .from('companies')
        .update({
          is_active: false,
          deactivation_reason: 'Suscripción expirada',
          deactivated_at: new Date().toISOString(),
        })
        .eq('id', company.id);

      if (!updateError) {
        deactivatedCompanies.push({
          id: company.id,
          name: company.name,
          expired_date: company.subscription_end_date,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${deactivatedCompanies.length} empresas desactivadas por expiración`,
        deactivated: deactivatedCompanies,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error('Error en check-expired-companies:', error);
    return new Response(
      JSON.stringify({ error: error.message || "Error verificando empresas expiradas" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
