
import { PrismaClient } from '../src/generated/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Checking for courses with invalid relations...");

    const courses = await prisma.course.findMany();
    console.log(`Found ${courses.length} courses.`);

    for (const course of courses) {
        console.log(`Checking Course: ${course.id} (${course.title})`);

        // Check Subject
        const subject = await prisma.subject.findUnique({ where: { id: course.subjectId } });
        if (!subject) {
            console.error(`ERROR: Course ${course.id} refers to missing Subject ${course.subjectId}`);
        } else {
            console.log(`  - Subject: OK (${subject.name})`);
        }

        // Check Strand (optional)
        if (course.strandId) {
            const strand = await prisma.strand.findUnique({ where: { id: course.strandId } });
            if (!strand) {
                console.error(`ERROR: Course ${course.id} refers to missing Strand ${course.strandId}`);
            } else {
                console.log(`  - Strand: OK (${strand.name})`);
            }
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
