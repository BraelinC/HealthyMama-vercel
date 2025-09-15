import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, ChefHat, AlertCircle, CheckCircle, Lightbulb, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TimingResult {
  timing: {
    totalMinutes: number;
    prepTime: number;
    cookTime: number;
    difficulty: number;
    breakdown: {
      ingredients: Array<{
        name: string;
        prepTime: number;
        cookTime: number;
      }>;
      methods: string[];
      complexityFactors: string[];
    };
    recommendations: string[];
  };
  alternatives: string[];
  validation?: {
    isValid: boolean;
    issues: string[];
    suggestions: string[];
  };
  enhanced_recipe: {
    title: string;
    cook_time_minutes: number;
    prep_time_minutes: number;
    actual_cook_time_minutes: number;
    difficulty: number;
  };
}

export function CookingTimeCalculator() {
  const [recipe, setRecipe] = useState({
    title: "Chicken Stir-Fry",
    ingredients: "chicken breast, bell peppers, broccoli, soy sauce, garlic, onion, vegetable oil",
    instructions: "Cut chicken into strips. Heat oil in wok. Stir-fry chicken until golden. Add vegetables and sauce. Cook until tender."
  });
  const [constraints, setConstraints] = useState({
    cookTime: 45,
    difficulty: 3,
    prepTimePreference: "moderate"
  });
  const [result, setResult] = useState<TimingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const calculateTiming = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/recipes/calculate-timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe: {
            title: recipe.title,
            ingredients: recipe.ingredients.split(',').map(i => i.trim()),
            instructions: recipe.instructions.split('.').filter(i => i.trim())
          },
          constraints
        })
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        toast({
          title: "Analysis Complete",
          description: `Recipe analyzed: ${data.timing.totalMinutes} minutes, difficulty ${data.timing.difficulty}/5`
        });
      } else {
        throw new Error('Failed to calculate timing');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to analyze recipe timing",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return "bg-green-500";
    if (difficulty <= 3) return "bg-yellow-500";
    if (difficulty <= 4) return "bg-orange-500";
    return "bg-red-500";
  };

  const sampleRecipes = [
    {
      title: "Simple Scrambled Eggs",
      ingredients: "eggs, butter, salt, pepper",
      instructions: "Beat eggs. Heat butter in pan. Add eggs and scramble until set."
    },
    {
      title: "Chocolate Chip Cookies",
      ingredients: "flour, butter, brown sugar, white sugar, eggs, vanilla, baking soda, chocolate chips",
      instructions: "Cream butter and sugars. Add eggs and vanilla. Mix in flour and baking soda. Fold in chocolate chips. Bake at 375°F for 9-11 minutes."
    },
    {
      title: "Homemade Bread Loaf",
      ingredients: "bread flour, yeast, water, salt, sugar, olive oil",
      instructions: "Mix yeast with warm water and sugar. Combine flour and salt. Add yeast mixture and oil. Knead for 8 minutes. Let rise 1 hour. Shape and bake 45 minutes at 450°F."
    },
    {
      title: "Thai Green Curry",
      ingredients: "chicken thighs, green curry paste, coconut milk, thai basil, fish sauce, palm sugar, eggplant",
      instructions: "Fry curry paste in oil. Add chicken and cook. Pour in coconut milk. Add vegetables and seasonings. Simmer until tender."
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChefHat className="w-5 h-5" />
            Intelligent Cooking Time & Difficulty Calculator
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Test the new AI-powered system that calculates accurate cooking times and difficulty levels for any recipe
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sample Recipe Buttons */}
          <div className="space-y-2">
            <Label>Quick Test with Sample Recipes:</Label>
            <div className="flex flex-wrap gap-2">
              {sampleRecipes.map((sample, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setRecipe(sample)}
                  className="text-xs"
                >
                  {sample.title}
                </Button>
              ))}
            </div>
          </div>

          {/* Recipe Input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Recipe Title</Label>
                <Input
                  id="title"
                  value={recipe.title}
                  onChange={(e) => setRecipe({...recipe, title: e.target.value})}
                  placeholder="Enter recipe name"
                />
              </div>
              
              <div>
                <Label htmlFor="ingredients">Ingredients (comma-separated)</Label>
                <Textarea
                  id="ingredients"
                  value={recipe.ingredients}
                  onChange={(e) => setRecipe({...recipe, ingredients: e.target.value})}
                  placeholder="chicken, vegetables, sauce..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="instructions">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={recipe.instructions}
                  onChange={(e) => setRecipe({...recipe, instructions: e.target.value})}
                  placeholder="Step-by-step cooking instructions..."
                  rows={4}
                />
              </div>
            </div>

            {/* Constraints */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="cookTime">Max Cook Time (minutes)</Label>
                <Input
                  id="cookTime"
                  type="number"
                  value={constraints.cookTime}
                  onChange={(e) => setConstraints({...constraints, cookTime: parseInt(e.target.value)})}
                />
              </div>
              
              <div>
                <Label htmlFor="difficulty">Max Difficulty Level (1-5)</Label>
                <Input
                  id="difficulty"
                  type="number"
                  min="1"
                  max="5"
                  value={constraints.difficulty}
                  onChange={(e) => setConstraints({...constraints, difficulty: parseInt(e.target.value)})}
                />
              </div>

              <Button 
                onClick={calculateTiming} 
                disabled={loading}
                className="w-full"
              >
                {loading ? "Analyzing..." : "Calculate Timing & Difficulty"}
              </Button>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4 border-t pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Time Breakdown */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Time Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {result.timing.totalMinutes} min
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div>Prep: {result.timing.prepTime} min</div>
                      <div>Cook: {result.timing.cookTime} min</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Difficulty */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ChefHat className="w-4 h-4" />
                      Difficulty
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full ${getDifficultyColor(result.timing.difficulty)} flex items-center justify-center text-white font-bold`}>
                        {result.timing.difficulty}
                      </div>
                      <div className="text-sm">
                        {result.timing.difficulty <= 2 ? "Easy" :
                         result.timing.difficulty <= 3 ? "Medium" :
                         result.timing.difficulty <= 4 ? "Hard" : "Expert"}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Validation */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {result.validation?.isValid ? 
                        <CheckCircle className="w-4 h-4 text-green-500" /> :
                        <AlertCircle className="w-4 h-4 text-orange-500" />
                      }
                      Constraints
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={result.validation?.isValid ? "default" : "secondary"}>
                      {result.validation?.isValid ? "Meets Requirements" : "Some Issues"}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ingredient Analysis */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Ingredient Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {result.timing.breakdown.ingredients.slice(0, 5).map((ing, index) => (
                        <div key={index} className="flex justify-between">
                          <span className="capitalize">{ing.name}</span>
                          <span className="text-muted-foreground">
                            {ing.prepTime + ing.cookTime}min
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Cooking Methods */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Cooking Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1">
                      {result.timing.breakdown.methods.map((method, index) => (
                        <Badge key={index} variant="outline" className="text-xs capitalize">
                          {method}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {result.timing.recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Cooking Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {result.timing.recommendations.slice(0, 3).map((tip, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Easy Alternatives */}
              {result.alternatives.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Repeat className="w-4 h-4" />
                      Easy Alternatives
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1 text-sm">
                      {result.alternatives.slice(0, 2).map((alt, index) => (
                        <div key={index} className="text-muted-foreground">
                          • {alt}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Validation Issues */}
              {result.validation && !result.validation.isValid && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
                      <AlertCircle className="w-4 h-4" />
                      Constraint Issues
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.validation.issues.map((issue, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        ⚠️ {issue}
                      </div>
                    ))}
                    {result.validation.suggestions.map((suggestion, index) => (
                      <div key={index} className="text-sm text-blue-600">
                        💡 {suggestion}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}