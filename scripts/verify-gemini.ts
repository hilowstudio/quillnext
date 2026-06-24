import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local" });

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && process.env.GEMINI_API_KEY) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GEMINI_API_KEY;
}

const modelsToTest = [
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro-002",
    "gemini-exp-1206"
];

async function test() {
    for (const mName of modelsToTest) {
        console.log(`\nTesting ${mName}...`);
        try {
            const result = await streamText({
                model: google(mName),
                messages: [{ role: "user", content: "Hi" }],
            });

            let buffer = "";
            for await (const chunk of result.textStream) {
                buffer += chunk;
            }
            console.log("Success:", buffer);
            return; // Exit on first success
        } catch (e: unknown) {
            console.error(`Failed ${mName}:`, e instanceof Error ? e.message : e);
            if (e && typeof e === "object" && "data" in e) {
                console.error("Error Data:", JSON.stringify(e.data, null, 2));
            }
        }
    }
}

test();
