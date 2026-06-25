import { db, withTenant } from "@/server/db";
import { Prisma } from "@/generated/client";
import {
  parsePersonalityData,
  parseLearningStyleData,
  parseInterestsData,
} from "@/lib/students/learner-profile";

// -----------------------------------------------------------------------
// Master Context System
// Central service that aggregates all context sources for AI prompting
// -----------------------------------------------------------------------

export interface MasterContextParams {
  organizationId: string;
  studentId?: string;
  objectiveId?: string;
  courseId?: string;
  // (Q-09-005, 2026-06-23) The per-source media ids (courseBlockId/bookId/videoId/articleId/documentId)
  // were removed: they were never read by any sub-fetcher. Source-specific generation now flows through
  // generateResourceCore (sourceType/sourceId), not this context object.
}

export interface FamilyContext {
  classroom: {
    name: string;
    description: string | null;
    educationalPhilosophy: string;
    educationalPhilosophyOther: string | null;
    faithBackground: string;
    faithBackgroundOther: string | null;
    schoolYearStartDate: Date;
    schoolYearEndDate: Date;
    schoolDaysOfWeek: number[];
    dailyStartTime: Date | null;
    dailyEndTime: Date | null;
  };
  instructors: Array<{
    firstName: string;
    lastName: string | null;
    whatStudentsCall: string | null;
    role: string;
  }>;
  holidays: Array<{
    holidayDate: Date;
    name: string;
  }>;
  environment?: {
    philosophyPreferences: string[];
    resourceTypes: string[];
    goals: string[];
    deviceTypes: string[];
    challenges: string[];
    faithBackground: string | null;
  };
}

export interface StudentContext {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    currentGrade: string | null;
    birthdate: Date | null;
    learningDifficulties: string[] | null;
  };
  profile: {
    personalityData: {
      motivationalDriver?: string;
      creativityPreference?: string;
      feedbackStyle?: string;
      frustrationResponse?: string;
      workStyle?: string;
      gamificationMode?: boolean;
      scaffoldingLevel?: string;
      toneInstructions?: string;
    } | null;
    learningStyleData: {
      inputMode?: string;
      contentDensity?: string;
      outputMode?: string;
      processingMode?: string;
      formatInstructions?: string;
    } | null;
    interestsData: {
      hookThemes?: string[];
      specificEntities?: Array<{ category: string; favorite: string }>;
      expertTopics?: string[];
      integrationMode?: string;
      analogyStrategy?: string;
    } | null;
  } | null;
  enrolledCourses: Array<{
    id: string;
    title: string;
    subject: string;
    strand: string | null;
  }>;
  currentObjectives: Array<{
    id: string;
    code: string;
    text: string;
    subject: string;
    strand: string;
  }>;
  progress: {
    completedActivities: number;
    completedAssessments: number;
    overallCompletionPercentage: number | null;
  };
}

export interface AcademicContext {
  objective: {
    id: string;
    code: string;
    text: string;
    complexity: number | null;
    gradeLevel: number | null;
    sortOrder: number;
  };
  hierarchy: {
    subject: {
      id: string;
      code: string;
      name: string;
    };
    strand: {
      id: string;
      code: string;
      name: string;
    };
    topic: {
      id: string;
      code: string;
      name: string;
    };
    subtopic: {
      id: string;
      code: string;
      name: string;
    };
  };
  fullPath: string;
}

export interface LibraryContext {
  relevantBooks: Array<{
    id: string;
    title: string;
    authors: string[] | null;
    subject: string;
    strand: string | null;
    summary: string | null;
    tableOfContents: Prisma.JsonValue;
  }>;
  relevantVideos: Array<{
    id: string;
    title: string | null;
    youtubeVideoId: string;
    extractedSummary: string | null;
    extractedKeyPoints: Prisma.JsonValue;
  }>;
  courseResources: Array<{
    id: string;
    title: string;
    resourceKind: string;
  }>;
}

export interface ScheduleContext {
  classroomId: string;
  schoolYearStartDate: Date;
  schoolYearEndDate: Date;
  schoolDaysOfWeek: number[];
  dailyStartTime: Date | null;
  dailyEndTime: Date | null;
  holidays: Array<{
    holidayDate: Date;
    name: string;
  }>;
  currentWeek: number;
  totalWeeks: number;
}

export interface MasterContext {
  family: FamilyContext | null;
  student: StudentContext | null;
  academic: AcademicContext | null;
  library: LibraryContext | null;
  schedule: ScheduleContext | null;
  metadata: {
    contextCompleteness: {
      family: boolean;
      student: boolean;
      academic: boolean;
      library: boolean;
      schedule: boolean;
    };
    generatedAt: Date;
  };
}

/**
 * Get complete master context for AI prompting
 * Aggregates all relevant context sources
 *
 * Note: Family and schedule contexts are truly optional (can be null)
 * Student, academic, and library contexts will throw errors if they fail
 * when their respective parameters are provided
 */
export async function getMasterContext(
  params: MasterContextParams,
): Promise<MasterContext> {
  // Family and schedule are optional - organization might not have them set up yet
  const [family, schedule] = await Promise.all([
    getFamilyContext(params.organizationId).catch(() => null),
    getScheduleContext(params.organizationId).catch(() => null),
  ]);

  // Student context - if studentId provided, we expect it to succeed or throw
  const student = params.studentId
    ? await getStudentContext(params.studentId, params.organizationId)
    : null;

  // Academic context - if objectiveId provided, we expect it to succeed or throw
  const academic = params.objectiveId
    ? await getAcademicContext(params.objectiveId)
    : null;

  // Library context - always attempt, but it's acceptable to be null
  const library = await getLibraryContext(
    params.organizationId,
    params.objectiveId,
    params.courseId
    // Library context is optional - don't fail if unavailable
  ).catch(() => null);

  return {
    family,
    student,
    academic,
    library,
    schedule,
    metadata: {
      contextCompleteness: {
        family: family !== null,
        student: student !== null,
        academic: academic !== null,
        library: library !== null,
        schedule: schedule !== null,
      },
      generatedAt: new Date(),
    },
  };
}

/**
 * Get family/classroom context
 */
export async function getFamilyContext(
  organizationId: string,
): Promise<FamilyContext | null> {
  const organization = await withTenant(
    (tx) =>
      tx.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          classrooms: {
            select: {
              id: true,
              name: true,
              description: true,
              educationalPhilosophy: true,
              educationalPhilosophyOther: true,
              faithBackground: true,
              faithBackgroundOther: true,
              schoolYearStartDate: true,
              schoolYearEndDate: true,
              schoolDaysOfWeek: true,
              dailyStartTime: true,
              dailyEndTime: true,
              environmentPreferences: true,
              instructors: {
                select: {
                  firstName: true,
                  lastName: true,
                  role: true,
                  user: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
              holidays: {
                select: {
                  id: true,
                  holidayDate: true,
                  name: true,
                },
              },
            },
            take: 1,
            orderBy: { createdAt: "desc" as const },
          },
        },
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!organization || !organization.classrooms || organization.classrooms.length === 0) {
    return null;
  }

  const classroom = organization.classrooms[0]!;

  // Extract environment data from the proper JSON field
  let environment: FamilyContext["environment"] | undefined;
  if (classroom.environmentPreferences) {
    try {
      environment = classroom.environmentPreferences as FamilyContext["environment"];
    } catch (e) {
      // If parsing fails, environment remains undefined
    }
  }

  return {
    classroom: {
      name: classroom.name,
      description: classroom.description,
      educationalPhilosophy: classroom.educationalPhilosophy,
      educationalPhilosophyOther: classroom.educationalPhilosophyOther,
      faithBackground: classroom.faithBackground,
      faithBackgroundOther: classroom.faithBackgroundOther,
      schoolYearStartDate: classroom.schoolYearStartDate,
      schoolYearEndDate: classroom.schoolYearEndDate,
      schoolDaysOfWeek: classroom.schoolDaysOfWeek as number[],
      dailyStartTime: classroom.dailyStartTime,
      dailyEndTime: classroom.dailyEndTime,
    },
    instructors: classroom.instructors.map((instructor) => ({
      firstName: instructor.firstName,
      lastName: instructor.lastName,
      whatStudentsCall: null, // This field doesn't exist in schema, but we'll add it if needed
      role: instructor.role,
    })),
    holidays: classroom.holidays.map((holiday) => ({
      holidayDate: holiday.holidayDate,
      name: holiday.name,
    })),
    environment,
  };
}

/**
 * Get student context including profile, courses, and progress  
 */
export async function getStudentContext(
  studentId: string,
  organizationId: string,
): Promise<StudentContext | null> {
  // Precise select with proper typing
  const studentSelect = {
    id: true,
    firstName: true,
    lastName: true,
    preferredName: true,
    currentGrade: true,
    birthdate: true,
    learningDifficulties: true,
    organizationId: true,
    learnerProfile: {
      select: {
        personalityData: true,
        learningStyleData: true,
        interestsData: true,
      },
    },
    courseEnrollments: {
      select: {
        courseId: true,
        course: {
          select: {
            id: true,
            title: true,
            subjectId: true,
            subject: {
              select: {
                name: true,
              },
            },
            strand: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    },
    activityProgress: {
      where: {
        status: "COMPLETED",
      },
      select: {
        id: true,
      },
    },
    assessmentAttempts: {
      where: {
        status: "GRADED",
      },
      select: {
        id: true,
      },
    },
    courseProgress: {
      select: {
        overallCompletionPercentage: true,
      },
      take: 1,
    },
    personalizedResources: {
      select: {
        id: true,
        title: true,
        resourceKind: {
          select: {
            label: true,
          },
        },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    },
  } satisfies Prisma.LearnerSelect;

  const student = await withTenant(
    (tx) =>
      tx.learner.findUnique({
        where: { id: studentId },
        select: studentSelect,
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!student || student.organizationId !== organizationId) {
    return null;
  }

  // Get current objectives from enrolled courses
  const courseIds = student.courseEnrollments.map((ce) => ce.courseId);

  const objectiveSelect = {
    id: true,
    code: true,
    text: true,
    subtopic: {
      select: {
        topic: {
          select: {
            strand: {
              select: {
                name: true,
                subject: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.ObjectiveSelect;

  const currentObjectives = await db.objective.findMany({
    where: {
      subtopic: {
        topic: {
          strand: {
            courses: {
              some: {
                id: {
                  in: courseIds,
                },
              },
            },
          },
        },
      },
    },
    select: objectiveSelect,
    take: 20,
    orderBy: { sortOrder: "asc" },
  });

  return {
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName || "",
      preferredName: student.preferredName,
      currentGrade: student.currentGrade,
      birthdate: student.birthdate,
      learningDifficulties: student.learningDifficulties
        ? student.learningDifficulties.split(",").map(s => s.trim())
        : null,
    },
    profile: student.learnerProfile
      ? {
        personalityData: parsePersonalityData(student.learnerProfile.personalityData),
        learningStyleData: parseLearningStyleData(student.learnerProfile.learningStyleData),
        interestsData: parseInterestsData(student.learnerProfile.interestsData),
      }
      : null,
    enrolledCourses: student.courseEnrollments.map((ce) => ({
      id: ce.course.id,
      title: ce.course.title,
      subject: ce.course.subject.name,
      strand: ce.course.strand?.name || null,
    })),
    currentObjectives: currentObjectives.map((obj) => ({
      id: obj.id,
      code: obj.code,
      text: obj.text,
      subject: obj.subtopic.topic.strand.subject.name,
      strand: obj.subtopic.topic.strand.name,
    })),
    progress: {
      completedActivities: student.activityProgress.length,
      completedAssessments: student.assessmentAttempts.length,
      overallCompletionPercentage:
        student.courseProgress[0]?.overallCompletionPercentage
          ? Number(student.courseProgress[0].overallCompletionPercentage)
          : null,
    },
  };
}


/**
 * Get academic context from Academic Spine
 */
export async function getAcademicContext(
  objectiveId: string,
): Promise<AcademicContext | null> {
  const objectiveSelect = {
    id: true,
    code: true,
    text: true,
    complexity: true,
    gradeLevel: true,
    sortOrder: true,
    subtopic: {
      select: {
        id: true,
        code: true,
        name: true,
        topic: {
          select: {
            id: true,
            code: true,
            name: true,
            strand: {
              select: {
                id: true,
                code: true,
                name: true,
                subject: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  } satisfies Prisma.ObjectiveSelect;

  const objective = await db.objective.findUnique({
    where: { id: objectiveId },
    select: objectiveSelect,
  });

  if (!objective) {
    return null;
  }

  const obj = objective;

  const hierarchy = {
    subject: {
      id: obj.subtopic.topic.strand.subject.id,
      code: obj.subtopic.topic.strand.subject.code,
      name: obj.subtopic.topic.strand.subject.name,
    },
    strand: {
      id: obj.subtopic.topic.strand.id,
      code: obj.subtopic.topic.strand.code,
      name: obj.subtopic.topic.strand.name,
    },
    topic: {
      id: obj.subtopic.topic.id,
      code: obj.subtopic.topic.code,
      name: obj.subtopic.topic.name,
    },
    subtopic: {
      id: obj.subtopic.id,
      code: obj.subtopic.code,
      name: obj.subtopic.name,
    },
  };

  const fullPath = [
    hierarchy.subject.name,
    hierarchy.strand.name,
    hierarchy.topic.name,
    hierarchy.subtopic.name,
  ].join(" > ");

  return {
    objective: {
      id: objective.id,
      code: objective.code,
      text: objective.text,
      complexity: objective.complexity,
      gradeLevel: objective.gradeLevel,
      sortOrder: objective.sortOrder,
    },
    hierarchy,
    fullPath,
  };
}

/**
 * Get library context (books and videos)
 */
export async function getLibraryContext(
  organizationId: string,
  objectiveId?: string,
  courseId?: string,
): Promise<LibraryContext | null> {
  // Get relevant books based on objective or course
  let relevantBooks: Prisma.BookGetPayload<{
    select: {
      id: true; title: true; authors: true; summary: true; tableOfContents: true;
      subject: { select: { name: true } };
      strand: { select: { name: true } };
    };
  }>[] = [];

  if (objectiveId) {
    const objective = await db.objective.findUnique({
      where: { id: objectiveId },
      select: {
        subtopic: {
          select: {
            topic: {
              select: {
                strandId: true,
                strand: {
                  select: {
                    subjectId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (objective) {
      const obj = objective;
      relevantBooks = await withTenant(
        (tx) =>
          tx.book.findMany({
            where: {
              organizationId,
              OR: [
                { subjectId: obj.subtopic.topic.strand.subjectId },
                { strandId: obj.subtopic.topic.strandId },
              ],
              extractionStatus: "EXTRACTED",
            },
            select: {
              id: true,
              title: true,
              authors: true,
              summary: true,
              tableOfContents: true,
              subject: {
                select: {
                  name: true,
                },
              },
              strand: {
                select: {
                  name: true,
                },
              },
            },
            take: 5,
            orderBy: { createdAt: "desc" },
          }),
        undefined,
        { organizationId, userId: null },
      );
    }
  } else if (courseId) {
    const course = await withTenant(
      (tx) =>
        tx.course.findUnique({
          where: { id: courseId },
          select: {
            subjectId: true,
            strandId: true,
            subject: {
              select: {
                name: true,
              },
            },
            strand: {
              select: {
                name: true,
              },
            },
          },
        }),
      undefined,
      { organizationId, userId: null },
    );

    if (course) {
      relevantBooks = await withTenant(
        (tx) =>
          tx.book.findMany({
            where: {
              organizationId,
              OR: [
                { subjectId: course.subjectId },
                course.strandId ? { strandId: course.strandId } : {},
              ],
              extractionStatus: "EXTRACTED",
            },
            select: {
              id: true,
              title: true,
              authors: true,
              summary: true,
              tableOfContents: true,
              subject: {
                select: {
                  name: true,
                },
              },
              strand: {
                select: {
                  name: true,
                },
              },
            },
            take: 5,
            orderBy: { createdAt: "desc" },
          }),
        undefined,
        { organizationId, userId: null },
      );
    }
  }

  // Get relevant videos
  const relevantVideos = await withTenant(
    (tx) =>
      tx.videoResource.findMany({
        where: {
          organizationId,
          extractionStatus: "EXTRACTED",
        },
        select: {
          id: true,
          title: true,
          youtubeVideoId: true,
          extractedSummary: true,
          extractedKeyPoints: true,
        },
        take: 5,
        orderBy: { createdAt: "desc" },
      }),
    undefined,
    { organizationId, userId: null },
  );

  // Get course resources if courseId provided
  let courseResources: Prisma.ResourceGetPayload<{
    select: { id: true; title: true; resourceKind: { select: { label: true } } };
  }>[] = [];
  if (courseId) {
    courseResources = await withTenant(
      (tx) =>
        tx.resource.findMany({
          where: {
            organizationId,
            assignments: {
              some: {
                courseId,
              },
            },
          },
          select: {
            id: true,
            title: true,
            resourceKind: {
              select: {
                label: true,
              },
            },
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        }),
      undefined,
      { organizationId, userId: null },
    );
  }

  return {
    relevantBooks: relevantBooks.map((book) => ({
      id: book.id,
      title: book.title,
      authors: (book.authors as string[]) || null,
      subject: book.subject.name,
      strand: book.strand?.name || null,
      summary: book.summary,
      tableOfContents: book.tableOfContents,
    })),
    relevantVideos: relevantVideos.map((video) => ({
      id: video.id,
      title: video.title,
      youtubeVideoId: video.youtubeVideoId,
      extractedSummary: video.extractedSummary,
      extractedKeyPoints: video.extractedKeyPoints,
    })),
    courseResources: courseResources.map((resource) => ({
      id: resource.id,
      title: resource.title,
      resourceKind: resource.resourceKind.label,
    })),
  };
}

/**
 * Get schedule context
 */
export async function getScheduleContext(
  organizationId: string,
): Promise<ScheduleContext | null> {
  const classroomSelect = {
    id: true,
    schoolYearStartDate: true,
    schoolYearEndDate: true,
    schoolDaysOfWeek: true,
    dailyStartTime: true,
    dailyEndTime: true,
    holidays: {
      select: {
        holidayDate: true,
        name: true,
      },
    },
  } satisfies Prisma.ClassroomSelect;

  const classroom = await withTenant(
    (tx) =>
      tx.classroom.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        select: classroomSelect,
      }),
    undefined,
    { organizationId, userId: null },
  );

  if (!classroom) {
    return null;
  }

  const room = classroom;

  const today = new Date();
  const startDate = room.schoolYearStartDate;
  const endDate = room.schoolYearEndDate;
  const daysDiff = Math.ceil(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const totalDays = Math.ceil(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const currentWeek = Math.max(1, Math.floor(daysDiff / 7) + 1);
  const totalWeeks = Math.ceil(totalDays / 7);

  return {
    classroomId: room.id,
    schoolYearStartDate: startDate,
    schoolYearEndDate: endDate,
    schoolDaysOfWeek: room.schoolDaysOfWeek as number[],
    dailyStartTime: room.dailyStartTime,
    dailyEndTime: room.dailyEndTime,
    holidays: room.holidays.map((h) => ({
      holidayDate: h.holidayDate,
      name: h.name,
    })),
    currentWeek,
    totalWeeks,
  };
}


