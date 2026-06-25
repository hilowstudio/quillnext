'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { Feature, FeatureCollection } from 'geojson';
import type { Layer, LeafletMouseEvent } from 'leaflet';
import { mapCountryToOperationWorld, findOperationWorldData, createOperationWorldLookup } from './utils/countryMapping';
import type { OperationWorldStats, OperationWorldCountry } from './actions';

// The clicked/selected country is a validated Operation World entry (country/url strings + a typed
// CountryData bag). The map's not-found fallback supplies an empty `data: {}` (valid CountryData).
export type CountrySelection = OperationWorldCountry;

interface WorldMapProps {
    stats: OperationWorldStats | null;
    onCountrySelect: (countryData: CountrySelection) => void;
}

const GeoJSONStyle = {
    fillColor: '#3b82f6',
    weight: 1, // Thinner lines
    opacity: 0.2, // More transparent outlines
    color: 'white',
    dashArray: '', // Solid lines (no dashes)
    fillOpacity: 0.3
};

const HoverStyle = {
    weight: 2,
    color: '#666',
    dashArray: '',
    fillOpacity: 0.5
};

export default function WorldMap({ stats, onCountrySelect }: WorldMapProps) {
    const [geoJsonData, setGeoJsonData] = useState<FeatureCollection | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const operationWorldLookup = useMemo(() => {
        if (!stats?.countries) return {};
        return createOperationWorldLookup(stats.countries);
    }, [stats]);

    useEffect(() => {
        // Self-hosted world GeoJSON (committed at public/world.geojson) — no third-party runtime dependency.
        fetch('/world.geojson')
            .then(res => res.json())
            .then(data => {
                setGeoJsonData(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Failed to load map data", err);
                setIsLoading(false);
            });
    }, []);

    const onEachFeature = (feature: Feature, layer: Layer) => {
        const countryId = feature.id || feature.properties?.name || feature.properties?.sovereignt;
        const name = feature.properties?.name || feature.id;

        layer.on({
            mouseover: (e: LeafletMouseEvent) => {
                const layer = e.target;
                layer.setStyle(HoverStyle);
                layer.bringToFront();
            },
            mouseout: (e: LeafletMouseEvent) => {
                const layer = e.target;
                layer.setStyle(GeoJSONStyle);
            },
            click: () => {
                // Determine country name and lookup data
                const foundData = findOperationWorldData(countryId, operationWorldLookup) ||
                    findOperationWorldData(name, operationWorldLookup);

                if (foundData) {
                    onCountrySelect({
                        country: foundData.country,
                        data: foundData.data,
                        url: foundData.url
                    });
                } else {
                    // Fallback if data not found, still select it so user sees name
                    onCountrySelect({
                        country: name || "Unknown",
                        data: {},
                        url: ""
                    });
                }
            }
        });
    };

    if (isLoading) {
        return <div className="h-full w-full flex items-center justify-center bg-qc-surface-raised rounded-lg">Loading Map...</div>;
    }

    return (
        <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%', borderRadius: '0.5rem' }}>
            {/* Base layer with labels (under shapes) */}
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            {geoJsonData && (
                <GeoJSON
                    data={geoJsonData}
                    style={GeoJSONStyle}
                    onEachFeature={onEachFeature}
                />
            )}
        </MapContainer>
    );
}
