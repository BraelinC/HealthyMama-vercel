import { Request, Response } from 'express';
import { db } from '../db';
import { userSavedCulturalMeals } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
// Authentication will be handled in the route

export async function saveCulturalMeals(req: Request, res: Response) {
  try {
    // Check authentication - for now, use a default user ID
    // TODO: Implement proper authentication
    const userId = 9; // Default user ID for testing

    const { cuisine_name, meals_data, summary_data, custom_name, notes } = req.body;

    // Validate required fields
    if (!cuisine_name || !meals_data || !summary_data) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'cuisine_name, meals_data, and summary_data are required'
      });
    }

    // userId already defined above

    // Check if user already has saved meals for this cuisine
    const existingSave = await db
      .select()
      .from(userSavedCulturalMeals)
      .where(
        and(
          eq(userSavedCulturalMeals.user_id, userId),
          eq(userSavedCulturalMeals.cuisine_name, cuisine_name.toLowerCase())
        )
      )
      .limit(1);

    if (existingSave.length > 0) {
      // Update existing save
      const [updatedSave] = await db
        .update(userSavedCulturalMeals)
        .set({
          meals_data,
          summary_data,
          custom_name: custom_name || `${cuisine_name} Meal Collection`,
          notes,
          updated_at: new Date()
        })
        .where(eq(userSavedCulturalMeals.id, existingSave[0].id))
        .returning();

      console.log(`✅ Updated saved meals for user ${userId}, cuisine: ${cuisine_name}`);
      
      return res.json({
        success: true,
        message: `Updated ${cuisine_name} meals in your profile`,
        saved_meals: updatedSave
      });
    } else {
      // Create new save
      const [newSave] = await db
        .insert(userSavedCulturalMeals)
        .values({
          user_id: userId,
          cuisine_name: cuisine_name.toLowerCase(),
          meals_data,
          summary_data,
          custom_name: custom_name || `${cuisine_name} Meal Collection`,
          notes
        })
        .returning();

      console.log(`✅ Saved new meals for user ${userId}, cuisine: ${cuisine_name}`);
      
      return res.json({
        success: true,
        message: `Saved ${cuisine_name} meals to your profile`,
        saved_meals: newSave
      });
    }

  } catch (error) {
    console.error('❌ Error saving cultural meals:', error);
    return res.status(500).json({
      error: 'Failed to save meals',
      message: 'An internal server error occurred while saving your meals'
    });
  }
}