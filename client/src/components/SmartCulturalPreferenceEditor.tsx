import { useState, useEffect } from 'react';
import { Globe, Plus, X, Edit3, Check, ChefHat, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import CulturalCuisineDropdown from '@/components/CulturalCuisineDropdown';
import CulturalFreeTextInput from '@/components/CulturalFreeTextInput';
import { useToast } from '@/hooks/use-toast';

interface CuisineResearchData {
  culture: string;
  meals: Array<{
    name: string;
    description: string;
    healthy_mods: string[];
    macros: {
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    };
  }>;
  styles: string[];
  key_ingredients: string[];
  cooking_techniques: string[];
  health_benefits: string[];
}

interface SmartCulturalPreferenceEditorProps {
  culturalBackground: string[];
  onCulturalBackgroundChange: (cuisines: string[]) => void;
  onSave: (overrideCuisines?: string[]) => void;
  isSaving?: boolean;
  showPreviewData?: boolean;
}

export default function SmartCulturalPreferenceEditor({
  culturalBackground,
  onCulturalBackgroundChange,
  onSave,
  isSaving = false,
  showPreviewData = false
}: SmartCulturalPreferenceEditorProps) {

  
  const [isEditing, setIsEditing] = useState(false);
  const [editingCuisines, setEditingCuisines] = useState<string[]>([]);
  const [isParsingCulture, setIsParsingCulture] = useState(false);
  const [researchData, setResearchData] = useState<{ [cuisine: string]: CuisineResearchData }>({});
  const [loadingResearch, setLoadingResearch] = useState<{ [cuisine: string]: boolean }>({});
  const [showResearch, setShowResearch] = useState(false);
  const [pendingCuisines, setPendingCuisines] = useState<string[]>([]);
  const [savingMeals, setSavingMeals] = useState<{ [cuisine: string]: boolean }>({});
  const [savedMeals, setSavedMeals] = useState<{ [cuisine: string]: boolean }>(() => {
    // Load saved meals state from localStorage
    try {
      const saved = localStorage.getItem('cultural-meals-saved-state');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Simple cache for research data (in memory)
  const researchCache = useState(new Map<string, CuisineResearchData>())[0];
  const { toast } = useToast();

  // Function to update saved meals state and persist to localStorage
  const updateSavedMealsState = (cuisine: string, saved: boolean) => {
    setSavedMeals(prev => {
      const newState = { ...prev, [cuisine]: saved };
      // Persist to localStorage
      try {
        localStorage.setItem('cultural-meals-saved-state', JSON.stringify(newState));
      } catch (error) {
        console.error('Failed to save cultural meals state to localStorage:', error);
      }
      return newState;
    });
  };

  // Utility function to clear all saved states (for debugging/reset)
  // Can be called from browser console: window.clearAllCulturalMealSavedStates()
  if (typeof window !== 'undefined') {
    (window as any).clearAllCulturalMealSavedStates = () => {
      setSavedMeals({});
      localStorage.removeItem('cultural-meals-saved-state');
      console.log('All cultural meal saved states cleared');
    };
  }

  // Current display cuisines: saved + pending
  const displayedCuisines = [...culturalBackground, ...pendingCuisines.filter(c => !culturalBackground.includes(c))];
  const hasUnsavedChanges = pendingCuisines.length > 0;
  


  // Clear pending cuisines when they get saved to culturalBackground
  useEffect(() => {
    // Remove any pending cuisines that are now in the saved culturalBackground
    const stillPending = pendingCuisines.filter(cuisine => !culturalBackground.includes(cuisine));
    if (stillPending.length !== pendingCuisines.length) {
      setPendingCuisines(stillPending);
    }
  }, [culturalBackground, pendingCuisines]);

  const handleStartEditing = () => {
    setEditingCuisines([...displayedCuisines]);
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setPendingCuisines([]);
    setEditingCuisines([]);
    setIsEditing(false);
  };

  const handleSaveChanges = async () => {
    // Always use displayedCuisines which includes both saved and pending
    const finalCuisines = displayedCuisines;
    const newCuisines = pendingCuisines; // These are the new ones to be saved
    
    try {
      onCulturalBackgroundChange(finalCuisines);
      await onSave(finalCuisines);
      
      setIsEditing(false);
      setPendingCuisines([]);
      setEditingCuisines([]);
      
      if (newCuisines.length > 0) {
        toast({
          title: "Saved Successfully",
          description: `Added ${newCuisines.join(', ')} to your cultural preferences.`
        });
      } else {
        toast({
          title: "Saved Successfully",
          description: "Your cultural preferences have been updated."
        });
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save cultural preferences. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Function to save meals to user profile
  const handleSaveMeals = async (cuisine: string) => {
    if (savingMeals[cuisine] || !researchData[cuisine]) return;
    
    setSavingMeals(prev => ({ ...prev, [cuisine]: true }));
    
    try {
      const response = await fetch('/api/save-cultural-meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuisine_name: cuisine,
          meals_data: researchData[cuisine].meals,
          summary_data: {
            key_ingredients: researchData[cuisine].key_ingredients,
            cooking_techniques: researchData[cuisine].cooking_techniques,
            health_benefits: researchData[cuisine].health_benefits
          },
          custom_name: `${cuisine} Meal Collection`
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save meals: ${response.statusText}`);
      }
      
      updateSavedMealsState(cuisine, true);
      toast({
        title: "Meals Saved!",
        description: `${cuisine} meals have been saved to your profile`,
        variant: "default"
      });
      
      // Don't reset the saved state - keep it persistent so users can see what's been saved
      
    } catch (error) {
      console.error(`Error saving ${cuisine} meals:`, error);
      toast({
        title: "Save Failed",
        description: `Could not save ${cuisine} meals. Please try again.`,
        variant: "destructive"
      });
    } finally {
      setSavingMeals(prev => ({ ...prev, [cuisine]: false }));
    }
  };

  const handleRemoveCuisine = (cuisineToRemove: string) => {
    if (isEditing) {
      // Remove from editing list
      const newEditing = editingCuisines.filter(c => c !== cuisineToRemove);
      setEditingCuisines(newEditing);
    } else {
      // Simply remove from pending list if it exists there
      const newPending = pendingCuisines.filter(c => c !== cuisineToRemove);
      setPendingCuisines(newPending);
    }
  };

  const handleAddQuickCuisine = async (cuisine: string) => {
    if (!culturalBackground.includes(cuisine)) {
      try {
        const newCuisines = [...culturalBackground, cuisine];
        onCulturalBackgroundChange(newCuisines);
        await onSave(newCuisines);
        
        toast({
          title: "Added Successfully",
          description: `${cuisine} cuisine has been added to your preferences.`
        });
      } catch (error) {
        toast({
          title: "Failed to Add",
          description: `Could not add ${cuisine}. Please try again.`,
          variant: "destructive"
        });
      }
    }
  };

  const handleQuickRemoveCuisine = async (cuisine: string) => {
    try {
      const newCuisines = culturalBackground.filter(c => c !== cuisine);
      onCulturalBackgroundChange(newCuisines);
      await onSave(newCuisines);
      
      toast({
        title: "Removed Successfully",
        description: `${cuisine} cuisine has been removed from your preferences.`
      });
    } catch (error) {
      toast({
        title: "Failed to Remove",
        description: `Could not remove ${cuisine}. Please try again.`,
        variant: "destructive"
      });
    }
  };

  // NLP Culture Parser function
  // Research individual cuisine with Perplexity
  const handleResearchCuisine = async (cuisine: string) => {
    // Check if research is already in progress or completed
    if (loadingResearch[cuisine]) {
      return;
    }
    
    // Check cache first
    if (researchCache.has(cuisine)) {
      const cachedData = researchCache.get(cuisine)!;
      setResearchData(prev => ({ ...prev, [cuisine]: cachedData }));
      setShowResearch(true);
      
      // Log cache hit in localStorage
      try {
        const existingHistory = localStorage.getItem('perplexity-search-history') || '[]';
        const history = JSON.parse(existingHistory);
        const searchEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          query: `Cultural cuisine research: ${cuisine} (cached)`,
          timestamp: new Date().toISOString(),
          responseSize: JSON.stringify(cachedData).length,
          cached: true,
          category: 'cultural-cuisine',
          responsePreview: `Loaded cached data for ${cuisine} cuisine with ${cachedData.meals?.length || 0} dishes`,
          fullResponse: cachedData
        };
        history.unshift(searchEntry);
        if (history.length > 50) {
          history.splice(50);
        }
        localStorage.setItem('perplexity-search-history', JSON.stringify(history));
      } catch (storageError) {
        console.error('Failed to store cached search in localStorage:', storageError);
      }
      
      toast({
        title: "Research Loaded",
        description: `Using cached data for ${cuisine} cuisine.`
      });
      return;
    }
    
    if (researchData[cuisine]) {
      setShowResearch(true);
      return;
    }
    
    setLoadingResearch(prev => ({ ...prev, [cuisine]: true }));
    
    try {
      const response = await fetch('/api/cultural-cuisine-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuisine })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server responded with ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      const enhancedData = {
        ...data,
        research_completed_at: new Date().toISOString()
      };
      
      // Store in both state and cache
      setResearchData(prev => ({ ...prev, [cuisine]: enhancedData }));
      researchCache.set(cuisine, enhancedData);
      setShowResearch(true);
      
      // Also store in localStorage for Perplexity cache viewing
      try {
        const existingHistory = localStorage.getItem('perplexity-search-history') || '[]';
        const history = JSON.parse(existingHistory);
        const searchEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          query: `Cultural cuisine research: ${cuisine}`,
          timestamp: new Date().toISOString(),
          responseSize: JSON.stringify(enhancedData).length,
          cached: false,
          category: 'cultural-cuisine',
          responsePreview: `Found ${enhancedData.meals?.length || 0} authentic dishes from ${cuisine} cuisine`,
          fullResponse: enhancedData
        };
        history.unshift(searchEntry);
        // Keep only last 50 entries
        if (history.length > 50) {
          history.splice(50);
        }
        localStorage.setItem('perplexity-search-history', JSON.stringify(history));
      } catch (storageError) {
        console.error('Failed to store search in localStorage:', storageError);
      }
      
      toast({
        title: "Research Complete",
        description: `Detailed information for ${cuisine} cuisine loaded!`
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      toast({
        title: "Research Failed", 
        description: `Failed to load cuisine information: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setLoadingResearch(prev => ({ ...prev, [cuisine]: false }));
    }
  };

  const handleFreeTextCultureInput = async (text: string) => {
    setIsParsingCulture(true);
    try {
      const response = await fetch('/api/culture-parser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!response.ok) throw new Error('Failed to parse culture');
      
      const { cultureTags, needsManualReview } = await response.json();
      
      if (cultureTags && cultureTags.length > 0) {
        const currentCuisines = isEditing ? editingCuisines : displayedCuisines;
        const newTags = cultureTags.filter((tag: string) => !currentCuisines.includes(tag));
        
        if (newTags.length > 0) {
          if (isEditing) {
            setEditingCuisines([...editingCuisines, ...newTags]);
          } else {
            setPendingCuisines([...pendingCuisines, ...newTags]);
          }
        }
        
        toast({
          title: "Success",
          description: `Found ${cultureTags.length} cultural cuisine${cultureTags.length > 1 ? 's' : ''}: ${cultureTags.join(', ')}`
        });
      } else {
        toast({
          title: "No matches found",
          description: "Please try describing your cultural background differently or select from the dropdown.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to parse cultural input. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsParsingCulture(false);
    }
  };

  const popularCuisines = [
    'Italian', 'Mexican', 'Chinese', 'Indian', 'Japanese', 'Thai', 'French',
    'Greek', 'Korean', 'Lebanese', 'Peruvian', 'Vietnamese', 'Southern US'
  ];

  // Use the current saved cuisines for quick add buttons  
  const availableQuickCuisines = popularCuisines.filter(c => !culturalBackground.includes(c));
  


  return (
    <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-600" />
          Cultural Cuisine Preferences
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Cultural Preferences */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">
              Your Cultural Cuisines {culturalBackground.length > 0 && `(${culturalBackground.length})`}:
            </Label>
            {culturalBackground.length > 0 && (
              <Button
                onClick={() => setShowResearch(!showResearch)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-xs"
              >
                <Search className="h-3 w-3" />
                {showResearch ? 'Hide Research' : 'Show Research'}
              </Button>
            )}
          </div>
          
          {/* Show current cuisines with easy remove */}
          {culturalBackground.length > 0 ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {culturalBackground.map((cuisine: string, index: number) => (
                <div key={`${cuisine}-${index}`} className="flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-2 pr-1 pl-3 py-1"
                  >
                    <span>{cuisine}</span>
                    <button
                      onClick={() => handleQuickRemoveCuisine(cuisine)}
                      className="hover:bg-red-100 rounded-full p-0.5 transition-colors"
                      title={`Remove ${cuisine}`}
                    >
                      <X size={12} className="text-red-500 hover:text-red-700" />
                    </button>
                  </Badge>
                  <Button
                    onClick={() => handleResearchCuisine(cuisine)}
                    disabled={loadingResearch[cuisine]}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-emerald-100"
                    title={`Research ${cuisine} cuisine details`}
                  >
                    {loadingResearch[cuisine] ? (
                      <div className="animate-spin h-3 w-3 border border-emerald-500 border-t-transparent rounded-full" />
                    ) : (
                      <ExternalLink className="h-3 w-3 text-emerald-600" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              No cultural cuisines added yet. Add some below!
            </div>
          )}
        </div>

        {/* Quick Add Interface */}
        {!isEditing && (
          <div className="space-y-3">
            <Label className="text-sm font-medium">Add New Cuisine:</Label>
            <CulturalCuisineDropdown
              selectedCuisines={culturalBackground}
              onCuisineChange={async (newCuisines) => {
                // Find the newly added cuisine
                const addedCuisine = newCuisines.find(c => !culturalBackground.includes(c));
                if (addedCuisine) {
                  await handleAddQuickCuisine(addedCuisine);
                }
              }}
              placeholder="Search and instantly add cuisines..."
            />
          </div>
        )}



        {/* Quick Add Popular Cuisines */}
        {availableQuickCuisines.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Quick Add Popular Cuisines:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {availableQuickCuisines.slice(0, 8).map((cuisine, index) => (
                <Button
                  key={`${cuisine}-${index}`}
                  onClick={() => handleAddQuickCuisine(cuisine)}
                  variant="outline"
                  size="sm"
                  className="text-xs flex items-center gap-1 hover:bg-emerald-50 hover:border-emerald-300"
                >
                  <Plus className="h-3 w-3" />
                  {cuisine}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Editing Mode Interface */}
        {isEditing && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border-2 border-emerald-200">
            <div className="flex items-center gap-2 mb-3">
              <Edit3 className="h-4 w-4 text-emerald-600" />
              <Label className="font-medium">Edit Cultural Preferences</Label>
            </div>
            
            <CulturalCuisineDropdown
              selectedCuisines={editingCuisines}
              onCuisineChange={setEditingCuisines}
              placeholder="Search and add more cuisines..."
            />
            
            <CulturalFreeTextInput
              onSubmit={handleFreeTextCultureInput}
              isLoading={isParsingCulture}
            />
            
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSaveChanges}
                disabled={isSaving}
                className="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                onClick={handleCancelEditing}
                variant="outline"
                disabled={isSaving}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {culturalBackground.length === 0 && (
          <div className="text-center py-6 border-2 border-dashed border-gray-300 rounded-lg">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">Add Your Cultural Cuisines</h3>
            <p className="text-sm text-gray-500 mb-4">
              Tell us about your cultural background to get personalized meal recommendations
            </p>
          </div>
        )}

        {/* Research Results Display */}
        {showResearch && Object.keys(researchData).length > 0 && (
          <div className="mt-4 space-y-4">
            <Label className="text-sm font-medium text-emerald-800 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Detailed Cuisine Research Results
            </Label>
            
            {Object.entries(researchData).map(([cuisine, data]) => (
              <Card key={cuisine} className="border border-emerald-200 bg-emerald-50/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-emerald-800 flex items-center gap-2">
                      <ChefHat className="h-5 w-5" />
                      {cuisine} Cuisine Details
                    </CardTitle>
                    <Button
                      onClick={() => {
                        if (savedMeals[cuisine]) {
                          // Double-click to reset saved state
                          updateSavedMealsState(cuisine, false);
                          toast({
                            title: "Reset Saved State",
                            description: `${cuisine} meals save status has been reset`,
                            variant: "default"
                          });
                        } else {
                          handleSaveMeals(cuisine);
                        }
                      }}
                      disabled={savingMeals[cuisine]}
                      variant="outline"
                      size="sm"
                      className={`transition-all duration-300 ${
                        savedMeals[cuisine]
                          ? 'border-green-400 text-green-700 bg-green-50 hover:bg-green-100 cursor-pointer'
                          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                      }`}
                      title={savedMeals[cuisine] ? 'Click to reset saved status' : 'Save meals to your profile'}
                    >
                      {savingMeals[cuisine] ? (
                        <div className="animate-spin h-4 w-4 border border-emerald-500 border-t-transparent rounded-full" />
                      ) : savedMeals[cuisine] ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          ✓ Saved (Click to Reset)
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Save to Profile
                        </>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Authentic Meals */}
                  {data.meals && data.meals.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-emerald-700 mb-2">Authentic Dishes</h4>
                      <div className="grid gap-3">
                        {data.meals.map((meal, idx) => (
                          <div key={idx} className="bg-white p-3 rounded border">
                            <div className="font-medium text-sm text-gray-800">{meal.name}</div>
                            <div className="text-xs text-gray-600 mt-1">{meal.description}</div>
                            {meal.cooking_techniques && meal.cooking_techniques.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-blue-600">Cooking techniques:</div>
                                <div className="text-xs text-gray-600">
                                  {meal.cooking_techniques.join(', ')}
                                </div>
                              </div>
                            )}
                            {meal.healthy_modifications && meal.healthy_modifications.length > 0 && (
                              <div className="mt-2">
                                <div className="text-xs font-medium text-emerald-600">Healthy modifications:</div>
                                <div className="text-xs text-gray-600">
                                  {meal.healthy_modifications.join(', ')}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Information - NEW FORMAT ONLY */}
                  {data.summary && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {data.summary.common_healthy_ingredients && data.summary.common_healthy_ingredients.length > 0 && (
                        <div className="bg-white p-3 rounded border">
                          <h4 className="font-medium text-sm text-emerald-700 mb-2">Common Healthy Ingredients</h4>
                          <div className="text-xs text-gray-600">
                            {data.summary.common_healthy_ingredients.join(', ')}
                          </div>
                        </div>
                      )}
                      
                      {data.summary.common_cooking_techniques && data.summary.common_cooking_techniques.length > 0 && (
                        <div className="bg-white p-3 rounded border">
                          <h4 className="font-medium text-sm text-emerald-700 mb-2">Common Cooking Techniques</h4>
                          <div className="text-xs text-gray-600">
                            {data.summary.common_cooking_techniques.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Cultural Data Preview */}
        {showPreviewData && culturalBackground.length > 0 && (
          <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <Label className="text-sm font-medium text-emerald-800 flex items-center gap-2">
              <ChefHat className="h-4 w-4" />
              Cultural Cuisine Data Preview
            </Label>
            <div className="text-xs text-emerald-700 mt-1 mb-3">
              AI-generated authentic dishes and ingredients from your cultural background
            </div>
            
            <div className="space-y-3">
              {culturalBackground.slice(0, 2).map((cuisine: string) => (
                <div key={cuisine} className="bg-white p-3 rounded border">
                  <div className="font-medium text-sm text-emerald-800 mb-2">{cuisine} Cuisine</div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div><strong>Sample dishes:</strong> Traditional staples, regional specialties</div>
                    <div><strong>Key ingredients:</strong> Common proteins, vegetables, spices</div>
                    <div><strong>Cooking styles:</strong> Traditional methods and techniques</div>
                    <div><strong>Health benefits:</strong> Nutritional advantages and dietary patterns</div>
                  </div>
                </div>
              ))}
              {culturalBackground.length > 2 && (
                <div className="text-xs text-gray-500 text-center">
                  +{culturalBackground.length - 2} more cuisines...
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}