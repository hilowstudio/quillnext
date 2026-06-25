"use client";

import { useState, useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { lorelei } from "@dicebear/collection";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// DiceBear lorelei options as this editor manipulates them: feature/color keys hold string[]
// (variant ids / hex), the *Probability keys hold number, seed is a string. The config is keyed
// dynamically by feature name, so it needs an index signature — which is why the array reads below
// assert string[] (those keys always hold arrays at runtime).
// No `undefined`/optional members so AvatarConfig stays assignable to Prisma's Json input/value on the
// save path (a key is either present with a value or absent). seed is read via the index + asserted.
type AvatarConfig = { [key: string]: string[] | number | string };
type AvatarUpdates = Record<string, string[] | number>;

interface AvatarCustomizerProps {
    studentId: string;
    // The persisted avatar config arrives as a loose Json-column value; narrowed to AvatarConfig below.
    initialConfig?: unknown;
    initialName?: string;
    onSave: (newConfig: AvatarConfig) => Promise<{ ok: boolean; error?: string }>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const HAIR_COLORS = [
    { name: "Jet Black", hex: "090806" },
    { name: "Off Black / Deep Brown", hex: "2C222B" },
    { name: "Dark Brown (Espresso)", hex: "3B3024" },
    { name: "Medium Brown (Chestnut)", hex: "4E3524" },
    { name: "Auburn", hex: "763C28" },
    { name: "Red / Ginger", hex: "B06540" },
    { name: "Light Brown / Mousy", hex: "A08061" },
    { name: "Strawberry Blonde", hex: "D69772" },
    { name: "Golden Blonde", hex: "C8A375" },
    { name: "Platinum / Flaxen", hex: "F2E7C9" }
];

const SKIN_TONES = [
    { name: "Deep Ebony", hex: "261C15" },
    { name: "Espresso", hex: "3F2A21" },
    { name: "Dark Chocolate", hex: "583E32" },
    { name: "Bronze / Umber", hex: "795241" },
    { name: "Caramel", hex: "9E6D53" },
    { name: "Olive / Tan", hex: "B6896C" },
    { name: "Honey / Beige", hex: "D2A685" },
    { name: "Fair / Peach", hex: "E7C3A7" },
    { name: "Ivory", hex: "F3D7C2" },
    { name: "Porcelain", hex: "FFDFC4" }
];

const EYE_COLORS = [
    { name: "Dark Brown", hex: "20130D" },
    { name: "Medium Brown", hex: "5E4631" },
    { name: "Light Brown / Amber", hex: "A4794B" },
    { name: "Hazel", hex: "8D7F48" },
    { name: "Olive Green", hex: "677452" },
    { name: "Emerald Green", hex: "4E7F55" },
    { name: "Gray", hex: "858E95" },
    { name: "Blue-Gray", hex: "5B7C8E" },
    { name: "Deep Blue", hex: "233D5B" },
    { name: "Light Blue", hex: "8FB4CC" }
];

const BRAND_COLORS = [
    { name: "Brand Navy", hex: "3A3F76" },
    { name: "Brand Gold", hex: "D9A441" },
    { name: "Brand Dark", hex: "1C1E23" },
    { name: "Brand Light", hex: "E5E2DC" }
];

const LIP_COLORS = [
    { name: "Deep Plum", hex: "3E2025" },
    { name: "Dark Cocoa", hex: "543128" },
    { name: "Berry / Mauve", hex: "7B4349" },
    { name: "Rosewood", hex: "965655" },
    { name: "Terracotta", hex: "A65E4E" },
    { name: "Dusty Rose", hex: "BC7678" },
    { name: "Soft Coral", hex: "CD8576" },
    { name: "Petal Pink", hex: "D99496" },
    { name: "Pale Peach", hex: "E1A696" },
    { name: "Blush Nude", hex: "E8BDB6" }
];

const EARRING_COLORS = [
    { name: "Classic Gold", hex: "D4AF37" },
    { name: "Sterling Silver", hex: "C0C0C0" },
    { name: "Rose Gold", hex: "B76E79" },
    { name: "White Gold / Platinum", hex: "E5E4E2" },
    { name: "Copper", hex: "B87333" },
    { name: "Bronze", hex: "CD7F32" },
    { name: "Gunmetal / Black Steel", hex: "2A2A2A" },
    { name: "Pearl (Cream)", hex: "F6F1C3" },
    { name: "Pearl (White)", hex: "FCFBF9" },
    { name: "Diamond / Cubic Zirconia", hex: "E1F4F9" }
];

const EYEGLASS_COLORS = [
    { name: "Jet Black", hex: "000000" },
    { name: "Tortoiseshell (Dark)", hex: "3D2314" },
    { name: "Tortoiseshell (Amber)", hex: "855E42" },
    { name: "Crystal / Clear", hex: "E6E9ED" },
    { name: "Gold Wire", hex: "D4AF37" },
    { name: "Silver Wire", hex: "B0B0B0" },
    { name: "Gunmetal / Slate", hex: "5C5C5C" },
    { name: "Dark Brown (Acetate)", hex: "4B3621" },
    { name: "Navy Blue", hex: "000080" },
    { name: "Burgundy / Oxblood", hex: "800020" }
];

// Full options from Lorelei schema
const OPTIONS = {
    hair: [
        "variant48", "variant47", "variant46", "variant45", "variant44", "variant43", "variant42", "variant41",
        "variant40", "variant39", "variant38", "variant37", "variant36", "variant35", "variant34", "variant33",
        "variant32", "variant31", "variant30", "variant29", "variant28", "variant27", "variant26", "variant25",
        "variant24", "variant23", "variant22", "variant21", "variant20", "variant19", "variant18", "variant17",
        "variant16", "variant15", "variant14", "variant13", "variant12", "variant11", "variant10", "variant09",
        "variant08", "variant07", "variant06", "variant05", "variant04", "variant03", "variant02", "variant01"
    ],
    eyes: [
        "variant24", "variant23", "variant22", "variant21", "variant20", "variant19", "variant18", "variant17",
        "variant16", "variant15", "variant14", "variant13", "variant12", "variant11", "variant10", "variant09",
        "variant08", "variant07", "variant06", "variant05", "variant04", "variant03", "variant02", "variant01"
    ],
    mouth: [
        "happy01", "happy02", "happy03", "happy04", "happy05", "happy06", "happy07", "happy08", "happy18",
        "happy09", "happy10", "happy11", "happy12", "happy13", "happy14", "happy17", "happy15", "happy16",
        "sad01", "sad02", "sad03", "sad04", "sad05", "sad06", "sad07", "sad08", "sad09"
    ],
    eyebrows: [
        "variant13", "variant12", "variant11", "variant10", "variant09", "variant08", "variant07", "variant06",
        "variant05", "variant04", "variant03", "variant02", "variant01"
    ],
    glasses: [
        "variant01", "variant02", "variant03", "variant04", "variant05"
    ],
    nose: [
        "variant01", "variant02", "variant03", "variant04", "variant05", "variant06"
    ],
    earrings: ["variant01", "variant02", "variant03"],
    freckles: ["variant01"],
    head: ["variant04", "variant03", "variant02", "variant01"]
};

// Map friendly names
const FEATURE_LABELS: Record<string, string> = {
    hair: "Hair Style",
    eyes: "Eyes",
    eyebrows: "Eyebrows",
    mouth: "Mouth",
    nose: "Nose",
    head: "Head Shape",
    glasses: "Glasses",
    earrings: "Earrings",
    freckles: "Freckles",
};

// Helper to remove empty/null values
const cleanConfig = (config: AvatarConfig): AvatarConfig => {
    return Object.fromEntries(Object.entries(config).filter(([_, v]) => v != null && v !== '')) as AvatarConfig;
};

const FeatureSlider = ({ feature, options, config, onUpdate }: { feature: string, options: string[], config: AvatarConfig, onUpdate: (updates: AvatarUpdates) => void }) => {
    // Find current index
    const currentVal = (config[feature] as string[] | undefined)?.[0];
    const currentIndex = currentVal ? options.indexOf(currentVal) : -1;

    const isOptional = ["glasses", "earrings", "freckles"].includes(feature);

    // Slider range: 
    // If optional: -1 to length-1 (where -1 is None)
    // If required: 0 to length-1

    const min = isOptional ? -1 : 0;
    const max = options.length - 1;
    const val = currentIndex === -1 && !isOptional ? 0 : currentIndex;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label>{FEATURE_LABELS[feature] || feature}</Label>
            </div>
            <Slider
                defaultValue={[val]}
                value={[val]}
                min={min}
                max={max}
                step={1}
                onValueChange={(vals) => {
                    const index = vals[0];
                    const updates: AvatarUpdates = {};

                    if (index === -1) {
                        updates[feature] = [];
                        if (isOptional) {
                            updates[`${feature}Probability`] = 0;
                        }
                    } else {
                        updates[feature] = [options[index]];
                        if (isOptional) {
                            updates[`${feature}Probability`] = 100;
                        }
                    }
                    onUpdate(updates);
                }}
            />
        </div>
    );
};

const ColorPicker = ({ label, property, config, onUpdate, options, required }: { label: string, property: string, config: AvatarConfig, onUpdate: (updates: AvatarUpdates) => void, options?: { name?: string, hex: string }[], required?: boolean }) => {
    const defaultColors: { name?: string, hex: string }[] = [
        { hex: "b6e3f4" }, { hex: "c0aede" }, { hex: "d1d4f9" }, { hex: "ffd5dc" },
        { hex: "ffdfbf" }, { hex: "ffffff" }, { hex: "000000" }, { hex: "e6e6e6" }
    ];

    const colorsToUse = options || defaultColors;

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <div className="flex gap-2 flex-wrap">
                {colorsToUse.map(colorObj => {
                    const color = colorObj.hex.replace('#', '');
                    return (
                        <button
                            key={color}
                            className={`w-8 h-8 rounded-full border-2 ${(config[property] as string[] | undefined)?.[0] === color ? "border-qc-primary" : "border-transparent"}`}
                            style={{ backgroundColor: `#${color}` }}
                            onClick={() => onUpdate({ [property]: [color] })}
                            title={colorObj.name || `#${color}`}
                        />
                    );
                })}
                {!required && (
                    <button
                        className={`w-8 h-8 rounded-full border-2 border-dashed border-qc-border-subtle flex items-center justify-center text-xs ${!config[property] ? "border-qc-primary" : ""}`}
                        onClick={() => onUpdate({ [property]: [] })}
                        title="Default / Random"
                    >x</button>
                )}
            </div>
        </div>
    );
}

export function AvatarCustomizer({
    studentId,
    initialConfig,
    initialName = "student",
    onSave,
    open,
    onOpenChange
}: AvatarCustomizerProps) {
    const [config, setConfig] = useState<AvatarConfig>((initialConfig as AvatarConfig | undefined) || { seed: initialName });
    const [isSaving, setIsSaving] = useState(false);

    // Generate avatar preview
    const avatarSvg = useMemo(() => {
        return createAvatar(lorelei, {
            ...config,
            seed: (config.seed as string | undefined) || initialName,
        }).toString();
    }, [config, initialName]);

    const updateConfig = (updates: AvatarUpdates) => {
        setConfig((prev) => {
            const newConfigs = { ...prev };
            Object.entries(updates).forEach(([key, value]) => {
                if (value === undefined || value === null) {
                    delete newConfigs[key];
                } else {
                    newConfigs[key] = value;
                }
            });
            return newConfigs;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalConfig = cleanConfig({ ...config, seed: (config.seed as string | undefined) || initialName });
            const result = await onSave(finalConfig);

            if (result.ok) {
                toast.success("Avatar updated!");
                onOpenChange(false);
            } else {
                toast.error(result.error || "Failed to save avatar");
            }
        } catch (error) {
            toast.error("An error occurred");
        } finally {
            setIsSaving(false);
        }
    };

    const randomize = () => {
        const randomItem = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
        const newConfig: AvatarConfig = {
            seed: Math.random().toString(36).substring(7),
            hair: [randomItem(OPTIONS.hair)],
            eyes: [randomItem(OPTIONS.eyes)],
            mouth: [randomItem(OPTIONS.mouth)],
            eyebrows: [randomItem(OPTIONS.eyebrows)],
            head: [randomItem(OPTIONS.head)],
            nose: [randomItem(OPTIONS.nose)],
        };

        // Randomly add optionals and FORCE probability
        if (Math.random() > 0.7) {
            newConfig.glasses = [randomItem(OPTIONS.glasses)];
            newConfig.glassesProbability = 100;
        } else { newConfig.glassesProbability = 0; }

        if (Math.random() > 0.7) {
            newConfig.earrings = [randomItem(OPTIONS.earrings)];
            newConfig.earringsProbability = 100;
        } else { newConfig.earringsProbability = 0; }

        if (Math.random() > 0.8) {
            newConfig.freckles = [randomItem(OPTIONS.freckles)];
            newConfig.frecklesProbability = 100;
        } else { newConfig.frecklesProbability = 0; }

        setConfig(newConfig);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Customize Avatar</DialogTitle>
                    <DialogDescription>
                        Use the sliders to find your perfect look!
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-6 py-4 flex-1 overflow-hidden">
                    {/* Preview */}
                    <div className="flex justify-center shrink-0">
                        <div
                            className="h-40 w-40 rounded-full overflow-hidden ring-4 ring-qc-primary/20 bg-qc-parchment-crumpled"
                            dangerouslySetInnerHTML={{ __html: avatarSvg }}
                        />
                    </div>

                    <div className="flex justify-center shrink-0">
                        <Button variant="outline" size="sm" onClick={randomize}>🎲 Randomize</Button>
                    </div>

                    <ScrollArea className="h-[50vh] pr-4">
                        <div className="space-y-6 pb-4">
                            <FeatureSlider feature="head" options={OPTIONS.head} config={config} onUpdate={updateConfig} />
                            <FeatureSlider feature="hair" options={OPTIONS.hair} config={config} onUpdate={updateConfig} />
                            <FeatureSlider feature="eyebrows" options={OPTIONS.eyebrows} config={config} onUpdate={updateConfig} />
                            <FeatureSlider feature="eyes" options={OPTIONS.eyes} config={config} onUpdate={updateConfig} />
                            <FeatureSlider feature="nose" options={OPTIONS.nose} config={config} onUpdate={updateConfig} />
                            <FeatureSlider feature="mouth" options={OPTIONS.mouth} config={config} onUpdate={updateConfig} />

                            <div className="border-t pt-4 mt-4">
                                <Label className="text-lg font-bold block mb-4">Accessories & Details</Label>
                                <div className="space-y-6">
                                    <FeatureSlider feature="glasses" options={OPTIONS.glasses} config={config} onUpdate={updateConfig} />
                                    <FeatureSlider feature="earrings" options={OPTIONS.earrings} config={config} onUpdate={updateConfig} />
                                    <FeatureSlider feature="freckles" options={OPTIONS.freckles} config={config} onUpdate={updateConfig} />
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <Label className="text-lg font-bold block mb-4">Colors</Label>
                                <div className="space-y-6">
                                    <ColorPicker label="Background" property="backgroundColor" config={config} onUpdate={updateConfig} options={BRAND_COLORS} />
                                    <ColorPicker label="Skin" property="skinColor" config={config} onUpdate={updateConfig} options={SKIN_TONES} required />
                                    <ColorPicker label="Hair" property="hairColor" config={config} onUpdate={updateConfig} options={HAIR_COLORS} required />
                                    <ColorPicker label="Eyes" property="eyesColor" config={config} onUpdate={updateConfig} options={EYE_COLORS} required />
                                    <ColorPicker label="Mouth" property="mouthColor" config={config} onUpdate={updateConfig} options={LIP_COLORS} required />
                                    <ColorPicker label="Glasses" property="glassesColor" config={config} onUpdate={updateConfig} options={EYEGLASS_COLORS} />
                                    <ColorPicker label="Earrings" property="earringsColor" config={config} onUpdate={updateConfig} options={EARRING_COLORS} />
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save Look"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
