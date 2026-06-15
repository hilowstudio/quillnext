import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client — a data layer ALONGSIDE Prisma (use Prisma for
 * primary relational access; reach for this for Supabase-native features such as
 * Storage or Realtime).
 *
 * Auth remains NextAuth (Google), so we disable session persistence/refresh.
 * Prefers SUPABASE_SERVICE_ROLE_KEY (full access, bypasses RLS) when present;
 * otherwise falls back to the publishable key (RLS-governed). Only ever import
 * this from server code — never ship the service-role key to the browser.
 */
export const createServerSupabaseClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
