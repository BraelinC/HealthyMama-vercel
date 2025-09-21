import { users, recipes, type User, type Recipe, type InsertRecipe, type IStorage } from "@shared/schema";

// In-memory storage for development
export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private recipes: Map<number, Recipe> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private recipeIdCounter = 1;

  constructor() {
    // Clear any existing recipes and regenerate
    this.recipes.clear();
    this.recipeIdCounter = 1;
    // Initialize default recipes after a short delay to ensure server is ready
    setTimeout(() => this.initializeDefaultRecipes(), 2000);
  }

  private async initializeDefaultRecipes() {
    // Generate authentic recipes using the detailed generation system
    await this.generateDefaultRecipes();
  }

  private async generateDefaultRecipes() {
    // Skip default recipe generation in development to avoid auth issues
    // These can be generated once a user logs in and starts using the app
    console.log('🍳 [MEM STORAGE] Skipping default recipe generation - will generate when needed');

    // Create some basic recipes directly in memory for testing
    const basicRecipes = [
      {
        title: "Simple Pasta",
        description: "Quick and easy pasta dish",
        ingredients: ["pasta", "olive oil", "garlic", "parmesan"],
        instructions: ["Boil pasta", "Heat oil", "Add garlic", "Mix with cheese"],
        time_minutes: 20,
        cuisine: "italian",
        diet: "vegetarian"
      },
      {
        title: "Chicken Salad",
        description: "Healthy chicken salad",
        ingredients: ["chicken breast", "lettuce", "tomatoes", "cucumber"],
        instructions: ["Cook chicken", "Chop vegetables", "Mix together", "Serve fresh"],
        time_minutes: 15,
        cuisine: "american",
        diet: "healthy"
      }
    ];

    for (const recipeData of basicRecipes) {
      await this.createRecipe(recipeData);
      console.log(`✅ [MEM STORAGE] Created basic recipe: ${recipeData.title}`);
    }
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.usersByEmail.get(email.toLowerCase());
  }

  async createUser(userData: {
    email: string;
    phone?: string;
    password_hash: string;
    full_name: string;
    account_type?: string;
    trial_ends_at?: Date;
    subscription_status?: string;
    stripe_customer_id?: string;
  }): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      email: userData.email.toLowerCase(),
      phone: userData.phone || null,
      password_hash: userData.password_hash,
      full_name: userData.full_name,
      google_id: null,
      account_type: userData.account_type || 'free_trial',
      trial_ends_at: userData.trial_ends_at || null,
      subscription_status: userData.subscription_status || 'active',
      stripe_customer_id: userData.stripe_customer_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.users.set(user.id, user);
    this.usersByEmail.set(user.email, user);
    return user;
  }

  async updateUserGoogleId(id: string, googleId: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      (user as any).google_id = googleId;
      user.updated_at = new Date();
      this.users.set(id, user);
      if (user.email) {
        this.usersByEmail.set(user.email.toLowerCase(), user);
      }
    }
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.stripe_customer_id === customerId) return user;
    }
    return undefined;
  }

  // Recipe methods
  async createRecipe(recipe: InsertRecipe): Promise<Recipe> {
    const newRecipe: Recipe = {
      id: this.recipeIdCounter++,
      title: recipe.title,
      description: recipe.description || null,
      image_url: recipe.image_url || null,
      time_minutes: recipe.time_minutes || null,
      cuisine: recipe.cuisine || null,
      diet: recipe.diet || null,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      nutrition_info: recipe.nutrition_info || null,
      video_id: recipe.video_id || null,
      video_title: recipe.video_title || null,
      video_channel: recipe.video_channel || null,
      is_saved: recipe.is_saved || false,
      user_id: recipe.user_id || null,
      created_at: new Date(),
    };

    this.recipes.set(newRecipe.id, newRecipe);
    return newRecipe;
  }

  async getRecipe(id: number): Promise<Recipe | undefined> {
    return this.recipes.get(id);
  }

  async getPopularRecipes(): Promise<Recipe[]> {
    return Array.from(this.recipes.values())
      .sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0))
      .slice(0, 6);
  }

  async getSavedRecipes(userId?: string): Promise<Recipe[]> {
    return Array.from(this.recipes.values())
      .filter(recipe => recipe.is_saved && (!userId || recipe.user_id === userId))
      .sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0));
  }

  async getGeneratedRecipes(userId?: string): Promise<Recipe[]> {
    return Array.from(this.recipes.values())
      .filter(recipe => !recipe.is_saved && (!userId || recipe.user_id === userId))
      .sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0));
  }

  async saveRecipe(id: number): Promise<Recipe | undefined> {
    const recipe = this.recipes.get(id);
    if (recipe) {
      recipe.is_saved = true;
      return recipe;
    }
    return undefined;
  }

  async unsaveRecipe(id: number): Promise<void> {
    const recipe = this.recipes.get(id);
    if (recipe) {
      recipe.is_saved = false;
    }
  }
}