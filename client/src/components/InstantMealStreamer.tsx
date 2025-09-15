import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChefHat, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InstantMealStreamerProps {
  filters: {
    numDays: number;
    mealsPerDay: number;
    cookTime: number;
    difficulty: number;
    nutritionGoal?: string;
    dietaryRestrictions?: string;
    availableIngredients?: string;
    excludeIngredients?: string;
    primaryGoal?: string;
    culturalBackground?: string[];
    selectedFamilyMembers?: string[];
    useIntelligentPrompt?: boolean;
  };
  onComplete: (mealPlan: any) => void;
  onCancel: () => void;
}

interface Meal {
  title?: string;
  name?: string;
  mealType?: string;
  cook_time_minutes?: number;
  cook_time?: number;
  difficulty?: number;
  nutrition?: {
    calories?: number;
  };
  day?: number;
  id?: string;
}

const getMealIcon = (mealType: string) => {
  switch (mealType?.toLowerCase()) {
    case 'breakfast': return '🌅';
    case 'lunch': return '🍽️';
    case 'dinner': return '🌙';
    default: return '🍽️';
  }
};

export function InstantMealStreamer({ filters, onComplete, onCancel }: InstantMealStreamerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mealsRef = useRef<Meal[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(0);
  const { toast } = useToast();

  // Function to immediately add meal card to DOM
  const addMealToDOM = useCallback((meal: Meal, index: number) => {
    if (!containerRef.current) return;

    const mealCard = document.createElement('div');
    mealCard.className = 'group relative bg-white border-2 border-emerald-200 rounded-xl p-6 hover:shadow-xl transition-all duration-300 hover:border-emerald-400 mb-4 shadow-lg';
    mealCard.style.opacity = '0';
    mealCard.style.transform = 'translateY(20px)';
    mealCard.style.transition = 'all 0.3s ease';
    mealCard.style.zIndex = '10';
    mealCard.style.position = 'relative';

    mealCard.innerHTML = `
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">${getMealIcon(meal.mealType || '')}</span>
            <div>
              <div class="text-xs font-medium text-blue-600 uppercase tracking-wide">
                Day ${meal.day || 1} • ${meal.mealType || 'Meal'}
              </div>
              <h4 class="font-semibold text-gray-800 group-hover:text-emerald-700 transition-colors">
                ${meal.title || meal.name || 'Delicious Meal'}
              </h4>
            </div>
          </div>
          
          <div class="flex items-center gap-4 mt-3">
            <div class="flex items-center gap-1 text-xs text-gray-500">
              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              <span>${meal.cook_time_minutes || meal.cook_time || 15}min</span>
            </div>
            <div class="flex items-center gap-1 text-xs text-gray-500">
              <span>⭐</span>
              <span>Difficulty ${meal.difficulty || 2}</span>
            </div>
            ${meal.nutrition?.calories ? `
              <div class="flex items-center gap-1 text-xs text-gray-500">
                <span>🔥 ${meal.nutrition.calories} cal</span>
              </div>
            ` : ''}
          </div>
        </div>
        
        <div class="opacity-0 group-hover:opacity-100 transition-opacity">
          <div class="h-2 w-2 bg-emerald-500 rounded-full"></div>
        </div>
      </div>
    `;

    // Add to DOM
    containerRef.current.appendChild(mealCard);

    // Animate in immediately
    requestAnimationFrame(() => {
      mealCard.style.opacity = '1';
      mealCard.style.transform = 'translateY(0)';
    });

    console.log(`✨ INSTANT: Added meal card to DOM: ${meal.title}`);
  }, []);

  const startStreaming = useCallback(async () => {
    if (!containerRef.current) return;

    setIsGenerating(true);
    setError(null);
    mealsRef.current = [];
    
    // Clear DOM container
    containerRef.current.innerHTML = '';

    try {
      const token = localStorage.getItem('auth_token');
      
      const requestBody = {
        numDays: filters.numDays,
        mealsPerDay: filters.mealsPerDay,
        cookTime: filters.cookTime,
        difficulty: filters.difficulty,
        nutritionGoal: filters.nutritionGoal || '',
        dietaryRestrictions: filters.dietaryRestrictions || '',
        availableIngredients: filters.availableIngredients || '',
        excludeIngredients: filters.excludeIngredients || '',
        primaryGoal: filters.primaryGoal || 'Save Money',
        culturalBackground: filters.culturalBackground || [],
        selectedFamilyMembers: filters.selectedFamilyMembers || [],
        useIntelligentPrompt: filters.useIntelligentPrompt !== false
      };

      console.log('🚀 INSTANT: Starting streaming request');

      const response = await fetch('/api/meal-plan/generate-stream', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      console.log('🎬 FRONTEND: Starting to read stream at', new Date().toISOString());

      while (true) {
        const { done, value } = await reader.read();
        console.log('📡 FRONTEND: Stream read - done:', done, 'value length:', value?.length, 'at', new Date().toISOString());
        
        if (done) {
          console.log('🏁 FRONTEND: Stream completed at', new Date().toISOString());
          break;
        }

        const decodedText = decoder.decode(value, { stream: true });
        console.log('🔄 FRONTEND: Decoded text:', decodedText.length, 'chars:', decodedText.substring(0, 100));
        buffer += decodedText;
        const lines = buffer.split('\n');
        console.log('📄 FRONTEND: Split into', lines.length, 'lines');
        buffer = lines.pop() || '';

        for (const line of lines) {
          console.log('🔍 FRONTEND: Processing line:', line.substring(0, 50));
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            console.log('📨 FRONTEND: Found SSE data:', data.substring(0, 100));
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'meal') {
                const meal = parsed.data;
                console.log(`🍽️ FRONTEND: Received meal at ${new Date().toISOString()}: ${meal.title}`);
                console.log('📦 FRONTEND: Meal data:', meal);
                
                // Check for duplicates
                const mealId = meal.id || `${meal.day || 1}-${meal.mealType}-${meal.title || meal.name}`;
                const existingMeal = mealsRef.current.find(m => (m.id || `${m.day || 1}-${m.mealType}-${m.title || m.name}`) === mealId);
                if (existingMeal) {
                  console.log('⏭️ FRONTEND: Skipping duplicate meal:', meal.title);
                  continue;
                }

                // Add to ref
                console.log('➕ FRONTEND: Adding meal to ref array, current count:', mealsRef.current.length);
                mealsRef.current.push(meal);
                console.log('📊 FRONTEND: Ref array now has', mealsRef.current.length, 'meals');
                
                // IMMEDIATELY add to DOM - TRUE REAL-TIME!
                console.log('🎨 FRONTEND: Adding meal to DOM immediately...');
                addMealToDOM(meal, mealsRef.current.length - 1);
                setMealCount(mealsRef.current.length);
                console.log('✅ FRONTEND: Meal added to DOM and count updated');
                
              } else if (parsed.type === 'complete') {
                console.log('✅ INSTANT: Complete signal received');
                console.log('📊 FRONTEND: All meals streamed:', parsed.allMealsStreamed, 'Total streamed:', parsed.totalMealsStreamed, 'Expected:', parsed.expectedTotalMeals);
                
                if (parsed.allMealsStreamed && parsed.totalMealsStreamed >= (parsed.expectedTotalMeals || 6)) {
                  console.log(`🎉 ALL ${parsed.expectedTotalMeals || 6} MEALS CONFIRMED STREAMED! Showing final complete meal plan...`);
                  setTimeout(() => onComplete(parsed.data), 500);
                } else {
                  console.log('⏳ FRONTEND: Complete signal received but not all meals streamed yet. Waiting...');
                }
              } else if (parsed.type === 'partial_complete') {
                console.log(`⏳ FRONTEND: Partial completion - ${parsed.streamedMeals}/${parsed.totalExpected} meals streamed`);
                // Don't show final result yet, continue waiting for more meals
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      console.error('❌ INSTANT: Streaming error:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate meal plan');
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : 'Please try again',
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [filters, onComplete, toast, addMealToDOM]);

  // Start streaming when component mounts
  useEffect(() => {
    startStreaming();
  }, []);

  return (
    <div className="space-y-4">

      {/* Progress Header - Show when we have meals */}
      {mealCount > 0 && (
        <div className="flex items-center justify-between mb-6 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <ChefHat className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-emerald-800">
                ✨ Found {mealCount} Perfect Meals!
              </h3>
              <p className="text-sm text-emerald-600">
                Your personalized meal plan is ready
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
            Live Generated
          </div>
        </div>
      )}

      {/* Meals Container - Direct DOM manipulation */}
      <div ref={containerRef} className="space-y-4 min-h-[200px] bg-gray-50/30 rounded-lg p-4 border-2 border-dashed border-emerald-200">
        {/* Meals will be added here via direct DOM manipulation */}
        {mealCount === 0 && isGenerating && (
          <div className="text-center text-gray-500 py-8">
            <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Meals will appear here as they're generated...</p>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Error: {error}</p>
        </div>
      )}
    </div>
  );
}