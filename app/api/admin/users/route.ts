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

function getClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return {
    admin: createClient(supabaseUrl, serviceRoleKey),
  };
}

async function authenticate(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return getUserFromToken(authHeader.slice(7));
}

export async function GET(request: NextRequest) {
  const user = await authenticate(request);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = getClients();
  if (!clients) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data, error } = await clients.admin
    .from("users")
    .select("*")
    .in("role", ["staff", "intern"])
    .order("name");

  if (error) {
    console.error("admin/users GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const user = await authenticate(request);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = getClients();
  if (!clients) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { name, role } = await request.json();
  if (!name || !role) {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }

  if (!["staff", "intern"].includes(role)) {
    return NextResponse.json({ error: "role must be staff or intern" }, { status: 400 });
  }

  const { data: existing } = await clients.admin
    .from("users")
    .select("name")
    .ilike("name", name.trim())
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `User "${name.trim()}" already exists. Edit them instead.` }, { status: 409 });
  }

  const { data, error } = await clients.admin
    .from("users")
    .insert({ name: name.trim(), role, state: "out_of_office", updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error("admin/users POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const user = await authenticate(request);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = getClients();
  if (!clients) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { name, newName, newRole } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const trimmedName = name.trim();

  const { data: found } = await clients.admin
    .from("users")
    .select("name, role, state, updated_at")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (!found) {
    return NextResponse.json({ error: `User "${trimmedName}" not found.` }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (newName) {
    const trimmedNew = newName.trim();
    if (trimmedNew.toLowerCase() === trimmedName.toLowerCase()) {
      return NextResponse.json({ error: "New name is the same as the current name." }, { status: 400 });
    }

    const { data: nameTaken } = await clients.admin
      .from("users")
      .select("name")
      .ilike("name", trimmedNew)
      .maybeSingle();

    if (nameTaken) {
      return NextResponse.json({ error: `User "${trimmedNew}" already exists.` }, { status: 409 });
    }

    updates.name = trimmedNew;
  }

  if (newRole) {
    if (!["staff", "intern"].includes(newRole)) {
      return NextResponse.json({ error: "role must be staff or intern" }, { status: 400 });
    }
    updates.role = newRole;
  }

  const { data, error } = await clients.admin
    .from("users")
    .update(updates)
    .eq("name", found.name)
    .select()
    .single();

  if (error) {
    console.error("admin/users PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const user = await authenticate(request);
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clients = getClients();
  if (!clients) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { name } = await request.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const trimmedName = name.trim();

  const { data: toDelete } = await clients.admin
    .from("users")
    .select("name")
    .ilike("name", trimmedName)
    .maybeSingle();

  if (!toDelete) {
    return NextResponse.json({ error: `User "${trimmedName}" not found.` }, { status: 404 });
  }

  const { error } = await clients.admin
    .from("users")
    .delete()
    .eq("name", toDelete.name);

  if (error) {
    console.error("admin/users DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
