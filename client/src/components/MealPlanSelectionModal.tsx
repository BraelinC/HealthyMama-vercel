import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogOverlay } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  CalendarDays, 
  Coffee, 
  Sun, 
  Moon, 
  Check,
  Loader2,
  ChefHat,
  Clock,
  X,
  Sparkles,
  Utensils
} from "lucide-react";

interface Recipe {
  id?: string | number;
  title: string;
  description?: string;
  image_url?: string;
  time_minutes?: number;
  cuisine?: string;
  diet?: string;
  ingredients?: any[];
  instructions?: any[];
  nutrition_info?: any;
  video_id?: string;
  video_title?: string;
  video_channel?: string;
}

interface MealPlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: Recipe | null;
  onSuccess?: () => void;
}

interface MealSlot {
  dayNumber: number;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  isOccupied: boolean;
  currentRecipe?: any;
}

interface DayMeals {
  dayNumber: number;
  dayKey: string;
  breakfast?: any;
  lunch?: any;
  dinner?: any;
}

export function MealPlanSelectionModal({ isOpen, onClose, recipe, onSuccess }: MealPlanSelectionModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSlot, setSelectedSlot] = useState<MealSlot | null>(null);
  const [selectedNewDayMeal, setSelectedNewDayMeal] = useState<'breakfast' | 'lunch' | 'dinner'>('lunch');
  const [isAddingNewDay, setIsAddingNewDay] = useState(false);

  // Fetch user's current meal plans
  const { data: mealPlansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['/api/meal-plans/saved'],
    queryFn: async () => {
      const response = await fetch('/api/meal-plans/saved', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch meal plans');
      return response.json();
    },
    enabled: isOpen,
  });

  // Parse existing meal plan days
  const extractDaysFromMealPlan = (mealPlan: any): DayMeals[] => {
    const days: DayMeals[] = [];
    
    if (!mealPlan) return days;

    // Look for day_1, day_2, etc. pattern
    Object.keys(mealPlan).forEach(key => {
      if (key.startsWith('day_')) {
        const dayNumber = parseInt(key.split('_')[1]);
        if (!isNaN(dayNumber)) {
          const dayData = mealPlan[key];
          days.push({
            dayNumber,
            dayKey: key,
            breakfast: dayData?.breakfast || null,
            lunch: dayData?.lunch || null,
            dinner: dayData?.dinner || null
          });
        }
      }
    });

    return days.sort((a, b) => a.dayNumber - b.dayNumber);
  };

  // Get the most recent meal plan and extract days
  const currentPlan = mealPlansData?.[0];
  const mealPlanData = currentPlan?.meal_plan || {};
  const existingDays = extractDaysFromMealPlan(mealPlanData);
  const nextDayNumber = existingDays.length > 0 
    ? Math.max(...existingDays.map(d => d.dayNumber)) + 1 
    : 1;


  // Mutation to add recipe to meal plan
  const addToMealPlanMutation = useMutation({
    mutationFn: async ({ dayNumber, mealType }: { dayNumber: number; mealType: string }) => {
      // Prepare the updated meal plan
      const dayKey = `day_${dayNumber}`;
      const updatedMealPlan = { ...mealPlanData };
      
      // Initialize the day if it doesn't exist
      if (!updatedMealPlan[dayKey]) {
        updatedMealPlan[dayKey] = {};
      }
      
      // Add the recipe to the specified meal type
      updatedMealPlan[dayKey][mealType] = {
        ...recipe,
        name: recipe?.title,
        title: recipe?.title,
        prep_time: recipe?.time_minutes,
        difficulty: 'Medium',
        cuisine: recipe?.cuisine || '',
        diet: recipe?.diet || '',
        ingredients: recipe?.ingredients || [],
        instructions: recipe?.instructions || [],
        nutrition: recipe?.nutrition_info || null,
        image_url: recipe?.image_url || null,
        video_id: recipe?.video_id || null,
        video_title: recipe?.video_title || null,
        video_channel: recipe?.video_channel || null
      };

      // If updating existing meal plan
      if (currentPlan?.id) {
        const response = await fetch(`/api/meal-plans/${currentPlan.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({
            name: currentPlan.name,
            description: currentPlan.description || '',
            meal_plan: updatedMealPlan
          }),
        });
        if (!response.ok) throw new Error('Failed to update meal plan');
        return response.json();
      } else {
        // Create new meal plan
        const response = await fetch('/api/save-meal-plan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({
            name: `My Meal Plan - ${new Date().toLocaleDateString()}`,
            description: 'Created from favorites',
            meal_plan: updatedMealPlan,
            date_range: `Day 1 - Day ${dayNumber}`,
            total_recipes: dayNumber * 3,
            preferences: {
              dietary_restrictions: [],
              cuisine_types: [],
              goals: []
            }
          }),
        });
        if (!response.ok) throw new Error('Failed to create meal plan');
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans/saved'] });
      toast({
        title: "Recipe Added! 🎉",
        description: `${recipe?.title} has been added to your meal plan.`,
        variant: "default",
      });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add recipe to meal plan. Please try again.",
        variant: "destructive",
      });
      console.error('Error adding to meal plan:', error);
    },
  });

  const handleAddToMealPlan = () => {
    if (selectedSlot) {
      addToMealPlanMutation.mutate({
        dayNumber: selectedSlot.dayNumber,
        mealType: selectedSlot.mealType,
      });
    } else if (isAddingNewDay) {
      addToMealPlanMutation.mutate({
        dayNumber: nextDayNumber,
        mealType: selectedNewDayMeal,
      });
    }
  };

  const getMealIcon = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return <Coffee className="h-3 w-3" />;
      case 'lunch': return <Sun className="h-3 w-3" />;
      case 'dinner': return <Moon className="h-3 w-3" />;
      default: return <ChefHat className="h-3 w-3" />;
    }
  };

  const getMealEmoji = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return '🍳';
      case 'lunch': return '🥗';
      case 'dinner': return '🍝';
      default: return '🍽️';
    }
  };

  if (!recipe) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/60 z-[3000000]" />
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col z-[3000001]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-purple-600" />
            Add to Meal Plan
          </DialogTitle>
          <DialogDescription>
            Choose where to add this recipe in your meal plan
          </DialogDescription>
        </DialogHeader>

        {/* Recipe Preview Card */}
        <Card className="mb-3 bg-gradient-to-r from-purple-50 to-pink-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              {recipe.image_url && (
                <img 
                  src={recipe.image_url} 
                  alt={recipe.title}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 text-sm">{recipe.title}</h3>
                {recipe.description && (
                  <p className="text-xs text-gray-600 line-clamp-1 mt-0.5">
                    {recipe.description}
                  </p>
                )}
                <div className="flex gap-2 mt-1">
                  {recipe.time_minutes && (
                    <Badge variant="secondary" className="text-xs py-0">
                      <Clock className="h-3 w-3 mr-1" />
                      {recipe.time_minutes} min
                    </Badge>
                  )}
                  {recipe.cuisine && (
                    <Badge variant="secondary" className="text-xs py-0">
                      {recipe.cuisine}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoadingPlans ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <Tabs defaultValue="existing" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing" disabled={existingDays.length === 0}>
                Existing Days ({existingDays.length})
              </TabsTrigger>
              <TabsTrigger value="new" disabled={nextDayNumber > 7}>
                Add New Day
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="flex-1 overflow-hidden mt-3">
              {existingDays.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CalendarDays className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No meal plan days yet. Start by adding a new day!</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="grid gap-3">
                    {existingDays.map((day) => (
                      <Card key={day.dayNumber} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-purple-700 flex items-center gap-2">
                              <CalendarDays className="h-4 w-4" />
                              Day {day.dayNumber}
                            </h4>
                            <Badge variant="outline" className="text-xs">
                              {Object.values({
                                breakfast: day.breakfast,
                                lunch: day.lunch,
                                dinner: day.dinner
                              }).filter(Boolean).length}/3 meals
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                              const meal = day[mealType as keyof typeof day];
                              const isOccupied = !!meal && typeof meal === 'object';
                              const isSelected = selectedSlot?.dayNumber === day.dayNumber && 
                                               selectedSlot?.mealType === mealType;

                              return (
                                <button
                                  key={mealType}
                                  onClick={() => {
                                    setSelectedSlot({
                                      dayNumber: day.dayNumber,
                                      mealType: mealType as 'breakfast' | 'lunch' | 'dinner',
                                      isOccupied,
                                      currentRecipe: meal
                                    });
                                    setIsAddingNewDay(false);
                                  }}
                                  className={`
                                    relative flex flex-col items-center p-3 rounded-lg border-2 
                                    transition-all duration-200 text-left w-full min-h-[100px]
                                    ${isSelected 
                                      ? 'border-purple-500 bg-purple-50 shadow-md' 
                                      : isOccupied 
                                        ? 'border-gray-200 bg-gray-50 hover:border-gray-300' 
                                        : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                    }
                                  `}
                                >
                                  {/* Meal Type Header */}
                                  <div className="flex items-center gap-1 mb-2 text-xs font-medium text-gray-600">
                                    {getMealEmoji(mealType)}
                                    <span className="capitalize">{mealType}</span>
                                  </div>
                                  
                                  {/* Meal Content */}
                                  {isOccupied && meal ? (
                                    <div className="w-full">
                                      {meal.image_url && (
                                        <img 
                                          src={meal.image_url} 
                                          alt={meal.name || meal.title}
                                          className="w-full h-12 object-cover rounded mb-1"
                                        />
                                      )}
                                      <p className="text-xs text-gray-700 line-clamp-2 font-medium">
                                        {meal.name || meal.title || 'Recipe'}
                                      </p>
                                      {meal.prep_time && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          {meal.prep_time} min
                                        </p>
                                      )}
                                      {isSelected && (
                                        <Badge className="absolute top-1 right-1 text-xs px-1 py-0" variant="secondary">
                                          Replace
                                        </Badge>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center flex-1">
                                      <Plus className="h-4 w-4 text-green-600 mb-1" />
                                      <span className="text-xs text-green-600 font-medium">
                                        Empty
                                      </span>
                                    </div>
                                  )}
                                  
                                  {isSelected && (
                                    <Check className="absolute top-1 right-1 h-4 w-4 text-purple-600" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="new" className="mt-3">
              {nextDayNumber > 7 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>You've reached the maximum of 7 days in your meal plan.</p>
                </div>
              ) : (
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-purple-700 flex items-center gap-2">
                          <Sparkles className="h-5 w-5" />
                          Create Day {nextDayNumber}
                        </h4>
                        <Badge className="bg-purple-600 text-white">
                          New Day
                        </Badge>
                      </div>
                      
                      <RadioGroup 
                        value={selectedNewDayMeal} 
                        onValueChange={(value) => {
                          setSelectedNewDayMeal(value as 'breakfast' | 'lunch' | 'dinner');
                          setIsAddingNewDay(true);
                          setSelectedSlot(null);
                        }}
                      >
                        <div className="grid grid-cols-3 gap-4">
                          {['breakfast', 'lunch', 'dinner'].map((mealType) => (
                            <label
                              key={mealType}
                              htmlFor={`new-${mealType}`}
                              className={`
                                flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer
                                transition-all duration-200 hover:shadow-md
                                ${selectedNewDayMeal === mealType && isAddingNewDay
                                  ? 'border-purple-500 bg-purple-50 shadow-md' 
                                  : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                }
                              `}
                            >
                              <RadioGroupItem 
                                value={mealType} 
                                id={`new-${mealType}`}
                                className="sr-only"
                              />
                              <span className="text-2xl mb-2">{getMealEmoji(mealType)}</span>
                              <span className="text-sm font-medium capitalize">
                                {mealType}
                              </span>
                              {selectedNewDayMeal === mealType && isAddingNewDay && (
                                <Check className="h-4 w-4 text-purple-600 mt-2" />
                              )}
                            </label>
                          ))}
                        </div>
                      </RadioGroup>

                      <div className="pt-4 border-t">
                        <p className="text-sm text-gray-600">
                          This will create Day {nextDayNumber} in your meal plan and add "{recipe.title}" 
                          to the {selectedNewDayMeal} slot.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddToMealPlan}
            disabled={!selectedSlot && !isAddingNewDay || addToMealPlanMutation.isPending}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {addToMealPlanMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to Meal Plan
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}