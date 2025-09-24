import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WandSparkles, ChevronDown, ChevronUp, Zap, Clock } from "lucide-react";
import { estimateRecipeDifficulty } from "@/lib/difficultyEstimator";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import DifficultyRater from "@/components/DifficultyRater";

const recipeFormSchema = z.object({
  recipeType: z.string().optional(),
  cuisine: z.string().optional(),
  dietRestrictions: z.string().optional(),
  cookingTime: z.string().optional(),
  availableIngredients: z.string().optional(),
  excludeIngredients: z.string().optional(),
  description: z.string().min(1, "Please describe what kind of recipe you'd like").max(500),
});

type RecipeFormValues = z.infer<typeof recipeFormSchema>;

interface RecipeGeneratorProps {
  onRecipeGenerated: (recipe: any) => void;
}

const RecipeGenerator = ({ onRecipeGenerated }: RecipeGeneratorProps) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  
  const form = useForm<RecipeFormValues>({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: {
      recipeType: "Any Type",
      cuisine: "Any Cuisine",
      dietRestrictions: "None",
      cookingTime: "30",
      availableIngredients: "",
      excludeIngredients: "",
      description: "",
    },
  });

  const generateRecipeMutation = useMutation({
    mutationFn: async (data: RecipeFormValues) => {
      return await apiRequest("POST", "/api/recipes/generate", data);
    },
    onSuccess: async (response) => {
      const data = await response.json();
      setIsGenerating(false);
      onRecipeGenerated(data);
    },
    onError: (error) => {
      setIsGenerating(false);
      toast({
        title: "Error",
        description: `Failed to generate recipe: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RecipeFormValues, generationMode: 'fast' | 'detailed') => {
    setIsGenerating(true);
    
    // Set preferences based on generation mode
    const isFastMode = generationMode === 'fast';
    
    // Fast mode: prioritize speed and simplicity
    // Detailed mode: prioritize comprehensive recipe with nutrition
    const enhancedData = {
      ...data,
      difficulty: isFastMode ? 3 : 7, // Fast = simple, Detailed = comprehensive
      preferYouTube: true, // Both modes use YouTube but with different processing
      generationMode: generationMode,
      skipNutrition: isFastMode, // Fast mode skips nutrition calculations
      skipVideoEnhancement: isFastMode // Fast mode skips transcript processing
    };
    
    console.log(`${isFastMode ? 'Fast' : 'Detailed'} generation mode selected`);
    
    generateRecipeMutation.mutate(enhancedData);
  };

  return (
    <Card className="bg-white rounded-lg overflow-hidden shadow-md">
      <CardContent className="p-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What would you like to cook?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="e.g., A simple weeknight dinner that's healthy and uses minimal dishes"
                      rows={2}
                      {...field}
                      className="resize-none"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
              className="flex items-center justify-between w-full text-sm text-gray-600 py-0 h-8"
            >
              <span>Advanced Options</span>
              {showAdvancedOptions ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showAdvancedOptions && (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="recipeType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Recipe Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="text-sm h-9">
                            <SelectValue placeholder="Select recipe type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Any Type">Any Type</SelectItem>
                          <SelectItem value="Main Course">Main Course</SelectItem>
                          <SelectItem value="Appetizer">Appetizer</SelectItem>
                          <SelectItem value="Dessert">Dessert</SelectItem>
                          <SelectItem value="Breakfast">Breakfast</SelectItem>
                          <SelectItem value="Snack">Snack</SelectItem>
                          <SelectItem value="Drink">Drink</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cuisine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Cuisine</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="text-sm h-9">
                            <SelectValue placeholder="Select cuisine" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Any Cuisine">Any Cuisine</SelectItem>
                          <SelectItem value="Italian">Italian</SelectItem>
                          <SelectItem value="Mexican">Mexican</SelectItem>
                          <SelectItem value="Asian">Asian</SelectItem>
                          <SelectItem value="Mediterranean">Mediterranean</SelectItem>
                          <SelectItem value="American">American</SelectItem>
                          <SelectItem value="Indian">Indian</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dietRestrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Diet Restrictions</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="text-sm h-9">
                            <SelectValue placeholder="Select restrictions" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="None">None</SelectItem>
                          <SelectItem value="Vegetarian">Vegetarian</SelectItem>
                          <SelectItem value="Vegan">Vegan</SelectItem>
                          <SelectItem value="Gluten-Free">Gluten-Free</SelectItem>
                          <SelectItem value="Dairy-Free">Dairy-Free</SelectItem>
                          <SelectItem value="Keto">Keto</SelectItem>
                          <SelectItem value="Low-Carb">Low-Carb</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="cookingTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Cooking Time (min)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="5"
                          max="180"
                          placeholder="30"
                          className="text-sm h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="availableIngredients"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-sm">Available Ingredients</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., chicken, rice, tomatoes"
                          className="text-sm h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excludeIngredients"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel className="text-sm">Exclude Ingredients</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., nuts, shellfish, mushrooms"
                          className="text-sm h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Dual Mode Generation Buttons */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  type="button"
                  onClick={() => {
                    const data = form.getValues();
                    onSubmit(data, 'fast');
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-md flex items-center justify-center gap-2 py-2 h-10"
                  disabled={isGenerating}
                >
                  <Zap className="h-4 w-4" />
                  {isGenerating ? "Generating..." : "Fast Gen"}
                </Button>
                
                <Button 
                  type="button"
                  onClick={() => {
                    const data = form.getValues();
                    onSubmit(data, 'detailed');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md flex items-center justify-center gap-2 py-2 h-10"
                  disabled={isGenerating}
                >
                  <Clock className="h-4 w-4" />
                  {isGenerating ? "Generating..." : "Detailed Gen"}
                </Button>
              </div>
              
              {/* Mode descriptions */}
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div className="text-center">
                  <p className="font-medium text-blue-500">Fast Mode</p>
                  <p>Quick video suggestion with basic info</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-blue-600">Detailed Mode</p>
                  <p>Complete recipe with nutrition data</p>
                </div>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default RecipeGenerator;
