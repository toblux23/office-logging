import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

  // Check that the caller is an existing admin
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: existingAdmin } = await adminClient
    .from("admin_config")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!existingAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, password } = await request.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: "Email and password (min 6 chars) required." }, { status: 400 });
  }

  // Create the user in Supabase Auth
  const { error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Add to admin_config
  const { error: insertError } = await adminClient
    .from("admin_config")
    .insert({ email });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
