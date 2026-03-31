import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentUserOrg } from "@/lib/auth-helpers";
import { db } from "@/server/db";
import { cacheQuery } from "@/lib/utils/prisma-cache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { StudentCard } from "@/components/students/StudentCard";

const getOrganizationStudents = cacheQuery(
  async (organizationId: string) => {
    return db.student.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        currentGrade: true,
        birthdate: true,
        avatarConfig: true,
        createdAt: true,
        learnerProfile: {
          select: {
            id: true,
            personalityData: true,
            learningStyleData: true,
            interestsData: true,
          },
        },
        courseEnrollments: {
          select: {
            courseId: true,
            status: true,
            course: {
              select: {
                id: true,
                title: true,
                subject: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Explicit bound - organizations shouldn't have hundreds of students
    });
  },
  ["organization-students"],
  {
    revalidate: 60, // 1 minute cache
    tags: ["students"]
  }
);

export default async function StudentsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { organizationId } = await getCurrentUserOrg();
  if (!organizationId) {
    return redirect("/onboarding");
  }

  // Get all students for this organization
  const students = await getOrganizationStudents(organizationId);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-qc-charcoal mb-2 text-balance">
            Students
          </h1>
          <p className="font-body text-qc-text-muted qc-prose">
            Manage student profiles and assessments
          </p>
        </div>
        <Button asChild>
          <Link href="/students/new">Add Student</Link>
        </Button>
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-body text-qc-text-muted mb-4">
              No students yet. Add your first student to get started.
            </p>
            <Button asChild>
              <Link href="/students/new">Add Student</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((student) => (
            <StudentCard key={student.id} student={student as any} />
          ))}

        </div>
      )}
    </div>
  );
}

