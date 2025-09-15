import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Save,
  X,
  ChefHat,
  Clock,
  Users,
  Play,
  FileText,
  Target,
  ListChecks,
  Info,
  ShoppingCart,
  Lightbulb,
  BookOpen,
  TrendingUp,
  Heart,
  GripVertical,
  Trash2,
  Edit,
  Video,
  Youtube,
  Image,
  Upload,
  MessageSquare,
  BarChart3,
  Settings,
  Eye,
  EyeOff,
} from "lucide-react";

interface Lesson {
  id?: number;
  course_id: number;
  module_id?: number;
  title: string;
  emoji?: string;
  description?: string;
  video_url?: string;
  youtube_video_id?: string;
  image_url?: string;
  ingredients: string[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  servings: number;
  difficulty_level: number;
  lesson_order: number;
  is_published: boolean;
  nutrition_info?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  sections?: LessonSection[];
  meal_plans?: any[];
}

interface LessonSection {
  id?: number;
  section_type: "about" | "key_takeaways" | "action_steps" | "resources" | "custom";
  title: string;
  content: string;
  template_id?: string;
  display_order: number;
  is_visible?: boolean;
}

interface ContentToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: any;
}

interface EnhancedLessonEditorProps {
  lesson?: Lesson;
  communityId: string;
  courseId: number;
  moduleId?: number;
  onClose: () => void;
  onSave?: (lesson: Lesson) => void;
}

// Extract YouTube video ID from various URL formats
const extractYouTubeVideoId = (url: string): string => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
  const match = url.match(regex);
  return match ? match[1] : url;
};

export default function EnhancedLessonEditor({
  lesson,
  communityId,
  courseId,
  moduleId,
  onClose,
  onSave,
}: EnhancedLessonEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [lessonData, setLessonData] = useState<Lesson>({
    course_id: courseId,
    module_id: moduleId,
    title: lesson?.title || "",
    emoji: lesson?.emoji || "🍽️",
    description: lesson?.description || "",
    video_url: lesson?.video_url || "",
    youtube_video_id: lesson?.youtube_video_id || "",
    image_url: lesson?.image_url || "",
    ingredients: lesson?.ingredients || [""],
    instructions: lesson?.instructions || [""],
    prep_time: lesson?.prep_time || 15,
    cook_time: lesson?.cook_time || 30,
    servings: lesson?.servings || 4,
    difficulty_level: lesson?.difficulty_level || 2,
    lesson_order: lesson?.lesson_order || 1,
    is_published: lesson?.is_published || false,
    nutrition_info: lesson?.nutrition_info || { calories: 0, protein: 0, carbs: 0, fat: 0 },
    sections: lesson?.sections || [],
    ...lesson,
  });

  const [contentToggles, setContentToggles] = useState<ContentToggle[]>([
    {
      id: "comments",
      label: "Comments",
      description: "Allow members to comment on this lesson",
      enabled: true,
      icon: MessageSquare,
    },
    {
      id: "polls",
      label: "Polls & Quizzes",
      description: "Add interactive polls and quizzes",
      enabled: false,
      icon: BarChart3,
    },
    {
      id: "recipe_card",
      label: "Recipe Card",
      description: "Show formatted recipe card",
      enabled: true,
      icon: ChefHat,
    },
    {
      id: "nutrition",
      label: "Nutrition Info",
      description: "Display nutrition information",
      enabled: true,
      icon: Target,
    },
    {
      id: "shopping_list",
      label: "Shopping List",
      description: "Generate shopping list from ingredients",
      enabled: true,
      icon: ShoppingCart,
    },
  ]);

  const [activeTab, setActiveTab] = useState("content");
  const [youtubeUrl, setYoutubeUrl] = useState("");

  // Handle YouTube URL input
  const handleYouTubeUrl = (url: string) => {
    setYoutubeUrl(url);
    if (url) {
      const videoId = extractYouTubeVideoId(url);
      setLessonData({ ...lessonData, youtube_video_id: videoId });
    } else {
      setLessonData({ ...lessonData, youtube_video_id: "" });
    }
  };

  // Toggle content feature
  const toggleContent = (toggleId: string) => {
    setContentToggles(toggles =>
      toggles.map(toggle =>
        toggle.id === toggleId ? { ...toggle, enabled: !toggle.enabled } : toggle
      )
    );
  };

  // Save lesson mutation
  const saveLessonMutation = useMutation({
    mutationFn: async (data: Lesson) => {
      const url = lesson?.id
        ? `/api/communities/${communityId}/courses/${courseId}/lessons/${lesson.id}`
        : `/api/communities/${communityId}/courses/${courseId}/lessons`;
      
      const method = lesson?.id ? "PUT" : "POST";
      
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${lesson?.id ? "update" : "create"} lesson`);
      }

      return response.json();
    },
    onSuccess: (savedLesson) => {
      toast({
        title: "Success",
        description: `Lesson ${lesson?.id ? "updated" : "created"} successfully!`,
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/communities/${communityId}/courses/${courseId}/lessons`],
      });
      onSave?.(savedLesson);
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${lesson?.id ? "update" : "create"} lesson. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!lessonData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a lesson title.",
        variant: "destructive",
      });
      return;
    }

    saveLessonMutation.mutate(lessonData);
  };

  // Add ingredient
  const addIngredient = () => {
    setLessonData({
      ...lessonData,
      ingredients: [...lessonData.ingredients, ""],
    });
  };

  // Remove ingredient
  const removeIngredient = (index: number) => {
    setLessonData({
      ...lessonData,
      ingredients: lessonData.ingredients.filter((_, i) => i !== index),
    });
  };

  // Update ingredient
  const updateIngredient = (index: number, value: string) => {
    const newIngredients = [...lessonData.ingredients];
    newIngredients[index] = value;
    setLessonData({ ...lessonData, ingredients: newIngredients });
  };

  // Add instruction
  const addInstruction = () => {
    setLessonData({
      ...lessonData,
      instructions: [...lessonData.instructions, ""],
    });
  };

  // Remove instruction
  const removeInstruction = (index: number) => {
    setLessonData({
      ...lessonData,
      instructions: lessonData.instructions.filter((_, i) => i !== index),
    });
  };

  // Update instruction
  const updateInstruction = (index: number, value: string) => {
    const newInstructions = [...lessonData.instructions];
    newInstructions[index] = value;
    setLessonData({ ...lessonData, instructions: newInstructions });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {lesson?.id ? "Edit Lesson" : "Create New Lesson"}
              </h1>
              <p className="text-sm text-gray-400">Design your course content</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={saveLessonMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveLessonMutation.isPending ? "Saving..." : "Save Lesson"}
            </Button>
            <Button onClick={onClose} variant="ghost" className="text-gray-400">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Editor */}
          <div className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
              <TabsList className="w-full bg-gray-800 border-b border-gray-700 rounded-none">
                <TabsTrigger value="content" className="flex-1">
                  <FileText className="w-4 h-4 mr-2" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="video" className="flex-1">
                  <Youtube className="w-4 h-4 mr-2" />
                  Video
                </TabsTrigger>
                <TabsTrigger value="recipe" className="flex-1">
                  <ChefHat className="w-4 h-4 mr-2" />
                  Recipe
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex-1">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              {/* Content Tab */}
              <TabsContent value="content" className="p-6 space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Basic Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-gray-300">Lesson Title</Label>
                        <Input
                          value={lessonData.title}
                          onChange={(e) => setLessonData({ ...lessonData, title: e.target.value })}
                          placeholder="e.g., Perfect Pasta Techniques"
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Emoji</Label>
                        <Input
                          value={lessonData.emoji}
                          onChange={(e) => setLessonData({ ...lessonData, emoji: e.target.value })}
                          placeholder="🍝"
                          className="bg-gray-700 border-gray-600 text-white"
                          maxLength={2}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-300">Lesson Content</Label>
                      <Textarea
                        value={lessonData.description}
                        onChange={(e) => setLessonData({ ...lessonData, description: e.target.value })}
                        placeholder="Write your lesson content here... Add instructions, key points, explanations, etc."
                        className="bg-gray-700 border-gray-600 text-white min-h-[200px]"
                        rows={8}
                      />
                      <p className="text-xs text-gray-400 mt-1">Tip: Use clear headings, bullet points, and step-by-step instructions</p>
                    </div>

                    {/* Quick Content Templates */}
                    <div>
                      <Label className="text-gray-300 mb-3 block">Quick Content Templates</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700 justify-start h-auto p-3"
                          onClick={() => {
                            const currentContent = lessonData.description;
                            setLessonData({
                              ...lessonData,
                              description: currentContent + "\n\n## Key Points\n• \n• \n• \n"
                            });
                          }}
                        >
                          <div className="text-left">
                            <div className="flex items-center">
                              <Target className="w-4 h-4 mr-2" />
                              Key Points
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Add bullet points</p>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700 justify-start h-auto p-3"
                          onClick={() => {
                            const currentContent = lessonData.description;
                            setLessonData({
                              ...lessonData,
                              description: currentContent + "\n\n## Steps to Follow\n1. \n2. \n3. \n"
                            });
                          }}
                        >
                          <div className="text-left">
                            <div className="flex items-center">
                              <ListChecks className="w-4 h-4 mr-2" />
                              Step List
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Numbered steps</p>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700 justify-start h-auto p-3"
                          onClick={() => {
                            const currentContent = lessonData.description;
                            setLessonData({
                              ...lessonData,
                              description: currentContent + "\n\n## 💡 Pro Tip\n\n"
                            });
                          }}
                        >
                          <div className="text-left">
                            <div className="flex items-center">
                              <Info className="w-4 h-4 mr-2" />
                              Pro Tip
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Important note</p>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700 justify-start h-auto p-3"
                          onClick={() => {
                            const currentContent = lessonData.description;
                            setLessonData({
                              ...lessonData,
                              description: currentContent + "\n\n---\n\n## Next Section\n\n"
                            });
                          }}
                        >
                          <div className="text-left">
                            <div className="flex items-center">
                              <Plus className="w-4 h-4 mr-2" />
                              Section Break
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Add separator</p>
                          </div>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Content Toggles */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Content Features
                    </CardTitle>
                    <p className="text-sm text-gray-400">Toggle different content types for this lesson</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {contentToggles.map((toggle) => (
                      <div key={toggle.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <toggle.icon className="w-5 h-5 text-purple-400" />
                          <div>
                            <Label className="text-white font-medium">{toggle.label}</Label>
                            <p className="text-xs text-gray-400">{toggle.description}</p>
                          </div>
                        </div>
                        <Switch
                          checked={toggle.enabled}
                          onCheckedChange={() => toggleContent(toggle.id)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Video Tab */}
              <TabsContent value="video" className="p-6 space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Youtube className="w-5 h-5 text-red-500" />
                      YouTube Video Integration
                    </CardTitle>
                    <p className="text-sm text-gray-400">Add a YouTube video to enhance your lesson</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-gray-300">YouTube URL</Label>
                      <Input
                        value={youtubeUrl}
                        onChange={(e) => handleYouTubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Paste the full YouTube URL and we'll extract the video ID automatically
                      </p>
                    </div>

                    {lessonData.youtube_video_id && (
                      <div className="space-y-3">
                        <Label className="text-gray-300">Video Preview</Label>
                        <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-600">
                          <iframe
                            src={`https://www.youtube.com/embed/${lessonData.youtube_video_id}`}
                            title="YouTube video preview"
                            className="w-full h-full"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Youtube className="w-4 h-4 text-red-500" />
                          Video ID: {lessonData.youtube_video_id}
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-gray-300">Alternative Video URL</Label>
                      <Input
                        value={lessonData.video_url}
                        onChange={(e) => setLessonData({ ...lessonData, video_url: e.target.value })}
                        placeholder="https://example.com/video.mp4"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Direct video URL (MP4, etc.) if not using YouTube
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Recipe Tab */}
              <TabsContent value="recipe" className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Ingredients */}
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        Ingredients
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {lessonData.ingredients.map((ingredient, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={ingredient}
                            onChange={(e) => updateIngredient(index, e.target.value)}
                            placeholder="e.g., 2 cups pasta"
                            className="bg-gray-700 border-gray-600 text-white flex-1"
                          />
                          <Button
                            onClick={() => removeIngredient(index)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={addIngredient}
                        variant="outline"
                        className="w-full border-gray-600 text-gray-300"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Ingredient
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Instructions */}
                  <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <ListChecks className="w-5 h-5" />
                        Instructions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {lessonData.instructions.map((instruction, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold mt-1">
                            {index + 1}
                          </div>
                          <Textarea
                            value={instruction}
                            onChange={(e) => updateInstruction(index, e.target.value)}
                            placeholder="Describe this step..."
                            className="bg-gray-700 border-gray-600 text-white flex-1"
                            rows={2}
                          />
                          <Button
                            onClick={() => removeInstruction(index)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={addInstruction}
                        variant="outline"
                        className="w-full border-gray-600 text-gray-300"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Step
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Recipe Details */}
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Recipe Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <Label className="text-gray-300">Prep Time (min)</Label>
                        <Input
                          type="number"
                          value={lessonData.prep_time}
                          onChange={(e) => setLessonData({ ...lessonData, prep_time: parseInt(e.target.value) || 0 })}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Cook Time (min)</Label>
                        <Input
                          type="number"
                          value={lessonData.cook_time}
                          onChange={(e) => setLessonData({ ...lessonData, cook_time: parseInt(e.target.value) || 0 })}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Servings</Label>
                        <Input
                          type="number"
                          value={lessonData.servings}
                          onChange={(e) => setLessonData({ ...lessonData, servings: parseInt(e.target.value) || 1 })}
                          className="bg-gray-700 border-gray-600 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Difficulty (1-5)</Label>
                        <Select
                          value={lessonData.difficulty_level.toString()}
                          onValueChange={(value) => setLessonData({ ...lessonData, difficulty_level: parseInt(value) })}
                        >
                          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Very Easy</SelectItem>
                            <SelectItem value="2">2 - Easy</SelectItem>
                            <SelectItem value="3">3 - Medium</SelectItem>
                            <SelectItem value="4">4 - Hard</SelectItem>
                            <SelectItem value="5">5 - Expert</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="p-6 space-y-6">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Settings className="w-5 h-5" />
                      Publishing Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-white font-medium">Published Status</Label>
                        <p className="text-xs text-gray-400">Make this lesson visible to members</p>
                      </div>
                      <Switch
                        checked={lessonData.is_published}
                        onCheckedChange={(checked) => setLessonData({ ...lessonData, is_published: checked })}
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">Lesson Order</Label>
                      <Input
                        type="number"
                        value={lessonData.lesson_order}
                        onChange={(e) => setLessonData({ ...lessonData, lesson_order: parseInt(e.target.value) || 1 })}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - Preview */}
          <div className="w-96 border-l border-gray-700 bg-gray-800 overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Live Preview
              </h3>
              
              {/* Lesson Preview Card */}
              <Card className="bg-gray-900 border-gray-600">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{lessonData.emoji}</span>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white truncate">{lessonData.title || "Untitled Lesson"}</h4>
                      <p className="text-xs text-gray-400">
                        {lessonData.prep_time + lessonData.cook_time} min • {lessonData.servings} servings • Level {lessonData.difficulty_level}
                      </p>
                    </div>
                    {lessonData.is_published ? (
                      <Badge className="bg-green-600 text-white">Published</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-gray-600 text-gray-300">Draft</Badge>
                    )}
                  </div>

                  {lessonData.youtube_video_id && (
                    <div className="aspect-video bg-gray-800 rounded-lg overflow-hidden">
                      <iframe
                        src={`https://www.youtube.com/embed/${lessonData.youtube_video_id}`}
                        title="YouTube preview"
                        className="w-full h-full"
                        frameBorder="0"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {lessonData.description && (
                    <div className="prose prose-sm prose-invert max-w-none">
                      <div className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                        {lessonData.description.split('\n').map((line, index) => {
                          if (line.startsWith('##')) {
                            return <h3 key={index} className="text-white font-semibold mt-3 mb-2 text-base">{line.replace('##', '').trim()}</h3>;
                          }
                          if (line.startsWith('•')) {
                            return <li key={index} className="ml-4 list-disc text-sm">{line.replace('•', '').trim()}</li>;
                          }
                          if (line.match(/^\d+\./)) {
                            return <li key={index} className="ml-4 list-decimal text-sm">{line.replace(/^\d+\./, '').trim()}</li>;
                          }
                          if (line.startsWith('---')) {
                            return <hr key={index} className="my-3 border-gray-600" />;
                          }
                          if (line.trim()) {
                            return <p key={index} className="mb-2 text-sm">{line}</p>;
                          }
                          return <br key={index} />;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Content Features Preview */}
                  {contentToggles.some(t => t.enabled) && (
                    <div className="pt-3 border-t border-gray-700">
                      <h5 className="text-xs font-semibold text-gray-400 mb-2">Available Features</h5>
                      <div className="flex flex-wrap gap-2">
                        {contentToggles.filter(t => t.enabled).map((toggle) => (
                          <div key={toggle.id} className="flex items-center gap-1 bg-purple-600/20 px-2 py-1 rounded text-xs text-purple-400">
                            <toggle.icon className="w-3 h-3" />
                            <span>{toggle.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}