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

/**
 * Swap ONLY the role + password on a connection URL, preserving the host, port, database, and every
 * query param verbatim.
 *
 * For the RLS cutover the app must connect as the non-bypass `app_user` role instead of the
 * `postgres` superuser that the Vercel↔Supabase integration provisions in `POSTGRES_URL`. Hand-
 * building a whole `app_user` URL is error-prone — it loses the integration's exact pooler host and
 * routing params (e.g. `supa=base-pooler.x`) and silently breaks the connection. Deriving from the
 * known-good integration URL and changing only the credentials keeps everything else correct.
 *
 * Done with deliberate string surgery (not `new URL`) so the host/port/path/query bytes are never
 * re-encoded. The Supabase pooler username carries a `.<project_ref>` tenant suffix; we keep it.
 * Returns the URL unchanged when no password is supplied (so a misconfig fails safe, not silently).
 */
export function withRole(
  url: string | undefined,
  role: string,
  password: string | undefined,
): string | undefined {
  if (!url || !password) return url;
  const schemeEnd = url.indexOf("://");
  const at = url.lastIndexOf("@"); // last @ = userinfo/host delimiter (encoded pw @ are %40)
  if (schemeEnd < 0 || at < 0 || at < schemeEnd) return url;
  const scheme = url.slice(0, schemeEnd + 3);
  const userinfo = url.slice(schemeEnd + 3, at);
  const hostAndRest = url.slice(at + 1);
  const user = userinfo.split(":")[0]; // strip the old password
  const dot = user.indexOf("."); // keep the `.<project_ref>` pooler tenant suffix if present
  const newUser = dot >= 0 ? `${role}${user.slice(dot)}` : role;
  return `${scheme}${newUser}:${encodeURIComponent(password)}@${hostAndRest}`;
}
