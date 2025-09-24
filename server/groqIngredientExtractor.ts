import Groq from "groq-sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

export class GroqIngredientExtractor {
  private client: Groq | null = null;

  constructor() {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (groqApiKey) {
      console.log("🚀 [GROQ INGREDIENT PARSER] Initializing with GPT-OSS-20B");
      this.client = new Groq({ apiKey: groqApiKey });
    } else {
      console.error("❌ [GROQ INGREDIENT PARSER] GROQ_API_KEY not found in environment");
    }
  }

  /**
   * Generate structured ingredients from a transcript when the video lacks a proper ingredient list.
   * Returns array of { name, display_text, measurements: [{ quantity, unit }] }
   */
  async extractFromTranscript(transcript: string, recipeTitle: string) {
    if (!this.client) return [] as any[];
    if (!transcript || transcript.length < 50) return [] as any[];

    const systemPrompt = `You are a chef. Read a cooking video transcript and extract a concise, de-duplicated ingredient list with normalized measurements.

Return ONLY valid JSON in this exact shape:
{
  "ingredients": [
    {
      "name": "ingredient name lowercase",
      "display_text": "Human-friendly ingredient line",
      "measurements": [ { "quantity": number, "unit": "cup|tbsp|tsp|oz|lb|g|ml|item" } ]
    }
  ]
}

Rules:
- Prefer standard units (cup, tbsp, tsp, oz, lb, g, ml, item). Convert fractions to decimals.
- Omit brand words and keep core food name in 'name'.
- If an amount is missing, infer a reasonable default (e.g., 1 tbsp oil) but stay minimal.
- De-duplicate similar items (e.g., "garlic clove" and "minced garlic" → garlic).
- 5–20 total items.
`;

    const userPrompt = `Recipe: ${recipeTitle}\n\nTranscript (first 4000 chars):\n${transcript.slice(0, 4000)}`;

    try {
      const start = Date.now();
      const resp = await this.client.chat.completions.create({
        model: "gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });
      const content = resp.choices?.[0]?.message?.content;
      if (!content) return [] as any[];
      const json = JSON.parse(content);
      console.log(`✅ [GROQ INGREDIENT PARSER] Extracted ingredients in ${Date.now() - start}ms`);
      return json.ingredients || [];
    } catch (e) {
      console.error("[GROQ INGREDIENT PARSER] extraction failed:", e);
      return [] as any[];
    }
  }
}

export const groqIngredientExtractor = new GroqIngredientExtractor();


