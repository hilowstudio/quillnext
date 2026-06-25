
'use server';

import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { auth } from '@/auth';
import { fetchUnreachedOfTheDay } from '@/lib/joshua-project';
import { db } from '@/server/db';

// Q-20-001: these read GLOBAL reference content (no org filter needed), but require a session so the
// actions are self-gating (defense-in-depth on top of the proxy, per src/proxy.ts's "backstop NOT a
// replacement"), closing the unauthenticated-invocation / JP-quota surface.
async function requireSession() {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");
}

// --- Types ---

// Lenient READ schema for the on-disk Operation World stats JSON (an unvalidated file). Validating it
// here lets the consumers (MissionsClient / WorldMap / CountryInfoCard) work off a real typed shape
// instead of asserting one. Each `data` field is an optional string that `.catch`es a stray non-string
// to undefined (the cards render every field as `… || 'N/A'`); unknown extra keys pass through.
const owOptionalString = z.string().optional().catch(undefined);
const countryDataSchema = z.object({
    capital: owOptionalString,
    population: owOptionalString,
    continent: owOptionalString,
    _urban: owOptionalString,
    population_under_15_yrs: owOptionalString,
    life_expectancy: owOptionalString,
    official_language: owOptionalString,
    languages: owOptionalString,
    literacy_rate: owOptionalString,
    largest_religion: owOptionalString,
    _largest_religion: owOptionalString,
    _christian: owOptionalString,
    _evangelical: owOptionalString,
    people_groups: owOptionalString,
    least_reached_people_groups: owOptionalString,
    _unevangelized: owOptionalString,
    hdi_ranking: owOptionalString,
    persecution_ranking: owOptionalString,
}).catchall(z.unknown());
export type CountryData = z.infer<typeof countryDataSchema>;

const owCountrySchema = z.object({
    country: z.string(),
    url: z.string(),
    data: countryDataSchema,
});
export type OperationWorldCountry = z.infer<typeof owCountrySchema>;

const operationWorldStatsSchema = z.object({
    metadata: z.object({
        totalCountries: z.number(),
        scrapedAt: z.string(),
        source: z.string(),
    }),
    countries: z.array(owCountrySchema),
});
export type OperationWorldStats = z.infer<typeof operationWorldStatsSchema>;

// --- Actions ---

export async function getUnreachedOfTheDayAction() {
    await requireSession();
    return await fetchUnreachedOfTheDay();
}

/**
 * Reads the Operation World stats from the JSON file.
 * This file is relatively small (~175KB), so we can read it fully.
 */
export async function getOperationWorldStats(): Promise<OperationWorldStats | null> {
    try {
        await requireSession();
        const filePath = path.join(process.cwd(), 'src', 'server', 'data', 'mission-stats.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const parsed = operationWorldStatsSchema.safeParse(JSON.parse(fileContent));
        if (!parsed.success) {
            console.error('Operation World stats failed validation:', parsed.error);
            return null;
        }
        return parsed.data;
    } catch (error) {
        console.error('Error reading Operation World stats:', error);
        return null;
    }
}

/**
 * Gets counties for a specific state from the `counties` table.
 * (Previously read+parsed the full 29MB counties_list.json on every request;
 * now a single indexed query. Seeded via prisma/seed-counties.ts.)
 */
export async function getCountiesForState(stateName: string): Promise<unknown[]> {
    try {
        await requireSession();
        const rows = await db.county.findMany({
            where: { state: stateName },
            orderBy: { county: 'asc' },
            select: { data: true },
        });
        // `data` is an unvalidated Prisma Json column holding the full original county record.
        // Return it raw (unknown) and let the consumer validate the rich shape at its boundary
        // (CountyIssuesLookup's `countySchema`) — no unchecked `as CountyData` assertion here.
        return rows.map((r) => r.data);
    } catch (error) {
        console.error('Error querying counties for state:', error);
        return [];
    }
}

/**
 * Gets the list of unique states from the `counties` table.
 */
export async function getAllStates(): Promise<string[]> {
    try {
        await requireSession();
        const rows = await db.county.findMany({
            distinct: ['state'],
            select: { state: true },
            orderBy: { state: 'asc' },
        });
        return rows.map((r) => r.state);
    } catch (error) {
        console.error('Error querying states:', error);
        return [];
    }
}
