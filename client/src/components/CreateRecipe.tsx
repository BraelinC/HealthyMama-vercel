import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BookOpen, 
  Clock, 
  Users, 
  Plus, 
  Minus, 
  Save,
  X,
  ChefHat,
  Star,
  Camera,
  Upload,
  Image as ImageIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface CreateRecipeProps {
  isOpen: boolean;
  onClose: () => void;
  saveAsMealPlan?: boolean; // Optional prop to save as meal plan instead of recipe
}

interface Ingredient {
  id: string;
  amount: string;
  unit: string;
  name: string;
}

interface Instruction {
  id: string;
  step: number;
  text: string;
}

// Smart unit suggestions based on ingredient type
const getUnitSuggestions = (ingredientName: string): string[] => {
  const ingredient = ingredientName.toLowerCase();
  
  // Liquids
  if (ingredient.includes('oil') || ingredient.includes('water') || ingredient.includes('milk') || 
      ingredient.includes('cream') || ingredient.includes('juice') || ingredient.includes('vinegar') ||
      ingredient.includes('wine') || ingredient.includes('broth') || ingredient.includes('stock') ||
      ingredient.includes('sauce') || ingredient.includes('syrup')) {
    return ['cup', 'fl oz', 'tbsp', 'tsp', 'ml'];
  }
  
  // Spices and small amounts
  if (ingredient.includes('salt') || ingredient.includes('pepper') || ingredient.includes('garlic powder') ||
      ingredient.includes('onion powder') || ingredient.includes('paprika') || ingredient.includes('cumin') ||
      ingredient.includes('oregano') || ingredient.includes('basil') || ingredient.includes('thyme') ||
      ingredient.includes('cinnamon') || ingredient.includes('nutmeg') || ingredient.includes('ginger') ||
      ingredient.includes('cayenne') || ingredient.includes('chili powder')) {
    return ['tsp', 'tbsp', 'pinch', 'dash', 'g'];
  }
  
  // Meat and proteins
  if (ingredient.includes('chicken') || ingredient.includes('beef') || ingredient.includes('pork') ||
      ingredient.includes('fish') || ingredient.includes('salmon') || ingredient.includes('turkey') ||
      ingredient.includes('lamb') || ingredient.includes('shrimp') || ingredient.includes('bacon')) {
    return ['lb', 'oz', 'kg', 'g', 'piece'];
  }
  
  // Vegetables (whole)
  if (ingredient.includes('onion') || ingredient.includes('potato') || ingredient.includes('tomato') ||
      ingredient.includes('carrot') || ingredient.includes('bell pepper') || ingredient.includes('cucumber') ||
      ingredient.includes('avocado') || ingredient.includes('lemon') || ingredient.includes('lime') ||
      ingredient.includes('apple') || ingredient.includes('banana')) {
    return ['piece', 'cup', 'lb', 'oz', 'large'];
  }
  
  // Flour and powders
  if (ingredient.includes('flour') || ingredient.includes('sugar') || ingredient.includes('powder') ||
      ingredient.includes('cornstarch') || ingredient.includes('cocoa')) {
    return ['cup', 'tbsp', 'tsp', 'lb', 'oz'];
  }
  
  // Eggs and dairy
  if (ingredient.includes('egg') || ingredient.includes('butter') || ingredient.includes('cheese') ||
      ingredient.includes('yogurt') || ingredient.includes('sour cream')) {
    return ['piece', 'cup', 'tbsp', 'oz', 'lb'];
  }
  
  // Rice, pasta, grains
  if (ingredient.includes('rice') || ingredient.includes('pasta') || ingredient.includes('quinoa') ||
      ingredient.includes('oats') || ingredient.includes('barley') || ingredient.includes('noodles')) {
    return ['cup', 'lb', 'oz', 'pkg', 'g'];
  }
  
  // Default suggestions
  return ['cup', 'tbsp', 'tsp', 'oz', 'lb'];
};

export function CreateRecipe({ isOpen, onClose, saveAsMealPlan = false }: CreateRecipeProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("basics");
  
  // Recipe form state
  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [prepTime, setPrepTime] = useState("");
  const [servings, setServings] = useState("4");
  const [difficulty, setDifficulty] = useState(1);
  const [cuisine, setCuisine] = useState("");
  const [mealType, setMealType] = useState("Breakfast");
  const [tags, setTags] = useState<string[]>([]);
  const [recipeImage, setRecipeImage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', amount: '', unit: '', name: '' }
  ]);
  
  const [instructions, setInstructions] = useState<Instruction[]>([
    { id: '1', step: 1, text: '' }
  ]);

  const addIngredient = () => {
    const newId = (ingredients.length + 1).toString();
    setIngredients([...ingredients, { id: newId, amount: '', unit: '', name: '' }]);
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter(ing => ing.id !== id));
    }
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(ingredients.map(ing => 
      ing.id === id ? { ...ing, [field]: value } : ing
    ));
  };

  const addInstruction = () => {
    const newId = (instructions.length + 1).toString();
    const newStep = instructions.length + 1;
    setInstructions([...instructions, { id: newId, step: newStep, text: '' }]);
  };

  const removeInstruction = (id: string) => {
    if (instructions.length > 1) {
      const filtered = instructions.filter(inst => inst.id !== id);
      // Renumber steps
      const renumbered = filtered.map((inst, index) => ({ ...inst, step: index + 1 }));
      setInstructions(renumbered);
    }
  };

  const updateInstruction = (id: string, text: string) => {
    setInstructions(instructions.map(inst => 
      inst.id === id ? { ...inst, text } : inst
    ));
  };

  const handleImageUpload = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setRecipeImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, GIF, etc.)",
        variant: "destructive"
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const removeImage = () => {
    setRecipeImage(null);
  };

  const handleTakePicture = async () => {
    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera if available
      });
      
      // Create video element to show camera preview
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      
      // Create canvas for capturing image
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      // Wait for video to load
      video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Show camera preview in a modal-like overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.9);
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: all;
          touch-action: none;
        `;
        
        // Prevent scrolling and clicks behind overlay
        overlay.onclick = (e) => e.stopPropagation();
        overlay.ontouchstart = (e) => {
          if (e.target === overlay) {
            e.preventDefault();
          }
        };
        overlay.ontouchmove = (e) => {
          if (e.target === overlay) {
            e.preventDefault();
          }
        };
        
        video.style.cssText = `
          max-width: 90%;
          max-height: 70%;
          border-radius: 8px;
        `;
        
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
          display: flex;
          gap: 16px;
          margin-top: 20px;
        `;
        
        const captureBtn = document.createElement('button');
        captureBtn.textContent = '📸 Take Photo';
        captureBtn.style.cssText = `
          background: #10b981;
          color: white;
          border: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          min-height: 48px;
          min-width: 120px;
        `;
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '❌ Cancel';
        cancelBtn.style.cssText = `
          background: #ef4444;
          color: white;
          border: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
          min-height: 48px;
          min-width: 120px;
        `;
        
        // Capture photo function
        const capturePhoto = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (context && video.videoWidth > 0 && video.videoHeight > 0) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setRecipeImage(imageDataUrl);
            
            // Cleanup
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(overlay);
            
            toast({
              title: "Photo captured!",
              description: "Your recipe photo has been added successfully."
            });
          } else {
            toast({
              title: "Camera Error",
              description: "Please wait for camera to fully load, then try again.",
              variant: "destructive"
            });
          }
        };
        
        // Add both click and touch events for better mobile support
        captureBtn.onclick = capturePhoto;
        captureBtn.ontouchend = capturePhoto;
        
        // Cancel function
        const cancelCapture = (e) => {
          e.preventDefault();
          e.stopPropagation();
          stream.getTracks().forEach(track => track.stop());
          document.body.removeChild(overlay);
        };
        
        // Add both click and touch events for better mobile support
        cancelBtn.onclick = cancelCapture;
        cancelBtn.ontouchend = cancelCapture;
        
        buttonContainer.appendChild(captureBtn);
        buttonContainer.appendChild(cancelBtn);
        overlay.appendChild(video);
        overlay.appendChild(buttonContainer);
        document.body.appendChild(overlay);
      });
      
    } catch (error) {
      console.error('Camera access error:', error);
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to take photos. You can also upload an image instead.",
        variant: "destructive"
      });
    }
  };

  const saveRecipeMutation = useMutation({
    mutationFn: async (recipeData: any) => {
      const endpoint = saveAsMealPlan 
        ? '/api/community-recipes/save-as-meal-plan'
        : '/api/recipes/create';
      
      return apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(recipeData),
      });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      if (saveAsMealPlan) {
        queryClient.invalidateQueries({ queryKey: ['/api/meal-plans/saved'] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/recipes/user'] });
        queryClient.invalidateQueries({ queryKey: ['/api/favorites'] });
      }
      
      toast({ 
        title: saveAsMealPlan ? "Meal Saved!" : "Recipe Saved!", 
        description: `"${recipeName}" has been saved${saveAsMealPlan ? ' as a meal plan' : ' to your recipes'}.` 
      });
      handleClose();
    },
    onError: (error) => {
      console.error('Error saving recipe:', error);
      toast({
        title: "Error",
        description: `Failed to save ${saveAsMealPlan ? 'meal' : 'recipe'}. Please try again.`,
        variant: "destructive"
      });
    }
  });

  const handleSave = () => {
    console.log("🍳 CreateRecipe handleSave called");
    console.log("🍳 saveAsMealPlan prop:", saveAsMealPlan);
    console.log("🍳 recipeName:", recipeName);
    
    if (!recipeName.trim()) {
      toast({ 
        title: "Recipe Name Required", 
        description: "Please enter a name for your recipe.",
        variant: "destructive"
      });
      return;
    }

    // Validate ingredients - convert to simple strings and filter empty ones
    const validIngredients = ingredients
      .map(ing => {
        const parts = [];
        if (ing.amount?.trim()) parts.push(ing.amount.trim());
        if (ing.unit?.trim()) parts.push(ing.unit.trim());
        if (ing.name?.trim()) parts.push(ing.name.trim());
        return parts.join(' ');
      })
      .filter(ing => ing.trim().length > 0);

    if (validIngredients.length === 0) {
      toast({ 
        title: "Ingredients Required", 
        description: "Please add at least one ingredient.",
        variant: "destructive"
      });
      return;
    }

    // Validate instructions
    const validInstructions = instructions
      .map(inst => inst.text?.trim())
      .filter(text => text && text.length > 0);

    if (validInstructions.length === 0) {
      toast({ 
        title: "Instructions Required", 
        description: "Please add at least one instruction step.",
        variant: "destructive"
      });
      return;
    }
    
    const recipeData = {
      title: recipeName.trim(),
      description: description.trim() || `Cook time: ${cookTime || '0'}m | Difficulty: ${difficulty}/5`,
      image_url: recipeImage,
      time_minutes: parseInt(cookTime) || 0,
      cuisine: cuisine.trim() || 'homemade',
      diet: `Difficulty: ${difficulty}/5`,
      meal_type: mealType,
      ingredients: validIngredients,
      instructions: validInstructions,
      nutrition_info: {
        calories: 0, // Could be calculated later
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0
      }
    };

    saveRecipeMutation.mutate(recipeData);
  };

  const handleClose = () => {
    // Reset form
    setRecipeName("");
    setDescription("");
    setCookTime("");
    setPrepTime("");
    setServings("4");
    setDifficulty(1);
    setCuisine("");
    setTags([]);
    setIngredients([{ id: '1', amount: '', unit: '', name: '' }]);
    setInstructions([{ id: '1', step: 1, text: '' }]);
    setActiveTab("basics");
    setRecipeImage(null);
    setIsDragOver(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogOverlay className="z-[100000]" />
      <DialogContent 
        className="max-w-3xl w-[95vw] max-h-[85vh] p-0 mx-auto z-[100001]"
        style={{ touchAction: 'auto', height: '85vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Header */}
          <DialogHeader className="p-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <BookOpen className="h-8 w-8 text-emerald-600" />
              <DialogTitle className="text-2xl font-bold text-gray-900">
                Create Your Own Recipe
              </DialogTitle>
            </div>
            <p className="text-gray-600 mt-2">
              Build your recipe from scratch with ingredients, instructions, and more
            </p>
          </DialogHeader>

          {/* Content */}
          <div 
            className="flex-1 overflow-y-auto p-6 min-h-0" 
            style={{ 
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehavior: 'contain',
              position: 'relative'
            }}
          >
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 mb-6">
                <TabsTrigger value="basics">Recipe Basics</TabsTrigger>
                <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
                <TabsTrigger value="instructions">Instructions</TabsTrigger>
              </TabsList>

              {/* Recipe Basics Tab */}
              <TabsContent value="basics" className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Recipe Name *
                        </label>
                        <Input
                          placeholder="Enter recipe name..."
                          value={recipeName}
                          onChange={(e) => setRecipeName(e.target.value)}
                          className="text-lg"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Meal Type *
                        </label>
                        <Select value={mealType} onValueChange={setMealType}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select meal type..." />
                          </SelectTrigger>
                          <SelectContent className="z-[100002]">
                            <SelectItem value="Breakfast">🍳 Breakfast</SelectItem>
                            <SelectItem value="Lunch">🥗 Lunch</SelectItem>
                            <SelectItem value="Dinner">🍽️ Dinner</SelectItem>
                            <SelectItem value="Baking">🍞 Baking</SelectItem>
                            <SelectItem value="Sweets">🍰 Sweets</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Image Upload Section */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Recipe Image
                        </label>
                        
                        {!recipeImage ? (
                          <div
                            className={`
                              border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                              ${isDragOver 
                                ? 'border-emerald-400 bg-emerald-50' 
                                : 'border-gray-300 hover:border-emerald-400 hover:bg-emerald-50'
                              }
                            `}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onClick={() => document.getElementById('recipe-image-input')?.click()}
                          >
                            <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                            <div className="space-y-2">
                              <p className="text-sm font-medium text-gray-900">
                                Add a photo of your recipe
                              </p>
                              <p className="text-xs text-gray-500">
                                Drag and drop or click to upload
                              </p>
                              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    document.getElementById('recipe-image-input')?.click();
                                  }}
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Import Image
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTakePicture();
                                  }}
                                >
                                  <Camera className="h-4 w-4 mr-2" />
                                  Take Picture
                                </Button>
                              </div>
                            </div>
                            <input
                              id="recipe-image-input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                              <img
                                src={recipeImage}
                                alt="Recipe preview"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={removeImage}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <div className="mt-2 flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => document.getElementById('recipe-image-input')?.click()}
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                Change Image
                              </Button>
                            </div>
                            <input
                              id="recipe-image-input"
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">
                          Description
                        </label>
                        <Textarea
                          placeholder="Describe your recipe..."
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            <Clock className="h-4 w-4 inline mr-1" />
                            Prep Time (min)
                          </label>
                          <Input
                            type="number"
                            placeholder="15"
                            value={prepTime}
                            onChange={(e) => setPrepTime(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            <ChefHat className="h-4 w-4 inline mr-1" />
                            Cook Time (min)
                          </label>
                          <Input
                            type="number"
                            placeholder="30"
                            value={cookTime}
                            onChange={(e) => setCookTime(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            <Users className="h-4 w-4 inline mr-1" />
                            Servings
                          </label>
                          <Input
                            type="number"
                            value={servings}
                            onChange={(e) => setServings(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            Cuisine Type
                          </label>
                          <Input
                            placeholder="e.g., Italian, Mexican, Asian..."
                            value={cuisine}
                            onChange={(e) => setCuisine(e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">
                            <Star className="h-4 w-4 inline mr-1" />
                            Difficulty (1-5)
                          </label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((level) => (
                              <Button
                                key={level}
                                variant={difficulty >= level ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDifficulty(level)}
                                className="w-10 h-10 p-0"
                              >
                                {level}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Ingredients Tab */}
              <TabsContent value="ingredients" className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Ingredients</h3>
                      <Button onClick={addIngredient} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Ingredient
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {ingredients.map((ingredient) => (
                        <div key={ingredient.id} className="flex gap-2 items-center">
                          <div className="flex-1">
                            <Input
                              placeholder="Ingredient name"
                              value={ingredient.name}
                              onChange={(e) => updateIngredient(ingredient.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="w-12">
                            <Input
                              placeholder="1"
                              value={ingredient.amount}
                              onChange={(e) => updateIngredient(ingredient.id, 'amount', e.target.value)}
                            />
                          </div>
                          <div className="w-20 relative">
                            <Input
                              placeholder="cup"
                              value={ingredient.unit}
                              onChange={(e) => updateIngredient(ingredient.id, 'unit', e.target.value)}
                              list={`units-${ingredient.id}`}
                            />
                            <datalist id={`units-${ingredient.id}`}>
                              {getUnitSuggestions(ingredient.name).map((unit) => (
                                <option key={unit} value={unit} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Instructions Tab */}
              <TabsContent value="instructions" className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Instructions</h3>
                      <Button onClick={addInstruction} size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {instructions.map((instruction) => (
                        <div key={instruction.id} className="flex gap-3 items-start">
                          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-semibold text-sm flex-shrink-0 mt-1">
                            {instruction.step}
                          </div>
                          <div className="flex-1">
                            <Textarea
                              placeholder="Describe this step..."
                              value={instruction.text}
                              onChange={(e) => updateInstruction(instruction.id, e.target.value)}
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 p-6 flex-shrink-0">
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                <Save className="h-4 w-4 mr-2" />
                Save Recipe
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}