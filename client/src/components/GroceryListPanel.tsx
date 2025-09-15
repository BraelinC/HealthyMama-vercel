import { useState, useEffect } from "react";
import { 
  X, 
  ShoppingCart, 
  Loader2,
  Apple,
  Beef,
  Milk,
  Wheat,
  Fish,
  Egg,
  Carrot,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation } from "@tanstack/react-query";
import { safeApiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  displayText?: string;
  notes?: string;
}

interface MealPlan {
  id: number;
  name: string;
  mealPlan: any;
}

interface GroceryListPanelProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlan: MealPlan | null;
  prefetchedData?: any;
  onDataRefreshed?: (data: any) => void;
}

// Food category icons mapping
const categoryIcons: { [key: string]: JSX.Element } = {
  produce: <Apple className="w-4 h-4" />,
  meat: <Beef className="w-4 h-4" />,
  dairy: <Milk className="w-4 h-4" />,
  bakery: <Wheat className="w-4 h-4" />,
  seafood: <Fish className="w-4 h-4" />,
  eggs: <Egg className="w-4 h-4" />,
  vegetables: <Carrot className="w-4 h-4" />,
};

// Function to categorize ingredients
function categorizeIngredient(ingredient: string): string {
  const lowerIngredient = ingredient.toLowerCase();
  
  // Meat category
  if (lowerIngredient.includes('chicken') || lowerIngredient.includes('beef') || 
      lowerIngredient.includes('pork') || lowerIngredient.includes('turkey') ||
      lowerIngredient.includes('lamb') || lowerIngredient.includes('bacon') ||
      lowerIngredient.includes('sausage') || lowerIngredient.includes('ham')) {
    return 'meat';
  }
  
  // Seafood category
  if (lowerIngredient.includes('fish') || lowerIngredient.includes('salmon') ||
      lowerIngredient.includes('shrimp') || lowerIngredient.includes('crab') ||
      lowerIngredient.includes('lobster') || lowerIngredient.includes('tuna')) {
    return 'seafood';
  }
  
  // Dairy category
  if (lowerIngredient.includes('milk') || lowerIngredient.includes('cheese') ||
      lowerIngredient.includes('yogurt') || lowerIngredient.includes('butter') ||
      lowerIngredient.includes('cream') || lowerIngredient.includes('sour cream')) {
    return 'dairy';
  }
  
  // Eggs category
  if (lowerIngredient.includes('egg')) {
    return 'eggs';
  }
  
  // Bakery category
  if (lowerIngredient.includes('bread') || lowerIngredient.includes('tortilla') ||
      lowerIngredient.includes('roll') || lowerIngredient.includes('bagel') ||
      lowerIngredient.includes('muffin') || lowerIngredient.includes('croissant')) {
    return 'bakery';
  }
  
  // Vegetables and produce
  if (lowerIngredient.includes('tomato') || lowerIngredient.includes('lettuce') ||
      lowerIngredient.includes('onion') || lowerIngredient.includes('garlic') ||
      lowerIngredient.includes('carrot') || lowerIngredient.includes('celery') ||
      lowerIngredient.includes('pepper') || lowerIngredient.includes('spinach') ||
      lowerIngredient.includes('broccoli') || lowerIngredient.includes('potato') ||
      lowerIngredient.includes('mushroom') || lowerIngredient.includes('cucumber') ||
      lowerIngredient.includes('zucchini') || lowerIngredient.includes('corn') ||
      lowerIngredient.includes('apple') || lowerIngredient.includes('banana') ||
      lowerIngredient.includes('orange') || lowerIngredient.includes('lemon') ||
      lowerIngredient.includes('lime') || lowerIngredient.includes('avocado')) {
    return 'produce';
  }
  
  // Default category
  return 'pantry';
}

export function GroceryListPanel({ isOpen, onClose, mealPlan, prefetchedData, onDataRefreshed }: GroceryListPanelProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [categorizedIngredients, setCategorizedIngredients] = useState<{ [key: string]: Ingredient[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [savings, setSavings] = useState<{ duplicatesRemoved: number; itemsConsolidated: number } | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();

  const cacheKey = user && mealPlan ? `grocery:${(user as any).id}:${mealPlan.id}` : null;

  // Handle checkbox changes
  const handleItemCheck = (itemKey: string, checked: boolean) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(itemKey);
      } else {
        newSet.delete(itemKey);
      }
      return newSet;
    });
  };

  // Handle opening Instacart
  const handleOpenInstacart = async () => {
    // If we already have the URL from initial load, just open it
    if ((window as any).__instacartUrl) {
      window.open((window as any).__instacartUrl, '_blank');
      toast({
        title: "Shopping List Opened",
        description: "Your optimized Instacart shopping list has been opened!",
      });
      return;
    }
    
    // Otherwise, create a new shopping list
    createShoppingListMutation.mutate();
  };

  // Create shopping list mutation
  const createShoppingListMutation = useMutation({
    mutationFn: async () => {
      if (!mealPlan) throw new Error("No meal plan selected");
      
      return await safeApiRequest('/api/create-shopping-list', {
        method: 'POST',
        body: JSON.stringify({ mealPlanId: mealPlan.id }),
      });
    },
    onSuccess: (data) => {
      // Open Instacart if URL is available
      if (data.shoppingUrl) {
        window.open(data.shoppingUrl, '_blank');
        toast({
          title: "Shopping List Created",
          description: "Your optimized Instacart shopping list has been created!",
        });
      }
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch {}
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create shopping list. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Read from local cache on open for instant render
  useEffect(() => {
    if (!isOpen || !cacheKey) return;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const json = JSON.parse(cached);
        processGroceryData(json);
        setIsLoading(false);
      }
    } catch {}
  }, [isOpen, cacheKey]);
  
  // Update data when prefetchedData changes
  useEffect(() => {
    if (prefetchedData && prefetchedData.consolidatedIngredients) {
      console.log('Updating with prefetched grocery data');
      processGroceryData(prefetchedData);
      setIsLoading(false);
      if (cacheKey) {
        try { localStorage.setItem(cacheKey, JSON.stringify(prefetchedData)); } catch {}
      }
    }
  }, [prefetchedData, cacheKey]);
  
  // Fetch data if not prefetched when panel opens
  useEffect(() => {
    if (!mealPlan || !isOpen) return;
    
    // Only fetch if we don't have data already
    if (!ingredients.length && !prefetchedData) {
      const fetchConsolidatedList = async () => {
        setIsLoading(true);
        try {
          console.log('Fetching grocery list from API');
          // Get the consolidated ingredients from the API
          const response = await safeApiRequest('/api/create-shopping-list', {
            method: 'POST',
            body: JSON.stringify({ mealPlanId: mealPlan.id }),
          });
          
          processGroceryData(response);
          if (cacheKey) {
            try { localStorage.setItem(cacheKey, JSON.stringify(response)); } catch {}
          }
          
          // Update the parent component with fresh data
          if (onDataRefreshed) {
            onDataRefreshed(response);
          }
        } catch (error) {
          console.error("Error fetching consolidated list:", error);
        }
        setIsLoading(false);
      };
      
      fetchConsolidatedList();
    }
  }, [mealPlan?.id, isOpen, ingredients.length, prefetchedData, cacheKey]); // Check if we already have ingredients
  
  // Helper function to process grocery data
  const processGroceryData = (response: any) => {
    if (response.consolidatedIngredients) {
      const consolidatedIngredients: Ingredient[] = response.consolidatedIngredients.map((ing: any) => ({
        name: ing.name,
        displayText: ing.displayText || ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        category: ing.category || categorizeIngredient(ing.name),
        notes: ing.notes
      }));
      
      // Preserve existing custom ingredients by merging them
      setCategorizedIngredients(prevCategorized => {
        // Find custom ingredients (those with is_custom: true)
        const customIngredients: { [key: string]: Ingredient[] } = {};
        Object.entries(prevCategorized).forEach(([category, items]) => {
          const customItems = items.filter((item: any) => item.is_custom);
          if (customItems.length > 0) {
            customIngredients[category] = customItems;
          }
        });
        
        // Group API ingredients by category
        const grouped = consolidatedIngredients.reduce((acc, ingredient) => {
          const category = ingredient.category || 'other';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(ingredient);
          return acc;
        }, {} as { [key: string]: Ingredient[] });
        
        // Merge custom ingredients with API ingredients
        Object.entries(customIngredients).forEach(([category, customItems]) => {
          if (!grouped[category]) {
            grouped[category] = [];
          }
          grouped[category] = [...grouped[category], ...customItems];
        });
        
        return grouped;
      });
      
      setIngredients(consolidatedIngredients);
      setSavings(response.savings);
      setRecommendations(response.recommendations || []);
      
      // Store the response for later use
      if (response.shoppingUrl) {
        (window as any).__instacartUrl = response.shoppingUrl;
      }
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      
      {/* Slide-over panel */}
      <div className={`fixed top-0 left-0 h-full w-full max-w-md bg-background shadow-xl z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-bold">Grocery List</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="relative h-[calc(100vh-140px)]">
          <ScrollArea className="h-full">
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                
                {/* Categorized ingredients */}
                {Object.entries(categorizedIngredients).map(([category, items]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      {categoryIcons[category] || <ShoppingCart className="w-4 h-4" />}
                      <h3 className="font-semibold capitalize">{category}</h3>
                      <Badge variant="secondary" className="ml-auto">
                        {items.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {items.map((ingredient, index) => {
                        const itemKey = `${category}-${index}`;
                        const isChecked = checkedItems.has(itemKey);
                        return (
                          <div
                            key={itemKey}
                            className={`flex items-center gap-3 p-3 bg-muted/50 rounded-lg transition-all ${isChecked ? 'opacity-50' : ''}`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={(checked) => handleItemCheck(itemKey, checked as boolean)}
                              className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                            />
                            <div className="flex-1">
                              <span className={`text-sm font-medium ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                                {ingredient.displayText || ingredient.name}
                              </span>
                              {ingredient.notes && (
                                <span className="text-xs text-muted-foreground block mt-1">{ingredient.notes}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleOpenInstacart}
            disabled={createShoppingListMutation.isPending || ingredients.length === 0}
          >
            {createShoppingListMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Opening Instacart...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Instacart
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}