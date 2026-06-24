import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { getStudentProfileData } from "@/server/queries/students";
import {
  parsePersonalityData,
  parseLearningStyleData,
  parseInterestsData,
} from "@/lib/students/learner-profile";
import { serializeMasterContext } from "@/lib/context/context-serializer";
import { StudentDiscipleshipCard } from "@/components/family-discipleship/StudentDiscipleshipCard";
import { StudentHeader } from "./_components/StudentHeader";
import { PersonalityProfile } from "./_components/PersonalityProfile";
import { LearningStyle } from "./_components/LearningStyle";
import { InterestsPassions } from "./_components/InterestsPassions";
import { PersonalizationContextCard } from "./_components/PersonalizationContextCard";
import { EnrolledCourses } from "./_components/EnrolledCourses";
import { CurrentObjectives } from "./_components/CurrentObjectives";
import { RecommendedBooks } from "./_components/RecommendedBooks";
import { AIContextPreview } from "./_components/AIContextPreview";

// Loading fallbacks
function ProfileSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 bg-qc-warm-stone rounded-qc-md" />
      <div className="h-24 bg-qc-warm-stone rounded-qc-md" />
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="h-64 bg-qc-warm-stone rounded-qc-md animate-pulse" />
  );
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    redirect("/students");
  }
  const { id } = await params;

  // Fetch all student data using the query module
  const data = await getStudentProfileData(id, organizationId);

  if (!data) {
    redirect("/students");
  }

  const { student, masterContext, currentObjectives, relevantBooks } = data;

  const contextPreview = serializeMasterContext(masterContext, {
    includeDetails: true,
    prioritize: ["student", "academic", "family", "library", "schedule"],
  });

  const personalityData = parsePersonalityData(student.learnerProfile?.personalityData);
  const learningStyleData = parseLearningStyleData(student.learnerProfile?.learningStyleData);
  const interestsData = parseInterestsData(student.learnerProfile?.interestsData);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header loads immediately - no Suspense needed */}
      <StudentHeader student={student} />

      {/* Profile cards with Suspense for progressive loading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Suspense fallback={<ProfileSkeleton />}>
          <PersonalityProfile studentId={student.id} personalityData={personalityData} />
        </Suspense>
        <Suspense fallback={<ProfileSkeleton />}>
          <LearningStyle learningStyleData={learningStyleData} />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <InterestsPassions interestsData={interestsData} />
        </Suspense>
      </div>

      {/* Context completeness */}
      <Suspense fallback={<CardSkeleton />}>
        <PersonalizationContextCard student={student} relevantBooks={relevantBooks} />
      </Suspense>

      {/* Course and objective data */}
      <Suspense fallback={<CardSkeleton />}>
        <EnrolledCourses student={student} />
      </Suspense>

      <Suspense fallback={<CardSkeleton />}>
        <CurrentObjectives studentId={student.id} objectives={currentObjectives} />
      </Suspense>

      {/* Family Discipleship Suite */}
      <Suspense fallback={<CardSkeleton />}>
        <StudentDiscipleshipCard
          studentId={student.id}
          studentName={student.preferredName || student.firstName}
          className="mb-8"
        />
      </Suspense>

      {/* Book recommendations */}
      <Suspense fallback={<CardSkeleton />}>
        <RecommendedBooks studentId={student.id} books={relevantBooks} />
      </Suspense>

      {/* AI Context - loads last as it's least critical */}
      <Suspense fallback={<CardSkeleton />}>
        <AIContextPreview contextPreview={contextPreview} />
      </Suspense>
    </div>
  );
}
