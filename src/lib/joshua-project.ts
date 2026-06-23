
const JOSHUA_PROJECT_API_KEY = process.env.JOSHUA_PROJECT_API_KEY;
const JOSHUA_PROJECT_BASE_URL = 'https://api.joshuaproject.net';

export interface UnreachedPeopleGroup {
    id: string;
    name: string;
    country: string;
    continent: string;
    region: string;
    population: number;
    primaryLanguage: string;
    primaryReligion: string;
    percentEvangelical: number;
    jpScale: number;
    jpScaleText: string;
    leastReached: boolean;
    hasJesusFilm: boolean;
    hasAudioRecordings: boolean;
    bibleStatus: string;
    summary: string;
    photoUrl: string;
    mapUrl: string;
    profileUrl: string;
    countryUrl: string;
    longitude: number;
    latitude: number;
    locationInCountry: string;
    affinityBloc: string;
    peopleCluster: string;
    percentChristian: number;
    securityLevel: number;
    frontier: boolean;
    window1040: boolean;
}

export async function fetchUnreachedOfTheDay(): Promise<UnreachedPeopleGroup | null> {
    try {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        const response = await fetch(
            `${JOSHUA_PROJECT_BASE_URL}/v1/people_groups/daily_unreached.json?api_key=${JOSHUA_PROJECT_API_KEY}&month=${month}&day=${day}`
        );

        if (!response.ok) {
            throw new Error(`Joshua Project API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            return null;
        }

        const peopleGroup = data[0];

        return {
            id: peopleGroup.PeopleID3,
            name: peopleGroup.PeopNameInCountry,
            country: peopleGroup.Ctry,
            continent: peopleGroup.Continent,
            region: peopleGroup.RegionName,
            population: peopleGroup.Population,
            primaryLanguage: peopleGroup.PrimaryLanguageName,
            primaryReligion: peopleGroup.PrimaryReligion,
            percentEvangelical: peopleGroup.PercentEvangelical,
            jpScale: peopleGroup.JPScale,
            jpScaleText: peopleGroup.JPScaleText,
            leastReached: peopleGroup.LeastReached === 'Y',
            hasJesusFilm: peopleGroup.HasJesusFilm === 'Y',
            hasAudioRecordings: peopleGroup.HasAudioRecordings === 'Y',
            bibleStatus: peopleGroup.BibleStatus,
            summary: peopleGroup.Summary,
            photoUrl: peopleGroup.PeopleGroupPhotoURL,
            mapUrl: peopleGroup.PeopleGroupMapURL,
            profileUrl: peopleGroup.PeopleGroupURL,
            countryUrl: peopleGroup.CountryURL,
            longitude: peopleGroup.Longitude,
            latitude: peopleGroup.Latitude,
            locationInCountry: peopleGroup.LocationInCountry,
            affinityBloc: peopleGroup.AffinityBloc,
            peopleCluster: peopleGroup.PeopleCluster,
            percentChristian: peopleGroup.PercentAdherents,
            securityLevel: peopleGroup.SecurityLevel,
            frontier: peopleGroup.Frontier === 'Y',
            window1040: peopleGroup.Window1040 === 'Y'
        };
    } catch (error) {
        console.error('Error fetching unreached people group:', error);
        return null;
    }
}

// (fetchUnreachedByCountry removed 2026-06-22 — dead code, Q-20-005.)
