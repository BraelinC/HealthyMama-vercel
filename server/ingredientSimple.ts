import { groqIngredientExtractor } from './groqIngredientExtractor';

const qtyPattern = /(\d+\s?\/\s?\d+|\d+(?:\.\d+)?|½|¼|¾|⅓|⅔)\s*(cup|cups|tbsp|tsp|tablespoon|teaspoon|oz|ounce|ounces|lb|pound|g|gram|grams|ml|l|liter|liters|item|clove|slice|can|jar|package|pkg|pinch)/i;

export function listHasAmounts(list: string[]): boolean {
  if (!Array.isArray(list) || list.length === 0) return false;
  const hits = list.filter((i: any) => typeof i === 'string' && qtyPattern.test(i)).length;
  return hits >= Math.max(1, Math.round(list.length * 0.4));
}

function clean(list: string[]): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  return list
    .filter(Boolean)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(s => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export async function ensureMeasuredIngredients(args: {
  transcript: string;
  description?: string;
  initial: string[];
  title: string;
}): Promise<string[]> {
  const { transcript, initial, title } = args;

  // 1) If initial extraction produced anything, keep it as-is (no further validation)
  const initialClean = clean(initial || []);
  if (initialClean.length > 0) {
    console.log(`[ING SIMPLE] initial_present: ${initialClean.length}`);
    return initialClean;
  }

  // 2) If initial is empty, try transcript → Groq once, and return whatever it gives (cleaned)
  console.log('[ING SIMPLE] initial_empty -> try_transcript');
  if (transcript && transcript.length > 50) {
    try {
      const extracted = await groqIngredientExtractor.extractFromTranscript(transcript, title);
      const mapped = Array.isArray(extracted)
        ? extracted.map((ing: any) => ing.display_text || `${(ing.measurements?.[0]?.quantity ?? '')} ${(ing.measurements?.[0]?.unit ?? '')} ${ing.name}`.trim())
        : [];
      const cleaned = clean(mapped);
      console.log(`[ING SIMPLE] transcript_result: ${cleaned.length}`);
      return cleaned;
    } catch (e) {
      console.error('[ING SIMPLE] transcript_failed:', e);
      return [];
    }
  }

  console.log('[ING SIMPLE] no_transcript -> empty');
  return [];
}


