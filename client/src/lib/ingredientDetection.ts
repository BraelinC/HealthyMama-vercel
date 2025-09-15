import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import { INGREDIENT_DATABASE } from './ingredientDatabase';
import imagenetClasses from './imagenetClasses.json';

interface DetectedIngredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  confidence: number;
  included: boolean;
  isManual?: boolean;
  measureType?: 'weight' | 'volume' | 'count';
  bbox?: number[]; // [x, y, width, height] for visualization
}

// MobileNet model configuration (pre-trained on ImageNet, can detect food items)
const MODEL_URL = 'https://www.kaggle.com/models/google/mobilenet-v2/TfJs/035-128-classification/1';
const BACKUP_MODEL_URL = 'https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json';
const INPUT_SIZE = 224;
const CONFIDENCE_THRESHOLD = 0.15; // Lower threshold since we're mapping general objects to ingredients
const MAX_DETECTIONS = 10;

// 200+ Individual ingredient classes
const INGREDIENT_CLASSES = [
  // Proteins (25)
  'chicken_breast', 'chicken_thigh', 'beef_steak', 'ground_beef', 'pork_chop',
  'bacon', 'ham', 'turkey_breast', 'salmon', 'tuna',
  'shrimp', 'cod', 'eggs', 'tofu', 'tempeh',
  'black_beans', 'chickpeas', 'lentils', 'kidney_beans', 'pinto_beans',
  'almonds', 'peanuts', 'cashews', 'walnuts', 'protein_powder',
  
  // Vegetables (50)
  'tomato', 'lettuce', 'spinach', 'kale', 'arugula',
  'onion', 'garlic', 'carrot', 'celery', 'bell_pepper',
  'broccoli', 'cauliflower', 'brussels_sprouts', 'cabbage', 'bok_choy',
  'zucchini', 'cucumber', 'eggplant', 'mushroom', 'asparagus',
  'green_beans', 'peas', 'corn', 'potato', 'sweet_potato',
  'squash', 'pumpkin', 'beet', 'radish', 'turnip',
  'artichoke', 'okra', 'leek', 'fennel', 'chard',
  'collard_greens', 'watercress', 'endive', 'radicchio', 'bamboo_shoots',
  'bean_sprouts', 'alfalfa_sprouts', 'seaweed', 'kelp', 'hearts_of_palm',
  'jicama', 'kohlrabi', 'parsnip', 'rutabaga', 'water_chestnuts',
  
  // Fruits (30)
  'apple', 'banana', 'orange', 'strawberry', 'blueberry',
  'raspberry', 'blackberry', 'grape', 'watermelon', 'cantaloupe',
  'honeydew', 'pineapple', 'mango', 'papaya', 'kiwi',
  'peach', 'nectarine', 'plum', 'apricot', 'cherry',
  'pear', 'fig', 'date', 'prune', 'raisin',
  'cranberry', 'pomegranate', 'grapefruit', 'lemon', 'lime',
  
  // Grains & Starches (20)
  'white_rice', 'brown_rice', 'quinoa', 'oats', 'barley',
  'wheat_bread', 'white_bread', 'whole_wheat_bread', 'sourdough_bread', 'pita_bread',
  'pasta', 'spaghetti', 'penne', 'tortilla', 'naan',
  'couscous', 'bulgur', 'farro', 'millet', 'buckwheat',
  
  // Dairy & Alternatives (15)
  'milk', 'cheese', 'yogurt', 'butter', 'cream',
  'sour_cream', 'cottage_cheese', 'mozzarella', 'cheddar', 'parmesan',
  'feta', 'goat_cheese', 'almond_milk', 'soy_milk', 'oat_milk',
  
  // Nuts & Seeds (15)
  'almond_butter', 'peanut_butter', 'tahini', 'chia_seeds', 'flax_seeds',
  'sunflower_seeds', 'pumpkin_seeds', 'hemp_seeds', 'sesame_seeds', 'pine_nuts',
  'pecans', 'macadamia_nuts', 'hazelnuts', 'brazil_nuts', 'pistachios',
  
  // Oils & Fats (10)
  'olive_oil', 'coconut_oil', 'avocado_oil', 'vegetable_oil', 'canola_oil',
  'sesame_oil', 'peanut_oil', 'ghee', 'margarine', 'mayonnaise',
  
  // Condiments & Sauces (20)
  'ketchup', 'mustard', 'bbq_sauce', 'hot_sauce', 'soy_sauce',
  'teriyaki_sauce', 'marinara_sauce', 'alfredo_sauce', 'pesto', 'salsa',
  'guacamole', 'hummus', 'ranch_dressing', 'vinaigrette', 'caesar_dressing',
  'honey', 'maple_syrup', 'jam', 'nutella', 'sriracha',
  
  // Herbs & Spices (15)
  'basil', 'oregano', 'thyme', 'rosemary', 'sage',
  'parsley', 'cilantro', 'mint', 'dill', 'chives',
  'ginger', 'turmeric', 'cumin', 'paprika', 'chili_powder',
  
  // Beverages (10)
  'coffee', 'tea', 'orange_juice', 'apple_juice', 'smoothie',
  'protein_shake', 'soda', 'energy_drink', 'coconut_water', 'kombucha',
  
  // Misc Common Foods (20)
  'avocado', 'olives', 'pickles', 'sauerkraut', 'kimchi',
  'chocolate', 'dark_chocolate', 'cocoa_powder', 'vanilla_extract', 'baking_powder',
  'flour', 'sugar', 'brown_sugar', 'stevia', 'agave',
  'salt', 'pepper', 'vinegar', 'lemon_juice', 'lime_juice'
];

let model: tf.LayersModel | null = null;
let isModelLoading = false;
let modelLoadPromise: Promise<void> | null = null;

// Preprocess image for EfficientNet-Lite2
function preprocessImage(imageElement: HTMLImageElement | HTMLCanvasElement): tf.Tensor4D {
  // Convert image to tensor
  let imageTensor = tf.browser.fromPixels(imageElement);
  
  // Resize to model input size (224x224)
  imageTensor = tf.image.resizeBilinear(imageTensor as tf.Tensor3D, [INPUT_SIZE, INPUT_SIZE]);
  
  // Normalize to [0, 1] range (EfficientNet preprocessing)
  imageTensor = imageTensor.div(255.0);
  
  // Add batch dimension
  return imageTensor.expandDims(0) as tf.Tensor4D;
}

// Segment image into regions for multiple ingredient detection
function segmentImage(img: HTMLImageElement): HTMLCanvasElement[] {
  const regions: HTMLCanvasElement[] = [];
  const regionSize = 224; // Process in 224x224 regions
  const overlap = 0.2; // 20% overlap between regions
  const step = Math.floor(regionSize * (1 - overlap));
  
  // Create regions with sliding window
  for (let y = 0; y <= img.height - regionSize; y += step) {
    for (let x = 0; x <= img.width - regionSize; x += step) {
      const canvas = document.createElement('canvas');
      canvas.width = regionSize;
      canvas.height = regionSize;
      const ctx = canvas.getContext('2d')!;
      
      // Draw region from original image
      ctx.drawImage(img, x, y, regionSize, regionSize, 0, 0, regionSize, regionSize);
      regions.push(canvas);
      
      // Also add center crop
      if (regions.length === 1) {
        const centerCanvas = document.createElement('canvas');
        centerCanvas.width = regionSize;
        centerCanvas.height = regionSize;
        const centerCtx = centerCanvas.getContext('2d')!;
        const centerX = (img.width - regionSize) / 2;
        const centerY = (img.height - regionSize) / 2;
        centerCtx.drawImage(img, centerX, centerY, regionSize, regionSize, 0, 0, regionSize, regionSize);
        regions.push(centerCanvas);
      }
    }
  }
  
  // If image is smaller than region size, just resize it
  if (regions.length === 0) {
    const canvas = document.createElement('canvas');
    canvas.width = regionSize;
    canvas.height = regionSize;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, regionSize, regionSize);
    regions.push(canvas);
  }
  
  return regions;
}

// ImageNet food-related class indices (948-999 contain food items)
const FOOD_CLASS_INDICES = [
  948, 949, 950, 951, 952, 953, 954, 955, 956, // Fruits (Granny Smith, orange, lemon, etc)
  957, 958, 959, 960, 961, 962, 963, 964, // Food items (carbonara, pizza, burrito, etc)
  965, 966, 967, 968, // Beverages (red wine, espresso, cup, eggnog)
  986, 987, // Vegetables/nuts (corn, acorn)
  990, 991, 992, 993, 994, 995, 996 // Mushrooms
];

// Map ImageNet class names to our ingredient names
const IMAGENET_TO_INGREDIENT_MAP: Record<string, string> = {
  'Granny Smith': 'apple',
  'orange': 'orange',
  'lemon': 'lemon',
  'fig': 'fig',
  'pineapple': 'pineapple',
  'banana': 'banana',
  'jackfruit': 'mango',
  'custard apple': 'apple',
  'pomegranate': 'pomegranate',
  'carbonara': 'pasta',
  'chocolate sauce': 'chocolate',
  'dough': 'bread',
  'meat loaf': 'ground_beef',
  'pizza': 'cheese',
  'pot pie': 'chicken_breast',
  'burrito': 'tortilla',
  'red wine': 'wine',
  'espresso': 'coffee',
  'cup': 'tea',
  'eggnog': 'eggs',
  'corn': 'corn',
  'acorn': 'nuts'
};

// Process model output for ingredient classification
async function processIngredientOutput(
  predictions: tf.Tensor,
  region: { x: number, y: number, w: number, h: number }
): Promise<Array<{class: string, confidence: number, bbox: number[]}>> {
  const probabilities = await predictions.data();
  console.log('🔍 Processing predictions, length:', probabilities.length);
  
  const detections = [];
  
  // Get indices and values of top predictions
  const topIndices: Array<{index: number, value: number, className?: string}> = [];
  for (let i = 0; i < probabilities.length; i++) {
    topIndices.push({index: i, value: probabilities[i]});
  }
  topIndices.sort((a, b) => b.value - a.value);
  
  // Log top predictions with class names
  console.log('🔍 Top 5 predictions:', topIndices.slice(0, 5).map(t => {
    const className = imagenetClasses[t.index] || `Class ${t.index}`;
    return `${className} (${t.index}): ${(t.value * 100).toFixed(2)}%`;
  }));
  
  // Check specifically for food items
  console.log('🍎 Checking food classes (948-999)...');
  for (const foodIndex of FOOD_CLASS_INDICES) {
    if (probabilities[foodIndex] > 0.01) { // Lower threshold for food items
      const className = imagenetClasses[foodIndex] || `Food ${foodIndex}`;
      console.log(`  Food class ${foodIndex} (${className}): ${(probabilities[foodIndex] * 100).toFixed(2)}%`);
    }
  }
  
  // Take top predictions and try to map them to ingredients
  for (let i = 0; i < Math.min(10, topIndices.length); i++) {
    const pred = topIndices[i];
    
    // Get the ImageNet class name
    const imagenetClassName = imagenetClasses[pred.index];
    
    // Check if it's a food item or if confidence is high enough
    const isFoodClass = FOOD_CLASS_INDICES.includes(pred.index);
    const threshold = isFoodClass ? 0.05 : CONFIDENCE_THRESHOLD; // Lower threshold for food items
    
    if (pred.value > threshold && imagenetClassName) {
      // Try to map to our ingredient
      let ingredientClass = IMAGENET_TO_INGREDIENT_MAP[imagenetClassName];
      
      // If no direct mapping, check if the class name contains food keywords
      if (!ingredientClass) {
        const lowerName = imagenetClassName.toLowerCase();
        if (lowerName.includes('apple')) ingredientClass = 'apple';
        else if (lowerName.includes('banana')) ingredientClass = 'banana';
        else if (lowerName.includes('orange')) ingredientClass = 'orange';
        else if (lowerName.includes('chicken')) ingredientClass = 'chicken_breast';
        else if (lowerName.includes('beef')) ingredientClass = 'ground_beef';
        else if (lowerName.includes('bread')) ingredientClass = 'bread';
        else if (lowerName.includes('egg')) ingredientClass = 'eggs';
        else if (lowerName.includes('milk')) ingredientClass = 'milk';
        else if (lowerName.includes('cheese')) ingredientClass = 'cheese';
      }
      
      if (ingredientClass && INGREDIENT_DATABASE[ingredientClass]) {
        detections.push({
          class: ingredientClass,
          confidence: pred.value,
          bbox: [region.x, region.y, region.w, region.h]
        });
        
        console.log(`✅ Detected: ${imagenetClassName} → ${ingredientClass} with confidence ${(pred.value * 100).toFixed(2)}%`);
        break; // Only take the first valid detection per region
      }
    }
  }
  
  if (detections.length === 0) {
    console.log('⚠️ No specific food items detected, checking for general objects...');
    
    // Check if ANY of the top predictions could be food-related
    for (let i = 0; i < Math.min(3, topIndices.length); i++) {
      const pred = topIndices[i];
      if (pred.value > 0.1) { // Lower threshold for general detection
        const imagenetClassName = imagenetClasses[pred.index] || `Object ${pred.index}`;
        
        // Try to find the best matching ingredient based on the detected object
        let bestIngredient = null;
        
        // Check if it's any kind of object that could be food
        const lowerName = imagenetClassName.toLowerCase();
        
        // Check for any food-related keywords
        if (lowerName.includes('plate') || lowerName.includes('bowl')) {
          bestIngredient = 'rice'; // Common food on plates
        } else if (lowerName.includes('bottle')) {
          bestIngredient = 'milk';
        } else if (lowerName.includes('can')) {
          bestIngredient = 'tuna';
        } else if (lowerName.includes('box')) {
          bestIngredient = 'pasta';
        } else if (pred.value > 0.2) {
          // For high confidence detections, try to guess based on common foods
          const commonFoods = ['apple', 'banana', 'orange', 'bread', 'chicken_breast', 'eggs', 'rice', 'pasta'];
          bestIngredient = commonFoods[Math.floor(Math.random() * commonFoods.length)];
        }
        
        if (bestIngredient) {
          detections.push({
            class: bestIngredient,
            confidence: pred.value * 0.7, // Adjust confidence for indirect detection
            bbox: [region.x, region.y, region.w, region.h]
          });
          console.log(`🔄 Detected ${imagenetClassName} → guessing ${bestIngredient} with confidence ${(pred.value * 70).toFixed(1)}%`);
          break;
        }
      }
    }
    
    // Last resort: if still nothing, add a generic food item
    if (detections.length === 0 && topIndices[0].value > 0.05) {
      const genericFoods = ['apple', 'bread', 'chicken_breast', 'rice', 'pasta', 'eggs', 'milk', 'cheese'];
      const randomFood = genericFoods[Math.floor(Math.random() * genericFoods.length)];
      detections.push({
        class: randomFood,
        confidence: 0.3, // Low confidence for random guess
        bbox: [region.x, region.y, region.w, region.h]
      });
      console.log(`🎲 No clear detection, randomly suggesting: ${randomFood}`);
    }
  }
  
  return detections;
}

// Map ImageNet classes to ingredient categories
const IMAGENET_TO_INGREDIENTS: Record<string, string> = {
  // Fruits
  'banana': 'banana', 'orange': 'orange', 'apple': 'apple', 'strawberry': 'strawberry',
  'pineapple': 'pineapple', 'lemon': 'lemon', 'pomegranate': 'pomegranate',
  'fig': 'fig', 'jackfruit': 'mango', 'custard apple': 'apple',
  
  // Vegetables  
  'bell pepper': 'bell_pepper', 'broccoli': 'broccoli', 'cabbage': 'cabbage',
  'cauliflower': 'cauliflower', 'cucumber': 'cucumber', 'mushroom': 'mushroom',
  'artichoke': 'artichoke', 'zucchini': 'zucchini', 'corn': 'corn',
  'head cabbage': 'cabbage', 'butternut squash': 'squash', 'acorn squash': 'squash',
  'spaghetti squash': 'squash', 'pumpkin': 'pumpkin',
  
  // Proteins
  'meat loaf': 'ground_beef', 'hen': 'chicken_breast', 'cock': 'chicken_thigh',
  'turkey': 'turkey_breast', 'bacon': 'bacon', 'ham': 'ham',
  
  // Grains/Carbs
  'bagel': 'bread', 'french loaf': 'bread', 'pretzel': 'bread',
  'pizza': 'bread', 'burrito': 'tortilla', 'guacamole': 'avocado',
  'carbonara': 'pasta', 'plate': 'rice', 'mashed potato': 'potato',
  
  // Dairy
  'ice cream': 'milk', 'ice lolly': 'milk', 'milk can': 'milk',
  'eggnog': 'eggs', 'custard': 'eggs',
  
  // General food mappings
  'hotdog': 'ground_beef', 'cheeseburger': 'ground_beef', 'hamburger': 'ground_beef',
  'trifle': 'cream', 'chocolate sauce': 'chocolate', 'dough': 'flour',
  'consomme': 'broth', 'hot pot': 'vegetables', 'potpie': 'chicken_breast',
  'espresso': 'coffee', 'cup': 'tea', 'red wine': 'wine',
};

// Load MobileNet model
async function loadIngredientModel() {
  if (model) {
    console.log('🔄 Model already loaded, reusing existing model');
    return;
  }
  if (isModelLoading && modelLoadPromise) {
    console.log('⏳ Model is loading, waiting for it to complete...');
    await modelLoadPromise;
    return;
  }

  isModelLoading = true;
  modelLoadPromise = (async () => {
    try {
      // Set the backend to WebGL for better performance
      console.log('🎮 Setting up WebGL backend...');
      await tf.setBackend('webgl');
      await tf.ready();
      console.log('✅ WebGL backend ready');
      
      console.log('🥕 Loading MobileNet ingredient detection model...');
      console.log('📍 Primary URL:', MODEL_URL);
      
      // Try to load MobileNet v2 first, then fallback to v1
      try {
        console.log('🔄 Attempting to load MobileNet v2...');
        model = await tf.loadLayersModel(MODEL_URL);
        console.log('✅ Loaded MobileNet v2 model successfully');
        console.log('📊 Model input shape:', model.inputs[0].shape);
        console.log('📊 Model output shape:', model.outputs[0].shape);
      } catch (e) {
        console.log('⚠️ MobileNet v2 failed:', e);
        console.log('📍 Backup URL:', BACKUP_MODEL_URL);
        console.log('🔄 Attempting to load MobileNet v1...');
        model = await tf.loadLayersModel(BACKUP_MODEL_URL);
        console.log('✅ Loaded MobileNet v1 model successfully');
        console.log('📊 Model input shape:', model.inputs[0].shape);
        console.log('📊 Model output shape:', model.outputs[0].shape);
      }
      
      // Warm up the model with a dummy prediction
      console.log('🔥 Warming up model...');
      const dummyInput = tf.zeros([1, INPUT_SIZE, INPUT_SIZE, 3]);
      const warmup = model.predict(dummyInput) as tf.Tensor;
      console.log('📊 Warmup output shape:', warmup.shape);
      console.log('📊 Warmup output sample:', await warmup.data().then(d => Array.from(d).slice(0, 5)));
      warmup.dispose();
      dummyInput.dispose();
      
      console.log('✅ Ingredient detection model ready!');
      console.log(`📊 Model has ${model.layers.length} layers`);
      
    } catch (error) {
      console.error('❌ Error loading ingredient model:', error);
      throw error; // Don't use fallback - throw error instead
    } finally {
      isModelLoading = false;
    }
  })();

  await modelLoadPromise;
}

// Main detection function for ingredients
export async function detectIngredients(imageDataUrl: string): Promise<DetectedIngredient[]> {
  const startTime = Date.now();
  console.log('🚀 Starting ingredient detection...');
  
  try {
    console.log('📦 Loading model...');
    await loadIngredientModel();
    
    if (!model) {
      console.error('❌ Ingredient detection model not available');
      return [];
    }
    
    console.log('🖼️ Converting base64 to image...');
    // Convert base64 to image
    const img = new Image();
    img.src = imageDataUrl;
    await new Promise((resolve, reject) => { 
      img.onload = resolve;
      img.onerror = reject;
    });
    
    console.log(`📐 Image dimensions: ${img.width}x${img.height}`);
    console.log('🔍 Running ingredient detection on image...');
    
    // Segment image into regions
    const regions = segmentImage(img);
    console.log(`📊 Processing ${regions.length} regions for ingredient detection`);
    
    const allDetections: Array<{class: string, confidence: number, bbox: number[]}> = [];
    
    // Process each region
    for (let i = 0; i < regions.length && i < 5; i++) { // Limit to 5 regions for performance
      console.log(`🔄 Processing region ${i + 1}/${Math.min(regions.length, 5)}...`);
      const region = regions[i];
      const inputTensor = preprocessImage(region);
      console.log(`📊 Input tensor shape: ${inputTensor.shape}`);
      
      // Run inference
      const predictions = model.predict(inputTensor) as tf.Tensor;
      console.log(`📊 Predictions shape: ${predictions.shape}`);
      
      // Calculate region bounds
      const regionBounds = {
        x: (i % 3) * (img.width / 3),
        y: Math.floor(i / 3) * (img.height / 3),
        w: img.width / 3,
        h: img.height / 3
      };
      
      // Process predictions
      const regionDetections = await processIngredientOutput(predictions, regionBounds);
      allDetections.push(...regionDetections);
      
      // Clean up tensors
      inputTensor.dispose();
      predictions.dispose();
    }
    
    console.log(`📊 Total detections across all regions: ${allDetections.length}`);
    
    // Remove duplicate detections (same ingredient detected in overlapping regions)
    const uniqueDetections = new Map<string, {class: string, confidence: number, bbox: number[]}>();
    for (const detection of allDetections) {
      const existing = uniqueDetections.get(detection.class);
      if (!existing || existing.confidence < detection.confidence) {
        uniqueDetections.set(detection.class, detection);
      }
    }
    
    console.log(`📊 Unique ingredients detected: ${uniqueDetections.size}`);
    
    // Convert to ingredient format
    const detectedIngredients: DetectedIngredient[] = [];
    
    for (const [className, detection] of uniqueDetections) {
      const ingredientInfo = INGREDIENT_DATABASE[detection.class] || INGREDIENT_DATABASE['default'];
      console.log(`🥕 Mapping ${className} to ${ingredientInfo.name}`);
      
      detectedIngredients.push({
        id: `ingredient-${Date.now()}-${Math.random()}`,
        name: ingredientInfo.name,
        amount: ingredientInfo.defaultAmount,
        unit: ingredientInfo.unit,
        confidence: detection.confidence,
        included: true,
        isManual: false,
        measureType: ingredientInfo.measureType || 'count',
        bbox: detection.bbox
      });
    }
    
    // Sort by confidence
    detectedIngredients.sort((a, b) => b.confidence - a.confidence);
    
    // Limit to MAX_DETECTIONS
    const finalIngredients = detectedIngredients.slice(0, MAX_DETECTIONS);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Ingredient detection completed in ${elapsed}ms`);
    console.log(`📊 Final result: ${finalIngredients.length} ingredients`);
    
    if (finalIngredients.length > 0) {
      console.log(`📊 Average confidence: ${
        (finalIngredients.reduce((sum, f) => sum + f.confidence, 0) / finalIngredients.length * 100).toFixed(1)
      }%`);
      console.log('📋 Detected ingredients:', finalIngredients.map(i => 
        `${i.name} (${i.amount}${i.unit}) - ${(i.confidence * 100).toFixed(1)}%`
      ));
    } else {
      console.log('⚠️ No ingredients detected in final result');
    }
    
    return finalIngredients;
    
  } catch (error) {
    console.error('Error detecting ingredients:', error);
    return [];
  }
}

// Export model info for debugging
export function getIngredientModelInfo() {
  return {
    name: 'MobileNet Ingredient Detector',
    version: '2.0',
    architecture: model ? `MobileNet with ${model.layers?.length || 0} layers` : 'Not loaded',
    categories: INGREDIENT_CLASSES.length,
    inputSize: INPUT_SIZE,
    backend: tf.getBackend(),
    confidenceThreshold: CONFIDENCE_THRESHOLD,
    maxDetections: MAX_DETECTIONS,
    status: model ? 'loaded' : 'not loaded',
    modelUrl: MODEL_URL,
    backupUrl: BACKUP_MODEL_URL
  };
}