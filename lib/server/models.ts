import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

export function usesOpenAI() {
  return process.env.AI_PROVIDER === "openai";
}
export function aiService(): "OpenAI" | "AI Gateway" {
  return usesOpenAI() ? "OpenAI" : "AI Gateway";
}
export function textModelId() {
  return usesOpenAI()
    ? process.env.OPENAI_MODEL || "gpt-6.2-sol"
    : process.env.AI_MODEL || "google/gemini-4-hydrogen";
}
export function textModel() {
  const id = textModelId();
  return usesOpenAI()
    ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(id)
    : id;
}
export function imageModelId() {
  return usesOpenAI()
    ? process.env.OPENAI_IMAGE_MODEL || "gpt-image-2.6-flare"
    : process.env.AI_IMAGE_MODEL || "bfl/flux-3-image-klein";
}
export function imageModel() {
  const id = imageModelId();
  return usesOpenAI()
    ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).image(id)
    : id;
}
