import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env is loaded from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export interface ParsedIngredient {
  ingredient: string;      // Clean ingredient name (e.g., "sugar", "eggs")
  amount: string;          // Amount with unit (e.g., "½ teaspoon", "4")
  quantity: number;        // Numeric quantity (e.g., 0.5, 4)
  unit: string;           // Unit of measurement (e.g., "teaspoon", "pieces")
  originalText: string;    // Original ingredient line
}

export class GroqIngredientParser {
  private client: Groq | null = null;
  
  constructor() {
    // Use GROQ_API_KEY from environment variables (Vercel)
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (groqApiKey) {
      console.log('🚀 [GROQ INGREDIENT PARSER] Initializing with GPT-OSS-20B');
      console.log('✅ [GROQ INGREDIENT PARSER] API key loaded successfully');
      this.client = new Groq({
        apiKey: groqApiKey
      });
    } else {
      console.error('❌ [GROQ INGREDIENT PARSER] GROQ_API_KEY not found in environment');
      console.error('❌ [GROQ INGREDIENT PARSER] Please add GROQ_API_KEY to Replit Secrets');
    }
  }

  async parseIngredients(ingredients: string[]): Promise<ParsedIngredient[]> {
    console.log('🎯 [GROQ INGREDIENT PARSER] Parsing', ingredients.length, 'ingredients');
    
    if (!this.client) {
      console.log('❌ [GROQ INGREDIENT PARSER] No Groq client available');
      return [];
    }

    try {
      console.log('📡 [GROQ INGREDIENT PARSER] Calling GPT-OSS-20B...');
      const startTime = Date.now();
      
      const prompt = `Parse these cooking ingredients into structured data. For each ingredient, extract:
1. The clean ingredient name (lowercase, no amounts)
2. The amount with unit
3. The numeric quantity
4. The unit of measurement

Ingredients to parse:
${ingredients.map((ing, i) => `${i + 1}. ${ing}`).join('\n')}

Return a JSON array with this EXACT structure for each ingredient:
[
  {
    "ingredient": "sugar",
    "amount": "½ teaspoon",
    "quantity": 0.5,
    "unit": "teaspoon",
    "originalText": "½ teaspoon sugar"
  }
]

Rules:
- Convert fractions to decimal numbers (½ = 0.5, ¼ = 0.25, ⅛ = 0.125, ⅓ = 0.333, ⅔ = 0.667)
- For items without units (like "4 eggs"), use "pieces" as unit
- Keep the "amount" field exactly as written (with fractions if present)
- Clean ingredient names should be lowercase and singular
- Remove descriptors like "large", "fresh", "chopped" from ingredient name but keep in originalText

Parse ALL ingredients and return ONLY the JSON array, no other text.`;

      const completion = await this.client.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [{
          role: "user",
          content: prompt
        }],
        temperature: 0.1,  // Low temperature for consistent parsing
        max_tokens: 2000,
        reasoning_effort: "medium"
      });

      const response = completion.choices[0]?.message?.content || '';
      const timeTaken = Date.now() - startTime;
      
      console.log(`✅ [GROQ INGREDIENT PARSER] Parsed in ${timeTaken}ms`);
      
      // Extract JSON from response
      let parsed: ParsedIngredient[];
      try {
        // Try to find JSON in the response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON array found in response');
        }
      } catch (parseError) {
        console.error('❌ [GROQ INGREDIENT PARSER] Failed to parse JSON response:', parseError);
        console.log('Raw response:', response.substring(0, 500));
        
        // Fallback: try to extract individual ingredient objects
        try {
          const objectMatches = response.match(/\{[^{}]*\}/g);
          if (objectMatches) {
            const fallbackParsed = objectMatches.map(match => JSON.parse(match));
            console.log('✅ [GROQ INGREDIENT PARSER] Recovered using fallback parsing');
            return fallbackParsed;
          }
        } catch (fallbackError) {
          console.log('❌ [GROQ INGREDIENT PARSER] Fallback parsing also failed');
        }
        
        // Final fallback: create simple structure from original ingredients
        console.log('🔧 [GROQ INGREDIENT PARSER] Using basic ingredient fallback');
        return ingredients.map((ing, i) => ({
          ingredient: ing.toLowerCase().replace(/^[\d\s\/]+/, '').trim().split(' ').pop() || 'ingredient',
          amount: ing.match(/^[\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\w]*/) ? (ing.match(/^[\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\w]*/) || ['1'])[0].trim() : '1',
          quantity: 1,
          unit: 'piece',
          originalText: ing
        }));
      }

      // Validate and clean up parsed data
      const validated = parsed.filter((item, index) => {
        // Ensure all required fields exist
        if (!item.ingredient || !item.amount) {
          console.warn(`⚠️ [GROQ INGREDIENT PARSER] Skipping invalid item at index ${index}`);
          return false;
        }
        
        // Add originalText if missing
        if (!item.originalText) {
          item.originalText = ingredients[index];
        }
        
        return true;
      });

      console.log(`✅ [GROQ INGREDIENT PARSER] Successfully parsed ${validated.length} ingredients`);
      return validated;
      
    } catch (error) {
      console.error('🔥 [GROQ INGREDIENT PARSER] Error parsing ingredients:', error);
      return [];
    }
  }


  // Format parsed ingredients as a table for display
  formatAsTable(parsedIngredients: ParsedIngredient[]): string {
    const lines = ['Ingredient | Amount'];
    lines.push('-----------|-------');
    
    parsedIngredients.forEach(item => {
      lines.push(`${item.ingredient} | ${item.amount}`);
    });
    
    return lines.join('\n');
  }
}

// Export singleton instance
export const groqIngredientParser = new GroqIngredientParser();