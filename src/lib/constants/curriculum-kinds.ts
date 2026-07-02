/**
 * Canonical ResourceKind codes for the Curriculum Compiler artifacts.
 *
 * These MUST match the slugs produced by prisma/seed-generator-content-types.ts
 * (lowercase, underscore) from the "Universal Tools & Templates → Curriculum Design"
 * block of GENERATOR_CONTENT_TYPES.YAML, and the codes queried by
 * src/inngest/functions/compile-curriculum.ts. Consumers (explode-bundle, BundleView)
 * import from here so the casing can't drift apart again.
 */
export const CURRICULUM_KIND_CODES = {
  TEACHER_GUIDE: "teacher_guide",
  STUDENT_PACKET: "student_packet",
  SLIDES: "slides",
  READING_ANTHOLOGY: "reading_anthology",
  GRAPHIC_ORGANIZERS: "graphic_organizers",
  RELEASE_MANIFEST: "release_manifest",
} as const;

