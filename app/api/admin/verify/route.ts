import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  // Verify the caller's identity using their auth token
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin_config using service_role key (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminConfig, error: queryError } = await adminClient
    .from("admin_config")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (queryError) {
    console.error("admin/verify query error:", queryError);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  return NextResponse.json({ isAdmin: !!adminConfig, email: user.email });
}
