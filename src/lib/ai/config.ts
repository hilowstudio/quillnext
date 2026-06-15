import { google } from "@ai-sdk/google";

// Shim for API Key: AI SDK expects GOOGLE_GENERATIVE_AI_API_KEY, but user has GEMINI_API_KEY
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

// Model instances
export const models = {
  pro3: google("gemini-2.5-pro"), // was gemini-3-pro-preview (retired by Google ~2026-06; broke all generateObject paths)
  pro: google("gemini-2.5-pro"),
  flash: google("gemini-2.5-flash"),
  flashLite: google("gemini-2.5-flash-lite"),
  imagen: google("imagen-3.0-generate-001"), // Imagen 3 for image generation
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
  // Highest complexity - Use Gemini 3 Pro (only model that processes YouTube videos)
  PERSONALITY_PROFILING = "personality_profiling",
  LEARNING_STYLE_ANALYSIS = "learning_style_analysis",
  COMPLEX_CONTENT_GENERATION = "complex_content_generation",
  MULTI_STEP_REASONING = "multi_step_reasoning",
  COURSE_STRUCTURE_DESIGN = "course_structure_design",
  VIDEO_PROCESSING = "video_processing", // YouTube video analysis - REQUIRES Gemini 3 Pro
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
  // Highest complexity tasks -> Gemini 3 Pro (most advanced reasoning)
  // ⚠️ Video processing tasks MUST use Gemini 3 Pro (only model that supports YouTube)
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
      return models.pro3; // Use Gemini 3 Pro for highest complexity
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
  return models.pro3; // Structured outputs use Gemini 3 Pro for best quality
}

export function getGenerativeUIModel() {
  return models.flash; // Generative UI uses Flash for speed
}

/**
 * Embedding model - Using Gemini Text Embedding 004
 * Configured with 1536 dimensions to match existing PGVector schema
 */
export const embeddingModel = google.textEmbeddingModel("text-embedding-004");

/**
 * Check if content contains YouTube URLs
 * Used to automatically select Gemini 3 Pro for video processing
 */
export function containsYouTubeUrl(content: string): boolean {
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/;
  return youtubeRegex.test(content);
}

/**
 * Get model for task with automatic video detection
 * If content contains YouTube URLs, automatically uses Gemini 3 Pro
 * 
 * @param taskType - The task type
 * @param content - Optional content to check for YouTube URLs
 * @returns The appropriate model instance
 */
export function getModelForTaskWithVideoCheck(
  taskType: AITaskType,
  content?: string,
): typeof models.pro3 | typeof models.pro | typeof models.flash | typeof models.flashLite {
  // If content contains YouTube URLs, MUST use Gemini 3 Pro
  if (content && containsYouTubeUrl(content)) {
    return models.pro3;
  }

  // Otherwise use standard task-based selection
  return getModelForTask(taskType);
}
