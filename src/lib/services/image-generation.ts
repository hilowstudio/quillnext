import { generateText } from "ai";
import { models } from "@/lib/ai/config";

/**
 * Service to generate images using "Nano Banana Pro" (Google gemini-3-pro-image).
 *
 * Note: Gemini image-output models are LANGUAGE models that emit images — they are driven
 * via generateText with providerOptions.google.responseModalities:["IMAGE"], and the image
 * comes back in result.files. (This is different from Imagen, which uses experimental_generateImage.)
 *
 * Returns the raw base64 image string (no data: prefix), or null on failure.
 */
export async function generateNanoBananaImage(
  prompt: string,
  aspectRatio: "1:1" | "16:9" | "4:3" = "1:1",
) {
  try {
    const result = await generateText({
      model: models.imageGen,
      prompt,
      providerOptions: {
        google: {
          responseModalities: ["IMAGE"],
          imageConfig: { aspectRatio },
        },
      },
    });

    const imageFile = result.files.find((f) => f.mediaType.startsWith("image/"));
    if (!imageFile) {
      console.error("Nano Banana Pro: response contained no image part", { text: result.text });
      return null;
    }

    // base64 (no data: prefix). In a real app we'd upload this to blob storage (R2/S3)
    // and return a URL; callers currently inline the base64 directly.
    return imageFile.base64;
  } catch (error) {
    console.error("Nano Banana Pro Generation Failed:", error);
    return null;
  }
}
