"use client";

import { useState, useEffect } from "react";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { scheduleStepSchema } from "@/lib/schemas/onboarding";
import { saveScheduleStep } from "@/server/actions/blueprint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "@/components/icons/plus";
import { Trash } from "@/components/icons/trash";
import { cn } from "@/lib/utils";
import { addYears, differenceInCalendarMonths, isSameDay, eachDayOfInterval, min, max } from "date-fns";
import { DayPicker } from "react-day-picker";
import { isHoliday } from "@/lib/utils/holidays";
import type { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

// Styles for DayPicker
import "react-day-picker/dist/style.css";

type ScheduleFormData = z.infer<typeof scheduleStepSchema>;

const DAYS_OF_WEEK = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const BREAK_TYPES = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snack" },
  { value: "RECESS", label: "Recess" },
  { value: "EXERCISE", label: "Exercise" },
  { value: "SPORTS", label: "Sports" },
];

export function ScheduleStep({
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
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    getValues,
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleStepSchema),
    defaultValues: {
      schoolYearStartDate: initialData?.schoolYearStartDate
        ? new Date(initialData.schoolYearStartDate)
        : new Date(),
      schoolYearEndDate: initialData?.schoolYearEndDate
        ? new Date(initialData.schoolYearEndDate)
        : addYears(new Date(), 1),
      isYearRound: initialData?.isYearRound ?? false,
      schoolDaysOfWeek: initialData?.schoolDaysOfWeek || [1, 2, 3, 4, 5],
      daysPerWeek: initialData?.daysPerWeek || undefined,
      dailyStartTime: initialData?.dailyStartTime
        ? typeof initialData.dailyStartTime === "string"
          ? initialData.dailyStartTime.slice(0, 5)
          : new Date(initialData.dailyStartTime).toTimeString().slice(0, 5)
        : "08:00",
      dailyEndTime: initialData?.dailyEndTime
        ? typeof initialData.dailyEndTime === "string"
          ? initialData.dailyEndTime.slice(0, 5)
          : new Date(initialData.dailyEndTime).toTimeString().slice(0, 5)
        : "15:00",
      dailyTimesVary: initialData?.dailyTimesVary ?? false,
      hoursPerDay: initialData?.hoursPerDay || undefined,
      breaks: initialData?.breaks || [],
      plannedOffDays: initialData?.plannedOffDays ? initialData.plannedOffDays.map((d: any) => new Date(d)) : [],
    },
  });

  const startDate = watch("schoolYearStartDate");
  const endDate = watch("schoolYearEndDate");
  const isYearRound = watch("isYearRound");

  const selectedDays = watch("schoolDaysOfWeek") || [];

  // Custom tracking for "Varies Weekly" checkbox UI state
  const [variesWeekly, setVariesWeekly] = useState(!!initialData?.daysPerWeek);

  const dailyTimesVary = watch("dailyTimesVary");
  const breaks = watch("breaks") || [];

  const plannedOffDays = watch("plannedOffDays") || [];
  const [lastSelectedDate, setLastSelectedDate] = useState<Date | undefined>(undefined);

  // Effect: Auto-set End Date if Year Round
  useEffect(() => {
    if (isYearRound && startDate) {
      const oneYearLater = addYears(startDate, 1);
      setValue("schoolYearEndDate", oneYearLater);
    }
  }, [isYearRound, startDate, setValue]);

  const toggleDay = (day: number) => {
    const current = selectedDays;
    if (current.includes(day)) {
      setValue("schoolDaysOfWeek", current.filter((d) => d !== day));
    } else {
      setValue("schoolDaysOfWeek", [...current, day]);
    }
  };

  const handleWeekdaysOnly = (checked: boolean) => {
    if (checked) {
      setValue("schoolDaysOfWeek", [1, 2, 3, 4, 5]);
    } else {
      setValue("schoolDaysOfWeek", []);
    }
  };

  const isWeekdaysOnly =
    selectedDays.length === 5 &&
    [1, 2, 3, 4, 5].every(d => selectedDays.includes(d));

  const addBreak = () => {
    setValue("breaks", [
      ...breaks,
      { type: "LUNCH", startTime: "12:00", endTime: "13:00" },
    ]);
  };

  const removeBreak = (index: number) => {
    setValue("breaks", breaks.filter((_, i) => i !== index));
  };


  // Custom Calendar Renderers
  const footer = (
    <div className="flex gap-4 text-xs text-qc-text-muted mt-2 justify-center">
      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-qc-info-bg border border-qc-info-border"></span> Holiday</div>
      <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-qc-secondary border border-qc-secondary"></span> Off Day</div>
    </div>
  );

  const modifiers = {
    holiday: (date: Date) => !!isHoliday(date),
  };

  const modifiersStyles = {
    holiday: { backgroundColor: '#e0e7ff', color: '#3730a3' }, // Indigo-100/Indigo-800
    selected: { backgroundColor: '#D9A441', color: '#ffffff' } // Gold/White (Hardcoded for safety)
  };

  const CustomDayButton = (props: any) => {
    const { day, modifiers, ...buttonProps } = props;
    const holiday = isHoliday(day.date);
    return (
      <button
        {...buttonProps}
        title={holiday?.name}
      />
    );
  };

  const onSubmit: SubmitHandler<ScheduleFormData> = async (data) => {
    setIsSaving(true);
    try {
      // Identity is derived server-side from the session inside saveScheduleStep.
      // Sanitization
      const payload = { ...data };
      if (variesWeekly) {
        payload.schoolDaysOfWeek = []; // Clear explicit days if varies
      } else {
        payload.daysPerWeek = undefined; // Clear numeric days if explicit
      }

      if (payload.dailyTimesVary) {
        payload.dailyStartTime = undefined;
        payload.dailyEndTime = undefined;
      } else {
        payload.hoursPerDay = undefined;
      }

      await saveScheduleStep(payload);
      onSaveComplete();
    } catch (error) {
      console.error("Failed to save schedule step:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-12 animate-qc-fade-in pb-12">

      {/* 1. School Year Dates */}
      <div className="space-y-4">
        <Label className="text-xl font-display font-medium text-qc-primary">School Year Schedule</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Start Date */}
          <div className="space-y-3">
            <Label htmlFor="schoolYearStartDate" className="text-sm text-qc-text-muted font-medium">Start Date *</Label>
            <Controller
              control={control}
              name="schoolYearStartDate"
              render={({ field }) => (
                <Input
                  id="schoolYearStartDate"
                  type="date"
                  value={field.value ? field.value.toISOString().split("T")[0] : ""}
                  onChange={(e) => {
                    const dateStr = e.target.value;
                    if (dateStr) {
                      // Create date at local midnight to avoid timezone shifts
                      const [year, month, day] = dateStr.split("-").map(Number);
                      field.onChange(new Date(year, month - 1, day));
                    } else {
                      field.onChange(undefined);
                    }
                  }}
                  className="h-12 text-base px-4 border-qc-border-strong"
                />
              )}
            />
            {errors.schoolYearStartDate && <p className="text-sm text-qc-error">{errors.schoolYearStartDate.message}</p>}
          </div>

          {/* End Date */}
          <div className="space-y-3">
            <Label htmlFor="schoolYearEndDate" className="text-sm text-qc-text-muted font-medium">End Date *</Label>
            <div className={`transition-opacity ${isYearRound ? 'opacity-50 pointer-events-none' : ''}`}>
              <Controller
                control={control}
                name="schoolYearEndDate"
                render={({ field }) => (
                  <Input
                    id="schoolYearEndDate"
                    type="date"
                    disabled={isYearRound}
                    value={field.value ? field.value.toISOString().split("T")[0] : ""}
                    onChange={(e) => {
                      const dateStr = e.target.value;
                      if (dateStr) {
                        // Create date at local midnight to avoid timezone shifts
                        const [year, month, day] = dateStr.split("-").map(Number);
                        field.onChange(new Date(year, month - 1, day));
                      } else {
                        field.onChange(undefined);
                      }
                    }}
                    className="h-12 text-base px-4 border-qc-border-strong"
                  />
                )}
              />
            </div>

            {/* Year Round Checkbox (Below End Date) */}
            <div className="flex items-center gap-3 mt-2">
              <input
                type="checkbox"
                id="isYearRound"
                {...register("isYearRound")}
                className="w-5 h-5 rounded border-qc-border-strong text-qc-primary focus:ring-qc-primary cursor-pointer"
              />
              <Label htmlFor="isYearRound" className="text-base font-medium cursor-pointer text-qc-charcoal/80">
                Year-Round School
              </Label>
            </div>

            {errors.schoolYearEndDate && <p className="text-sm text-qc-error">{errors.schoolYearEndDate.message}</p>}
          </div>
        </div>
      </div>

      {/* 2. Vacation Days (Calendar) */}
      {startDate && endDate && (
        <div className="space-y-4 pt-4 border-t border-qc-border-subtle">
          <Label className="text-xl font-display font-medium text-qc-primary">Scheduled Off Days</Label>
          <p className="text-sm text-qc-text-muted mb-4">Select vacation days by clicking on dates. Hold <strong>Shift</strong> and click to select a range.</p>

          <div className="bg-white rounded-lg border border-qc-border-subtle p-4 flex justify-center overflow-x-auto" style={{ "--rdp-accent-color": "var(--color-qc-secondary)" } as any}>
            <DayPicker
              key={`${startDate.toISOString()}-${endDate.toISOString()}`} // Force re-render when dates change
              defaultMonth={startDate} // Start view at the beginning of the school year
              mode="multiple"
              selected={plannedOffDays}
              onSelect={(days, triggerDate, modifiers, e) => {
                if (e.shiftKey && lastSelectedDate && triggerDate) {
                  // Range selection logic
                  const start = min([lastSelectedDate, triggerDate]);
                  const end = max([lastSelectedDate, triggerDate]);
                  const range = eachDayOfInterval({ start, end });

                  // Merge new range with existing selected days, avoiding duplicates
                  const currentDays = getValues("plannedOffDays") || [];
                  const newDays = [...currentDays];

                  range.forEach(day => {
                    if (!newDays.some(d => isSameDay(d, day))) {
                      newDays.push(day);
                    }
                  });

                  setValue("plannedOffDays", newDays);
                  return;
                }

                // Standard single select/deselect
                setLastSelectedDate(triggerDate);
                setValue("plannedOffDays", days || []);
              }}
              min={2} // Allow selection
              fromDate={startDate}
              toDate={endDate}
              numberOfMonths={differenceInCalendarMonths(endDate, startDate) + 1}
              disableNavigation // Hide navigation arrows since we show all months
              showOutsideDays={false}
              className="p-0"
              classNames={{
                months: "flex flex-wrap justify-center gap-8",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                head_cell: "text-qc-text-muted rounded-md w-9 font-normal text-[0.8rem]",
                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: cn(
                  "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-qc-primary/10 rounded-full transition-colors"
                ),
                day_selected:
                  "!bg-qc-secondary !text-white hover:!bg-qc-secondary hover:!text-white focus:!bg-qc-secondary focus:!text-white",
                day_today: "bg-accent text-accent-foreground",
                day_outside:
                  "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                day_disabled: "text-muted-foreground opacity-50",
                day_range_middle:
                  "aria-selected:bg-accent aria-selected:text-accent-foreground",
                day_hidden: "invisible",
              }}
              components={{
                DayButton: CustomDayButton as any
              }}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              modifiersClassNames={{
                selected: "!bg-[#D9A441] !text-white"
              }}
            />
          </div>
          {footer}
        </div>
      )}

      {/* 3. School Days */}
      <div className="space-y-4 pt-4 border-t border-qc-border-subtle">
        <Label className="text-xl font-display font-medium text-qc-primary">School Days</Label>

        {/* Toggle between Fixed and Varies */}
        {!variesWeekly ? (
          <div className="flex flex-wrap gap-3 animate-qc-fade-in">
            {DAYS_OF_WEEK.map((day) => (
              <motion.div key={day.value} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  variant={selectedDays.includes(day.value) ? "default" : "outline"}
                  size="lg"
                  onClick={() => toggleDay(day.value)}
                  className={`h-12 w-32 text-base shadow-sm font-medium transition-all ${selectedDays.includes(day.value)
                    ? 'bg-qc-primary text-white hover:bg-qc-primary/90'
                    : 'bg-white text-qc-charcoal border-qc-border-strong hover:bg-qc-parchment hover:border-qc-primary'
                    }`}
                >
                  {day.label}
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="animate-qc-fade-in max-w-xs">
            <Label className="text-sm text-qc-text-muted font-medium mb-2 block">How many days per week?</Label>
            <Controller
              control={control}
              name="daysPerWeek"
              render={({ field }) => (
                <Select
                  onValueChange={(val) => field.onChange(Number(val))}
                  defaultValue={field.value?.toString()}
                >
                  <SelectTrigger className="h-12 text-base border-qc-border-strong">
                    <SelectValue placeholder="Select days" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} Day{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        {/* Checkboxes (Below Selectors) */}
        <div className="space-y-3 mt-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="weekdaysOnly"
              checked={!variesWeekly && isWeekdaysOnly}
              onChange={(e) => {
                setVariesWeekly(false);
                handleWeekdaysOnly(e.target.checked);
              }}
              className="w-5 h-5 rounded border-qc-border-strong text-qc-primary focus:ring-qc-primary cursor-pointer"
            />
            <Label htmlFor="weekdaysOnly" className="text-sm text-qc-text-muted font-medium cursor-pointer">Weekdays Only (M-F)</Label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="variesWeekly"
              checked={variesWeekly}
              onChange={(e) => {
                setVariesWeekly(e.target.checked);
                if (e.target.checked) {
                  setValue("schoolDaysOfWeek", []);
                }
              }}
              className="w-5 h-5 rounded border-qc-border-strong text-qc-primary focus:ring-qc-primary cursor-pointer"
            />
            <Label htmlFor="variesWeekly" className="text-sm text-qc-text-muted font-medium cursor-pointer">Varies Week by Week</Label>
          </div>
        </div>
      </div>

      {/* 4. Daily Times */}
      <div className="space-y-6 pt-4 border-t border-qc-border-subtle">
        <Label className="text-xl font-display font-medium text-qc-primary">Daily Schedule</Label>

        {!dailyTimesVary ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-qc-fade-in">
            <div className="space-y-3">
              <Label htmlFor="dailyStartTime" className="text-sm text-qc-text-muted font-medium">Daily Start Time</Label>
              <Input
                id="dailyStartTime"
                type="time"
                {...register("dailyStartTime")}
                className="h-12 text-base px-4 border-qc-border-strong"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="dailyEndTime" className="text-sm text-qc-text-muted font-medium">Daily End Time</Label>
              <Input
                id="dailyEndTime"
                type="time"
                {...register("dailyEndTime")}
                className="h-12 text-base px-4 border-qc-border-strong"
              />
            </div>
          </div>
        ) : (
          <div className="animate-qc-fade-in max-w-xs">
            <Label className="text-sm text-qc-text-muted font-medium mb-2 block">How many hours per day?</Label>
            <Controller
              control={control}
              name="hoursPerDay"
              render={({ field }) => (
                <Select
                  onValueChange={(val) => field.onChange(Number(val))}
                  defaultValue={field.value?.toString()}
                >
                  <SelectTrigger className="h-12 text-base border-qc-border-strong">
                    <SelectValue placeholder="Select hours" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} Hour{n > 1 ? "s" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        {/* Checkbox (Below Inputs) */}
        <div className="flex items-center gap-3 mt-4">
          <input
            type="checkbox"
            id="dailyTimesVary"
            {...register("dailyTimesVary")}
            className="w-5 h-5 rounded border-qc-border-strong text-qc-primary focus:ring-qc-primary cursor-pointer"
          />
          <Label htmlFor="dailyTimesVary" className="text-sm text-qc-text-muted font-medium cursor-pointer">
            Daily times vary (no fixed schedule)
          </Label>
        </div>
      </div>

      {/* 5. Breaks */}
      <div className="space-y-6 pt-4 border-t border-qc-border-subtle">
        <div className="flex items-center justify-between">
          <Label className="text-xl font-display font-medium text-qc-primary">Breaks (Optional)</Label>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button type="button" variant="outline" size="sm" onClick={addBreak} className="h-10 px-4 text-qc-primary border-qc-primary/30 hover:bg-qc-primary/5 hover:border-qc-primary">
              <Plus weight="bold" size={16} />
              <span className="ml-2">Add Break</span>
            </Button>
          </motion.div>
        </div>

        <AnimatePresence>
          {breaks.map((breakItem, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: "auto", scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="border-qc-border-subtle bg-qc-parchment/30 shadow-sm relative group overflow-visible mb-4">
                <motion.div
                  className="absolute -right-2 -top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow-md bg-qc-error-bg text-qc-error hover:bg-qc-error-bg hover:text-qc-error"
                    onClick={() => removeBreak(index)}
                  >
                    <Trash weight="fill" size={14} />
                  </Button>
                </motion.div>

                <CardContent className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label htmlFor={`breaks.${index}.type`} className="text-sm font-medium">Type</Label>
                      <Controller
                        control={control}
                        name={`breaks.${index}.type`}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger className="h-11 border-qc-border-strong hover:border-qc-primary transition-colors">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {BREAK_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor={`breaks.${index}.startTime`} className="text-sm font-medium">Start</Label>
                      <Input
                        type="time"
                        {...register(`breaks.${index}.startTime`)}
                        className="h-11 border-qc-border-strong hover:border-qc-primary transition-colors"
                      />
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor={`breaks.${index}.endTime`} className="text-sm font-medium">End</Label>
                      <Input
                        type="time"
                        {...register(`breaks.${index}.endTime`)}
                        className="h-11 border-qc-border-strong hover:border-qc-primary transition-colors"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-6">
        <Button type="submit" disabled={isSaving} className="hidden">
          {/* Hidden submit button to allow Enter key submission */}
          {isSaving ? "Saving..." : "Save & Continue"}
        </Button>
      </div>
    </form>
  );
}
