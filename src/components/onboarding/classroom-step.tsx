"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { classroomStepSchema } from "@/lib/schemas/onboarding";
import { saveClassroomStep } from "@/server/actions/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "@/components/icons/plus";
import { Trash } from "@/components/icons/trash";
import type { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

import { Controller } from "react-hook-form";

type ClassroomFormData = z.infer<typeof classroomStepSchema>;

export function ClassroomStep({
  initialData,
  onSaveComplete,
  isSaving,
  setIsSaving,
  formId,
}: {
  initialData: any;
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
        ? initialData.instructors.map((i: any) => ({
          firstName: i.firstName || "",
          lastName: i.lastName || "",
          sex: i.sex || undefined,
          whatStudentsCall: i.whatStudentsCall || "",
          email: i.email || "",
        }))
        : [{ firstName: "", lastName: "", email: "" }],
      instructorPin: "",
      educationalPhilosophy: initialData?.educationalPhilosophy || "TRADITIONAL_SCHOOL_AT_HOME",
      educationalPhilosophyOther: initialData?.educationalPhilosophyOther || "",
      faithBackground: initialData?.faithBackground || "PROTESTANT",
      faithBackgroundOther: initialData?.faithBackgroundOther || "",
      academicGoals: initialData?.academicGoals || [],
    },
  });

  const instructors = watch("instructors") || [];

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
      // Get user org in client action
      const response = await fetch("/api/auth/user-org", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get user organization");
      }

      const { userId, organizationId } = await response.json();

      await saveClassroomStep(organizationId, userId, data);
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
                  <div className="space-y-3">
                    <Label htmlFor={`instructors.${index}.whatStudentsCall`} className="text-sm font-medium">
                      What Students Call This Instructor
                    </Label>
                    <Input
                      id={`instructors.${index}.whatStudentsCall`}
                      placeholder="e.g., Mom, Dad, Ms. Smith"
                      {...register(`instructors.${index}.whatStudentsCall`)}
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
        <Label htmlFor="instructorPin" className="text-sm font-medium text-qc-primary">Instructor PIN *</Label>
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
            4-digit code for secure access to parent controls.
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

