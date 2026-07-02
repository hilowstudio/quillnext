import { google } from "@ai-sdk/google";

// Shim for API Key: AI SDK expects GOOGLE_GENERATIVE_AI_API_KEY, but user has GEMINI_API_KEY
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

// pro/pro3 use the STABLE gemini-2.5-pro. (Was gemini-3.1-pro-preview — a preview model that
// intermittently returned empty, content-filtered responses, silently breaking grounded and
// structured generation. Replaced with stable gemini-2.5-pro 2026-06-17.)
const proModel = google("gemini-2.5-pro");

// Model instances
export const models = {
  pro3: proModel, // structured / high-complexity tier (COMPLEX_CONTENT_GENERATION, COURSE_STRUCTURE_DESIGN, video tasks). Stable gemini-2.5-pro.
  pro: proModel, // identical to pro3 (same instance)
  flash: google("gemini-3.5-flash"), // DEFAULT model — getModelForTask fallback + most task mappings. Stable. Live-verified 2026-06-16.
  flashLite: google("gemini-3.1-flash-lite"), // low-complexity tier + safety-scan generateObject (lib/safety/guard.ts). Stable. Live-verified 2026-06-16.
  imageGen: google("gemini-3-pro-image"), // "Nano Banana Pro" — Gemini image-output model. Invoked via generateText + providerOptions.google.responseModalities:["IMAGE"] (see lib/services/image-generation.ts), NOT the Imagen generateImage API. Stable channel. Live-verified 2026-06-16. (Was imagen-3.0-generate-001.)
} as const;

/**
 * Task type definitions with default model assignments
 */
export enum AITaskType {
  // Highest-complexity tier — gemini-2.5-pro (models.pro3); VIDEO_* require it (only Gemini model
  // that processes YouTube). NOTE: PERSONALITY_PROFILING + LEARNING_STYLE_ANALYSIS are intentionally
  // downgraded to flash in taskModelMap below (reliability).
  PERSONALITY_PROFILING = "personality_profiling",
  LEARNING_STYLE_ANALYSIS = "learning_style_analysis",
  COMPLEX_CONTENT_GENERATION = "complex_content_generation",
  MULTI_STEP_REASONING = "multi_step_reasoning",
  COURSE_STRUCTURE_DESIGN = "course_structure_design",
  VIDEO_PROCESSING = "video_processing", // YouTube video analysis - REQUIRES gemini-2.5-pro
  VIDEO_BASED_CONTENT = "video_based_content", // Content generation from videos

  // Medium complexity - Use Flash
  GENERATIVE_UI = "generative_ui",
  QUIZ_GENERATION = "quiz_generation",
  WORKSHEET_GENERATION = "worksheet_generation",
  LESSON_PLAN_GENERATION = "lesson_plan_generation",
  RUBRIC_GENERATION = "rubric_generation",
  CONTENT_GENERATION = "content_generation",
  PROMPT_BUILDING = "prompt_building",

  // Low complexity - Use Flash-Lite
  TEXT_SUMMARIZATION = "text_summarization",
  TEXT_LEVELING = "text_leveling",
  PROOFREADING = "proofreading",
  SIMPLE_QA = "simple_qa",
  TEXT_TRANSFORMATION = "text_transformation",
}

/**
 * Model selection map: Task type -> Model
 */
const taskModelMap: Record<AITaskType, typeof models.pro3 | typeof models.pro | typeof models.flash | typeof models.flashLite> = {
  // Highest complexity tasks -> gemini-2.5-pro (most advanced reasoning)
  // ⚠️ Video processing tasks MUST use gemini-2.5-pro (only model that supports YouTube)
  [AITaskType.PERSONALITY_PROFILING]: models.flash, // Downgrade to Flash for reliability
  [AITaskType.LEARNING_STYLE_ANALYSIS]: models.flash, // Downgrade to Flash for reliability
  [AITaskType.COMPLEX_CONTENT_GENERATION]: models.pro3,
  [AITaskType.MULTI_STEP_REASONING]: models.pro3,
  [AITaskType.COURSE_STRUCTURE_DESIGN]: models.pro3,
  [AITaskType.VIDEO_PROCESSING]: models.pro3, // YouTube video analysis
  [AITaskType.VIDEO_BASED_CONTENT]: models.pro3, // Content generation from videos

  // Medium complexity tasks -> Flash
  [AITaskType.GENERATIVE_UI]: models.flash,
  [AITaskType.QUIZ_GENERATION]: models.flash,
  [AITaskType.WORKSHEET_GENERATION]: models.flash,
  [AITaskType.LESSON_PLAN_GENERATION]: models.flash,
  [AITaskType.RUBRIC_GENERATION]: models.flash,
  [AITaskType.CONTENT_GENERATION]: models.flash,
  [AITaskType.PROMPT_BUILDING]: models.flash,

  // Low complexity tasks -> Flash-Lite
  [AITaskType.TEXT_SUMMARIZATION]: models.flashLite,
  [AITaskType.TEXT_LEVELING]: models.flashLite,
  [AITaskType.PROOFREADING]: models.flashLite,
  [AITaskType.SIMPLE_QA]: models.flashLite,
  [AITaskType.TEXT_TRANSFORMATION]: models.flashLite,
};

/**
 * Get model for a specific task type
 * Automatically selects the most cost-effective model for the task
 */
export function getModelForTask(taskType: AITaskType) {
  return taskModelMap[taskType] || models.flash; // Default to Flash if unknown
}

/**
 * Embedding model — Gemini Embedding 2 (`gemini-embedding-2`, stable, multimodal).
 * Output is unit-normalized at every size, so cosine distance works directly.
 * We store 1536-dim vectors: Google-recommended, stays <=2000 so the pgvector
 * `books.embedding` / `video_resources.embedding` columns can be HNSW/IVFFlat-indexed
 * later (the columns are declared dimensionless `vector`, so this is not pinned in DDL).
 * Bumped from text-embedding-004 (768-dim) on 2026-06-16; both vector tables were empty,
 * so no re-embed was needed. Changing EMBEDDING_DIMENSIONS requires re-embedding existing rows.
 */
export const EMBEDDING_MODEL_ID = "gemini-embedding-2";
export const EMBEDDING_DIMENSIONS = 1536;
export const embeddingModel = google.textEmbeddingModel(EMBEDDING_MODEL_ID);

/**
 * Provider options for an embedding call. `taskType` materially improves retrieval quality:
 * stored content uses RETRIEVAL_DOCUMENT, search queries use RETRIEVAL_QUERY (asymmetric).
 * Always pins the output dimension to EMBEDDING_DIMENSIONS so stored + query vectors match.
 */
export function embeddingProviderOptions(taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") {
  return { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType } };
}
