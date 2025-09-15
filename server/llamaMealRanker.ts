/**
 * Llama 3 8B Meal Ranking Service
 * Lightweight LLM integration for intelligent meal ranking based on user weights
 */

import fetch from 'node-fetch';
import { MealScore, StructuredMeal, UserCulturalProfile } from './culturalMealRankingEngine.js';

export interface LlamaRankingRequest {
  meals: MealScore[];
  userProfile: UserCulturalProfile;
  context?: string;
  maxMeals?: number;
}

export interface LlamaRankingResponse {
  rankedMeals: MealScore[];
  reasoning: string;
  processingTime: number;
}

export class LlamaMealRanker {
  private apiEndpoint: string;
  private apiKey: string;
  private model: string = 'gpt-4o-mini'; // OpenAI GPT-4o mini model

  constructor() {
    // Use OpenAI for GPT-4o mini inference
    this.apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    this.apiKey = process.env.OPENAI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ OPENAI_API_KEY not found. Meal ranking requires API key.');
    }
  }

  /**
   * Rank meals using Llama 3 8B with weight-based intelligence
   */
  public async rankMeals(request: LlamaRankingRequest): Promise<LlamaRankingResponse> {
    const startTime = Date.now();
    
    console.log(`🤖 Ranking ${request.meals.length} meals with GPT-4o mini`);
    console.log(`🔑 API Key available: ${this.apiKey ? 'YES' : 'NO'}`);
    console.log(`🔗 Using endpoint: ${this.apiEndpoint}`);

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is required for GPT-4o mini ranking. Fallback system removed.');
    }

    const prompt = this.buildRankingPrompt(request);
    console.log(`📝 Prompt built, calling OpenAI API...`);
    console.log(`📏 Prompt length: ${prompt.length} characters`);
    
    const apiStartTime = Date.now();
    const response = await this.callLlamaAPI(prompt);
    const apiDuration = Date.now() - apiStartTime;
    console.log(`✅ OpenAI API response received in ${apiDuration}ms`);
    console.log(`📊 Response keys: ${Object.keys(response).join(', ')}`);
    
    const rankedMeals = this.parseRankingResponse(response, request.meals);
    
    return {
      rankedMeals,
      reasoning: response.reasoning || 'Ranked by cultural authenticity, health, cost, and time preferences',
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Build intelligent ranking prompt for AI to score and rank meals
   */
  private buildRankingPrompt(request: LlamaRankingRequest): string {
    const { meals, userProfile, maxMeals = 9 } = request;
    
    // Build user context
    const culturalPrefs = Object.entries(userProfile.cultural_preferences)
      .map(([culture, weight]) => `${culture}: ${(weight * 100).toFixed(0)}%`)
      .join(', ');
    
    const weights = userProfile.priority_weights;
    const weightsList = [
      `Cultural: ${(weights.cultural * 100).toFixed(0)}%`,
      `Health: ${(weights.health * 100).toFixed(0)}%`, 
      `Cost: ${(weights.cost * 100).toFixed(0)}%`,
      `Time: ${(weights.time * 100).toFixed(0)}%`
    ].join(', ');

    // Build meal options WITHOUT pre-calculated scores - let AI score them
    const mealOptions = meals.slice(0, 15).map((mealScore, index) => {
      const meal = mealScore.meal;
      return `${index + 1}. "${meal.name}" (${meal.cuisine})
   - Description: ${meal.description}
   - Authenticity Score: ${(meal.authenticity_score * 100).toFixed(0)}%`;
    }).join('\n\n');

    return `You are a meal ranking expert. Score and rank the best ${maxMeals} meals for this user profile.

USER PREFERENCES:
- Cultural Preferences: ${culturalPrefs}
- Priority Weights: ${weightsList}
- Dietary Restrictions: ${userProfile.dietary_restrictions.join(', ') || 'None'}

SCORING INSTRUCTIONS:
For each meal, YOU must calculate scores (0-100%) for:
1. Cultural Score: How well it matches user's cultural preference (use authenticity score × cultural preference)
2. Health Score: Based on cooking method and ingredients (steamed/grilled=high, fried=low, vegetables=high, heavy sauces=low)
3. Cost Score: Based on ingredients (simple ingredients=high, premium ingredients=low)
4. Time Score: Based on preparation complexity (stir-fry/simple=high, slow-cooked/complex=low)

Then calculate Total Score using the user's weights:
Total = (Cultural Weight × Cultural Score + Health Weight × Health Score + Cost Weight × Cost Score + Time Weight × Time Score) / Sum of Weights

MEAL OPTIONS:
${mealOptions}

CRITICAL: Return ONLY a JSON response with NO calculation strings, NO formulas, NO math expressions.
Use this EXACT format with abbreviated keys to save space:
{
  "meals": [
    {"id": 1, "cs": 85, "hs": 70, "cos": 90, "ts": 60, "tot": 78}
  ],
  "reason": "Brief explanation"
}

Keys: cs=cultural score, hs=health score, cos=cost score, ts=time score, tot=total score
Score ALL ${maxMeals} meals. Numbers only, NO text in meal objects.`;
  }

  /**
   * Call OpenAI API for GPT-4o mini inference
   */
  private async callLlamaAPI(prompt: string): Promise<any> {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a meal ranking expert. Respond only with valid JSON.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        max_tokens: 2500,
        temperature: 0.3, // Low temperature for consistent ranking
        response_format: { type: "json_object" } // Force JSON response for GPT-4o mini
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  /**
   * Parse AI response and create scored meals
   */
  private parseRankingResponse(aiResponse: any, originalMeals: MealScore[]): MealScore[] {
    // Handle old format (ranked_meal_ids)
    if (aiResponse.ranked_meal_ids) {
      const rankedMeals: MealScore[] = [];
      for (const mealId of aiResponse.ranked_meal_ids) {
        const mealIndex = mealId - 1;
        if (mealIndex >= 0 && mealIndex < originalMeals.length) {
          rankedMeals.push(originalMeals[mealIndex]);
        }
      }
      return rankedMeals;
    }
    
    // Handle both new format (meals) and what GPT-4o mini actually returns (ranked_meals)
    const mealsArray = aiResponse.meals || aiResponse.ranked_meals;
    
    if (!Array.isArray(mealsArray)) {
      console.error('Invalid AI response format:', aiResponse);
      throw new Error('No meals array found in AI response');
    }

    const rankedMeals: MealScore[] = [];
    
    // Process AI-scored meals (handle both formats)
    for (const meal of mealsArray) {
      const mealIndex = meal.id - 1; // Convert 1-based to 0-based index
      if (mealIndex >= 0 && mealIndex < originalMeals.length) {
        const originalMeal = originalMeals[mealIndex];
        
        // Handle both abbreviated format (cs, hs, cos, ts, tot) and full format (scores object)
        let culturalScore, healthScore, costScore, timeScore, totalScore;
        
        if (meal.cs !== undefined) {
          // Abbreviated format
          culturalScore = meal.cs;
          healthScore = meal.hs;
          costScore = meal.cos;
          timeScore = meal.ts;
          totalScore = meal.tot;
        } else if (meal.scores) {
          // Full format that GPT-4o mini actually returns
          culturalScore = meal.scores.cultural;
          healthScore = meal.scores.health;
          costScore = meal.scores.cost;
          timeScore = meal.scores.time;
          totalScore = meal.total_score;
        } else {
          console.warn('Unknown meal format:', meal);
          continue;
        }
        
        // Create new meal score with AI-calculated scores
        const aiScoredMeal: MealScore = {
          meal: originalMeal.meal,
          total_score: totalScore / 100, // Convert from percentage to 0-1
          component_scores: {
            cultural_score: culturalScore / 100,
            health_score: healthScore / 100,
            cost_score: costScore / 100,
            time_score: timeScore / 100
          },
          ranking_explanation: `AI Score: ${totalScore}% (C:${culturalScore}% H:${healthScore}% $:${costScore}% T:${timeScore}%)`
        };
        
        rankedMeals.push(aiScoredMeal);
      }
    }

    // Sort by total score descending
    rankedMeals.sort((a, b) => b.total_score - a.total_score);

    console.log(`✅ GPT-4o mini scored and ranked ${rankedMeals.length} meals`);
    console.log(`🎯 Reasoning: ${aiResponse.reason || aiResponse.reasoning || 'No reasoning provided'}`);
    return rankedMeals;
  }

  /**
   * Fallback ranking when Llama API is unavailable
   */
  private fallbackRanking(request: LlamaRankingRequest, startTime: number): LlamaRankingResponse {
    console.log('🔄 Using fallback ranking algorithm');
    
    const { meals, userProfile, maxMeals = 9 } = request;
    
    // Smart fallback: rank by weighted combination of dominant priorities
    const weights = userProfile.priority_weights;
    const sortedMeals = [...meals].sort((a, b) => {
      // Find user's top 2 priorities
      const priorityEntries = Object.entries(weights).sort(([,a], [,b]) => b - a);
      const topPriority = priorityEntries[0][0];
      const secondPriority = priorityEntries[1][0];
      
      // Weight scores based on top priorities
      let aScore = a.total_score;
      let bScore = b.total_score;
      
      if (topPriority === 'cultural') {
        aScore += a.component_scores.cultural_score * 0.5;
        bScore += b.component_scores.cultural_score * 0.5;
      } else if (topPriority === 'health') {
        aScore += a.component_scores.health_score * 0.5;
        bScore += b.component_scores.health_score * 0.5;
      } else if (topPriority === 'cost') {
        aScore += a.component_scores.cost_score * 0.5;
        bScore += b.component_scores.cost_score * 0.5;
      } else if (topPriority === 'time') {
        aScore += a.component_scores.time_score * 0.5;
        bScore += b.component_scores.time_score * 0.5;
      }
      
      return bScore - aScore;
    });

    return {
      rankedMeals: sortedMeals.slice(0, maxMeals),
      reasoning: `Fallback ranking by ${Object.entries(weights).sort(([,a], [,b]) => b - a)[0][0]} priority`,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Quick meal selection for meal plan generation - NO FALLBACK VERSION
   */
  public async selectMealsForPlan(
    userId: number,
    userProfile: UserCulturalProfile,
    mealCount: number = 9
  ): Promise<StructuredMeal[]> {
    
    console.log(`🎯 selectMealsForPlan called for ${mealCount} meals`);
    
    // Import the ranking engine
    const { culturalMealRankingEngine } = await import('./culturalMealRankingEngine.js');
    
    // Get pre-scored meals from ranking engine
    const scoredMeals = await culturalMealRankingEngine.getRankedMeals(
      userId, 
      userProfile, 
      mealCount * 2, // Get extra meals for better Llama selection
      0.7 // Lower threshold for more variety
    );

    console.log(`📊 Got ${scoredMeals.length} scored meals from ranking engine`);

    if (scoredMeals.length === 0) {
      throw new Error('No scored meals available from cultural ranking engine');
    }

    // Use Llama to intelligently rank the pre-filtered meals
    console.log(`🤖 Calling GPT-4o mini rankMeals with ${scoredMeals.length} meals...`);
    const rankingResult = await this.rankMeals({
      meals: scoredMeals,
      userProfile,
      maxMeals: mealCount
    });

    console.log(`🎯 GPT-4o mini selected ${rankingResult.rankedMeals.length} meals: ${rankingResult.reasoning}`);
    
    return rankingResult.rankedMeals.map(score => score.meal);
  }

  /**
   * Rank meals in parallel batches for faster processing
   */
  public async rankMealsInParallel(request: LlamaRankingRequest): Promise<LlamaRankingResponse> {
    const startTime = Date.now();
    const { meals, userProfile, maxMeals = 10 } = request;
    
    console.log(`🚀 Starting parallel ranking of ${meals.length} meals in batches of 2`);
    
    // Split meals into batches of 2
    const batches: MealScore[][] = [];
    for (let i = 0; i < meals.length; i += 2) {
      batches.push(meals.slice(i, i + 2));
    }
    
    console.log(`📦 Created ${batches.length} batches for parallel processing`);
    
    // Process all batches in parallel
    const batchPromises = batches.map(async (batch, batchIndex) => {
      console.log(`🔄 Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} meals`);
      
      try {
        const batchRequest: LlamaRankingRequest = {
          meals: batch,
          userProfile,
          maxMeals: batch.length
        };
        
        const batchResult = await this.rankMeals(batchRequest);
        console.log(`✅ Batch ${batchIndex + 1} completed with ${batchResult.rankedMeals.length} meals`);
        return batchResult.rankedMeals;
      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, error);
        console.error(`❌ Failed batch contained meals:`, batch.map(m => m.meal.name));
        return []; // Return empty array for failed batches
      }
    });
    
    // Wait for all batches to complete
    const batchResults = await Promise.all(batchPromises);
    console.log(`🎯 All ${batches.length} batches completed`);
    
    // Combine all results
    const allRankedMeals: MealScore[] = batchResults.flat();
    
    // Sort by total score descending and limit to maxMeals
    const finalRankedMeals = allRankedMeals
      .sort((a, b) => b.total_score - a.total_score)
      .slice(0, maxMeals);
    
    const totalProcessingTime = Date.now() - startTime;
    console.log(`🏁 Parallel ranking complete: ${finalRankedMeals.length} meals in ${totalProcessingTime}ms`);
    
    return {
      rankedMeals: finalRankedMeals,
      reasoning: `Parallel AI ranking of ${meals.length} meals using GPT-4o mini with user weight preferences`,
      processingTime: totalProcessingTime
    };
  }
}

// Export singleton instance
export const llamaMealRanker = new LlamaMealRanker();