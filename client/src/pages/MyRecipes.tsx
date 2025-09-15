import { useQuery } from "@tanstack/react-query";
import RecipeCard from "@/components/RecipeCard";
import { useState } from "react";
import RecipeDisplay from "@/components/RecipeDisplay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  Search,
  Loader2,
  Filter,
  X,
  Clock,
  ChefHat
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const MyRecipes = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [ingredientFilter, setIngredientFilter] = useState("");
  const [cuisineFilter, setCuisineFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  const [dietFilter, setDietFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const { data: savedRecipes, isLoading } = useQuery({
    queryKey: ['/api/recipes/saved'],
    enabled: true
  });
  
  const { data: generatedRecipes, isLoading: isLoadingGenerated } = useQuery({
    queryKey: ['/api/recipes/generated'],
    enabled: true
  });

  // Advanced filtering function
  const filterRecipes = (recipes: any[]) => {
    if (!recipes || !Array.isArray(recipes)) return [];
    
    return recipes.filter((recipe: any) => {
      // Title search
      const matchesTitle = recipe.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Ingredient search
      const matchesIngredient = !ingredientFilter || 
        (recipe.ingredients && Array.isArray(recipe.ingredients) && recipe.ingredients.some((ing: any) => 
          ing && typeof ing === 'string' && ing.toLowerCase().includes(ingredientFilter.toLowerCase())
        ));
      
      // Cuisine filter
      const matchesCuisine = !cuisineFilter || cuisineFilter === "all" || 
        (recipe.cuisine && recipe.cuisine.toLowerCase() === cuisineFilter.toLowerCase());
      
      // Time filter
      const matchesTime = !timeFilter || timeFilter === "all" || (() => {
        const time = recipe.time_minutes || 0;
        switch(timeFilter) {
          case "quick": return time <= 30;
          case "medium": return time > 30 && time <= 60;
          case "long": return time > 60;
          default: return true;
        }
      })();
      
      // Diet filter
      const matchesDiet = !dietFilter || dietFilter === "all" || 
        (recipe.diet && recipe.diet.toLowerCase().includes(dietFilter.toLowerCase()));
      
      return matchesTitle && matchesIngredient && matchesCuisine && matchesTime && matchesDiet;
    });
  };
  
  const filteredSavedRecipes = filterRecipes(Array.isArray(savedRecipes) ? savedRecipes : []);
  const filteredGeneratedRecipes = filterRecipes(Array.isArray(generatedRecipes) ? generatedRecipes : []);

  // Get unique values for filter options
  const getUniqueValues = (recipes: any[], field: string) => {
    if (!recipes || !Array.isArray(recipes)) return [];
    return Array.from(new Set(recipes.map(recipe => recipe[field]).filter(Boolean)));
  };

  const allRecipes = [...(Array.isArray(savedRecipes) ? savedRecipes : []), ...(Array.isArray(generatedRecipes) ? generatedRecipes : [])];
  const cuisines = getUniqueValues(allRecipes, 'cuisine');
  const diets = getUniqueValues(allRecipes, 'diet');

  const clearFilters = () => {
    setSearchQuery("");
    setIngredientFilter("");
    setCuisineFilter("");
    setTimeFilter("");
    setDietFilter("");
  };

  const hasActiveFilters = searchQuery || ingredientFilter || cuisineFilter || timeFilter || dietFilter;
  
  const handleRecipeClick = (recipe: any) => {
    setSelectedRecipe(recipe);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-neutral-800 mb-4">
          My Recipes
        </h1>
        <p className="text-neutral-600">
          View, manage, and cook your saved and generated recipes
        </p>
      </div>
      
      {selectedRecipe ? (
        <div className="mb-10">
          <RecipeDisplay recipe={selectedRecipe} />
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              onClick={() => setSelectedRecipe(null)}
            >
              Back to My Recipes
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Search and Filter Section */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative w-full max-w-lg">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400" />
                <Input
                  type="text"
                  placeholder="Search your recipes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && <Badge variant="destructive" className="ml-1 px-1 py-0 text-xs">•</Badge>}
              </Button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-neutral-50 border rounded-lg p-4 space-y-4">
                <div className="flex flex-wrap gap-4">
                  {/* Ingredient Filter */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Search by Ingredient
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., chicken, tomato, garlic"
                      value={ingredientFilter}
                      onChange={(e) => setIngredientFilter(e.target.value)}
                    />
                  </div>

                  {/* Cuisine Filter */}
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Cuisine
                    </label>
                    <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any cuisine" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any cuisine</SelectItem>
                        {cuisines.map((cuisine) => (
                          <SelectItem key={cuisine} value={cuisine}>
                            {cuisine}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Time Filter */}
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Cooking Time
                    </label>
                    <Select value={timeFilter} onValueChange={setTimeFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any time</SelectItem>
                        <SelectItem value="quick">Quick (≤30 min)</SelectItem>
                        <SelectItem value="medium">Medium (30-60 min)</SelectItem>
                        <SelectItem value="long">Long (60+ min)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Diet Filter */}
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      <ChefHat className="w-4 h-4 inline mr-1" />
                      Diet
                    </label>
                    <Select value={dietFilter} onValueChange={setDietFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any diet" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any diet</SelectItem>
                        {diets.map((diet) => (
                          <SelectItem key={diet} value={diet}>
                            {diet}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Active Filters & Clear */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                    <span className="text-sm text-neutral-600">Active filters:</span>
                    {searchQuery && <Badge variant="secondary">{searchQuery}</Badge>}
                    {ingredientFilter && <Badge variant="secondary">Has: {ingredientFilter}</Badge>}
                    {cuisineFilter && <Badge variant="secondary">{cuisineFilter}</Badge>}
                    {timeFilter && <Badge variant="secondary">{timeFilter === 'quick' ? '≤30 min' : timeFilter === 'medium' ? '30-60 min' : '60+ min'}</Badge>}
                    {dietFilter && <Badge variant="secondary">{dietFilter}</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-red-600 hover:text-red-700 ml-2"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Tabs defaultValue="saved" className="w-full">
            <TabsList className="w-full mb-6 grid grid-cols-2">
              <TabsTrigger value="saved">Saved Recipes</TabsTrigger>
              <TabsTrigger value="generated">Generated Recipes</TabsTrigger>
            </TabsList>
            
            <TabsContent value="saved">
              {isLoading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : filteredSavedRecipes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSavedRecipes.map((recipe: any) => (
                    <RecipeCard
                      key={recipe.id}
                      title={recipe.title}
                      description={recipe.description || ""}
                      imageUrl={recipe.image_url}
                      timeMinutes={recipe.time_minutes || 0}
                      tags={[recipe.cuisine || "Other", recipe.diet || "Regular"]}
                      onClick={() => handleRecipeClick(recipe)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <h3 className="text-xl font-display font-bold mb-2">No saved recipes found</h3>
                  <p className="text-neutral-600 mb-6">
                    {searchQuery ? "Try a different search term" : "Save recipes to view them here"}
                  </p>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-white"
                    onClick={() => window.location.href = "/"}
                  >
                    Browse Recipes
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="generated">
              {isLoadingGenerated ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                </div>
              ) : filteredGeneratedRecipes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGeneratedRecipes.map((recipe: any) => (
                    <RecipeCard
                      key={recipe.id}
                      title={recipe.title}
                      description={recipe.description || ""}
                      imageUrl={recipe.image_url}
                      timeMinutes={recipe.time_minutes || 0}
                      tags={[recipe.cuisine || "Other", recipe.diet || "Regular"]}
                      onClick={() => handleRecipeClick(recipe)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20">
                  <h3 className="text-xl font-display font-bold mb-2">No generated recipes found</h3>
                  <p className="text-neutral-600 mb-6">
                    {searchQuery ? "Try a different search term" : "Generate new recipes to view them here"}
                  </p>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-white"
                    onClick={() => window.location.href = "/#generate"}
                  >
                    Generate Recipe
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default MyRecipes;
