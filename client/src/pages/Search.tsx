import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Search as SearchIcon, 
  Filter, 
  Loader2, 
  Clock, 
  ChefHat, 
  Utensils,
  Play,
  ShoppingCart,
  BookOpen,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Heart,
  Share2,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CommunityShareModal } from "@/components/CommunityShareModal";
import { MealPlanSelectionModal } from "@/components/MealPlanSelectionModal";
import { apiRequest, safeApiRequest } from "@/lib/queryClient";
import ReactPlayer from "react-player";
import RecipeCard from "@/components/RecipeCard";
import { useAuth } from "@/hooks/useAuth";

interface GeneratedRecipe {
  id?: number;
  title: string;
  description: string;
  image_url: string;
  time_minutes: number;
  difficulty?: number;
  cuisine: string;
  diet: string;
  ingredients: string[] | Array<{
    name?: string;
    display_text: string;
    measurements?: Array<{
      quantity: number;
      unit: string;
    }>;
  }>;
  instructions: string[];
  source_url?: string;
  source_name?: string;
  video_id?: string;
  video_title?: string;
  nutrition?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    sodium_mg?: number;
  };
  nutrition_info?: any; // Add this field to match backend data
  video_channel?: string;
  total_nutrition?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
}

// Define the ChatMessage interface
interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "assistant";
}

// STEP 2.1: Transform saved recipes to GeneratedRecipe format
const transformSavedRecipe = (savedRecipe: any): GeneratedRecipe => {
  try {
    // Parse nutrition_info if it's a string
    let nutritionInfo = savedRecipe.nutrition_info;
    if (typeof nutritionInfo === 'string') {
      try {
        nutritionInfo = JSON.parse(nutritionInfo);
      } catch (e) {
        console.warn('Failed to parse nutrition_info:', e);
      }
    }
    
    return {
      id: savedRecipe.id,
      title: savedRecipe.title || 'Untitled Recipe',
      description: savedRecipe.description || 'No description available',
      image_url: savedRecipe.image_url || '',
      time_minutes: savedRecipe.time_minutes || 0,
      difficulty: savedRecipe.difficulty,
      cuisine: savedRecipe.cuisine || 'Any Cuisine',
      diet: savedRecipe.diet || 'None',
      ingredients: savedRecipe.ingredients || [],
      instructions: savedRecipe.instructions || [],
      source_url: savedRecipe.source_url,
      source_name: savedRecipe.source_name,
      video_id: savedRecipe.video_id,
      video_title: savedRecipe.video_title,
      video_channel: savedRecipe.video_channel,
      nutrition_info: nutritionInfo, // Keep parsed nutrition info
      nutrition: nutritionInfo, // Also map to nutrition for compatibility
      total_nutrition: savedRecipe.total_nutrition
    };
  } catch (error) {
    console.error('Error transforming saved recipe:', error);
    return {
      id: savedRecipe.id || 0,
      title: 'Error Loading Recipe',
      description: 'Failed to load recipe details',
      image_url: '',
      time_minutes: 0,
      cuisine: 'Any Cuisine',
      diet: 'None',
      ingredients: [],
      instructions: ['Unable to load instructions']
    };
  }
};

// STEP 2.2: Transform generated recipes to GeneratedRecipe format
const transformGeneratedRecipe = (genRecipe: any): GeneratedRecipe => {
  try {
    // Parse nutrition_info if it's a string
    let nutritionInfo = genRecipe.nutrition_info;
    if (typeof nutritionInfo === 'string') {
      try {
        nutritionInfo = JSON.parse(nutritionInfo);
      } catch (e) {
        console.warn('Failed to parse nutrition_info:', e);
      }
    }
    
    return {
      id: genRecipe.id,
      title: genRecipe.title || 'Untitled Recipe',
      description: genRecipe.description || 'No description available',
      image_url: genRecipe.image_url || '',
      time_minutes: genRecipe.time_minutes || 0,
      difficulty: genRecipe.difficulty,
      cuisine: genRecipe.cuisine || 'Any Cuisine',
      diet: genRecipe.diet || 'None',
      ingredients: genRecipe.ingredients || [],
      instructions: genRecipe.instructions || [],
      source_url: genRecipe.source_url,
      source_name: genRecipe.source_name,
      video_id: genRecipe.video_id,
      video_title: genRecipe.video_title,
      video_channel: genRecipe.video_channel,
      nutrition_info: nutritionInfo, // Keep parsed nutrition info
      nutrition: nutritionInfo, // Also map to nutrition for compatibility
      total_nutrition: genRecipe.total_nutrition
    };
  } catch (error) {
    console.error('Error transforming generated recipe:', error);
    return {
      id: genRecipe.id || 0,
      title: 'Error Loading Recipe',
      description: 'Failed to load recipe details',
      image_url: '',
      time_minutes: 0,
      cuisine: 'Any Cuisine',
      diet: 'None',
      ingredients: [],
      instructions: ['Unable to load instructions']
    };
  }
};

const Search = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [recipeType, setRecipeType] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [dietRestrictions, setDietRestrictions] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [availableIngredients, setAvailableIngredients] = useState("");
  const [excludeIngredients, setExcludeIngredients] = useState("");
  const [mode, setMode] = useState("fast");
  const [isFavorited, setIsFavorited] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: string, content: string}>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isAssistantThinking, setIsAssistantThinking] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  
  // State to track auto-trigger execution
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);
  const [currentUrlQuery, setCurrentUrlQuery] = useState<string | null>(null);
  const [mealPlanModalOpen, setMealPlanModalOpen] = useState(false);
  const [selectedRecipeForMealPlan, setSelectedRecipeForMealPlan] = useState<any>(null);
  
  // STEP 3.1: Set loading state immediately when URL query is detected
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [itemToShare, setItemToShare] = useState<any>(null);
  // Client-side recent generated cache (most recent first, max 3)
  const [recentGenerated, setRecentGenerated] = useState<GeneratedRecipe[]>([]);
  const recentsKey = `recentGenerated:${(user as any)?.id || 'anon'}`;

  const { toast } = useToast();

  // Share function - opens community modal
  const handleShare = (recipe: GeneratedRecipe) => {
    setItemToShare(recipe);
    setShareModalOpen(true);
  };

  // STEP 1.3: Enhanced URL parameter handling - works on first page load
  useEffect(() => {
    // Load client-side recents on mount
    try {
      const raw = localStorage.getItem(recentsKey);
      if (raw) {
        const list: GeneratedRecipe[] = JSON.parse(raw);
        setRecentGenerated(Array.isArray(list) ? list : []);
      }
    } catch {}

    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q');
    const urlMode = params.get('mode');
    
    if (urlQuery) {
      setQuery(urlQuery);
      console.log('URL query detected on page load:', urlQuery);
      
      // STEP 3.1: Set loading state immediately when URL query is detected
      setIsAutoLoading(true);
      console.log('Auto-loading state set to true');
      
      // Set mode from URL parameter if provided
      if (urlMode && (urlMode === 'fast' || urlMode === 'detailed')) {
        setMode(urlMode);
        console.log('URL mode set to:', urlMode);
      }
      
      // STEP 1.3: Reset auto-trigger flag for any new query (including first load)
      setHasAutoTriggered(false);
      setCurrentUrlQuery(urlQuery);
      console.log('Auto-trigger flag reset for query:', urlQuery);
    }
  }, []); // Empty dependency array means this runs once on mount

  // Fetch past recipes
  const { data: savedRecipes, isLoading: isLoadingSaved } = useQuery({
    queryKey: ['/api/recipes/saved'],
    enabled: true,
  });

  const { data: generatedRecipes, isLoading: isLoadingGenerated } = useQuery({
    queryKey: ['/api/recipes/generated'],
    enabled: true,
  });

  const generateRecipeMutation = useMutation({
    mutationFn: async (recipeData: any) => {
      return await safeApiRequest("/api/recipes/generate", {
        method: "POST",
        body: JSON.stringify(recipeData),
      });
    },
    onSuccess: (data: any) => {
      setGeneratedRecipe(data);
      // Push into client-side recent cache (dedupe by id or title), keep max 3
      try {
        const newItem: GeneratedRecipe = transformGeneratedRecipe(data);
        setRecentGenerated(prev => {
          const filtered = prev.filter(r => (r.id && newItem.id ? r.id !== newItem.id : r.title !== newItem.title));
          const next = [newItem, ...filtered].slice(0, 3);
          try { localStorage.setItem(recentsKey, JSON.stringify(next)); } catch {}
          return next;
        });
      } catch {}
      toast({
        title: "Recipe Generated!",
        description: `Your ${data?.title || 'recipe'} is ready with ${data?.video_id ? 'video instructions' : 'detailed steps'}.`,
      });
    },
    onError: (error: any) => {
      console.error("Recipe generation error:", error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate recipe. Please try again.",
        variant: "destructive",
      });
    },
  });

  // STEP 3.7: Enhanced auto-trigger with better error handling and mode support
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('q');
    
    // Only auto-trigger if:
    // 1. There's a URL query
    // 2. The query state matches the URL query
    // 3. We haven't already auto-triggered for this query
    // 4. The mutation is not currently pending
    if (urlQuery && query === urlQuery && !hasAutoTriggered && !generateRecipeMutation.isPending) {
      console.log('Auto-triggering recipe generation for:', urlQuery);
      console.log('Using mode:', mode);
      
      // Set flag to prevent re-triggering
      setHasAutoTriggered(true);
      
      // STEP 1.1: Auto-trigger search immediately without delay
      try {
        const recipeData = {
          description: urlQuery,
          recipeType: "",
          cuisine: "",
          dietRestrictions: "",
          cookingTime: undefined,
          availableIngredients: "",
          excludeIngredients: "",
          generationMode: mode, // Use current mode setting instead of hardcoded "detailed"
        };
        console.log('Triggering recipe generation immediately with data:', recipeData);
        
        // STEP 3.2: Clear auto-loading state when generation starts
        setIsAutoLoading(false);
        console.log('Auto-loading state cleared - mutation starting');
        
        generateRecipeMutation.mutate(recipeData);
      } catch (error) {
        console.error('Error during auto-trigger:', error);
        
        // STEP 3.2: Clear auto-loading state on error
        setIsAutoLoading(false);
        
        toast({
          title: "Auto-Generation Failed",
          description: "Failed to automatically generate recipe. Please try manually.",
          variant: "destructive",
        });
      }
    }
  }, [query, hasAutoTriggered, generateRecipeMutation.isPending, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      toast({
        title: "Missing Query",
        description: "Please enter a recipe or ingredient to search for.",
        variant: "destructive",
      });
      return;
    }

    const recipeData = {
      description: query,
      recipeType,
      cuisine,
      dietRestrictions,
      cookingTime: cookingTime ? parseInt(cookingTime) : undefined,
      availableIngredients,
      excludeIngredients,
      generationMode: mode,
    };

    generateRecipeMutation.mutate(recipeData);
  };

  const createShoppingList = async () => {
    if (!generatedRecipe) return;

    try {
      const ingredients = Array.isArray(generatedRecipe.ingredients) 
        ? generatedRecipe.ingredients.map(ing => 
            typeof ing === 'string' ? ing : ing.display_text
          )
        : [];

      const response = await fetch("/api/instacart/create-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ingredients,
          recipeName: generatedRecipe.title 
        }),
      });

      const data = await response.json();

      if (response.ok && data.shopping_url) {
        // Use window.location.href instead of window.open to avoid popup blockers
        window.location.href = data.shopping_url;
        // Note: The toast might not be visible since we're navigating away
        // But we can still set it in case the navigation fails
        toast({
          title: "Redirecting to Instacart...",
          description: "Creating your shopping list on Instacart.",
        });
      } else {
        console.error("Failed to create shopping list:", data);
        toast({
          title: "Shopping List Failed",
          description: data.message || "Could not create Instacart shopping list. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to create shopping list:", error);
      toast({
        title: "Shopping List Failed",
        description: "Could not create Instacart shopping list. Please try again.",
        variant: "destructive",
      });
    }
  };

  const clearFilters = () => {
    setRecipeType("");
    setCuisine("");
    setDietRestrictions("");
    setCookingTime("");
    setAvailableIngredients("");
    setExcludeIngredients("");
  };

  const hasActiveFilters = recipeType || cuisine || dietRestrictions || cookingTime || availableIngredients || excludeIngredients;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-stone-50 pb-20">
      <div className="container mx-auto px-4 py-6 md:py-10">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recipe Search */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm rounded-xl">
              <CardHeader className="border-b text-white rounded-t-xl" style={{ background: 'linear-gradient(to right, #14b8a6, #0d9488)' }}>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Recipe Search
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What would you like to cook?
                    </label>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g., chicken pasta, vegetarian breakfast, healthy dinner"
                      className="w-full"
                      disabled={generateRecipeMutation.isPending}
                    />
                  </div>

                  {/* Generation Mode */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={mode === "fast" ? "default" : "outline"}
                      onClick={() => setMode("fast")}
                      size="sm"
                      style={mode === "fast" ? { backgroundColor: '#14b8a6', color: 'white' } : {}}
                      className={mode === "fast" ? "hover:opacity-90" : ""}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Fast Mode
                    </Button>
                    <Button
                      type="button"
                      variant={mode === "detailed" ? "default" : "outline"}
                      onClick={() => setMode("detailed")}
                      size="sm"
                      style={mode === "detailed" ? { backgroundColor: '#14b8a6', color: 'white' } : {}}
                      className={mode === "detailed" ? "hover:opacity-90" : ""}
                    >
                      <BookOpen className="h-3 w-3 mr-1" />
                      Detailed Mode
                    </Button>
                  </div>

                  {/* Generate Button */}
                  <Button 
                    type="submit" 
                    size="lg"
                    disabled={generateRecipeMutation.isPending || isAutoLoading || !query.trim()}
                    style={{ backgroundColor: '#14b8a6', color: 'white' }} 
                    className="w-full hover:opacity-90"
                  >
                    {generateRecipeMutation.isPending || isAutoLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {isAutoLoading ? 'Auto-Loading Recipe...' : 
                         new URLSearchParams(window.location.search).get('q') ? 'Auto-Generating Recipe...' : 'Generating Recipe...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Recipe
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>



            {/* Generated Recipe Display */}
            {generatedRecipe && (
              <Card className="mt-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
                <CardContent className="p-6 relative">
                  {/* Action buttons in top right */}
                  <div className="absolute top-4 right-4 z-10 flex gap-2">
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      onClick={() => {
                        // Prepare recipe data for meal plan modal
                        const recipeData = {
                          id: generatedRecipe?.id,
                          title: generatedRecipe?.title || '',
                          description: generatedRecipe?.description || '',
                          image_url: generatedRecipe?.image_url,
                          time_minutes: generatedRecipe?.time_minutes,
                          cuisine: generatedRecipe?.cuisine,
                          diet: generatedRecipe?.diet,
                          ingredients: generatedRecipe?.ingredients || [],
                          instructions: generatedRecipe?.instructions || [],
                          nutrition_info: generatedRecipe?.nutrition || null,
                          video_id: generatedRecipe?.video_id,
                          video_title: generatedRecipe?.video_title,
                          video_channel: generatedRecipe?.video_channel
                        };
                        setSelectedRecipeForMealPlan(recipeData);
                        setMealPlanModalOpen(true);
                      }}
                      className="w-8 h-8 rounded-full shadow-sm bg-white/90 text-gray-700 hover:bg-green-50 hover:text-green-600"
                      title="Add to meal plan"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      onClick={() => handleShare(generatedRecipe)}
                      className="w-8 h-8 rounded-full shadow-sm bg-white/90 text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                      title="Share recipe"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="icon" 
                      onClick={async () => {
                        if (!generatedRecipe?.id) return;
                        
                        try {
                          if (isFavorited) {
                            // Remove from favorites
                            await apiRequest('/api/favorites', {
                              method: 'DELETE',
                              body: JSON.stringify({
                                item_type: 'recipe',
                                item_id: generatedRecipe.id.toString()
                              })
                            });
                            setIsFavorited(false);
                            toast({
                              title: "Removed from Favorites",
                              description: "Recipe removed from your favorites"
                            });
                          } else {
                            // Add to favorites
                            await apiRequest('/api/favorites', {
                              method: 'POST',
                              body: JSON.stringify({
                                item_type: 'recipe',
                                item_id: generatedRecipe.id.toString(),
                                title: generatedRecipe.title,
                                description: generatedRecipe.description || '',
                                image_url: generatedRecipe.image_url,
                                time_minutes: generatedRecipe.time_minutes,
                                cuisine: generatedRecipe.cuisine,
                                diet: generatedRecipe.diet,
                                video_id: generatedRecipe.video_id,
                                video_title: generatedRecipe.video_title,
                                video_channel: generatedRecipe.video_channel,
                                metadata: {
                                  ingredients: generatedRecipe.ingredients,
                                  instructions: generatedRecipe.instructions,
                                  nutrition_info: generatedRecipe.nutrition_info || generatedRecipe.nutrition
                                }
                              })
                            });
                            setIsFavorited(true);
                            toast({
                              title: "Added to Favorites",
                              description: `${generatedRecipe.title} saved to favorites`
                            });
                          }
                        } catch (error) {
                          console.error('Favorites error:', error);
                          toast({
                            title: "Error",
                            description: `Failed to ${isFavorited ? 'remove from' : 'add to'} favorites`,
                            variant: "destructive"
                          });
                        }
                      }}
                      className={`w-8 h-8 rounded-full shadow-sm transform transition-all duration-200 hover:scale-110 ${
                        isFavorited 
                          ? 'bg-red-500 text-white hover:bg-red-600' 
                          : 'bg-white/90 text-gray-700 hover:bg-white'
                      }`}
                    >
                      <Heart className={`h-4 w-4 transition-all duration-200 ${
                        isFavorited ? 'fill-white scale-110' : 'hover:text-red-500'
                      }`} />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {generatedRecipe.video_id && (
                      <div>
                        <div className="aspect-video rounded-lg overflow-hidden mb-3">
                          <ReactPlayer
                            url={`https://www.youtube.com/watch?v=${generatedRecipe.video_id}`}
                            width="100%"
                            height="100%"
                            controls
                          />
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          <strong>{generatedRecipe.video_title}</strong> by {generatedRecipe.video_channel}
                        </p>
                      </div>
                    )}

                    {/* Recipe Display with Tabs */}
                    <Tabs defaultValue="ingredients" className="w-full">
                      <TabsList className="w-full grid grid-cols-3 h-10 bg-purple-100 rounded-lg">
                        <TabsTrigger value="ingredients" className="text-xs data-[state=active]:bg-white data-[state=active]:text-purple-600">Ingredients</TabsTrigger>
                        <TabsTrigger value="instructions" className="text-xs data-[state=active]:bg-white data-[state=active]:text-purple-600">Instructions</TabsTrigger>
                        <TabsTrigger value="nutrition" className="text-xs data-[state=active]:bg-white data-[state=active]:text-purple-600">Nutrition</TabsTrigger>
                      </TabsList>

                      <TabsContent value="ingredients" className="p-4 pt-3">
                        <ul className="space-y-2">
                          {Array.isArray(generatedRecipe.ingredients) && generatedRecipe.ingredients.map((ingredient, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Checkbox 
                                id={`ingredient-${index}`} 
                                className="mt-0.5" 
                              />
                              <label 
                                htmlFor={`ingredient-${index}`} 
                                className="cursor-pointer text-gray-700"
                              >
                                {typeof ingredient === 'string' ? ingredient : ingredient.display_text}
                              </label>
                            </li>
                          ))}
                        </ul>
                        
                        {/* Shop Button */}
                        <div className="mt-4">
                          <Button
                            onClick={createShoppingList}
                            size="sm"
                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 text-xs h-9"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            Shop Ingredients
                          </Button>
                        </div>
                      </TabsContent>

                      <TabsContent value="instructions" className="p-4 pt-3">
                        <ol className="space-y-3">
                          {(() => {
                            const steps = Array.isArray(generatedRecipe.instructions)
                              ? generatedRecipe.instructions
                              : typeof generatedRecipe.instructions === 'string'
                                ? generatedRecipe.instructions.split(/\n+|(?=Step\s*\d+[:\.)])/i).filter(Boolean)
                                : [];
                            return steps.map((step, index) => (
                              <li key={index} className="flex gap-2 text-sm">
                                <span className="flex-shrink-0 w-5 h-5 bg-purple-600 rounded-full text-white flex items-center justify-center text-xs">
                                  {index + 1}
                                </span>
                                <span className="text-gray-700">{String(step).replace(/^Step\s*\d+[:\.)]\s*/i, '')}</span>
                              </li>
                            ));
                          })()}
                        </ol>
                      </TabsContent>

                      <TabsContent value="nutrition" className="p-4 pt-3">
                        {/* DEBUG: Nutrition debug UI removed but available in git history */}
                        {(generatedRecipe.nutrition || generatedRecipe.nutrition_info) ? (
                          <div>
                            <h4 className="font-semibold mb-4 text-purple-700">Nutrition Information</h4>
                            
                            {/* Use nutrition_info first, fall back to nutrition */}
                            {(() => {
                              const nutritionData = generatedRecipe.nutrition_info || generatedRecipe.nutrition || {};
                              return (
                                <>
                                  {/* Main Macros - 3 prominent boxes */}
                                  <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                                      <div className="text-2xl font-bold text-purple-700">{nutritionData.calories || 0}</div>
                                      <div className="text-sm font-medium text-purple-600">Calories</div>
                                    </div>
                                    <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                                      <div className="text-2xl font-bold text-emerald-700">{nutritionData.protein_g || nutritionData.protein || 0}g</div>
                                      <div className="text-sm font-medium text-emerald-600">Protein</div>
                                    </div>
                                    <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                                      <div className="text-2xl font-bold text-blue-700">{nutritionData.carbs_g || nutritionData.carbs || 0}g</div>
                                      <div className="text-sm font-medium text-blue-600">Carbs</div>
                                    </div>
                                  </div>

                                  {/* Secondary Macros */}
                                  <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                      <div className="text-lg font-semibold text-gray-700">{nutritionData.fat_g || nutritionData.fat || 0}g</div>
                                      <div className="text-sm text-gray-500">Fat</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                      <div className="text-lg font-semibold text-gray-700">{nutritionData.fiber_g || nutritionData.fiber || 0}g</div>
                                      <div className="text-sm text-gray-500">Fiber</div>
                                    </div>
                                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                                      <div className="text-lg font-semibold text-gray-700">{nutritionData.sodium_mg || nutritionData.sodium || 0}mg</div>
                                      <div className="text-sm text-gray-500">Sodium</div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="text-gray-500">Nutrition information not available for this recipe.</div>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Past Recipes Sidebar */}
          <div className="lg:col-span-1">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg">Recent Searches</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="generated" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="generated">Generated</TabsTrigger>
                    <TabsTrigger value="saved">Saved</TabsTrigger>
                  </TabsList>
                  <TabsContent value="generated" className="mt-4">
                    {isLoadingGenerated && recentGenerated.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {(recentGenerated.length > 0 ? recentGenerated : (Array.isArray(generatedRecipes) ? generatedRecipes : [])).map((recipe: any, idx: number) => (
                          <RecipeCard 
                            key={(recipe as any).id ?? `recent-${idx}`} 
                            title={recipe.title || 'Untitled Recipe'}
                            description={recipe.description || 'No description available'}
                            imageUrl={recipe.image_url || ''}
                            timeMinutes={recipe.time_minutes || 0}
                            tags={[recipe.cuisine, recipe.diet].filter(Boolean)}
                            onClick={() => {
                              const transformedRecipe = transformGeneratedRecipe(recipe);
                              setGeneratedRecipe(transformedRecipe);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="saved" className="mt-4">
                    {isLoadingSaved ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : savedRecipes && Array.isArray(savedRecipes) && savedRecipes.length > 0 ? (
                      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {savedRecipes.map((recipe: any) => (
                          <RecipeCard 
                            key={recipe.id} 
                            title={recipe.title || 'Untitled Recipe'}
                            description={recipe.description || 'No description available'}
                            imageUrl={recipe.image_url || ''}
                            timeMinutes={recipe.time_minutes || 0}
                            tags={[recipe.cuisine, recipe.diet].filter(Boolean)}
                            onClick={() => {
                              const transformedRecipe = transformSavedRecipe(recipe);
                              setGeneratedRecipe(transformedRecipe);
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-8">
                        No saved recipes yet
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Community Share Modal */}
      <CommunityShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        recipe={itemToShare}
        shareType="recipe"
      />
      
      {/* Meal Plan Selection Modal */}
      <MealPlanSelectionModal
        isOpen={mealPlanModalOpen}
        onClose={() => {
          setMealPlanModalOpen(false);
          setSelectedRecipeForMealPlan(null);
        }}
        recipe={selectedRecipeForMealPlan}
        onSuccess={() => {
          // Optionally show success message
          toast({
            title: "Recipe added to meal plan!",
            description: "You can view and edit your meal plan from the home page.",
          });
        }}
      />
    </div>
  );
};

export default Search;
