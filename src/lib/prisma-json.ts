import { Prisma } from "@/generated/client";

/**
 * Persist a closed-interface domain value into a Prisma `Json` column.
 *
 * Use ONLY when the value is verified JSON-safe at runtime — string / number /
 * boolean / plain object / array all the way down, with NO `Date`, `undefined`-valued
 * properties, `Map`/`Set`, class instances, or methods. Prisma runs `JSON.stringify`
 * over the value on write, so anything else would silently mutate (e.g. a `Date` →
 * ISO string) or be dropped. If a column can carry non-serializable values, convert
 * it for real (a Zod schema / explicit mapper), don't reach for this. If the resolved
 * type is nullable at the top level, coalesce with `?? Prisma.JsonNull` FIRST — the
 * `InputJsonValue` union does not include `null`, and that (not the closed interface)
 * is often the real cause of a TS2352.
 *
 * Why the two-step and not `as unknown as`: a fixed-property interface has no index
 * signature, so it satisfies neither direction of TS's `as` overlap check against the
 * `InputJsonValue` union (TS2352). Routing through `InputJsonObject` is a claim TS can
 * still partially check, which keeps a tripwire — the day a caller's value stops being
 * object-shaped the first cast breaks, whereas `as unknown as` would sail through to any
 * unrelated type with no error.
 */
export function toJsonInput<T extends object>(value: T): Prisma.InputJsonValue {
  return value as Prisma.InputJsonObject as Prisma.InputJsonValue;
}
