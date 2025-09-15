// Food detection main module - uses LogMeal AI
import { detectIngredientsWithLogMeal, getLogMealAPIInfo } from './logmealApiDetection';

// Re-export types for compatibility
export interface DetectedFood {
  id: string;
  name: string;
  amount: number;
  unit: string;
  confidence: number;
  included: boolean;
  isManual?: boolean;
  measureType?: 'weight' | 'volume' | 'count';
  source?: 'dish' | 'ingredient' | 'foodItem';
}

// Main detection function - uses LogMeal API only
export async function detectFoods(imageDataUrl: string): Promise<DetectedFood[]> {
  const startTime = Date.now();
  
  try {
    console.log('🍔 Starting LogMeal Food AI detection...');
    console.log('📊 Image size:', imageDataUrl.length, 'characters');
    
    // Use LogMeal API for detection
    const detections = await detectIngredientsWithLogMeal(imageDataUrl);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ LogMeal detection completed in ${elapsed}ms`);
    
    if (detections && detections.length > 0) {
      console.log(`Detected ${detections.length} foods with average confidence: ${
        (detections.reduce((sum, f) => sum + f.confidence, 0) / detections.length * 100).toFixed(1)
      }%`);
      
      // Log detected foods for debugging
      console.log('Detected foods:', detections.map(d => 
        `${d.name} (${d.amount}${d.unit}) - ${(d.confidence * 100).toFixed(0)}%`
      ).join(', '));
      
      return detections;
    } else {
      console.log('⚠️ No foods detected by LogMeal API');
      console.log('💡 Try taking a clearer photo with better lighting or add ingredients manually');
      return [];
    }
    
  } catch (error) {
    console.error('❌ LogMeal detection failed:', error);
    console.log('💡 You can add ingredients manually in the next screen');
    
    // Return empty array on error - user can add manually
    return [];
  }
}

// Parse text input for missing ingredients (backend handles via GPT)
export function parseManualFoodInput(text: string): DetectedFood[] {
  // This is handled by the backend API now
  // Keeping function for compatibility
  return [];
}

// Export model info for debugging
export function getModelInfo() {
  const logmealInfo = getLogMealAPIInfo();
  
  return {
    name: logmealInfo.name,
    version: logmealInfo.version,
    provider: logmealInfo.provider,
    features: logmealInfo.features,
    status: logmealInfo.status,
    endpoint: logmealInfo.endpoint,
    architecture: 'Advanced AI with 1300+ dish recognition',
    realAI: true
  };
}