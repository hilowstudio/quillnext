import { z } from "zod";

/** A 4-digit profile PIN. Shared by onboarding capture + per-profile PIN management. */
export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");
