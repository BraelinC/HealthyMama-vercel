// LogMeal API integration for advanced food detection
import { INGREDIENT_DATABASE } from './ingredientDatabase';

interface LogMealIngredient {
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

interface LogMealAPIResponse {
  ingredients: Array<{
    id: string;
    name: string;
    confidence: number;
    amount: number;
    unit: string;
    measureType: string;
    source: string;
  }>;
  raw: {
    hasRecognitionResults: boolean;
    hasFoodTypes: boolean;
    hasIngredients: boolean;
    hasFoodItems: boolean;
    totalDetections?: number;
    uniqueDetections?: number;
    endpointsUsed?: string[];
    sourceBreakdown?: Record<string, number>;
  };
}

// Compress image before sending to reduce size
function compressImage(imageDataUrl: string, maxWidth: number = 1024): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Calculate new dimensions
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to JPEG with compression (0.8 quality for better accuracy)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      console.log(`📸 Image compressed: ${imageDataUrl.length} → ${compressedDataUrl.length} bytes (${Math.round((1 - compressedDataUrl.length/imageDataUrl.length) * 100)}% reduction)`);
      resolve(compressedDataUrl);
    };
    img.src = imageDataUrl;
  });
}

// Call backend LogMeal API endpoint
export async function detectIngredientsWithLogMeal(imageDataUrl: string): Promise<LogMealIngredient[]> {
  const startTime = Date.now();
  console.log('🍔 Starting LogMeal AI food detection...');
  console.log('📡 API Endpoint: /api/detect-foods-logmeal');
  console.log('📊 Original image length:', imageDataUrl.length);
  
  try {
    // Compress image if it's too large
    let imageToSend = imageDataUrl;
    if (imageDataUrl.length > 150000) { // If larger than 150KB
      console.log('🗜️ Compressing large image...');
      imageToSend = await compressImage(imageDataUrl);
    }
    
    // Call our backend endpoint which handles the LogMeal API
    console.log('🔄 Sending request to LogMeal backend...');
    const response = await fetch('/api/detect-foods-logmeal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageToSend
      })
    });
    
    console.log('📨 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ LogMeal API error response:', errorText);
      throw new Error(`LogMeal API request failed: ${response.status} - ${errorText}`);
    }
    
    const data: LogMealAPIResponse = await response.json();
    
    // Check if it's an error response
    if ((data as any).error) {
      console.error('❌ Backend error:', (data as any).error);
      throw new Error((data as any).error);
    }
    
    console.log(`✅ LogMeal API response: ${data.ingredients?.length || 0} foods detected`);
    if (data.raw) {
      console.log(`📊 Detection types:`, {
        dishes: data.raw.hasRecognitionResults,
        foodTypes: data.raw.hasFoodTypes,
        ingredients: data.raw.hasIngredients,
        foodItems: data.raw.hasFoodItems
      });
    }
    
    // Convert LogMeal results to our ingredient format
    const detectedIngredients: LogMealIngredient[] = [];
    
    for (const item of data.ingredients || []) {
      // Skip items with very low confidence
      if (item.confidence < 0.2) {
        console.log(`⚠️ Skipping low confidence item: ${item.name} (${(item.confidence * 100).toFixed(1)}%)`);
        continue;
      }
      
      // Skip generic terms that don't provide useful information
      const genericTerms = ['ingredients', 'food', 'meal', 'dish'];
      if (genericTerms.includes(item.name.toLowerCase())) {
        console.log(`⚠️ Skipping generic classification: ${item.name}`);
        continue;
      }
      
      // Map to our ingredient database if possible
      let finalName = item.name;
      let ingredientInfo = null;
      
      // Try to find in our database
      const ingredientKey = item.name.toLowerCase().replace(/\s+/g, '_');
      if (INGREDIENT_DATABASE[ingredientKey]) {
        ingredientInfo = INGREDIENT_DATABASE[ingredientKey];
        finalName = ingredientInfo.name;
        console.log(`🔄 Mapped "${item.name}" to database: ${finalName}`);
      } else {
        // Use LogMeal's name and units
        console.log(`🥘 Using LogMeal detection: ${item.name}`);
      }
      
      detectedIngredients.push({
        id: item.id,
        name: finalName,
        amount: item.amount || (ingredientInfo?.defaultAmount || 1),
        unit: item.unit || (ingredientInfo?.unit || 'serving'),
        confidence: item.confidence,
        included: true,
        isManual: false,
        measureType: (item.measureType as any) || (ingredientInfo?.measureType) || 'count',
        source: item.source as any
      });
      
      console.log(`  ✅ ${item.source}: ${finalName} - ${item.amount}${item.unit} (${(item.confidence * 100).toFixed(1)}% confidence)`);
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`⏱️ LogMeal detection completed in ${elapsed}ms`);
    
    if (detectedIngredients.length > 0) {
      console.log(`📊 Average confidence: ${
        (detectedIngredients.reduce((sum, f) => sum + f.confidence, 0) / detectedIngredients.length * 100).toFixed(1)
      }%`);
      console.log('📋 Detected foods:', detectedIngredients.map(i => 
        `${i.name} (${i.amount}${i.unit}) - ${(i.confidence * 100).toFixed(1)}%`
      ));
    } else {
      console.log('⚠️ No specific foods detected by LogMeal API');
      
      // Check if raw data indicates rate limiting
      if (data.raw && data.raw.endpointsUsed && data.raw.endpointsUsed.length > 0) {
        console.log('⚠️ The LogMeal API may be rate limited or experiencing issues');
        console.log('💡 This is a known limitation of the free tier API');
      } else {
        console.log('💡 Tips for better detection:');
        console.log('   • Ensure good lighting and clear image');
        console.log('   • Center the food in the frame');
        console.log('   • Capture individual ingredients separately if possible');
        console.log('   • Try different angles or closer shots');
      }
      
      // Return empty array but don't throw error - let user add manually
      console.log('ℹ️ You can manually add ingredients using the form below');
    }
    
    return detectedIngredients;
    
  } catch (error) {
    console.error('❌ LogMeal API detection error:', error);
    throw error;
  }
}

// Get LogMeal API status/info
export function getLogMealAPIInfo() {
  return {
    name: 'LogMeal Food AI',
    version: '2.0',
    provider: 'LogMeal',
    features: [
      '1300+ Dish Recognition',
      'Multi-dish Detection', 
      'Ingredient Extraction',
      'Quantity Estimation',
      'Nutritional Analysis'
    ],
    status: 'ready',
    endpoint: '/api/detect-foods-logmeal',
    capabilities: 'Advanced food recognition with ingredients and portions'
  };
}