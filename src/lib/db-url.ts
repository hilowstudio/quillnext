/**
 * Database connection-string helpers shared by the app runtime (`src/server/db.ts`) and the
 * seed scripts (`prisma/seed*.ts`).
 *
 * Supabase's pooler/direct certificates are signed by a Supabase CA that isn't in Node's default
 * trust store, so the pg driver must connect with `ssl: { rejectUnauthorized: false }`. A `sslmode=`
 * param in the connection string (the Vercel↔Supabase integration adds `sslmode=require`) overrides
 * that option and re-enables verification → "Error opening a TLS connection: self-signed certificate
 * in certificate chain". Stripping `sslmode`/`ssl` from the URL leaves the explicit ssl option as the
 * sole authority; SSL itself stays ON because that option is truthy.
 */
export function withoutSslParams(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("ssl");
    return u.toString();
  } catch {
    return url; // not a parseable URL — leave it untouched
  }
}
