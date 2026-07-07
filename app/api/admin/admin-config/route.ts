import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

async function getUserFromToken(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user } } = await userClient.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const user = await getUserFromToken(token);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await adminClient
    .from("admin_config")
    .select("*")
    .order("created_at");

  if (error) {
    console.error("admin/admin-config GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const user = await getUserFromToken(token);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  if (email === user.email) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await adminClient
    .from("admin_config")
    .delete()
    .eq("email", email);

  if (error) {
    console.error("admin/admin-config DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
