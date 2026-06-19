import { google } from "@ai-sdk/google";
import { wrapLanguageModel, APICallError, NoSuchModelError } from "ai";

// Shim for API Key: AI SDK expects GOOGLE_GENERATIVE_AI_API_KEY, but user has GEMINI_API_KEY
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

type GoogleModel = ReturnType<typeof google>;

/**
 * True only when an error looks like the model was RETIRED / removed by the provider
 * (404 / "not found" / NoSuchModelError) — not a transient, rate-limit, or content error.
 * We fall back ONLY on this so genuine failures still surface loudly instead of being masked.
 */
export function isModelRetiredError(error: unknown): boolean {
  if (NoSuchModelError.isInstance(error)) return true;
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 404) return true;
    const body = `${error.message} ${error.responseBody ?? ""}`.toLowerCase();
    if (/not found|not supported for|no such model|does not exist|deprecated|model_not_found|unsupported model/.test(body)) {
      return true;
    }
  }
  // Last-resort duck typing for wrapped/unknown error shapes.
  const e = error as { statusCode?: number; status?: number; message?: string; responseBody?: string; cause?: { statusCode?: number; message?: string } };
  if ((e?.statusCode ?? e?.status ?? e?.cause?.statusCode) === 404) return true;
  const text = `${e?.message ?? ""} ${e?.responseBody ?? ""} ${e?.cause?.message ?? ""}`.toLowerCase();
  return /not found|not supported for|no such model|does not exist/.test(text);
}

/**
 * Wrap a (possibly preview) primary model so that if a call fails because the model was
 * retired, the SAME call is transparently retried against a stable fallback model. Callers
 * keep using the returned model exactly like any other LanguageModel.
 * Covers errors thrown at request time (a 404 retirement fails fast before streaming);
 * it does not retry an error emitted mid-stream.
 */
export function withRetirementFallback(primary: GoogleModel, fallback: GoogleModel) {
  return wrapLanguageModel({
    model: primary,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        try {
          return await doGenerate();
        } catch (error) {
          if (!isModelRetiredError(error)) throw error;
          console.error(`[ai/config] Model "${primary.modelId}" generate failed (likely retired) — falling back to "${fallback.modelId}".`, error);
          return await fallback.doGenerate(params);
        }
      },
      wrapStream: async ({ doStream, params }) => {
        try {
          return await doStream();
        } catch (error) {
          if (!isModelRetiredError(error)) throw error;
          console.error(`[ai/config] Model "${primary.modelId}" stream failed (likely retired) — falling back to "${fallback.modelId}".`, error);
          return await fallback.doStream(params);
        }
      },
    },
  });
}

// pro/pro3 use the STABLE gemini-2.5-pro. (Was gemini-3.1-pro-preview — a preview model that
// intermittently returned empty, content-filtered responses, silently breaking grounded and
// structured generation. Replaced with stable gemini-2.5-pro 2026-06-17.) The
// withRetirementFallback helper remains available but is no longer needed for a stable model.
const proModel = google("gemini-2.5-pro");

// Model instances
export const models = {
  pro3: proModel, // structured / high-complexity tier (getStructuredModel, COMPLEX_CONTENT_GENERATION, COURSE_STRUCTURE_DESIGN, video tasks). Stable gemini-2.5-pro.
  pro: proModel, // identical to pro3 (same instance)
  flash: google("gemini-3.5-flash"), // DEFAULT model — getDefaultModel() + getModelForTask fallback + most task mappings. Stable. Live-verified 2026-06-16.
  flashLite: google("gemini-3.1-flash-lite"), // low-complexity tier + safety-scan generateObject (lib/safety/guard.ts). Stable. Live-verified 2026-06-16.
  imageGen: google("gemini-3-pro-image"), // "Nano Banana Pro" — Gemini image-output model. Invoked via generateText + providerOptions.google.responseModalities:["IMAGE"] (see lib/services/image-generation.ts), NOT the Imagen generateImage API. Stable channel. Live-verified 2026-06-16. (Was imagen-3.0-generate-001.)
} as const;

/**
 * Task complexity levels for model selection
 */
export enum TaskComplexity {
  HIGH = "high", // Requires deep reasoning, multi-step analysis
  MEDIUM = "medium", // Moderate complexity, structured outputs
  LOW = "low", // Simple tasks, quick responses
}

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
 * Get model by complexity level
 */
export function getModelByComplexity(complexity: TaskComplexity) {
  switch (complexity) {
    case TaskComplexity.HIGH:
      return models.pro3; // Use gemini-2.5-pro for highest complexity
    case TaskComplexity.MEDIUM:
      return models.flash;
    case TaskComplexity.LOW:
      return models.flashLite;
  }
}

/**
 * Legacy functions for backward compatibility
 * These now use intelligent model selection
 */
export function getDefaultModel() {
  return models.flash; // Default to Flash for general use
}

export function getStructuredModel() {
  return models.pro3; // Structured outputs use gemini-2.5-pro for best quality
}

export function getGenerativeUIModel() {
  return models.flash; // Generative UI uses Flash for speed
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

/**
 * Check if content contains YouTube URLs
 * Used to automatically select gemini-2.5-pro for video processing
 */
export function containsYouTubeUrl(content: string): boolean {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  return youtubeRegex.test(content);
}

/**
 * Get model for task with automatic video detection
 * If content contains YouTube URLs, automatically uses gemini-2.5-pro
 * 
 * @param taskType - The task type
 * @param content - Optional content to check for YouTube URLs
 * @returns The appropriate model instance
 */
export function getModelForTaskWithVideoCheck(
  taskType: AITaskType,
  content?: string,
): typeof models.pro3 | typeof models.pro | typeof models.flash | typeof models.flashLite {
  // If content contains YouTube URLs, MUST use gemini-2.5-pro
  if (content && containsYouTubeUrl(content)) {
    return models.pro3;
  }

  // Otherwise use standard task-based selection
  return getModelForTask(taskType);
}
