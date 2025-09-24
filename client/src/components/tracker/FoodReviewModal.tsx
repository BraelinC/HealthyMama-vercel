import { useState } from 'react';
import { X, Plus, Minus, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { safeApiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Ingredient {
  id: string;
  name: string;
  amount: number;
  unit: string;
  confidence?: number;
  included: boolean;
  isManual?: boolean;
  measureType?: 'weight' | 'volume' | 'count';
}

interface FoodReviewModalProps {
  data: {
    image: string;
    detections: Ingredient[];
  };
  onClose: () => void;
  onSave: () => void;
}

// Common measurement units by type
const MEASUREMENT_UNITS = {
  weight: ['oz', 'g', 'lb', 'kg'],
  volume: ['cup', 'cups', 'tbsp', 'tsp', 'ml', 'L', 'fl oz'],
  count: ['piece', 'pieces', 'slice', 'slices', 'item', 'whole']
};

// Quick amount adjustments
const QUICK_AMOUNTS = {
  weight: [0.5, 1, 2, 3, 4, 6, 8],
  volume: [0.25, 0.5, 0.75, 1, 1.5, 2, 3],
  count: [1, 2, 3, 4, 5, 6, 8, 10]
};

export default function FoodReviewModal({ data, onClose, onSave }: FoodReviewModalProps) {
  const [ingredients, setIngredients] = useState<Ingredient[]>(data.detections);
  const [missingInput, setMissingInput] = useState('');
  const [isAddingMissing, setIsAddingMissing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string>('');
  const { toast } = useToast();

  // Determine meal type based on time
  const getMealType = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 11) return 'breakfast';
    if (hour >= 11 && hour < 15) return 'lunch';
    if (hour >= 15 && hour < 18) return 'snack';
    return 'dinner';
  };

  useState(() => {
    setSelectedMealType(getMealType());
  });

  // Toggle ingredient inclusion
  const toggleIngredient = (id: string) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, included: !ing.included } : ing
    ));
  };

  // Update ingredient amount with proper unit conversion
  const updateAmount = (id: string, newAmount: number) => {
    setIngredients(ingredients.map(ing => {
      if (ing.id === id) {
        return {
          ...ing,
          amount: newAmount
        };
      }
      return ing;
    }));
  };

  // Increment/decrement amount
  const adjustAmount = (id: string, delta: number) => {
    const ing = ingredients.find(i => i.id === id);
    if (ing) {
      const measureType = ing.measureType || 'count';
      let newAmount = ing.amount + delta;
      
      // Prevent negative or zero amounts
      if (measureType === 'count') {
        newAmount = Math.max(1, Math.round(newAmount));
      } else {
        newAmount = Math.max(0.1, Math.round(newAmount * 10) / 10);
      }
      
      updateAmount(id, newAmount);
    }
  };

  // Change unit for an ingredient
  const changeUnit = (id: string, newUnit: string) => {
    setIngredients(ingredients.map(ing => {
      if (ing.id === id) {
        // TODO: Add unit conversion logic here
        return { ...ing, unit: newUnit };
      }
      return ing;
    }));
  };

  // Add missing ingredients via GPT
  const handleAddMissing = async () => {
    if (!missingInput.trim()) return;

    setIsAddingMissing(true);
    try {
      const response = await safeApiRequest('/api/parse-missing-foods', {
        method: 'POST',
        body: JSON.stringify({ text: missingInput })
      });

      if (response.foods && response.foods.length > 0) {
        const newIngredients = response.foods.map((food: any) => ({
          ...food,
          id: `manual-${Date.now()}-${Math.random()}`,
          included: true,
          isManual: true,
          measureType: food.unit === 'cup' || food.unit === 'cups' ? 'volume' : 
                       food.unit === 'g' || food.unit === 'oz' ? 'weight' : 'count'
        }));
        
        setIngredients([...ingredients, ...newIngredients]);
        setMissingInput('');
        
        toast({
          title: "Ingredients Added",
          description: `Added ${newIngredients.length} ingredient${newIngredients.length > 1 ? 's' : ''}`,
        });
      }
    } catch (error) {
      console.error('Error parsing ingredients:', error);
      toast({
        title: "Error",
        description: "Failed to parse ingredients. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAddingMissing(false);
    }
  };

  // Save the food log
  const handleSave = async () => {
    const includedIngredients = ingredients.filter(ing => ing.included);
    
    if (includedIngredients.length === 0) {
      toast({
        title: "No ingredients selected",
        description: "Please select at least one ingredient to log.",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Create food log entry
      const logData = {
        meal_type: selectedMealType,
        foods: includedIngredients,
        image_url: data.image
      };

      await safeApiRequest('/api/food-logs', {
        method: 'POST',
        body: JSON.stringify(logData)
      });

      toast({
        title: "Meal Logged",
        description: `Logged ${includedIngredients.length} ingredient${includedIngredients.length > 1 ? 's' : ''}`,
      });

      onSave();
    } catch (error) {
      console.error('Error saving food log:', error);
      toast({
        title: "Error",
        description: "Failed to save meal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate totals
  const totals = ingredients.filter(ing => ing.included).length;

  // Group ingredients by category
  const groupedIngredients = {
    proteins: ingredients.filter(ing => ['chicken', 'beef', 'fish', 'egg', 'tofu'].some(p => ing.name.toLowerCase().includes(p))),
    vegetables: ingredients.filter(ing => ['tomato', 'lettuce', 'carrot', 'broccoli', 'spinach'].some(v => ing.name.toLowerCase().includes(v))),
    grains: ingredients.filter(ing => ['rice', 'bread', 'pasta', 'quinoa'].some(g => ing.name.toLowerCase().includes(g))),
    other: ingredients.filter(ing => 
      !['chicken', 'beef', 'fish', 'egg', 'tofu', 'tomato', 'lettuce', 'carrot', 'broccoli', 'spinach', 'rice', 'bread', 'pasta', 'quinoa']
        .some(item => ing.name.toLowerCase().includes(item))
    )
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed inset-x-4 inset-y-8 md:inset-x-auto md:inset-y-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-3xl md:w-full md:h-[85vh] bg-background border rounded-lg shadow-lg">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold">
                {ingredients.length === 0 ? 'Add Ingredients Manually' : 'Review Detected Ingredients'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {ingredients.length === 0 
                  ? 'Use the form below to add ingredients'
                  : `${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''} detected`
                }
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Meal Type Selection */}
          <div className="px-4 py-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Meal:</span>
              <div className="flex gap-1">
                {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                  <Button
                    key={type}
                    variant={selectedMealType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedMealType(type)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Manual Ingredients Entry */}
          <div className="flex-1 flex p-4 overflow-hidden">
            {/* Ingredients List */}
            <div className="flex-1 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  {/* Show message when no ingredients detected */}
                  {ingredients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <div className="rounded-full bg-orange-100 p-3 mb-4">
                        <Plus className="h-6 w-6 text-orange-600" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No ingredients detected</h3>
                      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                        The AI couldn't identify specific ingredients in your photo. 
                        You can manually add the ingredients below.
                      </p>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p>💡 Tips for better detection:</p>
                        <ul className="text-left space-y-1 ml-4">
                          <li>• Take photos with good lighting</li>
                          <li>• Center the food in the frame</li>
                          <li>• Capture individual ingredients separately</li>
                          <li>• Try different angles or closer shots</li>
                          <li>• If daily limit reached (200/day), try again tomorrow</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    Object.entries(groupedIngredients).map(([category, items]) => 
                      items.length > 0 && (
                        <div key={category}>
                          <h3 className="text-sm font-medium text-muted-foreground capitalize mb-2">
                            {category}
                          </h3>
                          <div className="space-y-2">
                            {items.map(ing => (
                            <div 
                              key={ing.id} 
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border bg-card",
                                !ing.included && "opacity-50"
                              )}
                            >
                              {/* Toggle */}
                              <Switch
                                checked={ing.included}
                                onCheckedChange={() => toggleIngredient(ing.id)}
                                className="flex-shrink-0"
                              />

                              {/* Name & Confidence */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium truncate">{ing.name}</span>
                                  {ing.confidence && (
                                    <span className="text-xs text-muted-foreground">
                                      {Math.round(ing.confidence * 100)}%
                                    </span>
                                  )}
                                  {ing.isManual && (
                                    <span className="text-xs bg-blue-500/10 text-blue-500 px-1.5 py-0.5 rounded">
                                      Manual
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Quantity Controls */}
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => adjustAmount(ing.id, ing.measureType === 'count' ? -1 : -0.5)}
                                  disabled={!ing.included}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>

                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={ing.amount}
                                    onChange={(e) => updateAmount(ing.id, parseFloat(e.target.value) || 0)}
                                    className="w-16 h-8 text-center"
                                    disabled={!ing.included}
                                    step={ing.measureType === 'count' ? 1 : 0.1}
                                    min={ing.measureType === 'count' ? 1 : 0.1}
                                  />
                                  <span className="text-sm text-muted-foreground w-12">
                                    {ing.unit}
                                  </span>
                                </div>

                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => adjustAmount(ing.id, ing.measureType === 'count' ? 1 : 0.5)}
                                  disabled={!ing.included}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            ))}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </ScrollArea>

              {/* Add Missing Ingredients */}
              <div className="pt-3 border-t mt-3">
                <div className="flex gap-2">
                  <Input
                    placeholder={
                      ingredients.length === 0 
                        ? "Add ingredients manually (e.g., '2 eggs, 1 apple, 1 cup milk')"
                        : "Add missing ingredients (e.g., '2 tbsp olive oil, 1 cup rice')"
                    }
                    value={missingInput}
                    onChange={(e) => setMissingInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddMissing()}
                  />
                  <Button
                    onClick={handleAddMissing}
                    disabled={isAddingMissing || !missingInput.trim()}
                  >
                    {isAddingMissing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Footer with Totals */}
          <div className="border-t p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Selected Items:</span>
                  <span className="font-bold ml-1 text-lg">{totals}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={isSaving || ingredients.filter(f => f.included).length === 0}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Log Meal
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}