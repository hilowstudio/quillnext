"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { classroomStepSchema } from "@/lib/schemas/onboarding";
import { saveClassroomStep } from "@/server/actions/blueprint";
import type { OnboardingData } from "./onboarding-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "@/components/icons/plus";
import { Trash } from "@/components/icons/trash";
import type { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

import { Controller } from "react-hook-form";
import { useState } from "react";

type ClassroomFormData = z.infer<typeof classroomStepSchema>;

// ---- Faith conviction flags: [enum value, parent-facing label]. "Follow our tradition" = null. ----
type Opt = readonly [string, string];
const TRANSLATION_OPTS: readonly Opt[] = [
  ["KJV", "KJV"], ["ESV", "ESV"], ["NKJV", "NKJV"], ["NASB", "NASB"], ["NIV", "NIV"], ["CSB", "CSB"], ["RSV-CE", "RSV-CE (Catholic)"],
];
const ORIGINS_OPTS: readonly Opt[] = [
  ["YOUNG_EARTH", "Young earth (6-day)"], ["OLD_EARTH", "Old earth, God created"], ["EVOLUTIONARY_CREATION", "Evolutionary creation"], ["MULTIPLE_VIEWS", "Show the views"], ["MAINSTREAM_SCIENCE", "Mainstream science"],
];
const SEXUALITY_OPTS: readonly Opt[] = [
  ["TRADITIONAL", "Traditional / biblical"], ["FACTUAL_DEFER", "Facts only, values at home"], ["AVOID", "We'll teach this ourselves"],
];
const SOTERIOLOGY_OPTS: readonly Opt[] = [
  ["REFORMED_CALVINIST", "Reformed / Calvinist"], ["ARMINIAN_WESLEYAN", "Arminian / Wesleyan"],
];
const ESCHATOLOGY_OPTS: readonly Opt[] = [
  ["DISPENSATIONAL_PREMIL", "Rapture / dispensational"], ["HISTORIC_PREMIL", "Historic premil"], ["AMILLENNIAL", "Amillennial"], ["POSTMILLENNIAL", "Postmillennial"], ["PRETERIST", "Preterist"],
];
const GIFTS_OPTS: readonly Opt[] = [
  ["CONTINUATIONIST", "Continue today"], ["CESSATIONIST", "Ceased"], ["OPEN_CAUTIOUS", "Open but cautious"],
];
const STORYLINE_OPTS: readonly Opt[] = [
  ["COVENANT", "Covenant theology"], ["DISPENSATIONALISM", "Dispensationalism"], ["PROGRESSIVE_DISPENSATIONALISM", "Progressive disp."], ["PROGRESSIVE_COVENANTALISM", "Progressive cov."], ["NEW_COVENANT_THEOLOGY", "New covenant theology"],
];
const CATHOLIC_EMPHASIS_OPTS: readonly Opt[] = [
  ["TRADITIONAL_LATIN_MASS", "Traditional / Latin Mass"], ["CONSERVATIVE_JPII_BENEDICT", "Conservative (JPII/Benedict)"], ["MAINSTREAM", "Mainstream"], ["PROGRESSIVE", "Progressive"],
];
const CATHOLIC_FAITHS = new Set(["ROMAN_CATHOLIC", "EASTERN_CATHOLIC"]);
const CHALLENGE_OPTS = ["Time Management", "Motivation", "Learning Differences", "Multiple Ages", "Limited Resources", "Parent Involvement"];
const CONFESSION_OPTS = [
  "Apostles' Creed", "Nicene Creed", "Westminster Standards", "Three Forms of Unity", "1689 London Baptist",
  "Baptist Faith & Message 2000", "Book of Concord (Lutheran)", "Thirty-Nine Articles",
  "Catechism of the Catholic Church", "Chicago Statement on Inerrancy", "TGC Confessional Statement",
];

const pillClass = (on: boolean) =>
  `h-9 px-4 rounded-full text-sm ${on ? "bg-qc-primary shadow-sm" : "border-qc-border-strong hover:bg-qc-parchment hover:text-qc-primary"}`;

function ConvictionFlag({ question, options, value, onSelect }: {
  question: string;
  options: readonly Opt[];
  value: string | null | undefined;
  onSelect: (v: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-qc-charcoal">{question}</Label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={!value ? "default" : "outline"} className={pillClass(!value)} onClick={() => onSelect(null)}>
          Follow our tradition
        </Button>
        {options.map(([val, label]) => (
          <Button key={val} type="button" size="sm" variant={value === val ? "default" : "outline"} className={pillClass(value === val)} onClick={() => onSelect(val)}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function MultiToggle({ options, values, onToggle }: {
  options: readonly string[];
  values: string[];
  onToggle: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = values.includes(opt);
        return (
          <Button key={opt} type="button" size="sm" variant={on ? "default" : "outline"} className={pillClass(on)}
            onClick={() => onToggle(on ? values.filter((v) => v !== opt) : [...values, opt])}>
            {opt}
          </Button>
        );
      })}
    </div>
  );
}

export function ClassroomStep({
  initialData,
  onSaveComplete,
  isSaving,
  setIsSaving,
  formId,
}: {
  initialData: OnboardingData;
  onSaveComplete: () => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  formId: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<ClassroomFormData>({
    resolver: zodResolver(classroomStepSchema),
    defaultValues: {
      name: initialData?.name || "",
      instructors: initialData?.instructors?.length
        ? initialData.instructors.map((i) => ({
          firstName: i.firstName || "",
          lastName: i.lastName || "",
          sex: i.sex || undefined,
          email: i.email || "",
        }))
        : [{ firstName: "", lastName: "", email: "" }],
      instructorPin: "",
      educationalPhilosophy: initialData?.educationalPhilosophy || "TRADITIONAL_SCHOOL_AT_HOME",
      educationalPhilosophyOther: initialData?.educationalPhilosophyOther || "",
      faithBackground: initialData?.faithBackground || "PROTESTANT",
      faithBackgroundOther: initialData?.faithBackgroundOther || "",
      academicGoals: initialData?.academicGoals || [],
      challenges: initialData?.challenges || [],
      bibleTranslation: initialData?.bibleTranslation || null,
      confessions: initialData?.confessions || [],
      origins: initialData?.origins || null,
      sexualityApproach: initialData?.sexualityApproach || null,
      soteriology: initialData?.soteriology || null,
      eschatology: initialData?.eschatology || null,
      spiritualGifts: initialData?.spiritualGifts || null,
      bibleStoryline: initialData?.bibleStoryline || null,
      catholicEmphasis: initialData?.catholicEmphasis || null,
    },
  });

  const instructors = watch("instructors") || [];
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isCatholic = CATHOLIC_FAITHS.has(watch("faithBackground") ?? "");

  const addInstructor = () => {
    setValue("instructors", [
      ...instructors,
      { firstName: "", lastName: "", email: "" },
    ]);
  };

  const removeInstructor = (index: number) => {
    if (instructors.length > 1) {
      setValue(
        "instructors",
        instructors.filter((_, i) => i !== index)
      );
    }
  };

  const onSubmit = async (data: ClassroomFormData) => {
    setIsSaving(true);
    try {
      // Identity is derived server-side from the session inside saveClassroomStep.
      await saveClassroomStep(data);
      onSaveComplete();
    } catch (error) {
      console.error("Failed to save classroom step:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-qc-fade-in">
      {/* Classroom Name */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <Label htmlFor="name" className="text-sm font-medium text-qc-primary">Classroom Name *</Label>
        <Input
          id="name"
          {...register("name")}
          placeholder="e.g., Smith Family Classroom"
          className="h-12 text-base px-4 border-qc-border-strong focus:border-qc-primary focus:ring-qc-primary/20 transition-all duration-200"
        />
        {errors.name && (
          <p className="text-sm font-body text-qc-error mt-1">{errors.name.message}</p>
        )}
      </motion.div>

      {/* Instructors */}
      <div className="space-y-6 pt-4 border-t border-qc-border-subtle">
        <div className="flex items-center justify-between">
          <Label className="text-2xl font-display font-medium text-qc-primary">Instructors *</Label>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addInstructor}
              className="h-10 px-4 text-qc-primary border-qc-primary/30 hover:bg-qc-primary/5 hover:border-qc-primary transition-all duration-200"
            >
              <Plus weight="bold" size={16} />
              <span className="ml-2">Add Instructor</span>
            </Button>
          </motion.div>
        </div>

        <AnimatePresence>
          {instructors.map((instructor, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-qc-border-subtle bg-qc-parchment/30 shadow-sm relative overflow-visible group hover:shadow-md transition-shadow duration-300">
                {instructors.length > 1 && (
                  <motion.div
                    className="absolute -right-2 -top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full shadow-md border-qc-error-border bg-qc-error-bg text-qc-error hover:bg-qc-error-bg hover:text-qc-error hover:border-qc-error-border"
                      onClick={() => removeInstructor(index)}
                    >
                      <Trash weight="fill" size={14} />
                    </Button>
                  </motion.div>
                )}

                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor={`instructors.${index}.firstName`} className="text-sm font-medium">
                        First Name *
                      </Label>
                      <Input
                        id={`instructors.${index}.firstName`}
                        {...register(`instructors.${index}.firstName`)}
                        className="h-11 border-qc-border-strong focus:ring-qc-primary/20 transition-all duration-200"
                      />
                      {errors.instructors?.[index]?.firstName && (
                        <p className="text-sm font-body text-qc-error">
                          {errors.instructors[index]?.firstName?.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor={`instructors.${index}.lastName`} className="text-sm font-medium">
                        Last Name
                      </Label>
                      <Input
                        id={`instructors.${index}.lastName`}
                        {...register(`instructors.${index}.lastName`)}
                        className="h-11 border-qc-border-strong focus:ring-qc-primary/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor={`instructors.${index}.email`} className="text-sm font-medium">Email</Label>
                    <Input
                      id={`instructors.${index}.email`}
                      type="email"
                      {...register(`instructors.${index}.email`)}
                      className="h-11 border-qc-border-strong focus:ring-qc-primary/20 transition-all duration-200"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Instructor PIN */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3 pt-4 border-t border-qc-border-subtle"
      >
        <Label htmlFor="instructorPin" className="text-sm font-medium text-qc-primary">Parent PIN</Label>
        <div className="flex items-center gap-4">
          <Input
            id="instructorPin"
            type="password"
            maxLength={4}
            placeholder="****"
            {...register("instructorPin")}
            className="h-12 w-32 text-center text-xl tracking-widest border-qc-border-strong focus:border-qc-primary transition-all duration-200 focus:scale-105"
          />
          <p className="text-sm font-body text-qc-text-muted flex-1">
            4-digit code that protects your parent profile. Leave blank when editing to keep your current PIN.
          </p>
        </div>
        {errors.instructorPin && (
          <p className="text-sm font-body text-qc-error">{errors.instructorPin.message}</p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-6 pt-4 border-t border-qc-border-subtle"
      >
        <Label className="text-2xl font-display font-medium text-qc-primary">Classroom Context</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Educational Philosophy */}
          <div className="space-y-3">
            <Label htmlFor="educationalPhilosophy" className="text-sm font-medium text-qc-primary">
              Educational Philosophy *
            </Label>
            <div className="relative">
              <Controller
                control={control}
                name="educationalPhilosophy"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger id="educationalPhilosophy">
                      <SelectValue placeholder="Select philosophy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRADITIONAL_SCHOOL_AT_HOME">Traditional (School-at-Home)</SelectItem>
                      <SelectItem value="VIRTUAL_ONLINE">Virtual / Online</SelectItem>
                      <SelectItem value="CLASSICAL">Classical</SelectItem>
                      <SelectItem value="CHARLOTTE_MASON">Charlotte Mason</SelectItem>
                      <SelectItem value="UNIT_STUDIES">Unit Studies</SelectItem>
                      <SelectItem value="MONTESSORI">Montessori</SelectItem>
                      <SelectItem value="UNSCHOOLING">Unschooling</SelectItem>
                      <SelectItem value="WALDORF">Waldorf</SelectItem>
                      <SelectItem value="ECLECTIC">Eclectic</SelectItem>
                      <SelectItem value="THOMAS_JEFFERSON_EDUCATION">Thomas Jefferson Education (TJEd)</SelectItem>
                      <SelectItem value="ROADSCHOOLING">Roadschooling</SelectItem>
                      <SelectItem value="WORLDSCHOOLING">Worldschooling</SelectItem>
                      <SelectItem value="GAMESCHOOLING">Gameschooling</SelectItem>
                      <SelectItem value="REGGIO_EMILIA">Reggio Emilia</SelectItem>
                      <SelectItem value="WILD_AND_FREE">Wild + Free</SelectItem>
                      <SelectItem value="PROJECT_BASED_LEARNING">Project-Based Learning (PBL)</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {watch("educationalPhilosophy") === "OTHER" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Input
                  placeholder="Please specify"
                  {...register("educationalPhilosophyOther")}
                  className="h-11 mt-2"
                />
              </motion.div>
            )}
          </div>

          {/* Faith Background */}
          <div className="space-y-3">
            <Label htmlFor="faithBackground" className="text-sm font-medium text-qc-primary">Faith Background *</Label>
            <div className="relative">
              <Controller
                control={control}
                name="faithBackground"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger id="faithBackground">
                      <SelectValue placeholder="Select faith background" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADVENTIST">Adventist (e.g. Seventh-day)</SelectItem>
                      <SelectItem value="ANABAPTIST">Anabaptist / Peace Church</SelectItem>
                      <SelectItem value="ANGLICAN_EPISCOPAL">Anglican / Episcopal</SelectItem>
                      <SelectItem value="BAPTIST">Baptist</SelectItem>
                      <SelectItem value="CHURCH_OF_CHRIST">Church of Christ</SelectItem>
                      <SelectItem value="EASTERN_CATHOLIC">Eastern Catholic (Byzantine, Maronite)</SelectItem>
                      <SelectItem value="EASTERN_ORTHODOX">Eastern Orthodox</SelectItem>
                      <SelectItem value="GREEK_ORTHODOX">Greek Orthodox</SelectItem>
                      <SelectItem value="LUTHERAN">Lutheran</SelectItem>
                      <SelectItem value="METHODIST_WESLEYAN">Methodist / Wesleyan</SelectItem>
                      <SelectItem value="NONDENOMINATIONAL">Nondenominational / Independent</SelectItem>
                      <SelectItem value="OTHER_ORTHODOX">Other Orthodox (Coptic, Serbian, etc.)</SelectItem>
                      <SelectItem value="PENTECOSTAL_CHARISMATIC">Pentecostal / Charismatic</SelectItem>
                      <SelectItem value="PRESBYTERIAN_REFORMED">Presbyterian / Reformed</SelectItem>
                      <SelectItem value="PROTESTANT">Protestant</SelectItem>
                      <SelectItem value="ROMAN_CATHOLIC">Roman Catholic</SelectItem>
                      <SelectItem value="RUSSIAN_ORTHODOX">Russian Orthodox</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {watch("faithBackground") === "OTHER" && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <Input
                  placeholder="Please specify"
                  {...register("faithBackgroundOther")}
                  className="h-11 mt-2"
                />
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Academic Goals */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <Label htmlFor="academicGoals" className="text-2xl font-display font-medium text-qc-primary">Academic Goals (Optional)</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            'Academic Excellence: Focus on core subjects and high achievement.',
            'Character Development: Emphasize virtues, responsibility, and personal growth.',
            'Life Skills: Teach practical skills like cooking, budgeting, and home maintenance.',
            'Faith-Based Education: Integrate religious studies and worldview.',
            'Interest-Led Learning: Follow the child\'s passions and curiosity.',
            'Preparation for College/Career: Focus on a rigorous, college-preparatory track.',
            'Social & Emotional Growth: Prioritize emotional intelligence and strong relationships.'
          ].map((goal) => {
            const currentGoals = watch("academicGoals") || [];
            const isSelected = currentGoals.includes(goal);
            const isDisabled = !isSelected && currentGoals.length >= 3;

            return (
              <motion.div key={goal} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                <label
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                    ? "bg-qc-primary/5 border-qc-primary shadow-sm"
                    : isDisabled
                      ? "opacity-50 cursor-not-allowed border-qc-border-subtle bg-qc-surface-raised"
                      : "bg-white border-qc-border-strong hover:border-qc-primary hover:bg-qc-parchment/50"
                    }`}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => {
                      const current = watch("academicGoals") || [];
                      let updated;
                      if (checked) {
                        if (current.length < 3) updated = [...current, goal];
                        else updated = current;
                      } else {
                        updated = current.filter((g) => g !== goal);
                      }
                      setValue("academicGoals", updated);
                    }}
                  />
                  <span className={`text-sm ${isSelected ? "text-qc-primary font-medium" : "text-qc-charcoal"}`}>
                    {goal}
                  </span>
                </label>
              </motion.div>
            );
          })}
        </div>
        {errors.academicGoals && (
          <p className="text-sm font-body text-qc-error mt-1">{errors.academicGoals.message}</p>
        )}
      </motion.div>

      {/* Current Challenges — retained from the removed Environment step */}
      <div className="space-y-3 pt-4 border-t border-qc-border-subtle">
        <Label className="text-2xl font-display font-medium text-qc-primary">Current Challenges (Optional)</Label>
        <p className="text-sm font-body text-qc-text-muted">What would you most like help with?</p>
        <MultiToggle options={CHALLENGE_OPTS} values={watch("challenges") || []} onToggle={(next) => setValue("challenges", next)} />
      </div>

      {/* Faith Convictions — optional, opt-in; these shape generated content */}
      <div className="space-y-5 pt-4 border-t border-qc-border-subtle">
        <div>
          <Label className="text-2xl font-display font-medium text-qc-primary">Faith Convictions (Optional)</Label>
          <p className="text-sm font-body text-qc-text-muted mt-1">
            Set only what you&apos;re passionate about — these shape the lessons we generate. &ldquo;Follow our tradition&rdquo; is the common, first-class choice, and there are no wrong answers.
          </p>
        </div>

        <ConvictionFlag question="Which Bible translation should we use?" options={TRANSLATION_OPTS}
          value={watch("bibleTranslation")} onSelect={(v) => setValue("bibleTranslation", v)} />

        <ConvictionFlag question="How should science lessons handle the age of the earth and how life began?" options={ORIGINS_OPTS}
          value={watch("origins")} onSelect={(v) => setValue("origins", v as ClassroomFormData["origins"])} />

        <ConvictionFlag question="How should we approach the body, gender, and sexuality?" options={SEXUALITY_OPTS}
          value={watch("sexualityApproach")} onSelect={(v) => setValue("sexualityApproach", v as ClassroomFormData["sexualityApproach"])} />

        {isCatholic && (
          <ConvictionFlag question="Where does your family land liturgically?" options={CATHOLIC_EMPHASIS_OPTS}
            value={watch("catholicEmphasis")} onSelect={(v) => setValue("catholicEmphasis", v as ClassroomFormData["catholicEmphasis"])} />
        )}

        <div className="pt-1">
          <Button type="button" variant="ghost" size="sm" className="text-qc-primary px-0 hover:bg-transparent"
            onClick={() => setShowAdvanced((s) => !s)}>
            {showAdvanced ? "− Hide advanced convictions" : "+ Advanced convictions (optional)"}
          </Button>
          {showAdvanced && (
            <div className="space-y-5 mt-3 pl-3 border-l-2 border-qc-border-subtle">
              <p className="text-sm font-body text-qc-text-muted">
                New vocabulary here is completely normal — &ldquo;follow our tradition&rdquo; is a real answer, and the most common one.
              </p>
              <ConvictionFlag question="When lessons touch on salvation, whose emphasis feels like home?" options={SOTERIOLOGY_OPTS}
                value={watch("soteriology")} onSelect={(v) => setValue("soteriology", v as ClassroomFormData["soteriology"])} />
              <ConvictionFlag question="How should end-times topics be handled?" options={ESCHATOLOGY_OPTS}
                value={watch("eschatology")} onSelect={(v) => setValue("eschatology", v as ClassroomFormData["eschatology"])} />
              <ConvictionFlag question="Do gifts like tongues, prophecy, and healing continue today?" options={GIFTS_OPTS}
                value={watch("spiritualGifts")} onSelect={(v) => setValue("spiritualGifts", v as ClassroomFormData["spiritualGifts"])} />
              <ConvictionFlag question="How do Israel, the church, and God's promises fit together across the Bible?" options={STORYLINE_OPTS}
                value={watch("bibleStoryline")} onSelect={(v) => setValue("bibleStoryline", v as ClassroomFormData["bibleStoryline"])} />
            </div>
          )}
        </div>

        <div className="space-y-2 pt-2">
          <Label className="text-sm font-medium text-qc-charcoal">Confessions or statements of faith your family affirms (optional)</Label>
          <p className="text-sm font-body text-qc-text-muted">If you have one, it tells us a lot in a single click.</p>
          <MultiToggle options={CONFESSION_OPTS} values={watch("confessions") || []} onToggle={(next) => setValue("confessions", next)} />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6">
        <Button type="submit" disabled={isSaving} className="hidden">
          {/* Hidden submit button to allow Enter key submission, actual button is in parent wizard */}
          {isSaving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </form>
  );
}

