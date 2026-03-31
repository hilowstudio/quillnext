
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Users, BookOpen, WarningCircle, MapPin } from "@phosphor-icons/react";
import Link from "next/link";
import type { UnreachedPeopleGroup } from "@/lib/joshua-project";

interface UnreachedOfTheDayProps {
    data: UnreachedPeopleGroup | null;
}

export function UnreachedOfTheDay({ data }: UnreachedOfTheDayProps) {
    if (!data) {
        return (
            <Card className="w-full h-full flex items-center justify-center p-8 bg-muted/20">
                <div className="text-center">
                    <WarningCircle size={40} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Unable to load Unreached People Group of the Day.</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="w-full shadow-lg border-l-4 border-l-qc-primary overflow-hidden">
            <div className="grid md:grid-cols-3 gap-0">
                {/* Image Section */}
                <div className="md:col-span-1 h-64 md:h-auto relative bg-qc-surface-raised dark:bg-qc-surface-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={data.photoUrl || "/placeholder-people.jpg"}
                        alt={data.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/600x800?text=No+Image';
                        }}
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                        <Badge variant="secondary" className="bg-white/90 text-black hover:bg-white/100 shadow-sm">
                            Unreached of the Day
                        </Badge>
                    </div>
                </div>

                {/* Content Section */}
                <div className="md:col-span-2 p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-qc-primary">{data.name}</h2>
                                <div className="flex items-center text-muted-foreground gap-2 mt-1">
                                    <MapPin size={16} />
                                    <span className="text-sm font-medium">{data.country}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {data.window1040 && <Badge variant="outline" className="border-qc-warning text-qc-warning-text">10/40 Window</Badge>}
                                {data.frontier && <Badge variant="outline" className="border-qc-error text-qc-error">Frontier Group</Badge>}
                            </div>
                        </div>

                        <p className="text-muted-foreground mb-6">
                            {data.summary || `Pray for the ${data.name} people of ${data.country}. They are one of the least reached people groups in the world.`}
                        </p>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <Users size={20} className="text-qc-secondary" />
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Population</p>
                                    <p className="font-medium">{data.population.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <BookOpen size={20} className="text-qc-secondary" />
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Primary Religion</p>
                                    <p className="font-medium">{data.primaryReligion}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <Globe size={20} className="text-qc-secondary" />
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">Language</p>
                                    <p className="font-medium">{data.primaryLanguage}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <WarningCircle size={20} className="text-qc-secondary" />
                                <div>
                                    <p className="text-xs text-muted-foreground uppercase font-semibold">% Evangelical</p>
                                    <p className="font-medium">{data.percentEvangelical?.toFixed(2) ?? '0.00'}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
                        <Button asChild className="flex-1 bg-qc-primary hover:bg-qc-primary/90">
                            <a href={data.profileUrl} target="_blank" rel="noopener noreferrer">View Full Profile</a>
                        </Button>

                        <Button variant="outline" className="flex-1" asChild>
                            <Link href={`/family-discipleship/prayer?title=Pray for ${data.name} (${data.country})&category=Missions`}>Pray Now</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
