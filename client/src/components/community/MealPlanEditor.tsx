import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Edit,
  Trash2,
  GripVertical,
  Save,
  ChefHat,
  Clock,
  Users,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  Settings,
  BookOpen,
  Play,
  FileText,
  Target,
  ListChecks,
  Info,
  X,
  Menu,
  ChevronLeft,
  FolderPlus,
  MoreHorizontal,
  Camera,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { SingleImageUploader } from "@/components/SingleImageUploader";
import InlineLessonEditor from "./InlineLessonEditor";

interface Course {
  id: number;
  title: string;
  emoji?: string;
  description?: string;
  category?: string;
  cover_image?: string;
  lesson_count: number;
  is_published: boolean;
  display_order: number;
  modules?: Module[];
}

interface Module {
  id: number;
  course_id: number;
  title: string;
  emoji?: string;
  description?: string;
  module_order: number;
  is_expanded: boolean;
  lessons?: Lesson[];
}

interface Lesson {
  id: number;
  course_id: number;
  module_id?: number;
  title: string;
  emoji?: string;
  description?: string;
  video_url?: string;
  youtube_video_id?: string;
  ingredients: string[];
  instructions: string[];
  prep_time: number;
  cook_time: number;
  servings: number;
  difficulty_level: number;
  lesson_order: number;
  is_published: boolean;
  sections?: LessonSection[];
}

interface LessonSection {
  id?: number;
  section_type: "about" | "key_takeaways" | "action_steps" | "custom";
  title: string;
  content: string;
  template_id?: string;
  display_order: number;
}

interface MealPlanEditorProps {
  communityId: string;
  onClose?: () => void;
}

// Template options for "About This Lesson" sections
const SECTION_TEMPLATES = [
  { id: "meal_prep", label: "Meal Prep Strategy", icon: ChefHat },
  { id: "shopping_guide", label: "Shopping Guide", icon: Users },
  { id: "techniques", label: "Cooking Techniques", icon: BookOpen },
  { id: "nutrition", label: "Nutritional Benefits", icon: Target },
  { id: "time_management", label: "Time-Saving Tips", icon: Clock },
  { id: "cultural", label: "Cultural Context", icon: Info },
  { id: "custom", label: "Custom", icon: FileText },
];

// Emoji options for courses and lessons
const EMOJI_OPTIONS = ["🌟", "🔥", "💰", "📚", "🥗", "🍽️", "👨‍🍳", "🎯", "💪", "🏆", "🚀", "✨", "🌮", "🍝", "🍜", "🍱"];

// Lesson Form Component
function LessonForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: {
    title: string;
    emoji?: string;
    description?: string;
    ingredients?: string[];
    instructions?: string[];
    prep_time?: number;
    cook_time?: number;
    servings?: number;
    difficulty_level?: number;
  }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('📝');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<string[]>(['']);
  const [instructions, setInstructions] = useState<string[]>(['']);
  const [prepTime, setPrepTime] = useState(10);
  const [cookTime, setCookTime] = useState(20);
  const [servings, setServings] = useState(4);
  const [difficultyLevel, setDifficultyLevel] = useState(2);

  const addIngredient = () => {
    setIngredients([...ingredients, '']);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = value;
    setIngredients(newIngredients);
  };

  const addInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const removeInstruction = (index: number) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };

  const updateInstruction = (index: number, value: string) => {
    const newInstructions = [...instructions];
    newInstructions[index] = value;
    setInstructions(newInstructions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      emoji,
      description: description.trim(),
      ingredients: ingredients.filter(ing => ing.trim()),
      instructions: instructions.filter(inst => inst.trim()),
      prep_time: prepTime,
      cook_time: cookTime,
      servings,
      difficulty_level: difficultyLevel,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-96 overflow-y-auto">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-2">
          <Label htmlFor="emoji">Emoji</Label>
          <Input
            id="emoji"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white text-center text-lg"
            maxLength={2}
          />
        </div>
        <div className="col-span-10">
          <Label htmlFor="title">Lesson Title *</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Perfect Pasta Technique"
            className="bg-gray-700 border-gray-600 text-white"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief lesson description..."
          className="bg-gray-700 border-gray-600 text-white"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="prep-time">Prep Time (minutes)</Label>
          <Input
            id="prep-time"
            type="number"
            value={prepTime}
            onChange={(e) => setPrepTime(Number(e.target.value))}
            className="bg-gray-700 border-gray-600 text-white"
            min="0"
          />
        </div>
        <div>
          <Label htmlFor="cook-time">Cook Time (minutes)</Label>
          <Input
            id="cook-time"
            type="number"
            value={cookTime}
            onChange={(e) => setCookTime(Number(e.target.value))}
            className="bg-gray-700 border-gray-600 text-white"
            min="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="servings">Servings</Label>
          <Input
            id="servings"
            type="number"
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            className="bg-gray-700 border-gray-600 text-white"
            min="1"
          />
        </div>
        <div>
          <Label htmlFor="difficulty">Difficulty (1-5)</Label>
          <Input
            id="difficulty"
            type="number"
            value={difficultyLevel}
            onChange={(e) => setDifficultyLevel(Number(e.target.value))}
            className="bg-gray-700 border-gray-600 text-white"
            min="1"
            max="5"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Ingredients</Label>
          <Button type="button" onClick={addIngredient} size="sm" variant="outline" className="border-gray-600 text-gray-300">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {ingredients.map((ingredient, index) => (
            <div key={index} className="flex gap-2">
              <Input
                value={ingredient}
                onChange={(e) => updateIngredient(index, e.target.value)}
                placeholder={`Ingredient ${index + 1}`}
                className="bg-gray-700 border-gray-600 text-white flex-1"
              />
              {ingredients.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  size="sm"
                  variant="destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Instructions</Label>
          <Button type="button" onClick={addInstruction} size="sm" variant="outline" className="border-gray-600 text-gray-300">
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {instructions.map((instruction, index) => (
            <div key={index} className="flex gap-2">
              <Textarea
                value={instruction}
                onChange={(e) => updateInstruction(index, e.target.value)}
                placeholder={`Step ${index + 1}`}
                className="bg-gray-700 border-gray-600 text-white flex-1"
                rows={2}
              />
              {instructions.length > 1 && (
                <Button
                  type="button"
                  onClick={() => removeInstruction(index)}
                  size="sm"
                  variant="destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
        <Button type="button" onClick={onCancel} variant="outline" className="border-gray-600 text-gray-300">
          Cancel
        </Button>
        <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
          Create Lesson
        </Button>
      </div>
    </form>
  );
}

export function MealPlanEditor({ communityId, onClose }: MealPlanEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [isCreatingLesson, setIsCreatingLesson] = useState(false);
  const [selectedModuleForLesson, setSelectedModuleForLesson] = useState<number | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [lessonEditorData, setLessonEditorData] = useState<{lesson: any, communityId: string, courseId: number} | null>(null);
  
  // Edit states
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);

  // Screen size detection for responsive rendering
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  console.log('MealPlanEditor mounted with communityId:', communityId);

  // Fetch courses for this community
  const { data: courses = [], isLoading, error } = useQuery({
    queryKey: [`/api/communities/${communityId}/courses`],
    queryFn: async () => {
      console.log('Fetching courses for community:', communityId);
      const token = localStorage.getItem('auth_token');
      console.log('Auth token exists:', !!token);
      
      const response = await fetch(`/api/communities/${communityId}/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      console.log('Courses fetch response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch courses:', errorText);
        throw new Error(`Failed to fetch courses: ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Fetched courses:', data);
      // Ensure we always return an array
      return Array.isArray(data) ? data : [];
    },
    enabled: !!communityId,
  });

  // Create course mutation
  const createCourseMutation = useMutation({
    mutationFn: async (data: Partial<Course>) => {
      console.log('Sending create course request:', data);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/communities/${communityId}/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      
      const responseText = await response.text();
      console.log('Create course response:', response.status, responseText);
      
      if (!response.ok) {
        let errorMessage = 'Failed to create course';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return JSON.parse(responseText);
    },
    onSuccess: (data) => {
      console.log('Course created successfully:', data);
      queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
      toast({ title: "Course created", description: "Your new course has been created successfully." });
      setIsCreatingCourse(false);
    },
    onError: (error) => {
      console.error('Error creating course:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create course",
        variant: "destructive"
      });
    },
  });

  // Create module mutation
  const createModuleMutation = useMutation({
    mutationFn: async (data: { courseId: number; title: string; emoji?: string; description?: string }) => {
      console.log('Sending create module request:', data);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/communities/${communityId}/courses/${data.courseId}/modules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: data.title,
          emoji: data.emoji,
          description: data.description,
        }),
      });
      
      const responseText = await response.text();
      console.log('Create module response:', response.status, responseText);
      
      if (!response.ok) {
        let errorMessage = 'Failed to create module';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return JSON.parse(responseText);
    },
    onSuccess: async (data) => {
      console.log('Module created successfully:', data);
      // Invalidate and refetch courses
      await queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
      
      // Update selectedCourse to include the new module
      if (selectedCourse) {
        const updatedCourses = queryClient.getQueryData([`/api/communities/${communityId}/courses`]) as Course[];
        const updatedSelectedCourse = updatedCourses?.find(c => c.id === selectedCourse.id);
        if (updatedSelectedCourse) {
          setSelectedCourse(updatedSelectedCourse);
        }
      }
      
      toast({ title: "Module created", description: "Your new module has been created successfully." });
      setIsCreatingModule(false);
    },
    onError: (error) => {
      console.error('Error creating module:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create module",
        variant: "destructive" 
      });
    },
  });

  // Create lesson mutation
  const createLessonMutation = useMutation({
    mutationFn: async (data: { 
      courseId: number; 
      moduleId?: number; 
      title: string; 
      emoji?: string; 
      description?: string;
      ingredients?: string[];
      instructions?: string[];
      prep_time?: number;
      cook_time?: number;
      servings?: number;
      difficulty_level?: number;
    }) => {
      console.log('Sending create lesson request:', data);
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`/api/communities/${communityId}/courses/${data.courseId}/lessons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          module_id: data.moduleId,
          title: data.title,
          emoji: data.emoji,
          description: data.description,
          ingredients: data.ingredients,
          instructions: data.instructions,
          prep_time: data.prep_time,
          cook_time: data.cook_time,
          servings: data.servings,
          difficulty_level: data.difficulty_level,
        }),
      });
      
      const responseText = await response.text();
      console.log('Create lesson response:', response.status, responseText);
      
      if (!response.ok) {
        let errorMessage = 'Failed to create lesson';
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = responseText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      return JSON.parse(responseText);
    },
    onSuccess: async (data) => {
      console.log('Lesson created successfully:', data);
      
      toast({ title: "✅ Lesson created", description: "Your new lesson has been created successfully." });
      
      // Reset loading state and open lesson editor modal with full lesson data
      setIsNavigating(false);
      setLessonEditorData({ lesson: data, communityId, courseId: data.course_id });
    },
    onError: (error) => {
      console.error('Error creating lesson:', error);
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to create lesson",
        variant: "destructive" 
      });
    },
  });

  // Update course mutation
  const updateCourseMutation = useMutation({
    mutationFn: async ({ courseId, data }: { courseId: number; data: Partial<Course> }) => {
      const response = await fetch(`/api/communities/${communityId}/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update course');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
      toast({ title: "Course updated", description: "Your course has been updated successfully." });
      setEditingCourse(null);
    },
  });

  // Update module mutation
  const updateModuleMutation = useMutation({
    mutationFn: async ({ courseId, moduleId, data }: { courseId: number; moduleId: number; data: Partial<Module> }) => {
      const response = await fetch(`/api/communities/${communityId}/courses/${courseId}/modules/${moduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update module');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
      toast({ title: "Module updated", description: "Your module has been updated successfully." });
      setEditingModule(null);
    },
  });

  // Delete course mutation
  const deleteCourseMutation = useMutation({
    mutationFn: async (courseId: number) => {
      const response = await fetch(`/api/communities/${communityId}/courses/${courseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to delete course');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
      toast({ title: "Course deleted", description: "The course has been deleted successfully." });
      setSelectedCourse(null);
    },
  });

  // Handle drag and drop for course ordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(courses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update display_order for all affected courses
    items.forEach((course, index) => {
      if (course.display_order !== index) {
        updateCourseMutation.mutate({
          courseId: course.id,
          data: { display_order: index },
        });
      }
    });
  };

  const toggleModuleExpansion = (moduleId: number) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handleCreateLesson = (moduleId?: number) => {
    if (selectedCourse) {
      // Show loading overlay immediately
      setIsNavigating(true);
      
      // Create the lesson - onSuccess will handle opening the modal
      createLessonMutation.mutate({
        courseId: selectedCourse.id,
        moduleId: moduleId,
        title: "New Lesson",
        emoji: "📝",
        description: "Add your lesson content here...",
        ingredients: [],
        instructions: [],
        prep_time: 0,
        cook_time: 0,
        servings: 4,
        difficulty_level: 1
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[10000]" data-meal-plan-editor>
      <div className="fixed inset-0 bg-gray-900 flex relative w-full h-full"
           onClick={(e) => {
             // Close sidebar when clicking on overlay area (only on mobile)
             if (window.innerWidth <= 768 && e.target === e.currentTarget) {
               const editor = document.querySelector('[data-meal-plan-editor]');
               if (editor && !editor.classList.contains('sidebar-collapsed')) {
                 editor.classList.add('sidebar-collapsed');
               }
             }
           }}>
        {/* Left Sidebar - Course List */}
        <div className="w-80 flex-shrink-0 h-full bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white mb-4">Meal Plan Courses</h2>
          <Button
            onClick={() => setIsCreatingCourse(true)}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Course
          </Button>
        </div>

{(() => {
          console.log('🔍 [RENDER DEBUG] Rendering state check:');
          console.log('🔍 [RENDER DEBUG] isLoading:', isLoading);
          console.log('🔍 [RENDER DEBUG] error:', error);
          console.log('🔍 [RENDER DEBUG] courses.length:', courses.length);
          console.log('🔍 [RENDER DEBUG] courses array:', courses);
          console.log('🔍 [RENDER DEBUG] isMobile:', isMobile);
          console.log('🔍 [RENDER DEBUG] window.innerWidth:', window.innerWidth);
          return null;
        })()}
        
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
            <p className="text-gray-400 mt-2">Loading courses...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400">Error loading courses</p>
            <p className="text-gray-400 text-sm mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-8">
            <ChefHat className="h-12 w-12 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-400">No courses yet</p>
            <p className="text-gray-500 text-sm mt-1">Create your first course to get started</p>
          </div>
        ) : (
          // Responsive rendering: Simple list for desktop, drag-drop for mobile
          <>
            {(() => {
              console.log('🔍 [RENDER DEBUG] About to render courses - isMobile:', isMobile);
              if (isMobile) {
                console.log('🔍 [RENDER DEBUG] Taking MOBILE path');
              } else {
                console.log('🔍 [RENDER DEBUG] Taking DESKTOP path');
              }
              return null;
            })()}
            
            {isMobile ? (
            // Mobile: Keep drag-and-drop functionality
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="courses">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {(courses as Course[]).map((course: Course, index: number) => (
                      <Draggable key={course.id} draggableId={`course-${course.id}`} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${
                            snapshot.isDragging ? 'opacity-50' : ''
                          } ${
                            selectedCourse?.id === course.id ? 'bg-gray-800' : ''
                          }`}
                        >
                          <Card
                            className="bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
                            onClick={() => {
                              setSelectedCourse(course);
                              // Auto-close sidebar on mobile after selecting course
                              if (window.innerWidth <= 768) {
                                const editor = document.querySelector('[data-meal-plan-editor]');
                                if (editor) {
                                  editor.classList.add('sidebar-collapsed');
                                }
                              }
                            }}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <div {...provided.dragHandleProps}>
                                    <GripVertical className="h-4 w-4 text-gray-400" />
                                  </div>
                                  <span className="text-lg">{course.emoji || '📚'}</span>
                                  <div className="flex-1">
                                    <h3 className="font-medium text-white text-sm">{course.title}</h3>
                                    <p className="text-xs text-gray-400">{course.lesson_count} lessons</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCourse(course);
                                    }}
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-600"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Badge
                                    className={`text-xs ${
                                      course.is_published
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-600 text-gray-300'
                                    }`}
                                  >
                                    {course.is_published ? 'Published' : 'Draft'}
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            // Desktop: Simple list without drag-and-drop
            <div className="space-y-2">
              {(courses as Course[]).map((course: Course) => (
                <Card
                  key={course.id}
                  className={`bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors ${
                    selectedCourse?.id === course.id ? 'ring-2 ring-purple-500' : ''
                  }`}
                  onClick={() => setSelectedCourse(course)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <span className="text-2xl">{course.emoji || '📚'}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-base">{course.title}</h3>
                          <p className="text-sm text-gray-400">{course.lesson_count} lessons</p>
                          {course.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{course.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCourse(course);
                          }}
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-600"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Badge
                          className={`text-xs ${
                            course.is_published
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-600 text-gray-300'
                          }`}
                        >
                          {course.is_published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}
          </>
        )}
      </div>

        {/* Exit Button */}
        <Button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 bg-gray-700 hover:bg-gray-600 text-white shadow-lg"
          size="sm"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Main Content Area */}
        <div className="flex-1 h-full p-6 overflow-y-auto bg-gray-900 min-w-0">
        {selectedCourse ? (
          <CourseEditor
            course={selectedCourse}
            communityId={communityId}
            onUpdate={(data) => updateCourseMutation.mutate({ courseId: selectedCourse.id, data })}
            onDelete={() => deleteCourseMutation.mutate(selectedCourse.id)}
            onSelectLesson={() => {}}
            onCreateModule={() => setIsCreatingModule(true)}
            onCreateLesson={handleCreateLesson}
            onEditModule={setEditingModule}
            selectedCourse={selectedCourse}
          />
        ) : (
          <div className="flex items-center justify-center h-full w-full">
            <div className="text-center max-w-md">
              <ChefHat className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Select a Course</h3>
              <p className="text-gray-400">Choose a course from the sidebar or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>

        {/* Toggle Sidebar Button */}
        <Button
          onClick={() => {
            // Toggle sidebar collapse state
            const editor = document.querySelector('[data-meal-plan-editor]');
            if (editor) {
              editor.classList.toggle('sidebar-collapsed');
            }
            // Only close on desktop when explicitly requested
            if (window.innerWidth >= 768 && onClose) {
              onClose();
            }
          }}
          className="absolute top-4 left-4 z-30 bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          size="sm"
          title="Toggle course list"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Create Course Dialog */}
        <Dialog open={isCreatingCourse} onOpenChange={setIsCreatingCourse}>
          <DialogContent className="bg-gray-800 text-white border-gray-700 z-[10001]">
            <DialogHeader>
              <DialogTitle>Create New Course</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a structured meal plan course for your community members
              </DialogDescription>
            </DialogHeader>
            <CourseForm
              onSubmit={(data) => {
                console.log('Creating course with data:', data);
                createCourseMutation.mutate(data);
              }}
              onCancel={() => setIsCreatingCourse(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Create Module Dialog */}
        <Dialog open={isCreatingModule} onOpenChange={setIsCreatingModule}>
          <DialogContent className="bg-gray-800 text-white border-gray-700 z-[10001]">
            <DialogHeader>
              <DialogTitle>Add Module to {selectedCourse?.title}</DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new module (section) to organize lessons within this course
              </DialogDescription>
            </DialogHeader>
            <ModuleForm
              onSubmit={(data) => {
                if (selectedCourse) {
                  console.log('Creating module with data:', data);
                  createModuleMutation.mutate({ 
                    courseId: selectedCourse.id, 
                    ...data 
                  });
                }
              }}
              onCancel={() => setIsCreatingModule(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Create Lesson Dialog */}
        <Dialog open={isCreatingLesson} onOpenChange={setIsCreatingLesson}>
          <DialogContent className="bg-gray-800 text-white border-gray-700 z-[10001] max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Add Lesson to {selectedCourse?.title}
                {selectedModuleForLesson && (
                  <span className="text-sm text-gray-400 block">
                    Module: {selectedCourse?.modules?.find(m => m.id === selectedModuleForLesson)?.title}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-gray-400">
                Create a new lesson with instructions, ingredients, and video content
              </DialogDescription>
            </DialogHeader>
            <LessonForm
              onSubmit={(data) => {
                if (selectedCourse) {
                  console.log('Creating lesson with data:', data);
                  createLessonMutation.mutate({ 
                    courseId: selectedCourse.id,
                    moduleId: selectedModuleForLesson || undefined,
                    ...data 
                  });
                }
              }}
              onCancel={() => {
                setIsCreatingLesson(false);
                setSelectedModuleForLesson(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Edit Course Dialog */}
        <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
          <DialogContent className="bg-gray-800 text-white border-gray-700 z-[10001]">
            <DialogHeader>
              <DialogTitle>Edit Course</DialogTitle>
              <DialogDescription className="text-gray-400">
                Update the course information
              </DialogDescription>
            </DialogHeader>
            {editingCourse && (
              <CourseForm
                initialData={editingCourse}
                onSubmit={(data) => {
                  updateCourseMutation.mutate({
                    courseId: editingCourse.id,
                    data,
                  });
                }}
                onCancel={() => setEditingCourse(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Module Dialog */}
        <Dialog open={!!editingModule} onOpenChange={(open) => !open && setEditingModule(null)}>
          <DialogContent className="bg-gray-800 text-white border-gray-700 z-[10001]">
            <DialogHeader>
              <DialogTitle>Edit Module</DialogTitle>
              <DialogDescription className="text-gray-400">
                Update the module information
              </DialogDescription>
            </DialogHeader>
            {editingModule && selectedCourse && (
              <ModuleForm
                initialData={editingModule}
                onSubmit={(data) => {
                  updateModuleMutation.mutate({
                    courseId: selectedCourse.id,
                    moduleId: editingModule.id,
                    data,
                  });
                }}
                onCancel={() => setEditingModule(null)}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Lesson Editor Modal */}
        {lessonEditorData && (
          <div className="fixed inset-0 bg-gray-900 z-[10003]">
            <InlineLessonEditor
              lesson={lessonEditorData.lesson}
              communityId={lessonEditorData.communityId}
              courseId={lessonEditorData.courseId}
              isCreator={true}
              onClose={() => setLessonEditorData(null)}
            />
          </div>
        )}

      </div>
      
      {/* Navigation Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 bg-gray-900 z-[10002] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
            <p className="mt-2 text-gray-400 text-sm">Creating lesson...</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Course Editor Component
function CourseEditor({
  course,
  communityId,
  onUpdate,
  onDelete,
  onSelectLesson,
  onCreateModule,
  onCreateLesson,
  onEditModule,
  selectedCourse,
}: {
  course: Course;
  communityId: string;
  onUpdate: (data: Partial<Course>) => void;
  onDelete: () => void;
  onSelectLesson: (lesson: Lesson) => void;
  onCreateModule: () => void;
  onCreateLesson: (moduleId?: number) => void;
  onEditModule: (module: Module) => void;
  selectedCourse: Course;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(course);

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{course.emoji || '📚'}</span>
            {isEditing ? (
              <Input
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="bg-gray-700 border-gray-600 text-white text-xl font-semibold"
              />
            ) : (
              <h1 className="text-2xl font-bold text-white">{course.title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isEditing ? (
              <>
                <Button
                  onClick={() => {
                    onUpdate(editData);
                    setIsEditing(false);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setEditData(course);
                    setIsEditing(false);
                  }}
                  variant="outline"
                  className="border-gray-600 text-gray-300"
                  size="sm"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => onUpdate({ is_published: !course.is_published })}
                  className={course.is_published ? "bg-gray-600 hover:bg-gray-700" : "bg-green-600 hover:bg-green-700"}
                  size="sm"
                >
                  {course.is_published ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                  {course.is_published ? 'Unpublish' : 'Publish'}
                </Button>
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  className="border-gray-600 text-gray-300"
                  size="sm"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  onClick={onDelete}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        {isEditing ? (
          <Textarea
            value={editData.description || ''}
            onChange={(e) => setEditData({ ...editData, description: e.target.value })}
            placeholder="Course description..."
            className="bg-gray-700 border-gray-600 text-white"
            rows={3}
          />
        ) : (
          <p className="text-gray-300">{course.description || 'No description provided'}</p>
        )}

        <div className="flex items-center gap-4 mt-4">
          <Badge className="bg-gray-700 text-gray-300">
            <BookOpen className="h-3 w-3 mr-1" />
            {course.lesson_count} Lessons
          </Badge>
          <Badge className="bg-gray-700 text-gray-300">
            <Clock className="h-3 w-3 mr-1" />
            {course.category || 'All Levels'}
          </Badge>
        </div>
      </div>

      {/* Modules and Lessons */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Course Content</h2>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={onCreateModule}
              disabled={!selectedCourse}
            >
              <FolderPlus className="h-4 w-4 mr-1" />
              Add Module
            </Button>
          </div>
        </div>

        {/* Course Structure with Modules and Lessons */}
        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
          {/* Render actual modules from database */}
          {course.modules?.map((module, moduleIndex) => (
            <div key={module.id} className="bg-gray-800 border border-gray-700 rounded-lg">
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">M{moduleIndex + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white">{module.title}</h3>
                    <p className="text-sm text-gray-400">{module.description || 'No description'}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-purple-400 hover:text-purple-300 hover:bg-purple-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateLesson(module.id);
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      <span className="text-xs">Add Lesson</span>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-gray-400 hover:text-white hover:bg-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditModule(module);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Lessons within Module */}
              <div className="space-y-0">
                {module.lessons?.map((lesson, index) => (
                  <div
                    key={lesson.id}
                    className="p-4 border-b border-gray-700 last:border-b-0 cursor-pointer hover:bg-gray-750 transition-colors group"
                    onClick={() => onSelectLesson(lesson as any)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gray-700 rounded flex items-center justify-center text-xs text-gray-300">
                        {index + 1}
                      </div>
                      <span className="text-lg">{lesson.emoji || '📝'}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-white group-hover:text-purple-400">{lesson.title}</h4>
                          <Badge 
                            variant="outline" 
                            className="text-xs border-blue-500 text-blue-400"
                          >
                            lesson
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400">{lesson.description || 'No description'}</p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {(lesson as any).prep_time + (lesson as any).cook_time || 0} min
                      </div>
                    </div>
                  </div>
                )) || (
                  <div className="p-4 text-center text-gray-400">
                    No lessons in this module yet
                  </div>
                )}
              </div>
            </div>
          )) || (
            <div className="text-center text-gray-400 py-8">
              No modules created yet. Click "Add Module" to get started.
            </div>
          )}
        </div>

        {/* Legacy lesson structure for demonstration */}
        <div className="hidden space-y-3">
          {[].map((lesson: any) => (
            <Card
              key={lesson.id}
              className="bg-gray-800 border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors group"
              onClick={() => onSelectLesson(lesson as any)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 bg-gray-700 rounded-lg group-hover:bg-gray-600 transition-colors">
                      <span className="text-xl">{lesson.emoji}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white text-base">{lesson.title}</h3>
                        <Badge variant="secondary" className="text-xs bg-purple-600/20 text-purple-300 border-purple-600/30">
                          {lesson.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">{lesson.description}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {lesson.duration} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          Video lesson
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white h-8 w-8 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// Course Form Component
function CourseForm({
  onSubmit,
  onCancel,
  initialData,
}: {
  onSubmit: (data: Partial<Course>) => void;
  onCancel: () => void;
  initialData?: Course;
}) {
  const [formData, setFormData] = useState<Partial<Course>>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    emoji: initialData?.emoji || '📚',
    category: initialData?.category || 'beginner',
    cover_image: initialData?.cover_image || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted with data:', formData);
    if (!formData.title) {
      console.error('Title is required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Course Title</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., 30-Day Family Meal Plan"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Emoji</label>
          <Select
            value={formData.emoji}
            onValueChange={(value) => setFormData({ ...formData, emoji: value })}
          >
            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              {EMOJI_OPTIONS.map((emoji) => (
                <SelectItem key={emoji} value={emoji} className="text-white">
                  {emoji}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what members will learn in this course..."
          className="bg-gray-700 border-gray-600 text-white"
          rows={3}
        />
      </div>

      {/* Cover Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Cover Image</label>
        <div className="space-y-3">
          {formData.cover_image ? (
            <div className="relative">
              <img 
                src={formData.cover_image} 
                alt="Course cover" 
                className="w-full h-32 object-cover rounded-lg border border-gray-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setFormData({ ...formData, cover_image: '' })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="w-full h-32 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Upload course cover image</p>
              </div>
            </div>
          )}
          <SingleImageUploader
            onImageUploaded={(url) => setFormData({ ...formData, cover_image: url })}
            className="w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Difficulty Level</label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData({ ...formData, category: value })}
        >
          <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600">
            <SelectItem value="beginner" className="text-white">Beginner</SelectItem>
            <SelectItem value="intermediate" className="text-white">Intermediate</SelectItem>
            <SelectItem value="advanced" className="text-white">Advanced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="border-gray-600 text-gray-300"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-purple-600 hover:bg-purple-700 text-white"
          disabled={!formData.title}
        >
          {initialData ? 'Update Course' : 'Create Course'}
        </Button>
      </div>
    </form>
  );
}

// Module Form Component
function ModuleForm({
  onSubmit,
  onCancel,
  initialData,
}: {
  onSubmit: (data: { title: string; emoji?: string; description?: string; cover_image?: string }) => void;
  onCancel: () => void;
  initialData?: Module;
}) {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    emoji: initialData?.emoji || '📁',
    cover_image: (initialData as any)?.cover_image || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Module form submitted with data:', formData);
    if (!formData.title) {
      console.error('Module title is required');
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Module Title</label>
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Week 1: Foundation"
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Emoji</label>
          <Select
            value={formData.emoji}
            onValueChange={(value) => setFormData({ ...formData, emoji: value })}
          >
            <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600">
              {EMOJI_OPTIONS.map((emoji) => (
                <SelectItem key={emoji} value={emoji} className="text-white">
                  {emoji}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describe what this module covers..."
          className="bg-gray-700 border-gray-600 text-white"
          rows={3}
        />
      </div>

      {/* Module Cover Image Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Module Cover Image</label>
        <div className="space-y-3">
          {formData.cover_image ? (
            <div className="relative">
              <img 
                src={formData.cover_image} 
                alt="Module cover" 
                className="w-full h-24 object-cover rounded-lg border border-gray-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setFormData({ ...formData, cover_image: '' })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="w-full h-24 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <Camera className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Upload module cover</p>
              </div>
            </div>
          )}
          <SingleImageUploader
            onImageUploaded={(url) => setFormData({ ...formData, cover_image: url })}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          className="border-gray-600 text-gray-300"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          disabled={!formData.title}
        >
          {initialData ? 'Update Module' : 'Create Module'}
        </Button>
      </div>
    </form>
  );
}

// Lesson Editor is now implemented in EnhancedLessonEditor.tsx