// Country name mapping utility for Operation World data
// Maps GeoJSON country identifiers to Operation World country names

import type { OperationWorldCountry } from '../actions';

const COUNTRY_MAPPING: Record<string, string> = {
    // ISO codes to Operation World names
    'AFG': 'Afghanistan',
    'ALB': 'Albania',
    'DZA': 'Algeria',
    'AND': 'Andorra',
    'AGO': 'Angola',
    'ATG': 'Antigua and Barbuda',
    'ARG': 'Argentina',
    'ARM': 'Armenia',
    'AUS': 'Australia',
    'AUT': 'Austria',
    'AZE': 'Azerbaijan',
    'BHS': 'Bahamas',
    'BHR': 'Bahrain',
    'BGD': 'Bangladesh',
    'BRB': 'Barbados',
    'BLR': 'Belarus',
    'BEL': 'Belgium',
    'BLZ': 'Belize',
    'BEN': 'Benin',
    'BTN': 'Bhutan',
    'BOL': 'Bolivia',
    'BIH': 'Bosnia and Herzegovina',
    'BWA': 'Botswana',
    'BRA': 'Brazil',
    'BRN': 'Brunei',
    'BGR': 'Bulgaria',
    'BFA': 'Burkina Faso',
    'BDI': 'Burundi',
    'KHM': 'Cambodia',
    'CMR': 'Cameroon',
    'CAN': 'Canada',
    'CPV': 'Cape Verde',
    'CAF': 'Central African Republic',
    'TCD': 'Chad',
    'CHL': 'Chile',
    'CHN': 'China',
    'COL': 'Colombia',
    'COM': 'Comoros',
    'COG': 'Congo',
    'COD': 'Democratic Republic of the Congo',
    'CRI': 'Costa Rica',
    'CIV': 'Côte d\'Ivoire',
    'HRV': 'Croatia',
    'CUB': 'Cuba',
    'CYP': 'Cyprus',
    'CZE': 'Czech Republic',
    'DNK': 'Denmark',
    'DJI': 'Djibouti',
    'DMA': 'Dominica',
    'DOM': 'Dominican Republic',
    'ECU': 'Ecuador',
    'EGY': 'Egypt',
    'SLV': 'El Salvador',
    'GNQ': 'Equatorial Guinea',
    'ERI': 'Eritrea',
    'EST': 'Estonia',
    'ETH': 'Ethiopia',
    'FJI': 'Fiji',
    'FIN': 'Finland',
    'FRA': 'France',
    'GAB': 'Gabon',
    'GMB': 'Gambia, The',
    'GEO': 'Georgia',
    'DEU': 'Germany',
    'GHA': 'Ghana',
    'GRC': 'Greece',
    'GRD': 'Grenada',
    'GTM': 'Guatemala',
    'GIN': 'Guinea',
    'GNB': 'Guinea-Bissau',
    'GUY': 'Guyana',
    'HTI': 'Haiti',
    'HND': 'Honduras',
    'HUN': 'Hungary',
    'ISL': 'Iceland',
    'IND': 'India',
    'IDN': 'Indonesia',
    'IRN': 'Iran',
    'IRQ': 'Iraq',
    'IRL': 'Ireland',
    'ISR': 'Israel',
    'ITA': 'Italy',
    'JAM': 'Jamaica',
    'JPN': 'Japan',
    'JOR': 'Jordan',
    'KAZ': 'Kazakhstan',
    'KEN': 'Kenya',
    'KIR': 'Kiribati',
    'PRK': 'North Korea',
    'KOR': 'South Korea',
    'KWT': 'Kuwait',
    'KGZ': 'Kyrgyzstan',
    'LAO': 'Laos',
    'LVA': 'Latvia',
    'LBN': 'Lebanon',
    'LSO': 'Lesotho',
    'LBR': 'Liberia',
    'LBY': 'Libya',
    'LIE': 'Liechtenstein',
    'LTU': 'Lithuania',
    'LUX': 'Luxembourg',
    'MKD': 'North Macedonia',
    'MDG': 'Madagascar',
    'MWI': 'Malawi',
    'MYS': 'Malaysia',
    'MDV': 'Maldives',
    'MLI': 'Mali',
    'MLT': 'Malta',
    'MHL': 'Marshall Islands',
    'MRT': 'Mauritania',
    'MUS': 'Mauritius',
    'MEX': 'Mexico',
    'FSM': 'Micronesia',
    'MDA': 'Moldova',
    'MCO': 'Monaco',
    'MNG': 'Mongolia',
    'MNE': 'Montenegro',
    'MAR': 'Morocco',
    'MOZ': 'Mozambique',
    'MMR': 'Myanmar',
    'NAM': 'Namibia',
    'NRU': 'Nauru',
    'NPL': 'Nepal',
    'NLD': 'Netherlands',
    'NZL': 'New Zealand',
    'NIC': 'Nicaragua',
    'NER': 'Niger',
    'NGA': 'Nigeria',
    'MNP': 'Northern Mariana Islands',
    'NOR': 'Norway',
    'OMN': 'Oman',
    'PAK': 'Pakistan',
    'PLW': 'Palau',
    'PSE': 'Palestine',
    'PAN': 'Panama',
    'PNG': 'Papua New Guinea',
    'PRY': 'Paraguay',
    'PER': 'Peru',
    'PHL': 'Philippines',
    'POL': 'Poland',
    'PRT': 'Portugal',
    'QAT': 'Qatar',
    'ROU': 'Romania',
    'RUS': 'Russia',
    'RWA': 'Rwanda',
    'KNA': 'Saint Kitts and Nevis',
    'LCA': 'Saint Lucia',
    'VCT': 'Saint Vincent and the Grenadines',
    'WSM': 'Samoa',
    'SMR': 'San Marino',
    'STP': 'São Tomé and Príncipe',
    'SAU': 'Saudi Arabia',
    'SEN': 'Senegal',
    'SRB': 'Serbia',
    'SYC': 'Seychelles',
    'SLE': 'Sierra Leone',
    'SGP': 'Singapore',
    'SVK': 'Slovakia',
    'SVN': 'Slovenia',
    'SLB': 'Solomon Islands',
    'SOM': 'Somalia',
    'ZAF': 'South Africa',
    'SSD': 'South Sudan',
    'ESP': 'Spain',
    'LKA': 'Sri Lanka',
    'SDN': 'Sudan',
    'SUR': 'Suriname',
    'SWZ': 'Eswatini',
    'SWE': 'Sweden',
    'CHE': 'Switzerland',
    'SYR': 'Syria',
    'TWN': 'Taiwan',
    'TJK': 'Tajikistan',
    'TZA': 'Tanzania',
    'THA': 'Thailand',
    'TLS': 'Timor-Leste',
    'TGO': 'Togo',
    'TON': 'Tonga',
    'TTO': 'Trinidad and Tobago',
    'TUN': 'Tunisia',
    'TUR': 'Turkey',
    'TKM': 'Turkmenistan',
    'TUV': 'Tuvalu',
    'UGA': 'Uganda',
    'UKR': 'Ukraine',
    'ARE': 'United Arab Emirates',
    'GBR': 'United Kingdom',
    'USA': 'United States',
    'URY': 'Uruguay',
    'UZB': 'Uzbekistan',
    'VUT': 'Vanuatu',
    'VAT': 'Vatican City',
    'VEN': 'Venezuela',
    'VNM': 'Vietnam',
    'YEM': 'Yemen',
    'ZMB': 'Zambia',
    'ZWE': 'Zimbabwe'
};

// Alternative name mappings for countries with different naming conventions
const ALTERNATIVE_NAMES: Record<string, string> = {
    'United States of America': 'United States',
    'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
    'Russian Federation': 'Russia',
    'Republic of Korea': 'South Korea',
    'Democratic People\'s Republic of Korea': 'North Korea',
    'Republic of China': 'Taiwan',
    'The Gambia': 'Gambia, The',
    'Republic of the Congo': 'Congo',
    'DR Congo': 'Democratic Republic of the Congo',
    'Congo, Democratic Republic of the': 'Democratic Republic of the Congo',
    'Côte d\'Ivoire': 'Côte d\'Ivoire',
    'Ivory Coast': 'Côte d\'Ivoire',
    'North Macedonia': 'North Macedonia',
    'Macedonia': 'North Macedonia',
    'Eswatini': 'Eswatini',
    'Swaziland': 'Eswatini',
    'Timor-Leste': 'Timor-Leste',
    'East Timor': 'Timor-Leste',
    'Myanmar': 'Myanmar',
    'Burma': 'Myanmar',
    'Palestine': 'Palestine',
    'Palestinian Territory': 'Palestine',
    'Occupied Palestinian Territory': 'Palestine'
};

/**
 * Maps a country identifier (ISO code, name, or alternative name) to Operation World country name
 * @param {string} identifier - Country identifier from GeoJSON or other sources
 * @returns {string|null} - Operation World country name or null if not found
 */
export const mapCountryToOperationWorld = (identifier: string | null | undefined): string | null => {
    if (!identifier) return null;

    // First try direct ISO code mapping
    const directMatch = COUNTRY_MAPPING[identifier];
    if (directMatch) {
        return directMatch;
    }

    // Try alternative names mapping
    const altMatch = ALTERNATIVE_NAMES[identifier];
    if (altMatch) {
        return altMatch;
    }

    // Try case-insensitive exact match
    const lowerIdentifier = identifier.toLowerCase();
    for (const [, value] of Object.entries(COUNTRY_MAPPING)) {
        if (value.toLowerCase() === lowerIdentifier) {
            return value;
        }
    }

    // Try fuzzy matching for common variations
    const fuzzyMatches: Record<string, string> = {
        'usa': 'United States',
        'uk': 'United Kingdom',
        'uae': 'United Arab Emirates',
        'drc': 'Democratic Republic of the Congo',
        'congo dr': 'Democratic Republic of the Congo',
        'congo democratic republic': 'Democratic Republic of the Congo',
        'congo republic': 'Congo',
        'congo brazzaville': 'Congo',
        'congo kinshasa': 'Democratic Republic of the Congo',
        'gambia': 'Gambia, The',
        'the gambia': 'Gambia, The',
        'macedonia': 'North Macedonia',
        'swaziland': 'Eswatini',
        'east timor': 'Timor-Leste',
        'burma': 'Myanmar',
        'palestine': 'Palestine',
        'occupied palestinian territory': 'Palestine',
        'palestinian territory': 'Palestine'
    };

    const fuzzyMatch = fuzzyMatches[lowerIdentifier];
    if (fuzzyMatch) {
        return fuzzyMatch;
    }

    return null;
};

/**
 * Creates a lookup map from Operation World data for faster searching
 * @param {Array} operationWorldData - Array of country objects from operation-world-stats.json
 * @returns {Object} - Map of country names to country data objects
 */
export const createOperationWorldLookup = (operationWorldData: OperationWorldCountry[]): Record<string, OperationWorldCountry> => {
    const lookup: Record<string, OperationWorldCountry> = {};

    operationWorldData.forEach((country: OperationWorldCountry) => {
        if (country.country) {
            lookup[country.country] = country;
        }
    });

    return lookup;
};

/**
 * Finds Operation World data for a country identifier
 * @param {string} identifier - Country identifier from GeoJSON
 * @param {Object} operationWorldLookup - Lookup map created by createOperationWorldLookup
 * @returns {Object|null} - Operation World country data or null if not found
 */
export const findOperationWorldData = (
    identifier: string | null | undefined,
    operationWorldLookup: Record<string, OperationWorldCountry>
): OperationWorldCountry | null => {
    const operationWorldName = mapCountryToOperationWorld(identifier);
    if (!operationWorldName) return null;

    return operationWorldLookup[operationWorldName] || null;
};
