import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { 
  Calendar,
  Plus,
  Edit3,
  Trash2,
  ChefHat,
  Clock,
  Users,
  ShoppingCart,
  Download,
  Upload,
  GripVertical,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SavedMealPlan {
  id: string;
  name: string;
  description?: string;
  meal_plan?: any; // Frontend format
  mealPlan?: any;  // Database format - allow both keys
  created_at: string;
  updated_at: string;
}

interface MealItem {
  title: string;
  ingredients: string[];
  cook_time_minutes?: number;
  difficulty?: number;
  notes?: string;
}

const EditableMealPlanner = () => {
  const [selectedPlan, setSelectedPlan] = useState<SavedMealPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMealPlan, setEditedMealPlan] = useState<any>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDescription, setNewPlanDescription] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [mealToDelete, setMealToDelete] = useState<{dayKey: string, mealType: string} | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch saved meal plans
  const { data: savedPlans, isLoading } = useQuery({
    queryKey: ['/api/meal-plans/saved'],
    enabled: true
  });



  // Import from generated meal plan
  const importMutation = useMutation({
    mutationFn: async (importData: { name: string; description: string }) => {
      // Get the latest generated meal plan
      const latestPlan = await apiRequest('/api/meal-plan/latest');
      return await apiRequest('/api/meal-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: importData.name,
          description: importData.description,
          meal_plan: latestPlan.meal_plan
        })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meal-plans/saved'] });
      setSelectedPlan(data);
      setShowImportDialog(false);
      setNewPlanName("");
      setNewPlanDescription("");
      toast({
        title: "Success",
        description: "Meal plan imported successfully!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to import meal plan",
        variant: "destructive",
      });
    }
  });

  const handleEditMeal = (dayKey: string, mealType: string, updatedMeal: MealItem) => {
    if (!editedMealPlan) {
      console.error('editedMealPlan is null in handleEditMeal');
      return;
    }
    
    console.log('Editing meal:', { dayKey, mealType, editedMealPlan: editedMealPlan.meal_plan });
    
    // Ensure meal_plan exists and is an object
    const currentMealPlan = editedMealPlan.meal_plan && typeof editedMealPlan.meal_plan === 'object' 
      ? editedMealPlan.meal_plan 
      : {};
    
    // Ensure the day exists
    const currentDay = currentMealPlan[dayKey] && typeof currentMealPlan[dayKey] === 'object'
      ? currentMealPlan[dayKey]
      : {};
    
    setEditedMealPlan({
      ...editedMealPlan,
      meal_plan: {
        ...currentMealPlan,
        [dayKey]: {
          ...currentDay,
          [mealType]: updatedMeal
        }
      }
    });
  };

  // Handle drag and drop with meal swapping
  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    
    if (!destination || !editedMealPlan?.meal_plan) return;
    
    // Don't do anything if dropped in the same position
    if (destination.droppableId === source.droppableId) return;
    
    const sourceDayKey = source.droppableId.split('-')[0];
    const destDayKey = destination.droppableId.split('-')[0];
    const sourceMealType = source.droppableId.split('-')[1];
    const destMealType = destination.droppableId.split('-')[1];
    
    // Get both meals
    const sourceMeal = editedMealPlan.meal_plan[sourceDayKey]?.[sourceMealType];
    const destMeal = editedMealPlan.meal_plan[destDayKey]?.[destMealType];
    
    if (!sourceMeal) return;
    
    const newMealPlan = { ...editedMealPlan.meal_plan };
    
    // Ensure both day objects exist
    if (!newMealPlan[sourceDayKey]) newMealPlan[sourceDayKey] = {};
    if (!newMealPlan[destDayKey]) newMealPlan[destDayKey] = {};
    
    // Perform the swap
    newMealPlan[destDayKey] = {
      ...newMealPlan[destDayKey],
      [destMealType]: sourceMeal
    };
    
    if (destMeal) {
      // If there was a meal at destination, move it to source
      newMealPlan[sourceDayKey] = {
        ...newMealPlan[sourceDayKey],
        [sourceMealType]: destMeal
      };
      
      toast({
        title: "Meals swapped",
        description: `${sourceMeal.title} and ${destMeal.title} have been swapped`,
      });
    } else {
      // If destination was empty, just remove from source
      const newSourceDay = { ...newMealPlan[sourceDayKey] };
      delete newSourceDay[sourceMealType];
      newMealPlan[sourceDayKey] = newSourceDay;
      
      toast({
        title: "Meal moved",
        description: `${sourceMeal.title} moved to ${destDayKey.replace('_', ' ')} ${destMealType}`,
      });
    }
    
    setEditedMealPlan({
      ...editedMealPlan,
      meal_plan: newMealPlan
    });
  };

  // Handle meal deletion
  const handleDeleteMeal = (dayKey: string, mealType: string) => {
    setMealToDelete({ dayKey, mealType });
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteMeal = () => {
    if (!mealToDelete || !editedMealPlan?.meal_plan) return;
    
    const { dayKey, mealType } = mealToDelete;
    const newMealPlan = { ...editedMealPlan.meal_plan };
    
    if (newMealPlan[dayKey]) {
      const newDay = { ...newMealPlan[dayKey] };
      delete newDay[mealType];
      newMealPlan[dayKey] = newDay;
      
      setEditedMealPlan({
        ...editedMealPlan,
        meal_plan: newMealPlan
      });
      
      toast({
        title: "Meal deleted",
        description: `${mealType} removed from ${dayKey.replace('_', ' ')}`,
      });
    }
    
    setDeleteConfirmOpen(false);
    setMealToDelete(null);
  };



  const handleImport = () => {
    if (!newPlanName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a plan name",
        variant: "destructive",
      });
      return;
    }
    
    importMutation.mutate({
      name: newPlanName,
      description: newPlanDescription
    });
  };

  const generateShoppingList = () => {
    const planData = selectedPlan?.meal_plan || selectedPlan?.mealPlan;
    if (!planData || typeof planData !== 'object') {
      console.log('No valid meal plan for shopping list');
      return [];
    }
    
    const allIngredients: string[] = [];
    
    try {
      Object.values(planData).forEach((day: any) => {
        if (day && typeof day === 'object') {
          Object.values(day).forEach((meal: any) => {
            if (meal && meal.ingredients && Array.isArray(meal.ingredients)) {
              allIngredients.push(...meal.ingredients);
            }
          });
        }
      });
      
      // Group similar ingredients
      const ingredientCount: { [key: string]: number } = {};
      allIngredients.forEach(ingredient => {
        if (typeof ingredient === 'string') {
          const clean = ingredient.toLowerCase().trim();
          ingredientCount[clean] = (ingredientCount[clean] || 0) + 1;
        }
      });
      
      return Object.entries(ingredientCount).map(([ingredient, count]) => ({
        ingredient,
        count,
        bulkSaving: count >= 3
      }));
    } catch (error) {
      console.error('Error generating shopping list:', error);
      return [];
    }
  };

  const startEditing = () => {
    if (selectedPlan) {
      console.log('Starting edit for plan:', selectedPlan.name);
      console.log('selectedPlan.meal_plan type:', typeof selectedPlan.meal_plan);
      console.log('selectedPlan.meal_plan value:', selectedPlan.meal_plan);
      
      // Safe deep copy with comprehensive validation - check both mealPlan and meal_plan
      let safeMealPlan = {};
      const planData = selectedPlan.meal_plan || selectedPlan.mealPlan;
      
      if (planData && typeof planData === 'object') {
        try {
          safeMealPlan = JSON.parse(JSON.stringify(planData));
          console.log('Successfully parsed meal plan, keys:', Object.keys(safeMealPlan));
        } catch (error) {
          console.error('JSON parse error in startEditing:', error);
          safeMealPlan = {};
        }
      } else {
        console.warn('No valid meal plan data found, using empty object');
      }
      
      setEditedMealPlan({
        ...selectedPlan,
        meal_plan: safeMealPlan
      });
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedMealPlan(null);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading meal plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-800 mb-2">My Meal Plans</h1>
            <p className="text-neutral-600">Create, edit, and manage your weekly meal plans</p>
          </div>
          
          <div className="flex gap-2">

          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Mobile: Stack sidebar below on small screens */}
        {/* Saved Plans Sidebar - Full width on mobile, sidebar on desktop */}
        <div className="lg:col-span-1 lg:order-first order-last">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Saved Plans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {savedPlans && savedPlans.length > 0 ? (
                savedPlans.map((plan: SavedMealPlan) => (
                  <div
                    key={plan.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlan?.id === plan.id ? 'bg-primary/10 border-primary' : 'bg-white hover:bg-gray-50'
                    }`}
                    onClick={() => {
                      setSelectedPlan(plan);
                      setIsEditing(false);
                      setEditedMealPlan(null);
                    }}
                  >
                    <h3 className="font-medium text-sm">{plan.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                    {plan.description && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{plan.description}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <ChefHat className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">No saved plans yet</p>
                  <Button 
                    size="sm" 
                    onClick={() => window.location.href = '/meal-planner'}
                    className="w-full"
                  >
                    Generate First Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Plan View */}
        <div className="lg:col-span-3">
          {selectedPlan ? (
            <div>
              {/* Plan Header */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedPlan.name}</CardTitle>
                      {selectedPlan.description && (
                        <p className="text-gray-600 mt-1">{selectedPlan.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {!isEditing ? (
                        <Button onClick={startEditing} className="flex items-center justify-center gap-2 w-full sm:w-auto">
                          <Edit3 className="w-4 h-4" />
                          Edit Plan
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={cancelEditing} className="w-full sm:w-auto">
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Meal Plan Grid with Drag and Drop */}
              <div className="space-y-6">
                {(() => {
                  const mealPlanToShow = isEditing 
                    ? editedMealPlan?.meal_plan 
                    : (selectedPlan.meal_plan || selectedPlan.mealPlan);
                  console.log('Rendering meal plan:', { isEditing, mealPlanToShow, type: typeof mealPlanToShow });
                  
                  if (!mealPlanToShow || typeof mealPlanToShow !== 'object') {
                    console.warn('No valid meal plan to render');
                    return <div key="no-plan">No meal plan data available</div>;
                  }
                  
                  if (isEditing) {
                    return (
                      <DragDropContext onDragEnd={handleDragEnd}>
                        {Object.entries(mealPlanToShow).map(([dayKey, dayMeals]: [string, any]) => (
                          <Card key={dayKey}>
                            <CardHeader>
                              <CardTitle className="text-lg capitalize">
                                {dayKey.replace('_', ' ')}
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {['breakfast', 'lunch', 'dinner'].map((mealType) => {
                                  const meal = dayMeals?.[mealType];
                                  const droppableId = `${dayKey}-${mealType}`;
                                  
                                  return (
                                    <Droppable key={mealType} droppableId={droppableId}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.droppableProps}
                                          className={`border-2 border-dashed rounded-lg p-4 min-h-[200px] transition-colors ${
                                            snapshot.isDraggingOver 
                                              ? 'border-blue-400 bg-blue-50' 
                                              : 'border-gray-200 hover:border-gray-300'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-medium capitalize text-sm">{mealType}</h4>
                                            {meal && (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteMeal(dayKey, mealType)}
                                                className="h-6 w-6 p-0 hover:bg-red-100"
                                              >
                                                <Trash2 className="h-3 w-3 text-red-500" />
                                              </Button>
                                            )}
                                          </div>
                                          
                                          {meal ? (
                                            <Draggable draggableId={`${dayKey}-${mealType}`} index={0}>
                                              {(provided, snapshot) => (
                                                <div
                                                  ref={provided.innerRef}
                                                  {...provided.draggableProps}
                                                  className={`bg-white border rounded-lg p-3 shadow-sm transition-shadow ${
                                                    snapshot.isDragging ? 'shadow-lg' : 'hover:shadow-md'
                                                  }`}
                                                >
                                                  <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                      <Input
                                                        value={meal.title || ""}
                                                        onChange={(e) => handleEditMeal(dayKey, mealType, {
                                                          ...meal,
                                                          title: e.target.value
                                                        })}
                                                        placeholder="Meal title"
                                                        className="text-sm font-medium border-none p-0 h-auto"
                                                      />
                                                      {meal.cook_time_minutes && (
                                                        <Badge variant="secondary" className="text-xs mt-1">
                                                          <Clock className="w-3 h-3 mr-1" />
                                                          {meal.cook_time_minutes}m
                                                        </Badge>
                                                      )}
                                                    </div>
                                                    <div
                                                      {...provided.dragHandleProps}
                                                      className="cursor-grab hover:bg-gray-100 p-1 rounded"
                                                    >
                                                      <GripVertical className="h-4 w-4 text-gray-400" />
                                                    </div>
                                                  </div>
                                                  <Textarea
                                                    value={meal.ingredients?.join('\n') || ""}
                                                    onChange={(e) => handleEditMeal(dayKey, mealType, {
                                                      ...meal,
                                                      ingredients: e.target.value.split('\n').filter(i => i.trim())
                                                    })}
                                                    placeholder="Ingredients (one per line)"
                                                    className="text-xs min-h-[60px] mt-2"
                                                  />
                                                </div>
                                              )}
                                            </Draggable>
                                          ) : (
                                            <div className="text-center text-gray-400 text-sm py-8">
                                              Drop a meal here or add new
                                            </div>
                                          )}
                                          {provided.placeholder}
                                        </div>
                                      )}
                                    </Droppable>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </DragDropContext>
                    );
                  } else {
                    // Read-only view
                    return Object.entries(mealPlanToShow).map(([dayKey, dayMeals]: [string, any]) => (
                      <Card key={dayKey}>
                        <CardHeader>
                          <CardTitle className="text-lg capitalize">
                            {dayKey.replace('_', ' ')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {dayMeals && typeof dayMeals === 'object' ? Object.entries(dayMeals).map(([mealType, meal]: [string, any]) => (
                              <div key={mealType} className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium capitalize">{mealType}</h4>
                                  {meal.cook_time_minutes && (
                                    <Badge variant="secondary" className="text-xs">
                                      <Clock className="w-3 h-3 mr-1" />
                                      {meal.cook_time_minutes}m
                                    </Badge>
                                  )}
                                </div>
                                <h5 className="font-medium text-sm mb-2">{meal.title}</h5>
                                <div className="space-y-1">
                                  {meal.ingredients?.slice(0, 3).map((ingredient: string, idx: number) => (
                                    <p key={idx} className="text-xs text-gray-600">• {ingredient}</p>
                                  ))}
                                  {meal.ingredients?.length > 3 && (
                                    <p className="text-xs text-gray-400">+{meal.ingredients.length - 3} more</p>
                                  )}
                                </div>
                              </div>
                            )) : <div>No meals for this day</div>}
                          </div>
                        </CardContent>
                      </Card>
                    ));
                  }
                })()}
              </div>

              {/* Shopping List */}
              {!isEditing && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      Smart Shopping List
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {generateShoppingList().map(({ ingredient, count, bulkSaving }) => (
                        <div key={ingredient} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm capitalize">{ingredient}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={bulkSaving ? "default" : "secondary"} className="text-xs">
                              {count}x {bulkSaving && "• Bulk"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-20">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Welcome to Your Meal Planner</h3>
                <p className="text-gray-600 mb-6">
                  Generate your first meal plan to get started with weekly planning
                </p>
                <Button onClick={() => window.location.href = '/meal-planner'}>
                  <Plus className="w-4 h-4 mr-2" />
                  Generate Meal Plan
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Meal
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meal? This action cannot be undone.
              {mealToDelete && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                  <strong>{mealToDelete.mealType}</strong> from <strong>{mealToDelete.dayKey.replace('_', ' ')}</strong>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMealToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteMeal} className="bg-red-600 hover:bg-red-700">
              Delete Meal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EditableMealPlanner;