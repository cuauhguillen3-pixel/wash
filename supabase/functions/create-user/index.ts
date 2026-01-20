import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role: string;
  company_id: string | null;
  branch_id: string | null;
  phone: string | null;
  notes: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: adminUser }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !adminUser) {
      throw new Error("Unauthorized");
    }

    const { data: adminProfile, error: profileError } = await supabaseClient
      .from("user_profiles")
      .select("role")
      .eq("id", adminUser.id)
      .maybeSingle();

    if (profileError || !adminProfile) {
      throw new Error("Admin profile not found");
    }

    if (adminProfile.role !== "admin" && adminProfile.role !== "root") {
      throw new Error("Insufficient permissions");
    }

    const requestData: CreateUserRequest = await req.json();

    const { data: authData, error: createError } = await supabaseClient.auth.admin.createUser({
      email: requestData.email,
      password: requestData.password,
      email_confirm: true,
    });

    if (createError) {
      throw createError;
    }

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    const { error: profileInsertError } = await supabaseClient
      .from("user_profiles")
      .insert({
        id: authData.user.id,
        email: requestData.email,
        full_name: requestData.full_name,
        role: requestData.role,
        company_id: requestData.company_id,
        branch_id: requestData.branch_id,
        phone: requestData.phone,
        notes: requestData.notes,
      });

    if (profileInsertError) {
      await supabaseClient.auth.admin.deleteUser(authData.user.id);
      throw profileInsertError;
    }

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Error creating user" }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
