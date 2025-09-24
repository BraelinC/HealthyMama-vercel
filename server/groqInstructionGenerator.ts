import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure env is loaded from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export class GroqInstructionGenerator {
  private client: Groq | null = null;
  
  constructor() {
    // Use GROQ_API_KEY from environment variables (Vercel)
    const groqApiKey = process.env.GROQ_API_KEY;
    
    if (groqApiKey) {
      console.log('🚀 [GROQ INSTRUCTION GEN] Initializing with GPT-OSS-20B');
      console.log('✅ [GROQ INSTRUCTION GEN] API key loaded successfully');
      this.client = new Groq({
        apiKey: groqApiKey
      });
    } else {
      console.error('❌ [GROQ INSTRUCTION GEN] GROQ_API_KEY not found in environment');
    }
  }

  async generateInstructionsFromTranscript(
    transcript: string, 
    recipeName: string,
    ingredients?: string[]
  ): Promise<string[]> {
    console.log('🎯 [GROQ INSTRUCTION GEN] Generating instructions for:', recipeName);
    
    if (!this.client) {
      console.log('⚠️ [GROQ INSTRUCTION GEN] No client available, returning empty');
      return [];
    }

    if (!transcript || transcript.length < 50) {
      console.log('❌ [GROQ INSTRUCTION GEN] Transcript too short or missing');
      return [];
    }

    try {
      console.log('📡 [GROQ INSTRUCTION GEN] Calling GPT-OSS-20B to generate instructions...');
      const startTime = Date.now();
      
      const ingredientList = ingredients?.join(', ') || 'standard ingredients';
      
      const prompt = `You are a cooking expert. Convert this video transcript into clear, complete step-by-step cooking instructions for a home cook.

Recipe: ${recipeName}
Ingredients mentioned: ${ingredientList}

Transcript:
${transcript.substring(0, 12000)} 

Create numbered cooking instructions in this EXACT format:
Step 1: [First action]
Step 2: [Second action]
Step 3: [Third action]
...

Rules:
- Each step must start with "Step N:" where N is the step number
- Keep each step clear and concise
- Include specific times, temperatures, and measurements when mentioned
- If transcript is unclear, use standard cooking logic
- Generate between 6-12 steps (no fewer than 6)
- Make instructions actionable and easy to follow
- Always include: prep, any marinades/dredging, cooking method and timing, sauce reduction (if present), combining/tossing, and a final plating/serving step
- End with a plating/serving step that mentions garnish if applicable

Return ONLY the numbered steps, nothing else.`;

      const completion = await this.client.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [{
          role: "user",
          content: prompt
        }],
        temperature: 0.3,
        max_tokens: 1800,
        reasoning_effort: "medium"
      });

      const response = completion.choices[0]?.message?.content || '';
      const timeTaken = Date.now() - startTime;
      
      console.log(`✅ [GROQ INSTRUCTION GEN] Generated in ${timeTaken}ms`);
      console.log('📝 [GROQ INSTRUCTION GEN] Raw response:', response.substring(0, 200) + '...');
      
      // Parse the response into an array of instructions
      let instructions = this.parseInstructions(response);
      // Ensure a proper finishing step exists
      if (instructions.length > 0) {
        const last = instructions[instructions.length - 1].toLowerCase();
        const hasFinish = /serve|plate|garnish|enjoy/.test(last);
        if (!hasFinish) {
          instructions = [
            ...instructions,
            `Step ${instructions.length + 1}: Plate and serve immediately. Garnish to taste (e.g., sliced green onions or sesame).`
          ];
        }
      }
      
      if (instructions.length === 0) {
        console.log('⚠️ [GROQ INSTRUCTION GEN] Failed to parse instructions, trying fallback');
        return this.generateFallbackInstructions(recipeName, ingredients);
      }
      
      console.log(`✅ [GROQ INSTRUCTION GEN] Generated ${instructions.length} instructions`);
      return instructions;
      
    } catch (error) {
      console.error('🔥 [GROQ INSTRUCTION GEN] Error generating instructions:', error);
      return this.generateFallbackInstructions(recipeName, ingredients);
    }
  }

  private parseInstructions(response: string): string[] {
    // Split by "Step" and clean up
    const lines = response.split(/Step \d+:|^\d+\.|^\d+\)/gm)
      .map(line => line.trim())
      .filter(line => line.length > 10);
    
    // If we got good steps, format them properly
    if (lines.length > 0) {
      return lines.map((instruction, index) => {
        // Clean up any extra numbering or formatting
        const cleaned = instruction
          .replace(/^[:\-\s]+/, '')
          .replace(/^\d+[\.\)]\s*/, '')
          .trim();
        
        return `Step ${index + 1}: ${cleaned}`;
      });
    }
    
    // Try alternative parsing for different formats
    const altLines = response
      .split('\n')
      .filter(line => line.trim().length > 10)
      .filter(line => /step|cook|heat|mix|add|bake|boil|fry/i.test(line));
    
    if (altLines.length > 0) {
      return altLines.map((line, index) => {
        const cleaned = line
          .replace(/^[-\*\s]+/, '')
          .replace(/^step\s*\d+[:\.\)]\s*/i, '')
          .replace(/^\d+[\.\)]\s*/, '')
          .trim();
        
        return `Step ${index + 1}: ${cleaned}`;
      });
    }
    
    return [];
  }

  private generateFallbackInstructions(recipeName: string, ingredients?: string[]): string[] {
    console.log('🔧 [GROQ INSTRUCTION GEN] Generating fallback instructions');
    
    const fallbackSteps = [
      `Step 1: Gather all ingredients and prepare your workspace`,
      `Step 2: Prep ingredients as needed (wash, chop, measure)`,
      `Step 3: Follow standard cooking method for ${recipeName}`,
      `Step 4: Cook until done according to recipe requirements`,
      `Step 5: Season to taste and serve hot`
    ];
    
    // Customize based on recipe name
    if (recipeName.toLowerCase().includes('sandwich')) {
      return [
        `Step 1: Prepare all ingredients and have them ready`,
        `Step 2: Toast bread slices if desired`,
        `Step 3: Prepare the filling according to recipe`,
        `Step 4: Assemble sandwich with prepared ingredients`,
        `Step 5: Cut diagonally and serve immediately`
      ];
    } else if (recipeName.toLowerCase().includes('egg')) {
      return [
        `Step 1: Crack eggs into a bowl`,
        `Step 2: Season with salt and pepper`,
        `Step 3: Whisk eggs until well combined`,
        `Step 4: Cook eggs in a pan over medium heat`,
        `Step 5: Serve hot with chosen accompaniments`
      ];
    }
    
    return fallbackSteps;
  }

  async enhanceInstructions(existingInstructions: string[], recipeName: string): Promise<string[]> {
    // If instructions exist but aren't in step format, reformat them
    if (existingInstructions && existingInstructions.length > 0) {
      const needsFormatting = !existingInstructions[0].toLowerCase().startsWith('step');
      
      if (needsFormatting) {
        console.log('🔄 [GROQ INSTRUCTION GEN] Reformatting existing instructions');
        return existingInstructions.map((instruction, index) => {
          if (instruction.toLowerCase().startsWith('step')) {
            return instruction;
          }
          return `Step ${index + 1}: ${instruction}`;
        });
      }
    }
    
    return existingInstructions;
  }
}

// Export singleton instance
export const groqInstructionGenerator = new GroqInstructionGenerator();
