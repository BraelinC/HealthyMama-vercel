import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { generateRecipeWithGrok } from '../../server/grok';
import { groqValidator } from '../../server/groqValidator';
import { recipeNutritionCalculator } from '../../server/recipeNutritionCalculator';

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
    const { prompt, cuisine, dietaryRestrictions, servings = 4 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Recipe prompt is required' });
    }

    // Generate recipe with Grok
    let recipe;
    try {
      recipe = await generateRecipeWithGrok(prompt, {
        cuisine,
        dietaryRestrictions,
        servings,
        userId: auth.userId
      });
    } catch (error) {
      console.error('Grok generation failed:', error);
      return res.status(500).json({ error: 'Recipe generation failed' });
    }

    // Validate recipe structure
    const validatedRecipe = await groqValidator.validateRecipe(recipe);

    // Calculate nutrition if possible
    try {
      const nutritionData = await recipeNutritionCalculator.calculateRecipeNutrition(validatedRecipe);
      validatedRecipe.nutrition = nutritionData;
    } catch (error) {
      console.warn('Nutrition calculation failed:', error);
      // Continue without nutrition data
    }

    res.status(200).json({
      recipe: validatedRecipe,
      message: 'Recipe generated successfully'
    });

  } catch (error) {
    console.error('Recipe generation error:', error);
    res.status(500).json({ error: 'Failed to generate recipe' });
  }
}