import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Heart, 
  Search, 
  Clock, 
  ChefHat, 
  Trash2, 
  Play,
  Loader2,
  HeartOff,
  X,
  ShoppingCart,
  AlertCircle,
  Share2,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CommunityShareModal } from "@/components/CommunityShareModal";
import { MealPlanSelectionModal } from "@/components/MealPlanSelectionModal";
import { apiRequest } from "@/lib/queryClient";
import ReactPlayer from "react-player";

interface FavoriteItem {
  id: number | string;
  item_type: "recipe" | "meal_plan" | "youtube_video" | "user_recipe";
  item_id: string;
  title: string;
  description?: string;
  image_url?: string;
  time_minutes?: number;
  cuisine?: string;
  diet?: string;
  video_id?: string;
  video_title?: string;
  video_channel?: string;
  metadata?: any;
  created_at: string;
}

export default function Favorites() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [expandedFavorite, setExpandedFavorite] = useState<FavoriteItem | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [mealPlanModalOpen, setMealPlanModalOpen] = useState(false);
  const [selectedRecipeForMealPlan, setSelectedRecipeForMealPlan] = useState<any>(null);
  const [itemToShare, setItemToShare] = useState<FavoriteItem | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Share function - opens community modal
  const handleShare = (item: FavoriteItem) => {
    setItemToShare(item);
    setShareModalOpen(true);
  };

  // Fetch favorites with instant loading - aggressive caching
  const { data: favorites = [], isLoading, error } = useQuery<FavoriteItem[]>({
    queryKey: ['/api/favorites'],
    enabled: true,
    staleTime: Infinity, // Never consider data stale - instant from cache
    gcTime: Infinity, // Keep in cache forever
    retry: 0, // No retries for instant response
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always fetch fresh data when mounting
    refetchOnReconnect: false // Don't refetch on reconnect
  });


  // Fetch user's created recipes
  const { data: userRecipes = [] } = useQuery<any[]>({
    queryKey: ['/api/recipes/user'],
    enabled: true,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Always fetch fresh data when mounting
    refetchOnReconnect: false
  });

  // Remove from favorites mutation
  const removeFromFavoritesMutation = useMutation({
    mutationFn: async (favorite: FavoriteItem) => {
      return apiRequest(`/api/favorites/${favorite.item_type}/${favorite.item_id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      queryClient.refetchQueries({ queryKey: ['/api/favorites'] });
      toast({
        title: "Removed from favorites",
        description: "Item successfully removed from your favorites"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove item from favorites",
        variant: "destructive"
      });
    }
  });

  // Delete user recipe mutation
  const deleteUserRecipeMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      return apiRequest(`/api/recipes/user/${recipeId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recipes/user'] });
      toast({
        title: "Recipe deleted",
        description: "Your recipe has been deleted"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete recipe",
        variant: "destructive"
      });
    }
  });

  // Filter favorites based on search and type
  const filteredFavorites = favorites.filter((favorite: FavoriteItem) => {
    const matchesSearch = favorite.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         favorite.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         favorite.cuisine?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = selectedFilter === "all" || favorite.item_type === selectedFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Transform user recipes to display format
  const transformedUserRecipes = userRecipes.map((recipe: any) => ({
    id: `user_recipe_${recipe.id}`,
    item_type: "user_recipe",
    item_id: recipe.id.toString(),
    title: recipe.title,
    description: recipe.description,
    image_url: recipe.image_url,
    time_minutes: recipe.time_minutes,
    cuisine: recipe.cuisine,
    diet: recipe.diet,
    metadata: {
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      nutrition_info: recipe.nutrition_info
    },
    created_at: recipe.created_at
  }));

  // Filter user recipes based on search
  const filteredUserRecipes = transformedUserRecipes.filter((recipe: any) => {
    const matchesSearch = recipe.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         recipe.cuisine?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Group favorites by type
  const favoritesByType = {
    recipe: filteredFavorites.filter((f: FavoriteItem) => f.item_type === "recipe"),
    meal_plan: filteredFavorites.filter((f: FavoriteItem) => f.item_type === "meal_plan"),
    youtube_video: filteredFavorites.filter((f: FavoriteItem) => f.item_type === "youtube_video")
  };

  const handleRemoveFavorite = (favorite: FavoriteItem) => {
    if (favorite.item_type === "user_recipe") {
      // Delete user-created recipe
      deleteUserRecipeMutation.mutate(favorite.item_id);
    } else {
      // Remove from favorites
      removeFromFavoritesMutation.mutate(favorite);
    }
  };

  const handleOpenYouTubeVideo = (videoId: string) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  const FavoriteCard = ({ favorite }: { favorite: FavoriteItem }) => (
    <Card className="group hover:shadow-md transition-all duration-200 relative cursor-pointer" onClick={() => setExpandedFavorite(favorite)}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image */}
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            {favorite.image_url ? (
              <img 
                src={favorite.image_url} 
                alt={favorite.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                {favorite.item_type === "youtube_video" ? (
                  <Play className="h-6 w-6 text-purple-600" />
                ) : favorite.item_type === "meal_plan" ? (
                  <ChefHat className="h-6 w-6 text-purple-600" />
                ) : (
                  <Heart className="h-6 w-6 text-purple-600" />
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 truncate pr-2">
                {favorite.title}
              </h3>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-green-500 hover:text-green-600 hover:bg-green-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Prepare recipe data for meal plan modal
                    const recipeData = {
                      id: favorite.item_id,
                      title: favorite.title,
                      description: favorite.description,
                      image_url: favorite.image_url,
                      time_minutes: favorite.time_minutes,
                      cuisine: favorite.cuisine,
                      diet: favorite.diet,
                      ingredients: favorite.metadata?.ingredients || [],
                      instructions: favorite.metadata?.instructions || [],
                      nutrition_info: favorite.metadata?.nutrition || null,
                      video_id: favorite.video_id,
                      video_title: favorite.video_title,
                      video_channel: favorite.video_channel
                    };
                    setSelectedRecipeForMealPlan(recipeData);
                    setMealPlanModalOpen(true);
                  }}
                  title="Add to meal plan"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare(favorite);
                  }}
                  title="Share recipe"
                >
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFavorite(favorite);
                  }}
                  disabled={removeFromFavoritesMutation.isPending || deleteUserRecipeMutation.isPending}
                >
                  {(removeFromFavoritesMutation.isPending || deleteUserRecipeMutation.isPending) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {favorite.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                {favorite.description}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {favorite.item_type === "youtube_video" ? "YouTube" :
                 favorite.item_type === "meal_plan" ? "Meal Plan" : "Recipe"}
              </Badge>
              
              {favorite.time_minutes && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {favorite.time_minutes} min
                </Badge>
              )}
              
              {favorite.cuisine && (
                <Badge variant="outline" className="text-xs">
                  {favorite.cuisine}
                </Badge>
              )}
              
              {favorite.diet && (
                <Badge variant="outline" className="text-xs">
                  {favorite.diet}
                </Badge>
              )}
              
              {favorite.video_channel && (
                <Badge variant="outline" className="text-xs">
                  {favorite.video_channel}
                </Badge>
              )}
            </div>

            {favorite.item_type === "youtube_video" && favorite.video_id && (
              <Button
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenYouTubeVideo(favorite.video_id!);
                }}
              >
                <Play className="h-4 w-4 mr-2" />
                Watch Video
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Expanded Recipe View Component
  const ExpandedFavoriteView = ({ favorite }: { favorite: FavoriteItem }) => {
    const metadata = favorite.metadata || {};
    const ingredients = metadata.ingredients || [];
    const instructions = metadata.instructions || [];
    const nutrition = metadata.nutrition_info || metadata.nutrition || {};
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 pr-4">{favorite.title}</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpandedFavorite(null)}
              className="flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="p-6">
              <div className="space-y-4">
                {/* Video Player or Recipe Image */}
                {favorite.video_id ? (
                  <div>
                    <div className="aspect-video rounded-lg overflow-hidden mb-3">
                      <ReactPlayer
                        url={`https://www.youtube.com/watch?v=${favorite.video_id}`}
                        width="100%"
                        height="100%"
                        controls
                      />
                    </div>
                  </div>
                ) : favorite.image_url ? (
                  <div>
                    <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-gray-100 flex items-center justify-center">
                      <img
                        src={favorite.image_url}
                        alt={favorite.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="aspect-video rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                      <ChefHat className="h-16 w-16 text-purple-400" />
                    </div>
                  </div>
                )}
                
                {/* Recipe Info Section */}
                <div className="space-y-4">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {favorite.item_type === "youtube_video" ? "YouTube" :
                       favorite.item_type === "meal_plan" ? "Meal Plan" : "Recipe"}
                    </Badge>
                    
                    {favorite.time_minutes && (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {favorite.time_minutes} min
                      </Badge>
                    )}
                    
                    {favorite.cuisine && (
                      <Badge variant="outline">{favorite.cuisine}</Badge>
                    )}
                    
                    {favorite.diet && (
                      <Badge variant="outline">{favorite.diet}</Badge>
                    )}
                    
                    {favorite.video_channel && (
                      <Badge variant="outline">{favorite.video_channel}</Badge>
                    )}
                  </div>
                  
                  {/* Only show tabs if we have recipe data */}
                  {(ingredients.length > 0 || instructions.length > 0 || Object.keys(nutrition).length > 0) && (
                    <Tabs defaultValue="ingredients" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
                    <TabsTrigger value="instructions">Instructions</TabsTrigger>
                    <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="ingredients" className="mt-4">
                    <div className="space-y-2">
                      {ingredients.length > 0 ? (
                        ingredients.map((ingredient: any, index: number) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Checkbox className="rounded" />
                            <span className="text-sm">
                              {typeof ingredient === 'string' 
                                ? ingredient 
                                : ingredient.display_text || ingredient.name || 'Unknown ingredient'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">No ingredients available</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="instructions" className="mt-4">
                    <div className="space-y-3">
                      {instructions.length > 0 ? (
                        instructions.map((instruction: string, index: number) => (
                          <div key={index} className="flex gap-3">
                            <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-medium text-purple-600">
                              {index + 1}
                            </div>
                            <p className="text-sm text-gray-700 flex-1">{instruction}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm">No instructions available</p>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="nutrition" className="mt-4">
                    {Object.keys(nutrition).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {nutrition.calories && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-semibold text-gray-900">{Math.round(nutrition.calories)}</div>
                            <div className="text-xs text-gray-600">Calories</div>
                          </div>
                        )}
                        {(nutrition.protein_g || nutrition.protein) && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-semibold text-gray-900">{Math.round(nutrition.protein_g || nutrition.protein)}g</div>
                            <div className="text-xs text-gray-600">Protein</div>
                          </div>
                        )}
                        {(nutrition.carbs_g || nutrition.carbs) && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-semibold text-gray-900">{Math.round(nutrition.carbs_g || nutrition.carbs)}g</div>
                            <div className="text-xs text-gray-600">Carbs</div>
                          </div>
                        )}
                        {(nutrition.fat_g || nutrition.fat) && (
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <div className="text-lg font-semibold text-gray-900">{Math.round(nutrition.fat_g || nutrition.fat)}g</div>
                            <div className="text-xs text-gray-600">Fat</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No nutrition information available</p>
                    )}
                  </TabsContent>
                    </Tabs>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ type }: { type: string }) => (
    <div className="text-center py-12">
      <HeartOff className="h-12 w-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-600 mb-2">
        {type === "favorites" ? "No favorites found" : 
         type === "your_meals" ? "No meals created yet" : 
         `No ${type.replace("_", " ")} found`}
      </h3>
      <p className="text-gray-500 text-sm max-w-md mx-auto">
        {searchQuery 
          ? `No ${type === "favorites" ? "favorites" : type === "your_meals" ? "meals" : type.replace("_", " ")} match your search.`
          : type === "your_meals" 
            ? "Create your first recipe using the 'Create Recipe' button to see it here!"
            : "Start adding items to your favorites to see them here!"
        }
      </p>
    </div>
  );

  // NO LOADING STATE - Always show content immediately

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-stone-50 pb-20">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-12">
              <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Favorites</h2>
              <p className="text-gray-600 mb-4">There was a problem loading your favorites.</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Remove test banner - page works! */}
      
      <div className="max-w-4xl mx-auto p-4 pb-24">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Heart className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">My Favorites</h1>
          </div>
          <p className="text-gray-600">
            Your favorite items and custom-created meals in one place
          </p>
        </div>

      {/* Search and Stats */}
      <div className="mb-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search your favorites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {favorites.length > 0 && (
          <div className="text-sm text-gray-600">
            {filteredFavorites.length} of {favorites.length} favorites
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}
      </div>

      {error ? (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            <AlertCircle className="w-12 h-12 mx-auto mb-2" />
            Failed to load favorites
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/favorites'] })}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState type="favorites" />
      ) : (
        <Tabs defaultValue="favorites" className="w-full">
          <TabsList className="grid grid-cols-2 mb-6">
            <TabsTrigger value="favorites">
              Favorites ({favorites.length})
            </TabsTrigger>
            <TabsTrigger value="your_meals">
              Your Meals ({filteredUserRecipes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="favorites">
            {filteredFavorites.length > 0 ? (
              <div className="space-y-4">
                {filteredFavorites.map((favorite: FavoriteItem) => (
                  <FavoriteCard key={favorite.id} favorite={favorite} />
                ))}
              </div>
            ) : (
              <EmptyState type="favorites" />
            )}
          </TabsContent>

          <TabsContent value="your_meals">
            {filteredUserRecipes.length > 0 ? (
              <div className="space-y-4">
                {filteredUserRecipes.map((recipe: any) => (
                  <FavoriteCard key={recipe.id} favorite={recipe} />
                ))}
              </div>
            ) : (
              <EmptyState type="your_meals" />
            )}
          </TabsContent>
        </Tabs>
      )}
      
        {/* Expanded Favorite Modal */}
        {expandedFavorite && (
          <ExpandedFavoriteView favorite={expandedFavorite} />
        )}
        
        {/* Community Share Modal */}
        <CommunityShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          recipe={itemToShare ? {
            id: typeof itemToShare.id === 'string' ? parseInt(itemToShare.id) : itemToShare.id,
            title: itemToShare.title,
            description: itemToShare.description || '',
            ingredients: itemToShare.metadata?.ingredients || [],
            instructions: itemToShare.metadata?.instructions || [],
            image_url: itemToShare.image_url,
            time_minutes: itemToShare.time_minutes,
            cuisine: itemToShare.cuisine,
            nutrition: itemToShare.metadata?.nutrition_info || itemToShare.metadata?.nutrition,
            nutrition_info: itemToShare.metadata?.nutrition_info || itemToShare.metadata?.nutrition,
            video_id: itemToShare.video_id,
            video_title: itemToShare.video_title,
            video_channel: itemToShare.video_channel
          } : undefined}
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
            // Optionally refresh favorites or show success message
            queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
          }}
        />
      </div>
    </div>
  );
}