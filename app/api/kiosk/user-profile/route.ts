import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const name = request.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name query param is required" }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: user } = await admin
    .from("users")
    .select("name, role, state")
    .eq("name", name)
    .maybeSingle();

  if (user) {
    return NextResponse.json(user);
  }

  const { data: log } = await admin
    .from("logs")
    .select("name, role, state")
    .eq("name", name)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (log) {
    return NextResponse.json(log);
  }

  return NextResponse.json(null);
}
