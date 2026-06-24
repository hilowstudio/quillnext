
import { DynamicAssessmentWizard } from "@/components/students/DynamicAssessmentWizard";

export const metadata = {
  title: "Assessment | Quill & Compass",
};

export default async function AssessmentWizardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DynamicAssessmentWizard studentId={id} />;
}
