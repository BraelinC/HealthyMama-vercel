import { useState } from "react";
import { CookingTimeCalculator } from "@/components/CookingTimeCalculator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TestTube, Clock, ChefHat, Calculator, Sparkles,
  // Breakfast Icons
  Coffee, Egg, Cookie, Apple, Banana, Cherry, Grape, Milk,
  // Meat & Protein Icons  
  Beef, Fish, Drumstick,
  // Vegetables & Healthy
  Carrot, Salad, Corn,
  // International Cuisine
  Pizza, Sandwich, Soup, Cake, IceCream, Wine, Beer,
  // Cooking & Utensils
  Flame, Star, Heart, Utensils, 
  // Additional Food Items
  Wheat, Ham,
  // Generic Actions
  Plus, Search, Activity, Target, Gem, Crown, Gift, Sun, Leaf, Droplets, Snowflake
} from "lucide-react";

interface IconData {
  component: React.ReactNode;
  name: string;
  category: string;
  keywords: string[];
}

export function TestingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Comprehensive food icon collection organized by meal types and cuisines
  const foodIcons: IconData[] = [
    // BREAKFAST
    { component: <Coffee className="w-6 h-6 text-amber-700" />, name: "Coffee", category: "breakfast", keywords: ["coffee", "drink", "morning"] },
    { component: <Egg className="w-6 h-6 text-yellow-600" />, name: "Egg", category: "breakfast", keywords: ["egg", "omelette", "protein"] },
    { component: <Cookie className="w-6 h-6 text-amber-600" />, name: "Pastry", category: "breakfast", keywords: ["pastry", "croissant", "muffin"] },
    { component: <Milk className="w-6 h-6 text-blue-200" />, name: "Dairy", category: "breakfast", keywords: ["milk", "dairy", "yogurt"] },
    { component: <Wheat className="w-6 h-6 text-amber-600" />, name: "Bread", category: "breakfast", keywords: ["bread", "toast", "grain"] },
    
    // MEAT & PROTEIN
    { component: <Beef className="w-6 h-6 text-red-700" />, name: "Beef", category: "meat", keywords: ["beef", "steak", "protein"] },
    { component: <Fish className="w-6 h-6 text-blue-600" />, name: "Fish", category: "seafood", keywords: ["fish", "salmon", "seafood"] },
    { component: <Drumstick className="w-6 h-6 text-orange-700" />, name: "Chicken", category: "meat", keywords: ["chicken", "poultry", "protein"] },
    { component: <Ham className="w-6 h-6 text-pink-600" />, name: "Pork", category: "meat", keywords: ["ham", "pork", "bacon"] },
    
    // VEGETABLES & FRUITS
    { component: <Carrot className="w-6 h-6 text-orange-500" />, name: "Vegetables", category: "vegetables", keywords: ["carrot", "vegetable", "healthy"] },
    { component: <Salad className="w-6 h-6 text-green-600" />, name: "Salad", category: "vegetables", keywords: ["salad", "greens", "healthy"] },
    { component: <Apple className="w-6 h-6 text-red-500" />, name: "Apple", category: "fruits", keywords: ["apple", "fruit", "healthy"] },
    { component: <Banana className="w-6 h-6 text-yellow-500" />, name: "Banana", category: "fruits", keywords: ["banana", "fruit", "tropical"] },
    { component: <Cherry className="w-6 h-6 text-red-600" />, name: "Berries", category: "fruits", keywords: ["cherry", "berry", "sweet"] },
    { component: <Grape className="w-6 h-6 text-purple-600" />, name: "Grapes", category: "fruits", keywords: ["grape", "fruit", "wine"] },
    
    // CUISINES
    { component: <Pizza className="w-6 h-6 text-red-500" />, name: "Italian", category: "italian", keywords: ["pizza", "pasta", "italian"] },
    { component: <Flame className="w-6 h-6 text-red-600" />, name: "Mexican", category: "mexican", keywords: ["mexican", "spicy", "taco"] },
    { component: <Star className="w-6 h-6 text-yellow-600" />, name: "Asian", category: "asian", keywords: ["asian", "chinese", "stir fry"] },
    { component: <Crown className="w-6 h-6 text-purple-600" />, name: "French", category: "french", keywords: ["french", "gourmet", "elegant"] },
    { component: <Sun className="w-6 h-6 text-orange-500" />, name: "Mediterranean", category: "mediterranean", keywords: ["mediterranean", "olive", "healthy"] },
    
    // MEAL TYPES
    { component: <Sandwich className="w-6 h-6 text-orange-600" />, name: "Sandwich", category: "lunch", keywords: ["sandwich", "lunch", "quick"] },
    { component: <Soup className="w-6 h-6 text-orange-700" />, name: "Soup", category: "comfort", keywords: ["soup", "warm", "comfort"] },
    
    // DESSERTS
    { component: <Cake className="w-6 h-6 text-pink-500" />, name: "Cake", category: "dessert", keywords: ["cake", "dessert", "sweet"] },
    { component: <IceCream className="w-6 h-6 text-pink-400" />, name: "Ice Cream", category: "dessert", keywords: ["ice cream", "frozen", "sweet"] },
    
    // BEVERAGES
    { component: <Wine className="w-6 h-6 text-purple-700" />, name: "Wine", category: "beverages", keywords: ["wine", "alcohol", "drink"] },
    { component: <Beer className="w-6 h-6 text-amber-700" />, name: "Beer", category: "beverages", keywords: ["beer", "alcohol", "drink"] },
    { component: <Droplets className="w-6 h-6 text-blue-400" />, name: "Water", category: "beverages", keywords: ["water", "hydration", "drink"] },
    
    // COOKING METHODS
    { component: <ChefHat className="w-6 h-6 text-white" />, name: "Chef Special", category: "cooking", keywords: ["chef", "special", "gourmet"] },
    { component: <Utensils className="w-6 h-6 text-gray-700" />, name: "Fine Dining", category: "cooking", keywords: ["utensils", "dining", "elegant"] },
    
    // SEASONAL & DIET
    { component: <Leaf className="w-6 h-6 text-green-500" />, name: "Vegan", category: "diet", keywords: ["vegan", "healthy", "plant"] },
    { component: <Heart className="w-6 h-6 text-red-400" />, name: "Healthy", category: "diet", keywords: ["healthy", "heart", "nutrition"] },
    { component: <Activity className="w-6 h-6 text-green-500" />, name: "Fitness", category: "diet", keywords: ["fitness", "protein", "workout"] },
    { component: <Snowflake className="w-6 h-6 text-blue-300" />, name: "Cold", category: "seasonal", keywords: ["cold", "frozen", "winter"] }
  ];

  const filteredIcons = foodIcons.filter(icon => 
    icon.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    icon.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase())) ||
    icon.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const categories = Array.from(new Set(foodIcons.map(icon => icon.category)));

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 text-3xl font-bold">
          <TestTube className="w-8 h-8 text-primary" />
          New Features Testing Lab
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Test and explore the latest intelligent cooking features that have been integrated into Healthy Mama
        </p>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="text-center">
            <Clock className="w-8 h-8 mx-auto text-blue-500" />
            <CardTitle className="text-lg">Smart Timing</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              AI calculates accurate prep and cook times based on ingredients and methods
            </p>
            <Badge variant="secondary">Prep + Cook Analysis</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <ChefHat className="w-8 h-8 mx-auto text-green-500" />
            <CardTitle className="text-lg">Difficulty Scoring</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              1-5 scale difficulty rating considering techniques and complexity
            </p>
            <Badge variant="secondary">Skill Level Matching</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="text-center">
            <Calculator className="w-8 h-8 mx-auto text-purple-500" />
            <CardTitle className="text-lg">Smart Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Personalized cooking tips and easy alternatives for complex recipes
            </p>
            <Badge variant="secondary">Adaptive Guidance</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Testing Component */}
      <CookingTimeCalculator />

      {/* Food Icons Library Section */}
      <Card className="border-2 border-dashed border-purple-300">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            Food Icons Library - {foodIcons.length} Symbols
          </CardTitle>
          <CardDescription>
            Browse our comprehensive collection of food icons organized by meal types and cuisines. 
            These icons are automatically selected for your recipes based on ingredients and meal types.
          </CardDescription>
          
          <div className="flex gap-4 items-center mt-4">
            <Input
              placeholder="Search icons by name, category, or keywords..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
            <Badge variant="outline" className="text-sm">
              {filteredIcons.length} icons found
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid grid-cols-4 md:grid-cols-8 lg:grid-cols-10 gap-1 h-auto p-1 mb-6">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              {categories.slice(0, 9).map(category => (
                <TabsTrigger key={category} value={category} className="text-xs capitalize">
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                {filteredIcons.map((icon, index) => (
                  <Card key={index} className="p-2 hover:shadow-lg transition-shadow cursor-pointer hover:bg-purple-50">
                    <div className="flex flex-col items-center text-center space-y-1">
                      {icon.component}
                      <span className="text-xs font-medium text-gray-700 truncate w-full">{icon.name}</span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {icon.category}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {categories.map(category => (
              <TabsContent key={category} value={category} className="mt-6">
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="capitalize text-lg">{category} Icons</CardTitle>
                    <CardDescription>
                      Icons specifically for {category} related meals and dishes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-3">
                      {foodIcons
                        .filter(icon => icon.category === category)
                        .map((icon, index) => (
                          <div key={index} className="flex flex-col items-center text-center p-2 hover:bg-gray-50 rounded-lg cursor-pointer space-y-1">
                            {icon.component}
                            <span className="text-xs font-medium text-gray-700 truncate w-full">{icon.name}</span>
                            <div className="text-xs text-gray-500">
                              {icon.keywords.slice(0, 2).join(', ')}
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
          
          <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border">
            <h4 className="font-semibold mb-2 text-purple-800">How Icon Selection Works</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div>
                <strong>Smart Detection:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Analyzes meal titles and ingredients</li>
                  <li>• Detects cuisine types (Italian, Asian, etc.)</li>
                  <li>• Recognizes cooking methods (grilled, steamed)</li>
                  <li>• Identifies meal types (breakfast, lunch, dinner)</li>
                </ul>
              </div>
              <div>
                <strong>Fallback System:</strong>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Specific ingredient icons (chicken → drumstick)</li>
                  <li>• Cuisine-based icons (pasta → Italian)</li>
                  <li>• Meal type defaults (breakfast → coffee)</li>
                  <li>• Generic chef hat for unknown items</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}