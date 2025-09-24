import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { safeApiRequest } from "@/lib/queryClient";

import { 
  ChefHat,
  Loader2,
  Edit,
  Save,
  Plus,
  Trash2,
  Calendar,
  Clock,
  Send,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  BookOpen,
  Activity,
  Search,
  GripVertical,
  Move
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Meal {
  title: string;
  cook_time_minutes: number;
  difficulty: number;
  ingredients: string[];
  instructions: string[];
  nutrition?: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

interface DayMeals {
  breakfast?: Meal;
  lunch?: Meal;
  dinner?: Meal;
  snack?: Meal;
}

interface MealPlan {
  id: number;
  name: string;
  description: string;
  mealPlan: { [key: string]: DayMeals };
  createdAt: string;
  updatedAt: string;
}

export default function Home() {
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMeal, setEditingMeal] = useState<{ dayKey: string; mealType: string; meal: Meal } | null>(null);
  const [expandedMeal, setExpandedMeal] = useState<string | null>(null);
  const [draggedMeal, setDraggedMeal] = useState<{ dayKey: string; mealType: string; meal: Meal } | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch the most recent meal plan
  const { data: mealPlans, isLoading } = useQuery({
    queryKey: ['/api/meal-plans'],
  });

  // Set the current plan to the most recent one
  useEffect(() => {
    if (mealPlans && mealPlans.length > 0) {
      setCurrentPlan(mealPlans[0]);
    }
  }, [mealPlans]);

  // Update meal plan mutation
  const updateMealPlanMutation = useMutation({
    mutationFn: async ({ id, name, description, mealPlan }: { id: number; name: string; description: string; mealPlan: any }) => {
      return await safeApiRequest(`/api/meal-plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description, mealPlan }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans'] });
      toast({
        title: "Success",
        description: "Meal plan updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update meal plan",
        variant: "destructive",
      });
    },
  });

  const handleSavePlan = async () => {
    if (!currentPlan) return;

    await updateMealPlanMutation.mutateAsync({
      id: currentPlan.id,
      name: currentPlan.name,
      description: currentPlan.description,
      mealPlan: currentPlan.mealPlan,
    });

    setIsEditing(false);
  };

  const handleEditMeal = (dayKey: string, mealType: string, meal: Meal) => {
    setEditingMeal({ dayKey, mealType, meal });
  };

  const handleSaveMeal = () => {
    if (!editingMeal || !currentPlan) return;

    const updatedPlan = { ...currentPlan };
    updatedPlan.mealPlan[editingMeal.dayKey][editingMeal.mealType as keyof DayMeals] = editingMeal.meal;
    
    setCurrentPlan(updatedPlan);
    setEditingMeal(null);
    setIsEditing(true);
  };

  const handleDeleteMeal = (dayKey: string, mealType: string) => {
    if (!currentPlan) return;

    const updatedPlan = { ...currentPlan };
    delete updatedPlan.mealPlan[dayKey][mealType as keyof DayMeals];
    
    setCurrentPlan(updatedPlan);
    setIsEditing(true);
  };

  const handleAddMeal = (dayKey: string, mealType: string) => {
    const newMeal: Meal = {
      title: `New ${mealType}`,
      cook_time_minutes: 30,
      difficulty: 3,
      ingredients: ['Add ingredients'],
      instructions: ['Add instructions'],
      nutrition: {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      },
    };

    handleEditMeal(dayKey, mealType, newMeal);
  };

  const handleMealClick = (dayKey: string, mealType: string) => {
    if (isEditing) return;
    
    const expandedKey = `${dayKey}-${mealType}`;
    setExpandedMeal(expandedMeal === expandedKey ? null : expandedKey);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, dayKey: string, mealType: string, meal: Meal) => {
    if (!isEditing) return;
    
    setDraggedMeal({ dayKey, mealType, meal });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetDayKey: string, targetMealType: string) => {
    e.preventDefault();
    
    if (!draggedMeal || !currentPlan || !isEditing) return;
    
    // Don't do anything if dropping on same location
    if (draggedMeal.dayKey === targetDayKey && draggedMeal.mealType === targetMealType) {
      setDraggedMeal(null);
      return;
    }

    const updatedPlan = { ...currentPlan };
    
    // Check if target already has a meal
    const targetMeal = updatedPlan.mealPlan[targetDayKey][targetMealType as keyof DayMeals];
    
    if (targetMeal) {
      // Swap meals
      updatedPlan.mealPlan[draggedMeal.dayKey][draggedMeal.mealType as keyof DayMeals] = targetMeal;
      updatedPlan.mealPlan[targetDayKey][targetMealType as keyof DayMeals] = draggedMeal.meal;
      
      toast({
        title: "Meals Swapped",
        description: `${draggedMeal.meal.title} and ${targetMeal.title} have been swapped`,
      });
    } else {
      // Move meal to empty slot
      delete updatedPlan.mealPlan[draggedMeal.dayKey][draggedMeal.mealType as keyof DayMeals];
      updatedPlan.mealPlan[targetDayKey][targetMealType as keyof DayMeals] = draggedMeal.meal;
      
      toast({
        title: "Meal Moved",
        description: `${draggedMeal.meal.title} moved to ${targetDayKey.replace('_', ' ')} ${targetMealType}`,
      });
    }
    
    setCurrentPlan(updatedPlan);
    setDraggedMeal(null);
  };

  const getDayCount = (mealPlan: { [key: string]: DayMeals }) => {
    return Object.keys(mealPlan).length;
  };

  const getMealCount = (mealPlan: { [key: string]: DayMeals }) => {
    return Object.values(mealPlan).reduce((total, dayMeals) => {
      return total + Object.values(dayMeals).filter(Boolean).length;
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!currentPlan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">No Meal Plans Found</h1>
          <p className="text-muted-foreground mb-6">Create your first meal plan to get started.</p>
          <Button onClick={() => window.location.href = '/meal-planner'}>
            <Plus className="w-4 h-4 mr-2" />
            Create Meal Plan
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Your Meal Plan</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {getDayCount(currentPlan.mealPlan)} days
                </div>
                <div className="flex items-center gap-1">
                  <ChefHat className="w-4 h-4" />
                  {getMealCount(currentPlan.mealPlan)} meals
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={isEditing ? "default" : "outline"}
                onClick={() => setIsEditing(!isEditing)}
                className={isEditing ? "bg-purple-600 hover:bg-purple-700" : ""}
              >
                {isEditing ? (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Plan
                  </>
                )}
              </Button>
              {isEditing && (
                <Button
                  variant="outline"
                  onClick={() => handleSavePlan()}
                  disabled={updateMealPlanMutation.isPending}
                  style={{ borderColor: '#50C878', color: '#50C878' }}
                  className="hover:bg-emerald-50"
                >
                  {updateMealPlanMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Plan
                </Button>
              )}
            </div>
          </div>

          {/* Plan Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  {isEditing ? (
                    <Input
                      value={currentPlan.name}
                      onChange={(e) => setCurrentPlan({ ...currentPlan, name: e.target.value })}
                      className="text-lg font-semibold mb-2"
                    />
                  ) : (
                    <CardTitle className="text-lg">{currentPlan.name}</CardTitle>
                  )}
                  {isEditing ? (
                    <Textarea
                      value={currentPlan.description}
                      onChange={(e) => setCurrentPlan({ ...currentPlan, description: e.target.value })}
                      className="text-sm"
                      rows={2}
                    />
                  ) : (
                    <CardDescription>{currentPlan.description}</CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Meal Calendar */}
        <div className="space-y-6">
          <div className="grid gap-6">
            {Object.entries(currentPlan.mealPlan)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([dayKey, dayMeals]) => (
              <Card key={dayKey}>
                <CardHeader>
                  <CardTitle className="text-xl capitalize flex items-center gap-2">
                    <Calendar className="w-5 h-5" style={{ color: '#50C878' }} />
                    {dayKey.replace('_', ' ')}
                    {isEditing && (
                      <Badge 
                        variant="secondary" 
                        className="ml-2 text-xs bg-purple-100 text-purple-700 border-purple-200"
                      >
                        <Move className="w-3 h-3 mr-1" />
                        Editing Mode - Drag meals to rearrange
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                      const meal = dayMeals[mealType as keyof DayMeals];
                      return (
                        <Card 
                          key={mealType} 
                          className={`bg-muted/30 ${isEditing && !meal ? 'border-dashed border-2 border-muted-foreground/20' : ''}`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, dayKey, mealType)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm capitalize">{mealType}</CardTitle>
                              <div className="flex gap-1">
                                {meal && isEditing && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="drag-handle cursor-move"
                                      title="Drag to move meal"
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, dayKey, mealType, meal)}
                                    >
                                      <GripVertical className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleEditMeal(dayKey, mealType, meal)}
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteMeal(dayKey, mealType)}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {meal ? (
                              <div className="space-y-2">
                                <div 
                                  className={`cursor-pointer ${!isEditing ? 'hover:bg-muted/20 p-2 rounded -m-2' : ''}`}
                                  onClick={() => handleMealClick(dayKey, mealType)}
                                >
                                  <h4 className="font-medium text-sm">{meal.title}</h4>
                                  <div className="flex gap-2 text-xs">
                                    <Badge variant="outline">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {meal.cook_time_minutes}m
                                    </Badge>
                                    <Badge variant="outline">
                                      Difficulty: {meal.difficulty}/5
                                    </Badge>
                                  </div>
                                  {meal.nutrition && (
                                    <div className="text-xs text-muted-foreground">
                                      {meal.nutrition.calories} cal
                                    </div>
                                  )}
                                  {!isEditing && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <span>Click to view details</span>
                                      {expandedMeal === `${dayKey}-${mealType}` ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Expanded meal details */}
                                {!isEditing && expandedMeal === `${dayKey}-${mealType}` && (
                                  <div className="mt-4 p-4 bg-gradient-to-br from-muted/20 to-muted/40 rounded-lg space-y-4 border border-primary/20 shadow-sm">
                                    {/* Header with Search Button */}
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-semibold text-lg text-primary">Recipe Details</h4>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                                        onClick={() => {
                                          // Create smart search prompt with meal name and key ingredients
                                          const mainIngredients = meal.ingredients?.slice(0, 3).join(', ') || '';
                                          const searchQuery = `${meal.title} recipe with ${mainIngredients}`;
                                          // Navigate to search page with pre-filled query
                                          window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
                                        }}
                                      >
                                        <Search className="w-3 h-3 mr-1" />
                                        Find
                                      </Button>
                                    </div>
                                    
                                    {/* Ingredients */}
                                    <div>
                                      <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                                        <ShoppingCart className="w-4 h-4" />
                                        Ingredients
                                      </h5>
                                      <ul className="text-xs space-y-1 text-muted-foreground">
                                        {meal.ingredients?.map((ingredient, index) => (
                                          <li key={index} className="flex items-start gap-2">
                                            <span className="w-1 h-1 bg-primary rounded-full mt-1.5 flex-shrink-0"></span>
                                            {ingredient}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                    
                                    {/* Instructions */}
                                    <div>
                                      <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                                        <BookOpen className="w-4 h-4" />
                                        Instructions
                                      </h5>
                                      <ol className="text-xs space-y-2 text-muted-foreground">
                                        {meal.instructions?.map((instruction, index) => (
                                          <li key={index} className="flex gap-2">
                                            <span className="flex-shrink-0 w-4 h-4 bg-primary/10 text-primary rounded-full text-xs flex items-center justify-center font-medium">
                                              {index + 1}
                                            </span>
                                            {instruction}
                                          </li>
                                        ))}
                                      </ol>
                                    </div>
                                    
                                    {/* Nutrition */}
                                    {meal.nutrition && (
                                      <div>
                                        <h5 className="font-medium text-sm mb-2 flex items-center gap-1">
                                          <Activity className="w-4 h-4" />
                                          Nutrition
                                        </h5>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="text-xs bg-background/50 p-2 rounded">
                                            <div className="font-medium">Calories</div>
                                            <div className="text-muted-foreground">{meal.nutrition.calories}</div>
                                          </div>
                                          <div className="text-xs bg-background/50 p-2 rounded">
                                            <div className="font-medium">Protein</div>
                                            <div className="text-muted-foreground">{meal.nutrition.protein_g}g</div>
                                          </div>
                                          <div className="text-xs bg-background/50 p-2 rounded">
                                            <div className="font-medium">Carbs</div>
                                            <div className="text-muted-foreground">{meal.nutrition.carbs_g}g</div>
                                          </div>
                                          <div className="text-xs bg-background/50 p-2 rounded">
                                            <div className="font-medium">Fat</div>
                                            <div className="text-muted-foreground">{meal.nutrition.fat_g}g</div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-4 text-muted-foreground">
                                <div className="text-sm">No meal planned</div>
                                {isEditing && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={() => handleAddMeal(dayKey, mealType)}
                                  >
                                    <Plus className="w-3 h-3 mr-1" />
                                    Add {mealType}
                                  </Button>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              ))}
          </div>
        </div>
      </div>

      {/* Edit Meal Dialog */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Meal</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input
                  value={editingMeal.meal.title}
                  onChange={(e) => setEditingMeal({
                    ...editingMeal,
                    meal: { ...editingMeal.meal, title: e.target.value }
                  })}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cook Time (minutes)</label>
                  <Input
                    type="number"
                    value={editingMeal.meal.cook_time_minutes}
                    onChange={(e) => setEditingMeal({
                      ...editingMeal,
                      meal: { ...editingMeal.meal, cook_time_minutes: parseInt(e.target.value) || 0 }
                    })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Difficulty (1-5)</label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={editingMeal.meal.difficulty}
                    onChange={(e) => setEditingMeal({
                      ...editingMeal,
                      meal: { ...editingMeal.meal, difficulty: parseInt(e.target.value) || 1 }
                    })}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Ingredients (one per line)</label>
                <Textarea
                  value={editingMeal.meal.ingredients.join('\n')}
                  onChange={(e) => setEditingMeal({
                    ...editingMeal,
                    meal: { ...editingMeal.meal, ingredients: e.target.value.split('\n').filter(Boolean) }
                  })}
                  rows={4}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Instructions (one per line)</label>
                <Textarea
                  value={editingMeal.meal.instructions.join('\n')}
                  onChange={(e) => setEditingMeal({
                    ...editingMeal,
                    meal: { ...editingMeal.meal, instructions: e.target.value.split('\n').filter(Boolean) }
                  })}
                  rows={4}
                />
              </div>
              
              {editingMeal.meal.nutrition && (
                <div>
                  <label className="block text-sm font-medium mb-2">Nutrition</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Calories</label>
                      <Input
                        type="number"
                        value={editingMeal.meal.nutrition.calories}
                        onChange={(e) => setEditingMeal({
                          ...editingMeal,
                          meal: { 
                            ...editingMeal.meal, 
                            nutrition: { 
                              ...editingMeal.meal.nutrition!, 
                              calories: parseInt(e.target.value) || 0 
                            }
                          }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Protein (g)</label>
                      <Input
                        type="number"
                        value={editingMeal.meal.nutrition.protein_g}
                        onChange={(e) => setEditingMeal({
                          ...editingMeal,
                          meal: { 
                            ...editingMeal.meal, 
                            nutrition: { 
                              ...editingMeal.meal.nutrition!, 
                              protein_g: parseInt(e.target.value) || 0 
                            }
                          }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Carbs (g)</label>
                      <Input
                        type="number"
                        value={editingMeal.meal.nutrition.carbs_g}
                        onChange={(e) => setEditingMeal({
                          ...editingMeal,
                          meal: { 
                            ...editingMeal.meal, 
                            nutrition: { 
                              ...editingMeal.meal.nutrition!, 
                              carbs_g: parseInt(e.target.value) || 0 
                            }
                          }
                        })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Fat (g)</label>
                      <Input
                        type="number"
                        value={editingMeal.meal.nutrition.fat_g}
                        onChange={(e) => setEditingMeal({
                          ...editingMeal,
                          meal: { 
                            ...editingMeal.meal, 
                            nutrition: { 
                              ...editingMeal.meal.nutrition!, 
                              fat_g: parseInt(e.target.value) || 0 
                            }
                          }
                        })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditingMeal(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveMeal}>
                <Save className="w-4 h-4 mr-2" />
                Save Meal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}