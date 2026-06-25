/**
 * Transcript Builder Utility Functions
 * GPA calculations, validations, and data transformations
 */

import type { TranscriptCourse, YearSummary, AcademicSummary, CourseType, GradeValue, GradingScale, GradingScaleType, GPASettings } from './types';

/**
 * Format a date string (YYYY-MM-DD) as a localized date string
 * Parses the date as a local date to avoid timezone issues.
 */
export function formatDateLocal(
    dateStr?: string,
    options: Intl.DateTimeFormatOptions = { month: '2-digit', day: '2-digit', year: 'numeric' }
): string {
    if (!dateStr) return '';

    // Split the date string (e.g., "2005-05-15" -> [2005, 5, 15])
    const parts = dateStr.split('T')[0].split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return '';

    const [year, month, day] = parts;

    // Create Date object using local timezone
    // month - 1 because Date constructor uses 0-indexed months (0 = January, 11 = December)
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', options);
}

/**
 * Calculate GPA points from a grade value based on the selected scale
 */
export function getGpaPoints(
    grade: GradeValue,
    // Contract param kept for callers; weighted-GPA (Honors/AP bumps) by course type is not yet implemented.
    _courseType: CourseType = 'Regular',
    scaleType: GradingScaleType = '10-point'
): number | null {
    if (!grade) return null;

    const gradeStr = String(grade).toUpperCase().trim();

    // Special Grades Handling
    if (gradeStr === 'IP' || gradeStr === 'IN PROGRESS') return null;
    if (gradeStr === 'PASS' || gradeStr === 'P') return null; // Pass doesn't affect GPA
    if (gradeStr === 'FAIL' || gradeStr === 'F') return 0.0;
    if (gradeStr === 'M' || gradeStr === 'MASTERY') return 4.0; // Mastery counts as 4.0

    // Try to parse as number (percentage)
    const numericGrade = parseFloat(gradeStr);
    const isNumeric = !isNaN(numericGrade);

    if (isNumeric) {
        if (scaleType === '7-point') {
            if (numericGrade >= 93) return 4.0; // A
            if (numericGrade >= 85) return 3.0; // B
            if (numericGrade >= 77) return 2.0; // C
            if (numericGrade >= 70) return 1.0; // D
            return 0.0; // F
        } else if (scaleType === 'plus-minus') {
            if (numericGrade >= 93) return 4.0; // A
            if (numericGrade >= 90) return 3.7; // A-
            if (numericGrade >= 87) return 3.3; // B+
            if (numericGrade >= 83) return 3.0; // B
            if (numericGrade >= 80) return 2.7; // B-
            if (numericGrade >= 77) return 2.3; // C+
            if (numericGrade >= 73) return 2.0; // C
            if (numericGrade >= 70) return 1.7; // C- (User request had C down to 73, mapping standard C- range)
            if (numericGrade >= 67) return 1.3; // D+
            if (numericGrade >= 65) return 1.0; // D
            return 0.0;
        } else {
            // Default 10-point scale
            if (numericGrade >= 90) return 4.0;
            if (numericGrade >= 80) return 3.0;
            if (numericGrade >= 70) return 2.0;
            if (numericGrade >= 60) return 1.0;
            return 0.0;
        }
    }

    // Letter grade-based fallback (Standardized mapping)
    if (gradeStr.startsWith('A') && !gradeStr.includes('-')) return 4.0;
    if (gradeStr === 'A-' && scaleType === 'plus-minus') return 3.7;
    if (gradeStr === 'A-') return 4.0; // Treat A- as A in non-plus/minus

    if (gradeStr.includes('B')) {
        if (scaleType === 'plus-minus') {
            if (gradeStr === 'B+') return 3.3;
            if (gradeStr === 'B-') return 2.7;
            return 3.0;
        }
        return 3.0;
    }

    if (gradeStr.includes('C')) {
        if (scaleType === 'plus-minus') {
            if (gradeStr === 'C+') return 2.3;
            if (gradeStr === 'C-') return 1.7;
            return 2.0;
        }
        return 2.0;
    }

    if (gradeStr.includes('D')) {
        if (scaleType === 'plus-minus') {
            if (gradeStr === 'D+') return 1.3;
            if (gradeStr === 'D-') return 0.7;
            return 1.0;
        }
        return 1.0;
    }

    if (gradeStr.startsWith('F')) return 0.0;

    return null;
}

/**
 * Apply course type weighting
 */
export function applyCourseTypeWeighting(points: number | null, courseType: CourseType, weighted: boolean = true): number | null {
    if (points === null) return null;
    if (!weighted) return points; // Return base points if weighting is disabled

    switch (courseType) {
        case 'Honors':
            return Math.min(points + 0.5, 5.0); // Standard weighted is often +0.5 or +1, assuming +0.5 for Honors
        case 'AP/IB/Dual':
            return Math.min(points + 1.0, 5.0);
        case 'Regular':
        default:
            return points;
    }
}

/**
 * Calculate unweighted GPA
 */
export function calculateUnweightedGPA(courses: TranscriptCourse[], scaleType: GradingScaleType = '10-point'): number {
    const coursesWithGrades = courses.filter(course => {
        const points = getGpaPoints(course.grade, 'Regular', scaleType);
        return points !== null;
    });

    if (coursesWithGrades.length === 0) return 0;

    let totalPoints = 0;
    let totalCredits = 0;

    coursesWithGrades.forEach(course => {
        const points = getGpaPoints(course.grade, 'Regular', scaleType);
        if (points !== null) {
            totalPoints += points * course.credits;
            totalCredits += course.credits;
        }
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

/**
 * Calculate weighted GPA
 */
export function calculateWeightedGPA(courses: TranscriptCourse[], settings: GPASettings = { scale: '10-point', weighted: true }): number {
    const coursesWithGrades = courses.filter(course => {
        const points = getGpaPoints(course.grade, course.courseType, settings.scale);
        return points !== null;
    });

    if (coursesWithGrades.length === 0) return 0;

    let totalPoints = 0;
    let totalCredits = 0;

    coursesWithGrades.forEach(course => {
        const basePoints = getGpaPoints(course.grade, 'Regular', settings.scale);
        if (basePoints !== null) {
            const weightedPoints = applyCourseTypeWeighting(basePoints, course.courseType, settings.weighted);
            if (weightedPoints !== null) {
                totalPoints += weightedPoints * course.credits;
                totalCredits += course.credits;
            }
        }
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
}

/**
 * Calculate total credits for a set of courses
 */
export function calculateTotalCredits(courses: TranscriptCourse[]): number {
    return courses.reduce((total, course) => total + course.credits, 0);
}

/**
 * Calculate year summary 
 */
export function calculateYearSummary(
    gradeLevel: number,
    courses: TranscriptCourse[],
    settings: GPASettings = { scale: '10-point', weighted: true },
    yearLabel?: string,
    yearRange?: { start: number; end: number }
): YearSummary {
    const yearCourses = courses.filter(c => c.gradeLevel === gradeLevel && c.included !== false);
    const currentYear = new Date().getFullYear();
    const defaultYearRange = {
        start: currentYear - (12 - gradeLevel),
        end: currentYear - (12 - gradeLevel) + 1
    };

    return {
        gradeLevel,
        yearLabel: yearLabel || `${gradeLevel}th Grade`,
        yearRange: yearRange || defaultYearRange,
        courses: yearCourses,
        creditTotal: calculateTotalCredits(yearCourses),
        weightedGPA: calculateWeightedGPA(yearCourses, settings),
        unweightedGPA: calculateUnweightedGPA(yearCourses, settings.scale)
    };
}

/**
 * Calculate academic summary
 */
export function calculateAcademicSummary(
    courses: TranscriptCourse[],
    settings: GPASettings = { scale: '10-point', weighted: true }
): AcademicSummary {
    const includedCourses = courses.filter(c => c.included !== false);

    if (includedCourses.length === 0) {
        return {
            totalCredits: 0,
            weightedGPA: 0,
            unweightedGPA: 0,
            creditsBySubject: []
        };
    }

    const totalCredits = calculateTotalCredits(includedCourses);
    const weightedGPA = calculateWeightedGPA(includedCourses, settings);
    const unweightedGPA = calculateUnweightedGPA(includedCourses, settings.scale);

    const creditsBySubjectMap = includedCourses.reduce((acc, course) => {
        const subject = course.subject || 'Other';
        acc[subject] = (acc[subject] || 0) + course.credits;
        return acc;
    }, {} as Record<string, number>);

    const creditsBySubject = Object.entries(creditsBySubjectMap)
        .map(([subject, credits]) => ({ subject, credits }))
        .sort((a, b) => a.subject.localeCompare(b.subject));

    return {
        totalCredits,
        weightedGPA,
        unweightedGPA,
        creditsBySubject
    };
}

/**
 * Get grading scale legend based on type
 */
export function getGradingScaleLegend(type: GradingScaleType): GradingScale[] {
    switch (type) {
        case '7-point':
            return [
                { range: '100-93', points: 4.0 },
                { range: '92-85', points: 3.0 },
                { range: '84-77', points: 2.0 },
                { range: '76-70', points: 1.0 },
                { range: 'below 70', points: 0 }
            ];
        case 'plus-minus':
            return [
                { range: '100-93 (A)', points: 4.0 },
                { range: '92-90 (A-)', points: 3.7 },
                { range: '89-87 (B+)', points: 3.3 },
                { range: '86-83 (B)', points: 3.0 },
                { range: '82-80 (B-)', points: 2.7 },
                { range: '79-77 (C+)', points: 2.3 },
                { range: '76-73 (C)', points: 2.0 },
                { range: 'below 73', points: 0 }
            ];
        case '10-point':
        default:
            return [
                { range: '100-90', points: 4.0 },
                { range: '89-80', points: 3.0 },
                { range: '79-70', points: 2.0 },
                { range: '69-60', points: 1.0 },
                { range: 'below 59', points: 0 }
            ];
    }
}

export const DEFAULT_GRADING_SCALE = getGradingScaleLegend('10-point');

/**
 * Format GPA to 2 decimal places
 */
export function formatGPA(gpa: number): string {
    return gpa.toFixed(2);
}

/**
 * Format credits to 2 decimal places
 */
export function formatCredits(credits: number): string {
    return credits.toFixed(2);
}

// (getDefaultCoursesForGrade + validateCourse removed 2026-06-22 — dead code, zero callers, Q-22-004.
// The generate path builds courses from enrollments; if a future transcript-editor revival wants
// row validation, re-introduce a validator then.)
