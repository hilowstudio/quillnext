-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PARENT_INSTRUCTOR', 'MICROSCHOOL_COOP', 'CHURCH_PRIVATE_SCHOOL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'TEACHER', 'ADMIN', 'PARENT');

-- CreateEnum
CREATE TYPE "EducationalPhilosophy" AS ENUM ('TRADITIONAL_SCHOOL_AT_HOME', 'VIRTUAL_ONLINE', 'CLASSICAL', 'CHARLOTTE_MASON', 'UNIT_STUDIES', 'MONTESSORI', 'UNSCHOOLING', 'WALDORF', 'ECLECTIC', 'THOMAS_JEFFERSON_EDUCATION', 'ROADSCHOOLING', 'WORLDSCHOOLING', 'GAMESCHOOLING', 'REGGIO_EMILIA', 'WILD_AND_FREE', 'PROJECT_BASED_LEARNING', 'OTHER');

-- CreateEnum
CREATE TYPE "FaithBackground" AS ENUM ('ROMAN_CATHOLIC', 'EASTERN_CATHOLIC', 'EASTERN_ORTHODOX', 'GREEK_ORTHODOX', 'RUSSIAN_ORTHODOX', 'OTHER_ORTHODOX', 'PROTESTANT', 'ADVENTIST', 'ANABAPTIST', 'ANGLICAN_EPISCOPAL', 'BAPTIST', 'CHURCH_OF_CHRIST', 'LUTHERAN', 'METHODIST_WESLEYAN', 'NONDENOMINATIONAL', 'PENTECOSTAL_CHARISMATIC', 'PRESBYTERIAN_REFORMED', 'OTHER_PROTESTANT', 'OTHER');

-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "InstructorRole" AS ENUM ('PRIMARY', 'ASSISTANT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "CourseStudentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DROPPED', 'PENDING');

-- CreateEnum
CREATE TYPE "CourseBlockKind" AS ENUM ('UNIT', 'MODULE', 'SECTION', 'CHAPTER', 'LESSON');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('READING', 'WRITING', 'DISCUSSION', 'PROJECT', 'LAB', 'WORKSHEET', 'OTHER');

-- CreateEnum
CREATE TYPE "AssessmentScopeKind" AS ENUM ('LESSON', 'UNIT', 'MODULE', 'SECTION', 'CHAPTER', 'COURSE');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('QUIZ', 'TEST', 'FINAL_EXAM');

-- CreateEnum
CREATE TYPE "AssessmentItemType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY', 'MATCHING', 'FILL_IN_BLANK');

-- CreateEnum
CREATE TYPE "ResourceContentType" AS ENUM ('WORKSHEET', 'TEMPLATE', 'PROMPT', 'GUIDE', 'QUIZ', 'RUBRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('GOOGLE_BOOKS', 'OPEN_LIBRARY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('NOT_EXTRACTED', 'EXTRACTING', 'EXTRACTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResourceStorageType" AS ENUM ('TEXT', 'MARKDOWN', 'HTML', 'JSON', 'PDF_URL', 'DOCX_URL');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'GRADED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "GradingMethod" AS ENUM ('AUTO', 'AI_ASSISTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ScheduleItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'MISSED');

-- CreateTable
CREATE TABLE "counties" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "county" TEXT NOT NULL,
    "fips" TEXT,
    "population_total" INTEGER,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "counties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catechisms" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" TEXT,
    "question_count" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catechisms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catechism_questions" (
    "id" TEXT NOT NULL,
    "catechism_id" TEXT NOT NULL,
    "number" TEXT,
    "sort_order" INTEGER NOT NULL,
    "data" JSONB NOT NULL,

    CONSTRAINT "catechism_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentary_chapters" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'matthew-henry',
    "book" INTEGER NOT NULL,
    "chapter" INTEGER NOT NULL,
    "title" TEXT,
    "intro" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commentary_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commentary_sections" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "section_index" INTEGER NOT NULL,
    "verse_start" INTEGER NOT NULL,
    "verse_end" INTEGER NOT NULL,
    "title" TEXT,
    "html" TEXT NOT NULL,

    CONSTRAINT "commentary_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "is_official" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT,
    "email" TEXT,
    "email_verified" TIMESTAMP(3),
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'PARENT',
    "account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deactivated_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "classrooms" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "educationalPhilosophy" "EducationalPhilosophy" NOT NULL,
    "educational_philosophy_other" TEXT,
    "faithBackground" "FaithBackground" NOT NULL,
    "faith_background_other" TEXT,
    "school_year_start_date" DATE NOT NULL,
    "school_year_end_date" DATE NOT NULL,
    "school_days_of_week" JSONB,
    "daily_start_time" TIME(6),
    "daily_end_time" TIME(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "environment_preferences" JSONB,
    "daily_times_vary" BOOLEAN NOT NULL DEFAULT false,
    "days_per_week" INTEGER,
    "hours_per_day" INTEGER,
    "is_year_round" BOOLEAN NOT NULL DEFAULT false,
    "academic_goals" TEXT[],

    CONSTRAINT "classrooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_instructors" (
    "id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "sex" "Sex",
    "email" TEXT NOT NULL,
    "instructor_pin" TEXT NOT NULL,
    "role" "InstructorRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classroom_instructors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_holidays" (
    "id" TEXT NOT NULL,
    "classroom_id" TEXT NOT NULL,
    "holiday_date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "is_all_day" BOOLEAN NOT NULL DEFAULT true,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classroom_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "preferred_name" TEXT,
    "birthdate" DATE NOT NULL,
    "sex" "Sex",
    "current_grade" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "support_intensity" TEXT,
    "support_labels" TEXT[],
    "support_profile" JSONB,
    "learning_difficulties" TEXT,
    "avatar_config" JSONB,

    CONSTRAINT "students_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_flags" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "is_resolved" BOOLEAN NOT NULL DEFAULT false,
    "alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT,
    "implicated_caregiver" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "safety_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_students" (
    "classroom_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "role" TEXT,
    "notes" TEXT,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classroom_students_pkey" PRIMARY KEY ("classroom_id","student_id")
);

-- CreateTable
CREATE TABLE "learner_profiles" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "personality_data" JSONB,
    "learning_style_data" JSONB,
    "interests_data" JSONB,
    "raw_questionnaire_responses" JSONB,
    "questionnaire_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "uuid" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strands" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "short_code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "uuid" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "strand_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "short_code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "uuid" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subtopics" (
    "id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "short_code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "uuid" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtopics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" TEXT NOT NULL,
    "subtopic_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "short_code" TEXT,
    "text" TEXT NOT NULL,
    "uuid" TEXT,
    "complexity" INTEGER,
    "gradeLevel" INTEGER,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_bands" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_grade" INTEGER NOT NULL,
    "max_grade" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_bands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "strand_id" TEXT,
    "grade_band_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_students" (
    "course_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "CourseStudentStatus" NOT NULL,
    "enrolled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_students_pkey" PRIMARY KEY ("course_id","student_id")
);

-- CreateTable
CREATE TABLE "course_blocks" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "parent_block_id" TEXT,
    "source_bundle_id" TEXT,
    "kind" "CourseBlockKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "topic_id" TEXT,
    "subtopic_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "book_chapter_id" TEXT,
    "book_id" TEXT,
    "video_id" TEXT,
    "article_id" TEXT,
    "document_id" TEXT,
    "resource_id" TEXT,

    CONSTRAINT "course_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "course_block_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "estimated_minutes" INTEGER,
    "activityType" "ActivityType" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_objectives" (
    "activity_id" TEXT NOT NULL,
    "objective_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_objectives_pkey" PRIMARY KEY ("activity_id","objective_id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "scope_kind" "AssessmentScopeKind" NOT NULL,
    "scope_block_id" TEXT,
    "assessment_type" "AssessmentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "total_points" DECIMAL(65,30),
    "time_limit_minutes" INTEGER,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_items" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "item_type" "AssessmentItemType" NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_data" JSONB,
    "correct_answer" JSONB,
    "points" DECIMAL(65,30) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_kinds" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "strand_id" TEXT,
    "subject_id" TEXT,
    "is_specialized" BOOLEAN NOT NULL DEFAULT false,
    "requires_vision" BOOLEAN NOT NULL DEFAULT false,
    "content_type" "ResourceContentType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_kinds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "added_by_user_id" TEXT NOT NULL,
    "external_source" "ExternalSource" NOT NULL,
    "external_id" TEXT,
    "isbn" TEXT,
    "title" TEXT NOT NULL,
    "authors" JSONB,
    "publisher" TEXT,
    "published_date" TEXT,
    "description" TEXT,
    "cover_url" TEXT,
    "page_count" INTEGER,
    "subject_id" TEXT NOT NULL,
    "strand_id" TEXT,
    "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'NOT_EXTRACTED',
    "extracted_at" TIMESTAMP(3),
    "table_of_contents" JSONB,
    "summary" TEXT,
    "embedding" vector,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_generated_materials" (
    "id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "resource_kind_id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "generated_for_student_id" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_generated_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_resources" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "added_by_user_id" TEXT NOT NULL,
    "youtube_url" TEXT NOT NULL,
    "youtube_video_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "thumbnail_url" TEXT,
    "duration_seconds" INTEGER,
    "channel_name" TEXT,
    "subject_id" TEXT,
    "strand_id" TEXT,
    "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'NOT_EXTRACTED',
    "extracted_at" TIMESTAMP(3),
    "extracted_transcript" TEXT,
    "extracted_summary" TEXT,
    "extracted_key_points" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "embedding" vector,

    CONSTRAINT "video_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "resource_kind_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storage_type" "ResourceStorageType" NOT NULL,
    "content" JSONB,
    "metadata" JSONB,
    "generated_for_student_id" TEXT,
    "generated_from_book_id" TEXT,
    "generated_from_video_id" TEXT,
    "generated_from_article_id" TEXT,
    "generated_from_document_id" TEXT,
    "generation_context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "curriculum_bundle_id" TEXT,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_specs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL DEFAULT 1,
    "reading_level" TEXT NOT NULL,
    "constraints" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curriculum_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_bundles" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "parentBundleId" TEXT,
    "feedback" TEXT,
    "status" TEXT NOT NULL,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curriculum_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource_assignments" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT NOT NULL,
    "notes" TEXT,
    "course_id" TEXT,
    "course_block_id" TEXT,
    "activity_id" TEXT,
    "assessment_id" TEXT,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "student_id" TEXT,

    CONSTRAINT "resource_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_progress" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "ActivityStatus" NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "time_spent_minutes" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "score_points" DECIMAL(65,30),
    "max_points" DECIMAL(65,30),
    "letter_grade" TEXT,
    "grader_user_id" TEXT,
    "grading_method" "GradingMethod",
    "feedback" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_item_responses" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "response_data" JSONB NOT NULL,
    "points_earned" DECIMAL(65,30),
    "points_possible" DECIMAL(65,30) NOT NULL,
    "is_correct" BOOLEAN,
    "feedback" TEXT,
    "graded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_item_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_progress" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "overall_completion_percentage" DECIMAL(65,30),
    "current_block_id" TEXT,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "added_by_user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "content" TEXT,
    "subject_id" TEXT,
    "strand_id" TEXT,
    "extraction_status" "ExtractionStatus" NOT NULL DEFAULT 'NOT_EXTRACTED',
    "extracted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_resources" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "added_by_user_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "extracted_text" TEXT,
    "subject_id" TEXT,
    "strand_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devotionals" (
    "id" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "keyverse" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "devotionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gratitude_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gratitude_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devotional_reflections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "time_of_day" TEXT NOT NULL,
    "who_god_is" TEXT,
    "gods_activity" TEXT,
    "who_i_am" TEXT,
    "response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devotional_reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "local_church_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "preacher" TEXT,
    "main_passage" TEXT,
    "key_references" TEXT,
    "main_points" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applications" TEXT,
    "one_thing" TEXT,
    "serving_ideas" TEXT,
    "generosity_reflection" TEXT,
    "community_plan" TEXT,
    "songs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "local_church_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_entries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "student_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL DEFAULT 'entry',
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ongoing',
    "answered_at" TIMESTAMP(3),
    "answer_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prayer_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prayer_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bible_memory" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "student_id" TEXT,
    "reference" TEXT NOT NULL,
    "text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "mastered_at" TIMESTAMP(3),
    "last_practiced_at" TIMESTAMP(3),
    "last_refreshed_at" TIMESTAMP(3),
    "folder_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bible_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bible_memory_folder" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bible_memory_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_schedule_items" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "course_block_id" TEXT,
    "activity_id" TEXT,
    "date" DATE NOT NULL,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "status" "ScheduleItemStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_events" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "student_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "date" DATE NOT NULL,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "is_all_day" BOOLEAN NOT NULL DEFAULT false,
    "recurrence_rule" TEXT,
    "parent_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_catechism_progress" (
    "id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "catechism_id" TEXT NOT NULL,
    "current_question_index" INTEGER NOT NULL DEFAULT 0,
    "last_studied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mastered_questions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_catechism_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "counties_state_idx" ON "counties"("state");

-- CreateIndex
CREATE INDEX "counties_fips_idx" ON "counties"("fips");

-- CreateIndex
CREATE UNIQUE INDEX "counties_state_county_key" ON "counties"("state", "county");

-- CreateIndex
CREATE UNIQUE INDEX "catechisms_code_key" ON "catechisms"("code");

-- CreateIndex
CREATE INDEX "catechism_questions_catechism_id_idx" ON "catechism_questions"("catechism_id");

-- CreateIndex
CREATE UNIQUE INDEX "catechism_questions_catechism_id_sort_order_key" ON "catechism_questions"("catechism_id", "sort_order");

-- CreateIndex
CREATE INDEX "commentary_chapters_source_book_idx" ON "commentary_chapters"("source", "book");

-- CreateIndex
CREATE UNIQUE INDEX "commentary_chapters_source_book_chapter_key" ON "commentary_chapters"("source", "book", "chapter");

-- CreateIndex
CREATE UNIQUE INDEX "commentary_sections_chapter_id_section_index_key" ON "commentary_sections"("chapter_id", "section_index");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_instructors_classroom_id_user_id_key" ON "classroom_instructors"("classroom_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "classroom_holidays_classroom_id_holiday_date_name_key" ON "classroom_holidays"("classroom_id", "holiday_date", "name");

-- CreateIndex
CREATE UNIQUE INDEX "learner_profiles_student_id_key" ON "learner_profiles"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_code_key" ON "subjects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_uuid_key" ON "subjects"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "strands_uuid_key" ON "strands"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "strands_subject_id_code_key" ON "strands"("subject_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "topics_uuid_key" ON "topics"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "topics_strand_id_code_key" ON "topics"("strand_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "subtopics_uuid_key" ON "subtopics"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "subtopics_topic_id_code_key" ON "subtopics"("topic_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "objectives_code_key" ON "objectives"("code");

-- CreateIndex
CREATE UNIQUE INDEX "objectives_uuid_key" ON "objectives"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "grade_bands_code_key" ON "grade_bands"("code");

-- CreateIndex
CREATE INDEX "course_students_student_id_idx" ON "course_students"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "resource_kinds_code_key" ON "resource_kinds"("code");

-- CreateIndex
CREATE UNIQUE INDEX "video_resources_youtube_video_id_key" ON "video_resources"("youtube_video_id");

-- CreateIndex
CREATE INDEX "resource_assignments_course_id_idx" ON "resource_assignments"("course_id");

-- CreateIndex
CREATE INDEX "resource_assignments_resource_id_idx" ON "resource_assignments"("resource_id");

-- CreateIndex
CREATE INDEX "resource_assignments_student_id_idx" ON "resource_assignments"("student_id");

-- CreateIndex
CREATE INDEX "resource_assignments_assessment_id_idx" ON "resource_assignments"("assessment_id");

-- CreateIndex
CREATE INDEX "resource_assignments_activity_id_idx" ON "resource_assignments"("activity_id");

-- CreateIndex
CREATE INDEX "activity_progress_student_id_idx" ON "activity_progress"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_progress_activity_id_student_id_key" ON "activity_progress"("activity_id", "student_id");

-- CreateIndex
CREATE INDEX "assessment_attempts_assessment_id_idx" ON "assessment_attempts"("assessment_id");

-- CreateIndex
CREATE INDEX "assessment_attempts_student_id_idx" ON "assessment_attempts"("student_id");

-- CreateIndex
CREATE INDEX "assessment_item_responses_item_id_idx" ON "assessment_item_responses"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_item_responses_attempt_id_item_id_key" ON "assessment_item_responses"("attempt_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_progress_course_id_student_id_key" ON "course_progress"("course_id", "student_id");

-- CreateIndex
CREATE INDEX "devotionals_month_day_idx" ON "devotionals"("month", "day");

-- CreateIndex
CREATE UNIQUE INDEX "devotionals_month_day_time_key" ON "devotionals"("month", "day", "time");

-- CreateIndex
CREATE INDEX "gratitude_entries_user_id_date_idx" ON "gratitude_entries"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "gratitude_entries_user_id_date_key" ON "gratitude_entries"("user_id", "date");

-- CreateIndex
CREATE INDEX "devotional_reflections_user_id_idx" ON "devotional_reflections"("user_id");

-- CreateIndex
CREATE INDEX "devotional_reflections_date_idx" ON "devotional_reflections"("date");

-- CreateIndex
CREATE UNIQUE INDEX "devotional_reflections_user_id_date_time_of_day_key" ON "devotional_reflections"("user_id", "date", "time_of_day");

-- CreateIndex
CREATE INDEX "local_church_notes_user_id_idx" ON "local_church_notes"("user_id");

-- CreateIndex
CREATE INDEX "local_church_notes_date_idx" ON "local_church_notes"("date");

-- CreateIndex
CREATE UNIQUE INDEX "local_church_notes_user_id_date_key" ON "local_church_notes"("user_id", "date");

-- CreateIndex
CREATE INDEX "prayer_entries_student_id_idx" ON "prayer_entries"("student_id");

-- CreateIndex
CREATE INDEX "prayer_entries_user_id_idx" ON "prayer_entries"("user_id");

-- CreateIndex
CREATE INDEX "prayer_entries_date_idx" ON "prayer_entries"("date");

-- CreateIndex
CREATE INDEX "prayer_entries_status_idx" ON "prayer_entries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_categories_name_key" ON "prayer_categories"("name");

-- CreateIndex
CREATE INDEX "prayer_categories_name_idx" ON "prayer_categories"("name");

-- CreateIndex
CREATE INDEX "bible_memory_student_id_idx" ON "bible_memory"("student_id");

-- CreateIndex
CREATE INDEX "bible_memory_user_id_idx" ON "bible_memory"("user_id");

-- CreateIndex
CREATE INDEX "bible_memory_folder_id_idx" ON "bible_memory"("folder_id");

-- CreateIndex
CREATE INDEX "bible_memory_reference_idx" ON "bible_memory"("reference");

-- CreateIndex
CREATE INDEX "bible_memory_folder_student_id_idx" ON "bible_memory_folder"("student_id");

-- CreateIndex
CREATE INDEX "student_schedule_items_account_id_idx" ON "student_schedule_items"("account_id");

-- CreateIndex
CREATE INDEX "student_schedule_items_student_id_date_idx" ON "student_schedule_items"("student_id", "date");

-- CreateIndex
CREATE INDEX "custom_events_account_id_idx" ON "custom_events"("account_id");

-- CreateIndex
CREATE INDEX "custom_events_student_id_date_idx" ON "custom_events"("student_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "student_catechism_progress_student_id_catechism_id_key" ON "student_catechism_progress"("student_id", "catechism_id");

-- AddForeignKey
ALTER TABLE "catechism_questions" ADD CONSTRAINT "catechism_questions_catechism_id_fkey" FOREIGN KEY ("catechism_id") REFERENCES "catechisms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commentary_sections" ADD CONSTRAINT "commentary_sections_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "commentary_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_instructors" ADD CONSTRAINT "classroom_instructors_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_instructors" ADD CONSTRAINT "classroom_instructors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_holidays" ADD CONSTRAINT "classroom_holidays_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_flags" ADD CONSTRAINT "safety_flags_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_students" ADD CONSTRAINT "classroom_students_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_students" ADD CONSTRAINT "classroom_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_profiles" ADD CONSTRAINT "learner_profiles_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strands" ADD CONSTRAINT "strands_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_strand_id_fkey" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "subtopics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_grade_band_id_fkey" FOREIGN KEY ("grade_band_id") REFERENCES "grade_bands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_strand_id_fkey" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_students" ADD CONSTRAINT "course_students_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_students" ADD CONSTRAINT "course_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "video_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_parent_block_id_fkey" FOREIGN KEY ("parent_block_id") REFERENCES "course_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_subtopic_id_fkey" FOREIGN KEY ("subtopic_id") REFERENCES "subtopics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_blocks" ADD CONSTRAINT "course_blocks_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_course_block_id_fkey" FOREIGN KEY ("course_block_id") REFERENCES "course_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_objectives" ADD CONSTRAINT "activity_objectives_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_objectives" ADD CONSTRAINT "activity_objectives_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_scope_block_id_fkey" FOREIGN KEY ("scope_block_id") REFERENCES "course_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_kinds" ADD CONSTRAINT "resource_kinds_strand_id_fkey" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_kinds" ADD CONSTRAINT "resource_kinds_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_strand_id_fkey" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_generated_materials" ADD CONSTRAINT "book_generated_materials_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_generated_materials" ADD CONSTRAINT "book_generated_materials_generated_for_student_id_fkey" FOREIGN KEY ("generated_for_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_generated_materials" ADD CONSTRAINT "book_generated_materials_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_generated_materials" ADD CONSTRAINT "book_generated_materials_resource_kind_id_fkey" FOREIGN KEY ("resource_kind_id") REFERENCES "resource_kinds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_strand_id_fkey" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_resources" ADD CONSTRAINT "video_resources_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_generated_for_student_id_fkey" FOREIGN KEY ("generated_for_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_generated_from_book_id_fkey" FOREIGN KEY ("generated_from_book_id") REFERENCES "books"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_generated_from_video_id_fkey" FOREIGN KEY ("generated_from_video_id") REFERENCES "video_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_generated_from_article_id_fkey" FOREIGN KEY ("generated_from_article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_generated_from_document_id_fkey" FOREIGN KEY ("generated_from_document_id") REFERENCES "document_resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_resource_kind_id_fkey" FOREIGN KEY ("resource_kind_id") REFERENCES "resource_kinds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_curriculum_bundle_id_fkey" FOREIGN KEY ("curriculum_bundle_id") REFERENCES "curriculum_bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_bundles" ADD CONSTRAINT "curriculum_bundles_specId_fkey" FOREIGN KEY ("specId") REFERENCES "curriculum_specs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_course_block_id_fkey" FOREIGN KEY ("course_block_id") REFERENCES "course_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_assignments" ADD CONSTRAINT "resource_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_grader_user_id_fkey" FOREIGN KEY ("grader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_item_responses" ADD CONSTRAINT "assessment_item_responses_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_item_responses" ADD CONSTRAINT "assessment_item_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "assessment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_current_block_id_fkey" FOREIGN KEY ("current_block_id") REFERENCES "course_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progress" ADD CONSTRAINT "course_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_strand_id_fkey" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_resources" ADD CONSTRAINT "document_resources_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_resources" ADD CONSTRAINT "document_resources_added_by_user_id_fkey" FOREIGN KEY ("added_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_resources" ADD CONSTRAINT "document_resources_strand_id_fkey" FOREIGN KEY ("strand_id") REFERENCES "strands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_resources" ADD CONSTRAINT "document_resources_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gratitude_entries" ADD CONSTRAINT "gratitude_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devotional_reflections" ADD CONSTRAINT "devotional_reflections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_church_notes" ADD CONSTRAINT "local_church_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_entries" ADD CONSTRAINT "prayer_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_entries" ADD CONSTRAINT "prayer_entries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bible_memory" ADD CONSTRAINT "bible_memory_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "bible_memory_folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bible_memory" ADD CONSTRAINT "bible_memory_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bible_memory" ADD CONSTRAINT "bible_memory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bible_memory_folder" ADD CONSTRAINT "bible_memory_folder_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_schedule_items" ADD CONSTRAINT "student_schedule_items_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_schedule_items" ADD CONSTRAINT "student_schedule_items_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_schedule_items" ADD CONSTRAINT "student_schedule_items_course_block_id_fkey" FOREIGN KEY ("course_block_id") REFERENCES "course_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_schedule_items" ADD CONSTRAINT "student_schedule_items_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_events" ADD CONSTRAINT "custom_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_events" ADD CONSTRAINT "custom_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_catechism_progress" ADD CONSTRAINT "student_catechism_progress_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

