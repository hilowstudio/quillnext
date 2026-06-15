
'use server';

import fs from 'fs/promises';
import path from 'path';
import { fetchUnreachedOfTheDay } from '@/lib/joshua-project';
import { db } from '@/server/db';

// --- Types ---

export interface OperationWorldStats {
    metadata: {
        totalCountries: number;
        scrapedAt: string;
        source: string;
    };
    countries: Array<{
        country: string;
        url: string;
        data: Record<string, unknown>;
    }>;
}

export interface CountyData {
    State: string;
    County: string;
    // We can add more specific fields from the JSON as needed, but for now we'll be flexible
    [key: string]: unknown;
}

// --- Actions ---

export async function getUnreachedOfTheDayAction() {
    return await fetchUnreachedOfTheDay();
}

/**
 * Reads the Operation World stats from the JSON file.
 * This file is relatively small (~175KB), so we can read it fully.
 */
export async function getOperationWorldStats(): Promise<OperationWorldStats | null> {
    try {
        const filePath = path.join(process.cwd(), 'src', 'server', 'data', 'mission-stats.json');
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        return data;
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
export async function getCountiesForState(stateName: string): Promise<CountyData[]> {
    try {
        const rows = await db.county.findMany({
            where: { state: stateName },
            orderBy: { county: 'asc' },
            select: { data: true },
        });
        // `data` holds the full original county record.
        return rows.map((r) => r.data as unknown as CountyData);
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
