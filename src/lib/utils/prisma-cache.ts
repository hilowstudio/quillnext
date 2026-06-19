/**
 * Query caching utility — a thin wrapper over Next.js `unstable_cache`.
 */
import { unstable_cache } from "next/cache";

/**
 * Wrapper for Next.js unstable_cache. Use this for arbitrary async operations.
 */
export function cacheQuery<T, Args extends any[]>(
  fn: (...args: Args) => Promise<T>,
  keyParts: string[],
  options: { revalidate?: number; tags?: string[] } = {}
) {
  return unstable_cache(fn, keyParts, options);
}
