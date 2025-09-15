import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { enhancedMealPlanGenerator } from '../server/enhancedMealPlanGenerator';
import { intelligentPromptBuilderV2 } from '../server/intelligentPromptBuilderV2';
import { culturalMealRecommendationEngine } from '../server/culturalMealRecommendationEngine';

// JWT middleware for Vercel
function authenticateToken(req: VercelRequest): { userId: string } | null {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticateToken(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      days = 7,
      preferences = {},
      dietaryRestrictions = [],
      servings = 4,
      budget,
      culturalPreferences = []
    } = req.body;

    // Build intelligent prompt
    const promptContext = {
      userId: auth.userId,
      days,
      preferences,
      dietaryRestrictions,
      servings,
      budget,
      culturalPreferences
    };

    const optimizedPrompt = await intelligentPromptBuilderV2.buildPrompt(promptContext);

    // Generate meal plan
    const mealPlan = await enhancedMealPlanGenerator.generateMealPlan({
      prompt: optimizedPrompt,
      days,
      servings,
      userId: auth.userId,
      preferences,
      dietaryRestrictions,
      culturalPreferences
    });

    // Enhance with cultural recommendations
    const enhancedMealPlan = await culturalMealRecommendationEngine.enhanceMealPlan(
      mealPlan,
      culturalPreferences
    );

    res.status(200).json({
      mealPlan: enhancedMealPlan,
      message: 'Meal plan generated successfully'
    });

  } catch (error) {
    console.error('Meal plan generation error:', error);
    res.status(500).json({ error: 'Failed to generate meal plan' });
  }
}