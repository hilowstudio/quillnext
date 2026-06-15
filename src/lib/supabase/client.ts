import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client — a data layer ALONGSIDE Prisma.
 *
 * Auth in this app is handled by NextAuth (Google), NOT Supabase Auth, so this
 * client does not manage sessions. It uses the publishable key, which means all
 * access is governed by Postgres Row Level Security (RLS). NOTE: RLS is not yet
 * configured on this project — until it is, anything reachable via PostgREST is
 * effectively public. Do not use this client for sensitive reads/writes until
 * RLS policies exist.
 */
export const createClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
