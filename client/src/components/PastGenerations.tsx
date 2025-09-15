import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { History, Calendar, ChefHat, Clock, Trash2, Eye, Zap, RefreshCw, ArrowUp, Timer } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  getSessionCache, 
  promoteSessionPlan, 
  removeFromSessionCache,
  SESSION_CACHE_KEY,
  type SessionCachedPlan 
} from "@/lib/sessionCache";

interface SavedMealPlan {
  id: number;
  name: string;
  description: string;
  mealPlan: any;
  isAutoSaved?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Union type for both saved and session plans
type MealPlanItem = SavedMealPlan | SessionCachedPlan;

interface PastGenerationsProps {
  onLoadPlan?: (mealPlan: any) => void;
}

export function PastGenerations({ onLoadPlan }: PastGenerationsProps) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<MealPlanItem | null>(null);

  // Fetch user's saved meal plans
  const { data: savedPlans, refetch: refetchSaved, isLoading } = useQuery({
    queryKey: ['/api/meal-plans/saved'], // Match the key used in other components
    queryFn: async () => {
      try {
        const response = await apiRequest("/api/meal-plans/saved", {
          method: "GET",
        });
        console.log('PastGenerations API response:', response);
        return response as SavedMealPlan[];
      } catch (error) {
        console.error('PastGenerations query error:', error);
        // Return empty array instead of throwing to prevent infinite retries
        return [] as SavedMealPlan[];
      }
    },
    retry: 1, // Only retry once to avoid infinite loops
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch session cache data
  const { data: sessionPlans, refetch: refetchSession } = useQuery({
    queryKey: SESSION_CACHE_KEY,
    queryFn: () => {
      const sessionCache = getSessionCache();
      console.log('PastGenerations session cache:', sessionCache);
      return sessionCache;
    },
    staleTime: 1000, // Very short cache time for session data
  });

  // Merge and sort all plans (session first, then saved)
  const allPlans: MealPlanItem[] = [
    ...(sessionPlans || []),
    ...(savedPlans || [])
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log('📋 PastGenerations: All plans merged:', allPlans.length, 'total');
  console.log('📋 PastGenerations: Session plans:', sessionPlans?.length || 0);
  console.log('📋 PastGenerations: Saved plans:', savedPlans?.length || 0);

  // Combined refetch function
  const refetch = () => {
    refetchSaved();
    refetchSession();
  };

  const deletePlan = async (plan: MealPlanItem) => {
    try {
      if ('isSessionCache' in plan && plan.isSessionCache) {
        // Delete from session cache
        removeFromSessionCache(plan.id);
        refetchSession();
        toast({
          title: "Plan removed",
          description: "Temporary plan has been removed from session cache.",
        });
      } else {
        // Delete from database
        const response = await apiRequest(`/api/meal-plans/${plan.id}`, {
          method: "DELETE",
        });
        
        if (response.ok) {
          toast({
            title: "Plan deleted",
            description: "Meal plan has been removed from your history.",
          });
          refetchSaved();
        } else {
          throw new Error("Failed to delete plan");
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete meal plan. Please try again.",
        variant: "destructive",
      });
    }
  };

  const promotePlan = async (plan: SessionCachedPlan) => {
    try {
      const success = await promoteSessionPlan(plan.id);
      if (success) {
        toast({
          title: "Plan saved!",
          description: `"${plan.name}" has been permanently saved to your meal plans.`,
        });
        refetch(); // Refresh both caches
      } else {
        throw new Error("Failed to promote plan");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save plan permanently. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadPlan = (plan: MealPlanItem) => {
    if (onLoadPlan) {
      // Handle both mealPlan (DB field) and meal_plan (frontend field) for compatibility
      const planData = (plan as any).meal_plan || plan.mealPlan;
      onLoadPlan(planData);
      toast({
        title: "Plan loaded",
        description: `"${plan.name}" has been loaded into the planner.`,
      });
    }
  };

  const formatMealPlanSummary = (mealPlan: any) => {
    // Handle both mealPlan (DB field) and meal_plan (frontend field) for compatibility
    const planData = mealPlan?.meal_plan || mealPlan?.mealPlan;
    if (!planData) return "No meal data";
    
    const days = Object.keys(planData).length;
    const firstDay = Object.values(planData)[0] as any;
    const mealsPerDay = firstDay ? Object.keys(firstDay).length : 0;
    
    return `${days} days, ${mealsPerDay} meals/day`;
  };

  const getMealPreview = (mealPlan: any) => {
    // Handle both mealPlan (DB field) and meal_plan (frontend field) for compatibility
    const planData = mealPlan?.meal_plan || mealPlan?.mealPlan;
    if (!planData) return [];
    
    const firstDay = Object.values(planData)[0] as any;
    if (!firstDay) return [];
    
    return Object.entries(firstDay).slice(0, 3).map(([mealType, meal]: [string, any]) => ({
      type: mealType,
      title: meal.title || "Untitled meal"
    }));
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-3 sm:pb-6">
        <CardTitle className="flex items-center justify-between text-lg sm:text-xl">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: '#50C878' }} />
            Past Generations
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">
            Loading your meal plan history...
          </div>
        ) : !allPlans || allPlans.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No past generations yet.</p>
            <p className="text-xs">Generate your first meal plan to see it here!</p>
          </div>
        ) : (
          <ScrollArea className="h-48 sm:h-64">
            <div className="space-y-2 sm:space-y-3">
              {allPlans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`p-2 sm:p-3 hover:shadow-md transition-shadow ${
                    'isSessionCache' in plan && plan.isSessionCache 
                      ? 'border-l-2 border-l-yellow-200 bg-yellow-50/30' 
                      : (plan as any).isAutoSaved 
                      ? 'border-l-2 border-l-blue-200' 
                      : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">{plan.name}</h4>
                        {'isSessionCache' in plan && plan.isSessionCache ? (
                          <Badge variant="outline" className="text-xs px-1.5 py-0.5 border-yellow-300 text-yellow-700">
                            <Timer className="h-2.5 w-2.5 mr-1" />
                            Temp
                          </Badge>
                        ) : (plan as any).isAutoSaved ? (
                          <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                            <Zap className="h-2.5 w-2.5 mr-1" />
                            Auto
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {plan.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(plan.createdAt), "MMM d, yyyy")}
                        <Badge variant="outline" className="text-xs">
                          {formatMealPlanSummary(plan.mealPlan)}
                        </Badge>
                      </div>
                      
                      {/* Meal preview */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {getMealPreview(plan.mealPlan).map((meal, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {meal.type}: {meal.title.substring(0, 15)}...
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex gap-1 ml-2">
                      {/* Keep button for session cache items */}
                      {'isSessionCache' in plan && plan.isSessionCache && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => promotePlan(plan as SessionCachedPlan)}
                          className="text-green-600 hover:text-green-700"
                          title="Save this plan permanently"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedPlan(plan)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>{plan.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                              {plan.description}
                            </p>
                            
                            {/* Meal Plan Preview */}
                            {(() => {
                              const planData = plan.meal_plan || plan.mealPlan;
                              return planData && (
                                <div className="space-y-4">
                                  {Object.entries(planData).map(([dayKey, dayMeals]: [string, any]) => (
                                  <Card key={dayKey}>
                                    <CardHeader className="pb-2">
                                      <CardTitle className="text-lg capitalize">
                                        {dayKey.replace('_', ' ')}
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <div className="grid gap-3">
                                        {Object.entries(dayMeals).map(([mealType, meal]: [string, any]) => (
                                          <div key={mealType} className="border rounded-lg p-3">
                                            <h4 className="font-medium capitalize mb-1">{mealType}</h4>
                                            <h5 className="text-sm font-semibold text-green-600">{meal.title}</h5>
                                            <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                              <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {meal.cook_time_minutes}min
                                              </span>
                                              <span>Difficulty: {meal.difficulty}/5</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              );
                            })()}
                            
                            <div className="flex gap-2 justify-end">
                              <Button 
                                onClick={() => loadPlan(plan)}
                                className="bg-green-500 hover:bg-green-600"
                              >
                                Load This Plan
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => loadPlan(plan)}
                        className="text-green-600 hover:text-green-700"
                      >
                        Load
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => deletePlan(plan)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default PastGenerations;