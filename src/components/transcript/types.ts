/**
 * Transcript Builder Types
 * Based on Freedu.us transcript analysis and best practices
 */

export type TranscriptTemplate = 'year-based' | 'subject-based';

export type CourseType = 'Regular' | 'Honors' | 'AP/IB/Dual';

export type GradeValue = string | number; // Supports percentage (0-100) or special values (IP, Fail, Pass)


export interface TranscriptCourse {
    id: string;
    courseName: string;
    subject: string;
    grade: GradeValue;
    credits: number;
    courseType: CourseType;
    gradeLevel: number; // 9, 10, 11, 12, or 0 for pre-9th
    yearRange?: {
        start: number;
        end: number;
    };
    included?: boolean; // For transcript customization
    studentId?: string;
    courseNotes?: string; // Notes about where course was taken (400 char limit)
    order?: number; // For reordering courses within a year
    courseDescriptionId?: string; // Link to course description
}

export interface YearSummary {
    gradeLevel: number;
    yearLabel: string;
    yearRange: { start: number; end: number };
    courses: TranscriptCourse[];
    creditTotal: number;
    weightedGPA: number;
    unweightedGPA: number;
}

export interface SubjectCredits {
    subject: string;
    credits: number;
}

export interface AcademicSummary {
    totalCredits: number;
    weightedGPA: number;
    unweightedGPA: number;
    creditsBySubject?: SubjectCredits[]; // Credits per subject area
}

export interface GradingScale {
    range: string;
    points: number;
}

export interface TestScore {
    id: string;
    testType: 'SAT' | 'ACT' | 'Achievement' | 'Other';
    date?: string;
    scores: {
        [key: string]: number | string;
    };
    total?: number;
    composite?: number;
    // For Achievement tests
    nationalPercentileRank?: number; // NPR (0-99)
    stanine?: number; // Stanine (1-9)
    majorSections?: string[]; // e.g., ['Mathematics', 'Reading Comprehension', 'Complete Battery']
}

export type ActivityCategory =
    | 'academic-honors'
    | 'extracurricular-clubs'
    | 'arts-creative'
    | 'athletics'
    | 'community-service'
    | 'work-experience'
    | 'leadership'
    | 'special-programs'
    | 'certifications'
    | 'independent-study'
    | 'other';

export interface Activity {
    id: string;
    title: string;
    description?: string;
    category: ActivityCategory;
    years?: string;
    position?: string; // For leadership roles, team positions, etc.
    hours?: string; // For volunteer work, service hours
    awards?: string; // Awards or recognition received
}

export interface Note {
    id: string;
    content: string;
}

export interface StudentInfo {
    firstName: string;
    lastName: string;
    middleName?: string;
    email?: string;
    birthDate?: string;
    graduationDate?: string;
    gender?: string;
    studentId?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
    };
}

export interface SchoolInfo {
    name: string;
    address: string;
    administrator: string;
    email?: string;
    phone?: string;
}

export interface TranscriptData {
    id?: string;
    name: string;
    template: TranscriptTemplate;
    studentInfo: StudentInfo;
    schoolInfo: SchoolInfo;
    courses: TranscriptCourse[];
    pre9thCourses: TranscriptCourse[];
    tests: TestScore[];
    activities: Activity[];
    notes: Note[];
    gradingScale: GradingScale[];
    signed: boolean;
    signature?: {
        type: 'draw' | 'type';
        data: string;
        date: string;
    };
    gradingSettings?: GPASettings;
    createdAt?: string;
    updatedAt?: string;
}

export type GradingScaleType = '10-point' | '7-point' | 'plus-minus';

export interface GPASettings {
    scale: GradingScaleType;
    weighted: boolean;
    showNarratives?: boolean;
}
