import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env is loaded from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export class GroqRecipeValidator {
  private client: Groq | null = null;
  
  constructor() {
    // Use GROQ_API_KEY from environment variables (Vercel)
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (groqApiKey) {
      console.log('🚀 [GROQ VALIDATOR] Initializing with API key:', groqApiKey.substring(0, 10) + '...');
      console.log('✅ [GROQ VALIDATOR] API key loaded successfully');
      this.client = new Groq({
        apiKey: groqApiKey
      });
    } else {
      console.error('❌ [GROQ VALIDATOR] GROQ_API_KEY not found, using fallback validation');
    }
  }

  async validateInstructions(instructions: string | string[] | undefined | null): Promise<boolean> {
    // Convert array to string if needed
    let instructionText: string;
    
    if (Array.isArray(instructions)) {
      // Check for empty array
      if (instructions.length === 0) {
        console.log('❌ [GROQ VALIDATOR] Empty instructions array, returning false');
        return false;
      }
      instructionText = instructions.join(' ');
      console.log('🔍 [GROQ VALIDATOR] Instructions provided as array with', instructions.length, 'items, joined to string');
    } else if (typeof instructions === 'string') {
      instructionText = instructions;
    } else {
      console.log('❌ [GROQ VALIDATOR] Instructions missing or invalid type');
      return false;
    }
    
    console.log('🔍 [GROQ VALIDATOR] Starting validation for instructions:', instructionText?.substring(0, 100) + '...');
    
    // Basic validation
    if (!instructionText || instructionText.length < 30) {
      console.log('❌ [GROQ VALIDATOR] Instructions too short or missing, returning false');
      return false;
    }
    
    // If no client (no API key), use fallback
    if (!this.client) {
      console.log('⚠️ [GROQ VALIDATOR] No Groq client, using fallback validation');
      return this.fallbackValidation(instructionText);
    }
    
    try {
      console.log('📡 [GROQ VALIDATOR] Calling validation model via Groq API...');
      const startTime = Date.now();
      
      // Try GPT-OSS-20B first but check reasoning field too
      const completion = await this.client.chat.completions.create({
        model: "openai/gpt-oss-20b",  // Using GPT-OSS-20B for fast validation
        messages: [{
          role: "user",
          content: `Reply with only VALID or INVALID. Are these clear cooking instructions? ${instructionText.substring(0, 500)}`
        }],
        temperature: 0,
        max_tokens: 10
      });

      // GPT-OSS-20B returns response in reasoning field, not content
      let response = completion.choices[0]?.message?.content?.trim() || '';
      const reasoning = (completion.choices[0]?.message as any)?.reasoning || '';
      
      // If content is empty but reasoning exists, try to extract from reasoning
      if (!response && reasoning) {
        console.log(`📝 [GROQ VALIDATOR] Extracting from reasoning: "${reasoning.substring(0, 100)}"`);
        // GPT-OSS models put their answer in reasoning, so we'll use fallback
        response = this.fallbackValidation(instructionText) ? 'VALID' : 'INVALID';
        console.log(`📝 [GROQ VALIDATOR] Using fallback result: ${response}`);
      }
      
      const timeTaken = Date.now() - startTime;
      console.log(`✅ [GROQ VALIDATOR] Validation response: "${response}" (took ${timeTaken}ms)`);
      
      const isValid = response.includes('VALID') && !response.includes('INVALID');
      console.log(`📊 [GROQ VALIDATOR] Validation result: ${isValid ? 'VALID ✓' : 'INVALID ✗'}`);
      
      return isValid;
    } catch (error) {
      console.error('🔥 [GROQ VALIDATOR] Groq API error:', error);
      console.log('⚠️ [GROQ VALIDATOR] Falling back to local validation due to error');
      return this.fallbackValidation(instructionText);
    }
  }

  private fallbackValidation(instructions: string): boolean {
    console.log('🔧 [GROQ VALIDATOR] Running fallback validation...');
    
    // Quick local checks if API fails or no API key
    const hasMinLength = instructions.length > 50;
    const hasCookingVerbs = /cook|bake|mix|heat|boil|fry|stir|add|pour|slice|chop/i.test(instructions);
    const hasSteps = /\d+\.|step|first|then|next|finally/i.test(instructions);
    
    console.log(`  - Has minimum length (>50 chars): ${hasMinLength}`);
    console.log(`  - Has cooking verbs: ${hasCookingVerbs}`);
    console.log(`  - Has step indicators: ${hasSteps}`);
    
    const isValid = hasMinLength && hasCookingVerbs && hasSteps;
    console.log(`🔧 [GROQ VALIDATOR] Fallback result: ${isValid ? 'VALID ✓' : 'INVALID ✗'}`);
    
    return isValid;
  }

  // Batch validation for multiple recipes
  async validateBatch(recipes: any[]): Promise<any[]> {
    console.log(`📦 [GROQ VALIDATOR] Starting batch validation for ${recipes.length} recipes`);
    
    const validationPromises = recipes.map(async (recipe, index) => {
      console.log(`  🍳 Validating recipe ${index + 1}/${recipes.length}: ${recipe.title || 'Unknown'}`);
      const isValid = await this.validateInstructions(recipe.instructions);
      
      // Replace invalid instructions with standard message
      if (!isValid) {
        console.log(`  ❌ Recipe "${recipe.title}" has invalid instructions, replacing with "No instructions available"`);
        recipe.instructions = "No instructions available";
      } else {
        console.log(`  ✅ Recipe "${recipe.title}" has valid instructions`);
      }
      
      return recipe;
    });
    
    const results = await Promise.all(validationPromises);
    console.log(`📦 [GROQ VALIDATOR] Batch validation complete`);
    return results;
  }
}

// Export singleton instance
export const groqValidator = new GroqRecipeValidator();