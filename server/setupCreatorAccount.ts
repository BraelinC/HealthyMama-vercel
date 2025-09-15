import { db } from "./db";
import { users, creatorProfiles } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

// Script to create a test creator account
async function setupCreatorAccount() {
  try {
    const email = "creator@nutrima.com";
    const password = "Creator123!";
    const hashedPassword = await hashPassword(password);

    // Check if user already exists
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, email));

    let userId: string;

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log("✅ Creator account already exists");
      
      // Update to ensure it has creator status
      await db.update(users)
        .set({
          full_name: "NutriMa Creator",
          password_hash: hashedPassword,
          is_creator: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
      
      console.log("✅ Updated creator account password");
    } else {
      // Create new creator user with proper ID generation
      const userId_generated = `user_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const [newUser] = await db.insert(users)
        .values({
          id: userId_generated,
          email,
          full_name: "NutriMa Creator",
          password_hash: hashedPassword,
          phone: "5551234567",
          is_creator: true, // Make sure this user is marked as creator
        })
        .returning();
      
      userId = newUser.id;
      console.log("✅ Created new creator account");
    }

    // Check if creator profile exists
    const existingProfile = await db.select()
      .from(creatorProfiles)
      .where(eq(creatorProfiles.user_id, userId));

    if (existingProfile.length === 0) {
      // Create creator profile
      await db.insert(creatorProfiles)
        .values({
          user_id: userId,
          bio: "Official NutriMa Creator account for testing and demonstration",
          specialties: ["meal-planning", "budget-meals", "family-cooking", "healthy-eating"],
          follower_count: 0,
          total_plans_shared: 0,
          verified_nutritionist: true,
        });
      
      console.log("✅ Created creator profile");
    } else {
      console.log("✅ Creator profile already exists");
    }

    console.log("\n========================================");
    console.log("🎉 CREATOR ACCOUNT READY!");
    console.log("========================================");
    console.log("📧 Email: creator@nutrima.com");
    console.log("🔑 Password: Creator123!");
    console.log("========================================");
    console.log("\nYou can now login with these credentials to:");
    console.log("✅ Create communities");
    console.log("✅ Share meal plans");
    console.log("✅ Build a following");
    console.log("========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error setting up creator account:", error);
    process.exit(1);
  }
}

// Run the setup
setupCreatorAccount();