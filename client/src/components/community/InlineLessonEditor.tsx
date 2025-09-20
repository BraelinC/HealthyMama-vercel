import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  ChevronLeft,
  Target,
  ListChecks,
  Info,
  Play,
  MessageCircle,
  BarChart3,
  FileText,
  Image,
  Video,
  Clock,
  Upload,
  X,
  ChefHat,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import RecipeDisplay from "@/components/RecipeDisplay";

interface InlineLessonEditorProps {
  lesson: any;
  communityId: string;
  courseId: number;
  isCreator: boolean;
  onClose: () => void;
}

// Helper functions for rich recipe data support
const formatIngredientForDisplay = (ingredient: string | any): string => {
  if (typeof ingredient === 'string') return ingredient;
  // Rich ingredient object format: {id, amount, unit, name}
  if (ingredient && typeof ingredient === 'object') {
    const { amount, unit, name } = ingredient;
    return `${amount || ''} ${unit || ''} ${name || ''}`.trim();
  }
  return String(ingredient || '');
};

const formatInstructionForDisplay = (instruction: string | any, index: number): { step: number, text: string } => {
  if (typeof instruction === 'string') {
    return { step: index + 1, text: instruction };
  }
  // Rich instruction object format: {id, step, text}
  if (instruction && typeof instruction === 'object') {
    return { 
      step: instruction.step || index + 1, 
      text: instruction.text || String(instruction) 
    };
  }
  return { step: index + 1, text: String(instruction || '') };
};

const isRichRecipeData = (lesson: any): boolean => {
  // Check if ingredients or instructions contain objects rather than strings
  const hasRichIngredients = lesson?.ingredients?.length > 0 && 
    typeof lesson.ingredients[0] === 'object' && 
    lesson.ingredients[0].hasOwnProperty('amount');
  const hasRichInstructions = lesson?.instructions?.length > 0 && 
    typeof lesson.instructions[0] === 'object' && 
    lesson.instructions[0].hasOwnProperty('step');
  return hasRichIngredients || hasRichInstructions;
};

export default function InlineLessonEditor({ 
  lesson, 
  communityId, 
  courseId, 
  isCreator, 
  onClose 
}: InlineLessonEditorProps) {
  const normalizeYoutubeId = (input: string): string => {
    if (!input) return "";
    const match = input.match(/(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:shorts\/|watch\?v=|embed\/|v\/)?([\w-]{11})/i);
    if (match && match[1]) return match[1];
    return input;
  };

  const buildYoutubeEmbedUrl = (input: string): string => {
    const id = normalizeYoutubeId(input);
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : "";
  };

  const mapLessonToRecipe = (src: any) => {
    const safeIngredients = Array.isArray(src?.ingredients) ? src.ingredients : [];
    const safeInstructions = Array.isArray(src?.instructions) ? src.instructions : [];
    return {
      id: src?.id,
      title: src?.title || src?.recipe_name || "Lesson",
      description: src?.description || "",
      image_url: src?.image_url || "",
      time_minutes: (src?.prep_time || 0) + (src?.cook_time || 0) || undefined,
      cuisine: src?.cuisine || undefined,
      diet: src?.meal_type || undefined,
      video_id: normalizeYoutubeId(src?.youtube_video_id || "") || undefined,
      ingredients: safeIngredients.map((ing: any) => {
        if (typeof ing === 'string') {
          return { name: ing, display_text: ing, measurements: [] };
        }
        const display = `${ing?.amount ?? ''} ${ing?.unit ?? ''} ${ing?.name ?? ''}`.trim();
        return {
          name: ing?.name || display,
          display_text: display || ing?.name || '',
          measurements: ing?.amount || ing?.unit ? [{ quantity: ing?.amount || '', unit: ing?.unit || '' }] : []
        };
      }),
      instructions: safeInstructions.map((step: any, idx: number) => {
        if (typeof step === 'string') return step;
        return step?.text || `Step ${step?.step || idx + 1}`;
      }),
      nutrition_info: src?.nutrition_info || undefined,
    } as any;
  };
  // If not a creator, show simple student view
  if (!isCreator) {
    return (
      <div className="bg-gray-100 min-h-screen">
        <div className="bg-white border-b border-gray-200 p-3 sticky top-0 z-50">
          <div className="max-w-md mx-auto flex items-center">
            <Button onClick={onClose} variant="ghost" className="text-gray-600 px-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base font-semibold ml-1">Preview</h1>
          </div>
        </div>
        <div className="max-w-md mx-auto p-3">
          <RecipeDisplay recipe={mapLessonToRecipe(lesson)} />
        </div>
      </div>
    );
  }

  // Creator editing state
  const [isEditing, setIsEditing] = useState(false);
  const [lessonData, setLessonData] = useState({
    title: lesson?.title || "",
    description: lesson?.description || "",
    servings: lesson?.servings || 4,
    difficulty_level: lesson?.difficulty_level || 1,
    youtube_video_id: lesson?.youtube_video_id || "",
    image_url: lesson?.image_url || "",
    ingredients: lesson?.ingredients || [],
    instructions: lesson?.instructions || [],
    nutrition_info: lesson?.nutrition_info || {},
  });

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Section toggles for lesson components - use preview sectionStates if available
  const [sectionToggles, setSectionToggles] = useState({
    image_enabled: lesson?.sectionStates?.mediaVideo ?? !!(lesson?.image_url),
    video_enabled: lesson?.sectionStates?.mediaVideo ?? !!(lesson?.youtube_video_id),
    content_enabled: lesson?.sectionStates?.basicInfo ?? true,
    recipe_enabled: lesson?.sectionStates?.recipeDetails ?? !!(lesson?.ingredients?.length || lesson?.instructions?.length),
    lesson_sections_enabled: lesson?.sectionStates?.lessonSections ?? true,
  });

  // Interactive feature toggles
  const [interactiveFeatures, setInteractiveFeatures] = useState({
    comments_enabled: lesson?.comments_enabled || false,
    poll_enabled: lesson?.poll_enabled || false,
    notes_enabled: lesson?.notes_enabled || false,
    timer_enabled: lesson?.timer_enabled || false,
    image_enabled: lesson?.image_enabled || false,
    video_enabled: lesson?.video_enabled || false,
  });

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Extract YouTube video ID from URL
  const handleYouTubeUrl = (url: string) => {
    setYoutubeUrl(url);
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
      setLessonData({ ...lessonData, youtube_video_id: videoId });
    }
  };

  const extractYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  // Image upload functionality
  const uploadImage = async (file: File): Promise<string> => {
    try {
      // Get upload URL from backend
      const response = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentType: file.type }),
      });

      if (!response.ok) {
        throw new Error('Failed to get upload URL');
      }

      const { uploadURL } = await response.json();

      // Upload file directly to object storage
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image');
      }

      // Return the object path that can be accessed via our server
      const url = new URL(uploadURL);
      const objectPath = url.pathname;
      const objectId = objectPath.split('/').pop()?.split('?')[0];
      
      const serverPath = `/objects/uploads/${objectId}`;
      console.log('Upload successful. Server path:', serverPath);
      return serverPath;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const file = files[0]; // Only take the first file for lesson image
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select only image files.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select images smaller than 10MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const imageUrl = await uploadImage(file);
      setLessonData({ ...lessonData, image_url: imageUrl });
      
      toast({
        title: "Image uploaded",
        description: "Lesson image uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const openFileSelector = () => {
    fileInputRef.current?.click();
  };

  const removeImage = () => {
    setLessonData({ ...lessonData, image_url: "" });
  };

  // Save lesson mutation
  const saveLessonMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(`/api/communities/${communityId}/courses/${courseId}/lessons/${lesson.id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "✅ Lesson saved",
        description: "Your changes have been saved successfully.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({
        queryKey: [`/api/communities/${communityId}/courses/${courseId}/lessons`],
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Error saving lesson",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const dataToSave = {
      ...lessonData,
      ...interactiveFeatures
    };
    saveLessonMutation.mutate(dataToSave);
  };

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              onClick={onClose}
              variant="ghost" 
              className="text-gray-400 hover:text-white p-2"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-xl font-bold text-white">{lessonData.title || "Untitled Lesson"}</h1>
                <p className="text-sm text-gray-400">
                  {isEditing ? "Editing" : "Viewing"} • Course Lesson
                </p>
              </div>
            </div>
            {lesson?.is_published && (
              <Badge variant="outline" className="border-green-500 text-green-400 ml-4">
                Published
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <Button 
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={saveLessonMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saveLessonMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setIsEditing(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Edit Lesson
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-6">
        {isEditing ? (
          /* Simplified Creator Editing with Section Toggles */
          <div className="max-w-2xl mx-auto space-y-6">
            
            
            {/* 1. Image Import at Top */}
            <Card className="bg-gray-800 border-gray-700 relative">
              {/* Toggle switch in corner */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                <Image className="w-3 h-3 text-gray-400" />
                <div
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    sectionToggles.image_enabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                  onClick={() => {
                    setSectionToggles({
                      ...sectionToggles,
                      image_enabled: !sectionToggles.image_enabled
                    });
                  }}
                >
                  <div
                    className={`transform transition-transform duration-200 ease-in-out h-4 w-4 rounded-full bg-white shadow ${
                      sectionToggles.image_enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
              <CardContent className={`p-6 transition-opacity duration-200 ${
                sectionToggles.image_enabled ? 'opacity-100' : 'opacity-30'
              }`}>
                <div className="text-center space-y-4">
                  {lessonData.image_url ? (
                    <div className="relative w-full h-48 bg-gray-700 rounded-lg overflow-hidden">
                      <img 
                        src={lessonData.image_url} 
                        alt="Lesson" 
                        className="w-full h-full object-cover"
                      />
                      <Button 
                        variant="destructive"
                        size="sm"
                        onClick={removeImage}
                        className="absolute top-2 right-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div 
                      className="w-full h-48 bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 flex items-center justify-center hover:border-gray-500 transition-colors cursor-pointer"
                      onClick={openFileSelector}
                    >
                      <div className="text-center">
                        <Image className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-400 mb-3 text-sm">Import lesson image</p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={uploading}
                          className="bg-gray-600 border-gray-500 hover:bg-gray-500 text-white"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploading ? "Uploading..." : "Upload Image"}
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelect(e.target.files)}
                    className="hidden"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 2. YouTube Video Section */}
            <Card className="bg-gray-800 border-gray-700 relative">
              {/* Toggle switch in corner */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                <Video className="w-3 h-3 text-gray-400" />
                <div
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    sectionToggles.video_enabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                  onClick={() => {
                    setSectionToggles({
                      ...sectionToggles,
                      video_enabled: !sectionToggles.video_enabled
                    });
                  }}
                >
                  <div
                    className={`transform transition-transform duration-200 ease-in-out h-4 w-4 rounded-full bg-white shadow ${
                      sectionToggles.video_enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
              <CardContent className={`p-6 space-y-4 transition-opacity duration-200 ${
                sectionToggles.video_enabled ? 'opacity-100' : 'opacity-30'
              }`}>
                {/* YouTube URL */}
                <input
                  type="text"
                  placeholder="YouTube URL (optional) - https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => handleYouTubeUrl(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none placeholder-gray-400"
                />
                
                {/* YouTube Video Preview */}
                {lessonData.youtube_video_id && (
                  <div className="space-y-2">
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-600">
                      <iframe
                        src={buildYoutubeEmbedUrl(lessonData.youtube_video_id)}
                        title="YouTube video preview"
                        className="w-full h-full"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <p className="text-xs text-gray-400">Video will be embedded in your lesson</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 3. Simple Content Box */}
            <Card className="bg-gray-800 border-gray-700 relative">
              {/* Toggle switch in corner */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                <FileText className="w-3 h-3 text-gray-400" />
                <div
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    sectionToggles.content_enabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                  onClick={() => {
                    setSectionToggles({
                      ...sectionToggles,
                      content_enabled: !sectionToggles.content_enabled
                    });
                  }}
                >
                  <div
                    className={`transform transition-transform duration-200 ease-in-out h-4 w-4 rounded-full bg-white shadow ${
                      sectionToggles.content_enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
              <CardContent className={`p-6 space-y-4 transition-opacity duration-200 ${
                sectionToggles.content_enabled ? 'opacity-100' : 'opacity-30'
              }`}>
                {/* Title */}
                <input
                  type="text"
                  placeholder="Lesson Title"
                  value={lessonData.title}
                  onChange={(e) => setLessonData({...lessonData, title: e.target.value})}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-3 border border-gray-600 focus:border-purple-500 focus:outline-none text-xl font-medium placeholder-gray-400"
                />
                
                {/* Content */}
                <textarea
                  placeholder="Write your lesson content here..."
                  value={lessonData.description}
                  onChange={(e) => setLessonData({...lessonData, description: e.target.value})}
                  className="w-full bg-gray-700 text-white rounded-lg px-4 py-4 border border-gray-600 focus:border-purple-500 focus:outline-none resize-none placeholder-gray-400"
                  rows={12}
                />
              </CardContent>
            </Card>

            {/* 4. Recipe Data Section */}
            <Card className="bg-gray-800 border-gray-700 relative">
              {/* Toggle switch in corner */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                <ChefHat className="w-3 h-3 text-gray-400" />
                <div
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                    sectionToggles.recipe_enabled ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                  onClick={() => {
                    setSectionToggles({
                      ...sectionToggles,
                      recipe_enabled: !sectionToggles.recipe_enabled
                    });
                  }}
                >
                  <div
                    className={`transform transition-transform duration-200 ease-in-out h-4 w-4 rounded-full bg-white shadow ${
                      sectionToggles.recipe_enabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
              <CardContent className={`p-6 transition-opacity duration-200 ${
                sectionToggles.recipe_enabled ? 'opacity-100' : 'opacity-30'
              }`}>
                <Tabs defaultValue="ingredients" className="w-full">
                  <TabsList className="w-full grid grid-cols-3 h-10 bg-gray-700 rounded-lg">
                    <TabsTrigger value="ingredients" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">Ingredients</TabsTrigger>
                    <TabsTrigger value="instructions" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">Instructions</TabsTrigger>
                    <TabsTrigger value="nutrition" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">Nutrition</TabsTrigger>
                  </TabsList>

                  <TabsContent value="ingredients" className="p-4 pt-3">
                    <div className="space-y-3">
                      {lessonData.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={formatIngredientForDisplay(ingredient)}
                            onChange={(e) => {
                              const newIngredients = [...lessonData.ingredients];
                              newIngredients[index] = e.target.value;
                              setLessonData({...lessonData, ingredients: newIngredients});
                            }}
                            className="flex-1 bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                            placeholder="Enter ingredient..."
                          />
                          <Button
                            onClick={() => {
                              const newIngredients = lessonData.ingredients.filter((_, i) => i !== index);
                              setLessonData({...lessonData, ingredients: newIngredients});
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => {
                          setLessonData({...lessonData, ingredients: [...lessonData.ingredients, ""]});
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Ingredient
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="instructions" className="p-4 pt-3">
                    <div className="space-y-3">
                      {lessonData.instructions.map((instruction, index) => {
                        const formattedInstruction = formatInstructionForDisplay(instruction, index);
                        return (
                          <div key={index} className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-6 h-6 bg-purple-600 rounded-full text-white flex items-center justify-center text-xs mt-1">
                              {formattedInstruction.step}
                            </span>
                            <textarea
                              value={formattedInstruction.text}
                              onChange={(e) => {
                                const newInstructions = [...lessonData.instructions];
                                newInstructions[index] = e.target.value;
                                setLessonData({...lessonData, instructions: newInstructions});
                              }}
                              className="flex-1 bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none resize-none"
                              placeholder="Enter instruction step..."
                              rows={2}
                            />
                          <Button
                            onClick={() => {
                              const newInstructions = lessonData.instructions.filter((_, i) => i !== index);
                              setLessonData({...lessonData, instructions: newInstructions});
                            }}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-2 mt-1"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        );
                      })}
                      <Button
                        onClick={() => {
                          setLessonData({...lessonData, instructions: [...lessonData.instructions, ""]});
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Step
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="nutrition" className="p-4 pt-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Calories</label>
                        <input
                          type="number"
                          value={lessonData.nutrition_info.calories || ''}
                          onChange={(e) => {
                            setLessonData({
                              ...lessonData, 
                              nutrition_info: {
                                ...lessonData.nutrition_info,
                                calories: parseInt(e.target.value) || 0
                              }
                            });
                          }}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Protein (g)</label>
                        <input
                          type="number"
                          value={lessonData.nutrition_info.protein_g || ''}
                          onChange={(e) => {
                            setLessonData({
                              ...lessonData, 
                              nutrition_info: {
                                ...lessonData.nutrition_info,
                                protein_g: parseInt(e.target.value) || 0
                              }
                            });
                          }}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Carbs (g)</label>
                        <input
                          type="number"
                          value={lessonData.nutrition_info.carbs_g || ''}
                          onChange={(e) => {
                            setLessonData({
                              ...lessonData, 
                              nutrition_info: {
                                ...lessonData.nutrition_info,
                                carbs_g: parseInt(e.target.value) || 0
                              }
                            });
                          }}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Fat (g)</label>
                        <input
                          type="number"
                          value={lessonData.nutrition_info.fat_g || ''}
                          onChange={(e) => {
                            setLessonData({
                              ...lessonData, 
                              nutrition_info: {
                                ...lessonData.nutrition_info,
                                fat_g: parseInt(e.target.value) || 0
                              }
                            });
                          }}
                          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-purple-500 focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

          </div>
        ) : (
          /* Student View Layout */
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white">{lessonData.title}</h2>
                  </div>
                </div>

                {lessonData.image_url && sectionToggles.image_enabled && (
                  <div className="mb-6">
                    <img 
                      src={lessonData.image_url} 
                      alt="Lesson" 
                      className="w-full h-48 object-cover rounded-lg border border-gray-600"
                    />
                  </div>
                )}

                {lessonData.youtube_video_id && sectionToggles.video_enabled && (
                  <div className="mb-6">
                    <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-600">
                      <iframe
                        src={buildYoutubeEmbedUrl(lessonData.youtube_video_id)}
                        title="Lesson video"
                        className="w-full h-full"
                        frameBorder="0"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )}

                {lessonData.description && sectionToggles.content_enabled && (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {lessonData.description.split('\n').map((line: string, index: number) => {
                        if (line.startsWith('##')) {
                          return <h3 key={index} className="text-white font-semibold mt-6 mb-3 text-xl">{line.replace('##', '').trim()}</h3>;
                        }
                        if (line.startsWith('•')) {
                          return <li key={index} className="ml-6 list-disc mb-1">{line.replace('•', '').trim()}</li>;
                        }
                        if (line.match(/^\d+\./)) {
                          return <li key={index} className="ml-6 list-decimal mb-1">{line.replace(/^\d+\./, '').trim()}</li>;
                        }
                        if (line.startsWith('---')) {
                          return <hr key={index} className="my-6 border-gray-600" />;
                        }
                        if (line.trim()) {
                          return <p key={index} className="mb-3">{line}</p>;
                        }
                        return <br key={index} />;
                      })}
                    </div>
                  </div>
                )}

                {/* Recipe Data Display */}
                {sectionToggles.recipe_enabled && (
                  <div className="mt-6">
                    {/* Recipe Basics Display */}
                    {(lessonData.recipe_name || lessonData.meal_type || lessonData.cuisine || lessonData.difficulty_level) && (
                      <div className="mb-4 p-4 bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-semibold text-white">
                            {lessonData.recipe_name || lessonData.title}
                          </h3>
                          {lessonData.difficulty_level && (
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-4 h-4 ${
                                    i < lessonData.difficulty_level
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-600"
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {lessonData.meal_type && (
                            <Badge variant="outline" className="border-purple-500 text-purple-400">
                              {lessonData.meal_type}
                            </Badge>
                          )}
                          {lessonData.cuisine && (
                            <Badge variant="outline" className="border-green-500 text-green-400">
                              {lessonData.cuisine}
                            </Badge>
                          )}
                          {(lessonData.prep_time || lessonData.cook_time) && (
                            <Badge variant="outline" className="border-blue-500 text-blue-400">
                              <Clock className="w-3 h-3 mr-1" />
                              {((lessonData.prep_time || 0) + (lessonData.cook_time || 0))} min
                            </Badge>
                          )}
                          {lessonData.servings && (
                            <Badge variant="outline" className="border-orange-500 text-orange-400">
                              <Users className="w-3 h-3 mr-1" />
                              {lessonData.servings} servings
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <Tabs defaultValue="ingredients" className="w-full">
                      <TabsList className="w-full grid grid-cols-3 h-10 bg-gray-700 rounded-lg">
                        <TabsTrigger value="ingredients" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">Ingredients</TabsTrigger>
                        <TabsTrigger value="instructions" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">Instructions</TabsTrigger>
                        <TabsTrigger value="nutrition" className="text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white text-gray-300">Nutrition</TabsTrigger>
                      </TabsList>

                      <TabsContent value="ingredients" className="p-4 pt-3">
                        {lessonData.ingredients.length > 0 ? (
                          <ul className="space-y-2">
                            {lessonData.ingredients.map((ingredient, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-gray-300">
                                <span className="text-purple-400">•</span>
                                {formatIngredientForDisplay(ingredient)}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-4">No ingredients added yet</p>
                        )}
                      </TabsContent>

                      <TabsContent value="instructions" className="p-4 pt-3">
                        {lessonData.instructions.length > 0 ? (
                          <ol className="space-y-3">
                            {lessonData.instructions.map((step, index) => {
                              const formattedInstruction = formatInstructionForDisplay(step, index);
                              return (
                                <li key={index} className="flex gap-2 text-sm">
                                  <span className="flex-shrink-0 w-5 h-5 bg-purple-600 rounded-full text-white flex items-center justify-center text-xs">
                                    {formattedInstruction.step}
                                  </span>
                                  <span className="text-gray-300">{formattedInstruction.text}</span>
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-4">No instructions added yet</p>
                        )}
                      </TabsContent>

                      <TabsContent value="nutrition" className="p-4 pt-3">
                        {lessonData.nutrition_info && Object.keys(lessonData.nutrition_info).length > 0 ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-gray-700 rounded-lg">
                              <div className="text-lg font-semibold text-white">{lessonData.nutrition_info.calories || 0}</div>
                              <div className="text-sm text-gray-400">Calories</div>
                            </div>
                            <div className="text-center p-3 bg-gray-700 rounded-lg">
                              <div className="text-lg font-semibold text-white">{lessonData.nutrition_info.protein_g || 0}g</div>
                              <div className="text-sm text-gray-400">Protein</div>
                            </div>
                            <div className="text-center p-3 bg-gray-700 rounded-lg">
                              <div className="text-lg font-semibold text-white">{lessonData.nutrition_info.carbs_g || 0}g</div>
                              <div className="text-sm text-gray-400">Carbs</div>
                            </div>
                            <div className="text-center p-3 bg-gray-700 rounded-lg">
                              <div className="text-lg font-semibold text-white">{lessonData.nutrition_info.fat_g || 0}g</div>
                              <div className="text-sm text-gray-400">Fat</div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm text-center py-4">No nutrition information added yet</p>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {/* Lesson Sections Display */}
                {sectionToggles.lesson_sections_enabled && lessonData.lesson_sections && lessonData.lesson_sections.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Lesson Sections</h3>
                    <div className="space-y-4">
                      {lessonData.lesson_sections.map((section: any, index: number) => (
                        <div key={index} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">{section.emoji || '📝'}</span>
                            <h4 className="text-white font-medium">{section.title || `Section ${index + 1}`}</h4>
                          </div>
                          {section.content && (
                            <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                              {section.content}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Features Section */}
                <div className="mt-6 space-y-4">
                  {interactiveFeatures.comments_enabled && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <MessageCircle className="w-4 h-4 text-purple-400" />
                        <h4 className="text-white font-medium">Discussion</h4>
                      </div>
                      <p className="text-gray-300 text-sm">Comments are enabled for this lesson. Students can share their thoughts and ask questions.</p>
                    </div>
                  )}
                  
                  {interactiveFeatures.poll_enabled && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="w-4 h-4 text-purple-400" />
                        <h4 className="text-white font-medium">Poll</h4>
                      </div>
                      <p className="text-gray-300 text-sm">Interactive poll is available for student engagement.</p>
                    </div>
                  )}
                  
                  {interactiveFeatures.notes_enabled && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <h4 className="text-white font-medium">Notes</h4>
                      </div>
                      <p className="text-gray-300 text-sm">Students can take and save notes for this lesson.</p>
                    </div>
                  )}
                  
                  {interactiveFeatures.timer_enabled && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-purple-400" />
                        <h4 className="text-white font-medium">Timer</h4>
                      </div>
                      <p className="text-gray-300 text-sm">Built-in timer functionality is available for timed activities.</p>
                    </div>
                  )}
                  
                  {interactiveFeatures.image_enabled && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Image className="w-4 h-4 text-purple-400" />
                        <h4 className="text-white font-medium">Image Upload</h4>
                      </div>
                      <p className="text-gray-300 text-sm">Students can upload and share images related to this lesson.</p>
                    </div>
                  )}
                  
                  {interactiveFeatures.video_enabled && (
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Video className="w-4 h-4 text-purple-400" />
                        <h4 className="text-white font-medium">Video Content</h4>
                      </div>
                      <p className="text-gray-300 text-sm">Video sharing and discussion features are enabled for this lesson.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
