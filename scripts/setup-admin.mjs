#!/usr/bin/env node

/**
 * One-time admin setup script.
 *
 * Run ONCE after deploying the app and running supabase-setup.sql:
 *
 *   node scripts/setup-admin.mjs
 *
 * Requires these environment variables (set in .env.local or Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL   – your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY  – Supabase service_role key (secret, never client-side)
 *   ADMIN_EMAIL                – the single admin email
 *   ADMIN_PASSWORD             – the admin password
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Missing required environment variables.");
  console.error("  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

async function main() {
  // 1. Create the admin user in Supabase Auth
  console.log(`Creating admin user: ${ADMIN_EMAIL} ...`);
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    }),
  });

  if (!authRes.ok) {
    const body = await authRes.json();
    if (body.code === 422 && body.msg?.includes("already exists")) {
      console.log("  Admin user already exists — skipping creation.");
    } else {
      console.error("  Failed to create admin user:", body.msg || body);
      process.exit(1);
    }
  } else {
    console.log("  Admin user created successfully.");
  }

  // 2. Insert the admin email into admin_config
  console.log("  Inserting admin_config ...");
  const configRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_config`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: ADMIN_EMAIL,
    }),
  });

  if (!configRes.ok) {
    const body = await configRes.text();
    if (configRes.status === 409) {
      console.log("  Admin email already in admin_config — skipping.");
    } else {
      console.error("  Failed to insert admin_config:", body);
      process.exit(1);
    }
  } else {
    console.log("  admin_config inserted successfully.");
  }
  console.log("\n✓ Admin setup complete.");
  console.log(`  Sign in at /login with: ${ADMIN_EMAIL}`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
