import { useState, useEffect, useRef } from "react";
import type React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import RecipeCard from "@/components/RecipeCard";
import RecipeDisplay from "@/components/RecipeDisplay";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Eye,
  Video,
  Youtube,
  Image,
  Upload,
  Star,
  Minus,
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
  // Rich recipe data structure
  recipe_name?: string;
  meal_type?: string;
  cuisine?: string;
  ingredients: Ingredient[];
  instructions: Instruction[];
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
  meal_plans?: any[]; // Associated meal plan data
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

interface LessonEditorProps {
  lesson?: Lesson;
  lessonData?: any; // For editing existing lessons
  communityId: string;
  courseId: number;
  moduleId?: number;
  onClose: () => void;
  onSave?: (lesson: Lesson) => void;
  isInline?: boolean;
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

// Template content for different section types
const SECTION_TEMPLATES: Record<string, { title: string; content: string; icon: any }> = {
  meal_prep: {
    title: "Meal Prep Strategy",
    content: `## Preparation Timeline
- **Sunday**: Shop for ingredients and prep vegetables
- **Monday**: Cook proteins and grains in bulk
- **Wednesday**: Mid-week refresh of salads and quick prep items

## Storage Tips
- Store prepped vegetables in airtight containers with paper towels
- Keep proteins separate until assembly
- Label everything with dates for freshness tracking

## Time-Saving Techniques
- Use one-pan methods when possible
- Prep similar ingredients together
- Invest in quality storage containers`,
    icon: ChefHat,
  },
  shopping_guide: {
    title: "Shopping Guide",
    content: `## Essential Ingredients
- Fresh produce: [List seasonal options]
- Proteins: [Budget-friendly choices]
- Pantry staples: [Must-have items]

## Budget Tips
- Buy in bulk for frequently used items
- Choose seasonal produce for better prices
- Consider frozen vegetables for longer shelf life

## Shopping List Organization
- Group items by store section
- Note quantities needed
- Mark items that can be substituted`,
    icon: ShoppingCart,
  },
  techniques: {
    title: "Cooking Techniques",
    content: `## Key Skills
- **Knife Skills**: Proper chopping techniques for efficiency
- **Heat Control**: Understanding when to use high vs. low heat
- **Seasoning**: Building layers of flavor

## Common Mistakes to Avoid
- Overcrowding the pan
- Not preheating properly
- Adding salt too early to certain vegetables

## Pro Tips
- Read the entire recipe before starting
- Prep all ingredients before cooking
- Keep a "garbage bowl" nearby for scraps`,
    icon: BookOpen,
  },
  nutrition: {
    title: "Nutritional Benefits",
    content: `## Macro Breakdown
- **Protein**: Supports muscle maintenance and satiety
- **Carbohydrates**: Provides sustained energy
- **Healthy Fats**: Essential for nutrient absorption

## Key Nutrients
- Vitamins and minerals present
- Fiber content for digestive health
- Antioxidants for overall wellness

## Health Benefits
- Supports weight management goals
- Provides balanced nutrition
- Helps maintain stable energy levels`,
    icon: Heart,
  },
  time_management: {
    title: "Time-Saving Tips",
    content: `## Quick Prep Methods
- Use a food processor for chopping
- Cook multiple components simultaneously
- Batch similar tasks together

## Make-Ahead Options
- Prep vegetables the night before
- Cook grains in large batches
- Pre-mix spice blends

## Kitchen Organization
- Keep frequently used tools accessible
- Organize ingredients before starting
- Clean as you go to save time later`,
    icon: Clock,
  },
  cultural: {
    title: "Cultural Context",
    content: `## Origin & History
- Traditional background of this dish
- Regional variations
- Cultural significance

## Authentic Ingredients
- Traditional vs. modern substitutions
- Where to find specialty items
- Importance of specific ingredients

## Serving Traditions
- Traditional accompaniments
- Proper presentation
- Cultural dining customs`,
    icon: Info,
  },
};

// Default sections for a new lesson
const DEFAULT_SECTIONS: LessonSection[] = [
  {
    section_type: "about",
    title: "About This Lesson",
    content: "",
    template_id: "meal_prep",
    display_order: 0,
    is_visible: true,
  },
  {
    section_type: "key_takeaways",
    title: "Key Takeaways",
    content: "• Learn efficient meal prep techniques\n• Understand ingredient substitutions\n• Master time-saving cooking methods\n• Create balanced, nutritious meals",
    display_order: 1,
    is_visible: true,
  },
  {
    section_type: "action_steps",
    title: "Action Steps",
    content: "1. Review the complete recipe and ingredients list\n2. Shop for ingredients using the provided shopping guide\n3. Set aside 2 hours for meal prep on Sunday\n4. Follow the step-by-step instructions\n5. Store meals properly for the week",
    display_order: 2,
    is_visible: true,
  },
];

export function LessonEditor({
  lesson,
  lessonData: existingLessonData,
  communityId,
  courseId,
  moduleId,
  onClose,
  onSave,
  isInline = false,
}: LessonEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lessonData, setLessonData] = useState<Lesson>(
    existingLessonData || lesson || {
      course_id: courseId,
      module_id: moduleId,
      title: "",
      emoji: "🍽️",
      description: "",
      video_url: "",
      youtube_video_id: "",
      image_url: "",
      recipe_name: "",
      meal_type: "Dinner",
      cuisine: "",
      ingredients: [{ id: '1', amount: '', unit: '', name: '' }],
      instructions: [{ id: '1', step: 1, text: '' }],
      prep_time: 15,
      cook_time: 30,
      servings: 4,
      difficulty_level: 2,
      lesson_order: 0,
      is_published: false,
      sections: DEFAULT_SECTIONS,
      meal_plans: [],
    }
  );
  const [selectedTemplate, setSelectedTemplate] = useState<string>("meal_prep");
  const [editingSection, setEditingSection] = useState<number | null>(null);
  const [sectionStates, setSectionStates] = useState({
    basicInfo: true,
    mediaVideo: true,
    recipeDetails: true,
    lessonSections: true,
  });

  // Recipe tab management
  const [activeTab, setActiveTab] = useState("basics");

  // Preview window tracking for real-time updates
  const [previewIsOpen, setPreviewIsOpen] = useState(false);
  // Mobile inline preview overlay
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const mobilePreviewIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Mobile detection and horizontal sections state
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [currentSection, setCurrentSection] = useState(0);
  const sections = ['basic', 'media', 'recipe', 'lessons'];
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  // Mobile preview tabs (Ingredients, Instructions, Nutrition)
  const [previewTab, setPreviewTab] = useState<'ingredients' | 'instructions' | 'nutrition'>('ingredients');
  
  // Normalize YouTube input (URL or ID) to bare ID
  const extractYouTubeId = (input: string): string => {
    if (!input) return '';
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{8,}$/i.test(trimmed) && !trimmed.includes('http')) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.hostname.includes('youtube.com')) {
        const v = url.searchParams.get('v');
        if (v) return v;
        const parts = url.pathname.split('/').filter(Boolean);
        const embedIdx = parts.indexOf('embed');
        if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
        const shortsIdx = parts.indexOf('shorts');
        if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
      }
      if (url.hostname.includes('youtu.be')) {
        const id = url.pathname.replace('/', '');
        if (id) return id;
      }
    } catch {}
    return trimmed;
  };

  const buildYouTubeEmbedUrl = (id: string): string => {
    if (!id) return '';
    const vid = extractYouTubeId(id);
    return `https://www.youtube-nocookie.com/embed/${vid}?rel=0&modestbranding=1&playsinline=1`;
  };

  // Map current editor data to the mobile Recipe card UI used on Search page
  const mapLessonToRecipe = (src: any) => {
    const safeIngredients = Array.isArray(src?.ingredients) ? src.ingredients : [];
    const safeInstructions = Array.isArray(src?.instructions) ? src.instructions : [];
    return {
      id: src?.id,
      title: src?.title || src?.recipe_name || "Lesson",
      emoji: src?.emoji || undefined,
      description: src?.description || "",
      image_url: src?.image_url || "",
      time_minutes: (src?.prep_time || 0) + (src?.cook_time || 0) || undefined,
      cuisine: src?.cuisine || undefined,
      diet: src?.meal_type || undefined,
      video_id: extractYouTubeId(src?.youtube_video_id || "") || undefined,
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Touch gesture handlers (mobile)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStart(e.touches[0].clientX);
    setTouchEnd(null);
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStart === null) return;
    setTouchEnd(e.touches[0].clientX);
  };
  const handleTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    if (isLeftSwipe && currentSection < sections.length - 1) {
      setCurrentSection(currentSection + 1);
    }
    if (isRightSwipe && currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  // Handle when existing lesson data changes (for editing)
  useEffect(() => {
    console.log('🔄 existingLessonData changed:', existingLessonData);
    if (existingLessonData) {
      console.log('📝 Updating lesson data with existing data...');
      setLessonData(prevData => {
        const updatedData = {
          ...prevData,
          ...existingLessonData,
          // Ensure arrays are properly initialized
          ingredients: existingLessonData.ingredients?.length > 0 
            ? existingLessonData.ingredients 
            : [{ id: '1', amount: '', unit: '', name: '' }],
          instructions: existingLessonData.instructions?.length > 0 
            ? existingLessonData.instructions 
            : [{ id: '1', step: 1, text: '' }],
          sections: existingLessonData.sections?.length > 0 
            ? existingLessonData.sections 
            : DEFAULT_SECTIONS,
        };
        console.log('✅ Updated lesson data:', updatedData);
        return updatedData;
      });

      // Update section states based on what data exists in the lesson
      console.log('🎛️ Determining section states based on lesson data...');
      const newSectionStates = {
        // Basic Info: Always show if we have title or description
        basicInfo: !!(existingLessonData.title || existingLessonData.description),
        
        // Media & Video: Show if we have image or video
        mediaVideo: !!(existingLessonData.image_url || existingLessonData.youtube_video_id || existingLessonData.video_url),
        
        // Recipe Details: Show if we have recipe data
        recipeDetails: !!(
          existingLessonData.recipe_name ||
          existingLessonData.meal_type ||
          existingLessonData.cuisine ||
          existingLessonData.ingredients?.length > 0 ||
          existingLessonData.instructions?.length > 0 ||
          existingLessonData.prep_time ||
          existingLessonData.cook_time ||
          existingLessonData.servings
        ),
        
        // Lesson Sections: Show if we have lesson sections with actual content
        lessonSections: !!(existingLessonData.sections?.length > 0 && 
          existingLessonData.sections.some((section: any) => 
            section.content && section.content.trim().length > 0
          ))
      };
      
      console.log('🎛️ New section states:', newSectionStates);
      setSectionStates(newSectionStates);

      // Set the active tab based on what data exists
      if (existingLessonData.ingredients?.length > 0 || existingLessonData.instructions?.length > 0) {
        console.log('📝 Setting active tab to ingredients (has recipe data)');
        setActiveTab("ingredients");
      } else if (existingLessonData.recipe_name || existingLessonData.cuisine) {
        console.log('📝 Setting active tab to basics (has recipe basics)');
        setActiveTab("basics");
      } else {
        console.log('📝 Keeping default active tab (basics)');
        setActiveTab("basics");
      }
    }
  }, [existingLessonData]);

  // Preview functionality
  const collectCompletePreviewData = () => {
    return {
      // Basic Info
      title: lessonData.title,
      description: lessonData.description,
      emoji: lessonData.emoji,
      
      // Media & Video
      image_url: lessonData.image_url,
      youtube_video_id: lessonData.youtube_video_id,
      
      // Recipe Details (Rich Format)
      recipe_name: lessonData.recipe_name,
      meal_type: lessonData.meal_type,
      cuisine: lessonData.cuisine,
      difficulty_level: lessonData.difficulty_level,
      prep_time: lessonData.prep_time,
      cook_time: lessonData.cook_time,
      servings: lessonData.servings,
      
      // Rich Recipe Data
      ingredients: lessonData.ingredients,
      instructions: lessonData.instructions,
      
      // Lesson Sections
      sections: lessonData.sections,
      
      // Section Toggle States
      sectionStates: {
        basicInfo: sectionStates.basicInfo,
        mediaVideo: sectionStates.mediaVideo,
        recipeDetails: sectionStates.recipeDetails,
        lessonSections: sectionStates.lessonSections,
      },
      
      // Lesson metadata
      id: lessonData.id,
      course_id: lessonData.course_id,
      community_id: communityId,
    };
  };

  const handlePreview = () => {
    const previewData = collectCompletePreviewData();
    const previewId = lessonData.id || 'new';

    // Save to sessionStorage for desktop preview page and for consistency
    sessionStorage.setItem(`lesson-preview-${previewId}`, JSON.stringify(previewData));

    if (isMobile) {
      // On mobile, show inline overlay instead of a new tab
      setMobilePreviewOpen(true);
      setPreviewIsOpen(true);
      return;
    }

    // Desktop: open a new tab
    setPreviewIsOpen(true);
    const previewUrl = `/community/${communityId}/lesson/${previewId}/preview`;
    const previewWindow = window.open(previewUrl, '_blank');
    if (previewWindow) previewWindow.focus();
  };

  // Auto-save preview data for real-time updates
  useEffect(() => {
    if (previewIsOpen) {
      const previewData = collectCompletePreviewData();
      const previewId = lessonData.id || 'new';
      sessionStorage.setItem(`lesson-preview-${previewId}`, JSON.stringify(previewData));
      
      // Also trigger a custom event for cross-tab communication
      const event = new CustomEvent('lessonPreviewUpdate', { detail: previewData });
      window.dispatchEvent(event);
    }
  }, [lessonData, sectionStates, previewIsOpen]);

  // Lock background scroll when mobile preview is open
  useEffect(() => {
    if (!isMobile) return;
    const originalOverflow = document.body.style.overflow;
    if (mobilePreviewOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow || '';
    }
    return () => {
      document.body.style.overflow = originalOverflow || '';
    };
  }, [isMobile, mobilePreviewOpen]);

  // Disable scrolling inside the iframe preview (mobile)
  const handleMobilePreviewLoaded = () => {
    const iframe = mobilePreviewIframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      doc.documentElement.style.overflow = 'hidden';
      doc.documentElement.style.overscrollBehavior = 'none';
      if (doc.body) {
        doc.body.style.overflow = 'hidden';
        doc.body.style.height = '100%';
      }
      const prevent = (e: Event) => {
        e.preventDefault();
      };
      doc.addEventListener('wheel', prevent, { passive: false });
      doc.addEventListener('touchmove', prevent, { passive: false });
      // Ensure starts at top
      iframe.contentWindow?.scrollTo(0, 0);
    } catch (e) {
      // Ignore cross-origin errors (should be same-origin in this app)
    }
  };

  // Save lesson mutation
  const saveLessonMutation = useMutation({
    mutationFn: async (data: Lesson) => {
      const url = data.id
        ? `/api/communities/${communityId}/lessons/${data.id}`
        : `/api/communities/${communityId}/courses/${courseId}/lessons`;
      const method = data.id ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error("Failed to save lesson");
      return response.json();
    },
    onSuccess: (savedLesson) => {
      queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
      toast({ title: "Lesson saved", description: "Your lesson has been saved successfully." });
      if (onSave) onSave(savedLesson);
      onClose();
    },
  });

  // Update section state helper function
  const updateSectionState = (sectionKey: keyof typeof sectionStates, enabled: boolean) => {
    setSectionStates(prev => ({
      ...prev,
      [sectionKey]: enabled
    }));
  };

  // Recipe ingredient management
  const addIngredient = () => {
    const newId = (lessonData.ingredients.length + 1).toString();
    setLessonData({
      ...lessonData,
      ingredients: [...lessonData.ingredients, { id: newId, amount: '', unit: '', name: '' }]
    });
  };

  const removeIngredient = (id: string) => {
    if (lessonData.ingredients.length > 1) {
      setLessonData({
        ...lessonData,
        ingredients: lessonData.ingredients.filter(ing => ing.id !== id)
      });
    }
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setLessonData({
      ...lessonData,
      ingredients: lessonData.ingredients.map(ing => 
        ing.id === id ? { ...ing, [field]: value } : ing
      )
    });
  };

  // Recipe instruction management  
  const addInstruction = () => {
    const newId = (lessonData.instructions.length + 1).toString();
    const newStep = lessonData.instructions.length + 1;
    setLessonData({
      ...lessonData,
      instructions: [...lessonData.instructions, { id: newId, step: newStep, text: '' }]
    });
  };

  const removeInstruction = (id: string) => {
    if (lessonData.instructions.length > 1) {
      const updatedInstructions = lessonData.instructions
        .filter(inst => inst.id !== id)
        .map((inst, index) => ({ ...inst, step: index + 1 }));
      
      setLessonData({
        ...lessonData,
        instructions: updatedInstructions
      });
    }
  };

  const updateInstruction = (id: string, text: string) => {
    setLessonData({
      ...lessonData,
      instructions: lessonData.instructions.map(inst => 
        inst.id === id ? { ...inst, text } : inst
      )
    });
  };

  // Add a new section
  const addSection = (type: "about" | "custom") => {
    const template = SECTION_TEMPLATES[selectedTemplate];
    const newSection: LessonSection = {
      section_type: type,
      title: template?.title || "Custom Section",
      content: template?.content || "",
      template_id: type === "about" ? selectedTemplate : undefined,
      display_order: lessonData.sections?.length || 0,
      is_visible: true,
    };

    setLessonData({
      ...lessonData,
      sections: [...(lessonData.sections || []), newSection],
    });
  };

  // Update a section
  const updateSection = (index: number, updates: Partial<LessonSection>) => {
    const sections = [...(lessonData.sections || [])];
    sections[index] = { ...sections[index], ...updates };
    setLessonData({ ...lessonData, sections });
  };

  // Delete a section
  const deleteSection = (index: number) => {
    const sections = (lessonData.sections || []).filter((_, i) => i !== index);
    setLessonData({ ...lessonData, sections });
  };

  // Reorder sections
  const moveSection = (index: number, direction: "up" | "down") => {
    const sections = [...(lessonData.sections || [])];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;

    [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
    sections.forEach((section, i) => {
      section.display_order = i;
    });

    setLessonData({ ...lessonData, sections });
  };


  // Extracted section blocks for reuse (desktop and mobile)
  const basicInfoSection = (
    <Card className="bg-blue-950 border-blue-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Basic Information</CardTitle>
          <Switch
            checked={sectionStates.basicInfo}
            onCheckedChange={(checked) => updateSectionState('basicInfo', checked)}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
      </CardHeader>
      {sectionStates.basicInfo && (
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lesson Title
              </label>
              <Input
                value={lessonData.title}
                onChange={(e) => setLessonData({ ...lessonData, title: e.target.value })}
                placeholder="e.g., Week 1: Meal Prep Basics"
                className="bg-blue-900/40 border-blue-700 text-blue-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Emoji</label>
              <Select
                value={lessonData.emoji}
                onValueChange={(value) => setLessonData({ ...lessonData, emoji: value })}
              >
                <SelectTrigger className="bg-blue-900/40 border-blue-700 text-blue-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-blue-950 border-blue-700" style={{zIndex: 100006}}>
                  {["🍽️", "🥗", "🍝", "🍜", "🍱", "🍲", "🥘", "🍳", "🥙", "🌮", "🍕", "🍔"].map(
                    (emoji) => (
                      <SelectItem key={emoji} value={emoji} className="text-white">
                        {emoji}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <Textarea
              value={lessonData.description}
              onChange={(e) => setLessonData({ ...lessonData, description: e.target.value })}
              placeholder="Brief description of what students will learn..."
              className="bg-blue-900/40 border-blue-700 text-blue-100"
              rows={3}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );

  const mediaVideoSection = (
    <Card className="bg-blue-950 border-blue-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Media & Video</CardTitle>
          <Switch
            checked={sectionStates.mediaVideo}
            onCheckedChange={(checked) => updateSectionState('mediaVideo', checked)}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
      </CardHeader>
      {sectionStates.mediaVideo && (
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300">YouTube Video</label>
            <div className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500" />
              <Input
                value={lessonData.youtube_video_id || ""}
                onChange={(e) => setLessonData({ ...lessonData, youtube_video_id: extractYouTubeId(e.target.value) })}
                placeholder="YouTube ID or URL"
                className="bg-blue-900/40 border-blue-700 text-blue-100 flex-1"
              />
            </div>
            {lessonData.youtube_video_id && (
              <div className="aspect-video w-full">
                <iframe
                  className="w-full h-full rounded"
                  src={buildYouTubeEmbedUrl(lessonData.youtube_video_id)}
                  title="Lesson Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Cover Image</label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => document.getElementById('lesson-image-input')?.click()}
              >
                Choose Image
              </Button>
              <input
                id="lesson-image-input"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setLessonData({ ...lessonData, image_url: reader.result as string });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </div>
            {lessonData.image_url && (
              <img src={lessonData.image_url} alt="Cover" className="w-full max-w-md rounded-lg" />
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );

  const recipeDetailsSection = (
    <Card className="bg-blue-950 border-blue-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white">Recipe Details</CardTitle>
          <Switch
            checked={sectionStates.recipeDetails}
            onCheckedChange={(checked) => updateSectionState('recipeDetails', checked)}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
      </CardHeader>
      {sectionStates.recipeDetails && (
        <CardContent className="p-6">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 mb-6 gap-2">
              <TabsTrigger
                value="ingredients"
                className="rounded-lg bg-blue-900/50 border border-blue-700 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-blue-100 px-2 py-1 text-[11px] leading-tight sm:text-sm whitespace-normal break-words text-center"
              >
                Ingredients
              </TabsTrigger>
              <TabsTrigger
                value="instructions"
                className="rounded-lg bg-blue-900/50 border border-blue-700 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-blue-100 px-2 py-1 text-[11px] leading-tight sm:text-sm whitespace-normal break-words text-center"
              >
                Instructions
              </TabsTrigger>
              <TabsTrigger
                value="nutrition"
                className="rounded-lg bg-blue-900/50 border border-blue-700 data-[state=active]:bg-purple-600 data-[state=active]:text-white text-blue-100 px-2 py-1 text-[11px] leading-tight sm:text-sm whitespace-normal break-words text-center"
              >
                Nutrition
              </TabsTrigger>
            </TabsList>


            {/* Ingredients Tab */}
            <TabsContent value="ingredients" className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Ingredients</h3>
                <Button onClick={addIngredient} size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Ingredient
                </Button>
              </div>

              <div className="space-y-3">
                {lessonData.ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="flex gap-2 items-center">
                    <div className="flex-[3] min-w-0">
                      <Input
                        placeholder="Ingredient name"
                        value={ingredient.name}
                        onChange={(e) => updateIngredient(ingredient.id, 'name', e.target.value)}
                        className="bg-blue-900/40 border-blue-700 text-blue-100"
                      />
                    </div>
                    <div className="w-12 sm:w-16">
                      <Input
                        placeholder="1"
                        value={ingredient.amount}
                        onChange={(e) => updateIngredient(ingredient.id, 'amount', e.target.value)}
                        className="bg-blue-900/40 border-blue-700 text-blue-100 text-center"
                      />
                    </div>
                    <div className="w-20 sm:w-24">
                      <Input
                        placeholder="cup"
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(ingredient.id, 'unit', e.target.value)}
                        className="bg-blue-900/40 border-blue-700 text-blue-100"
                      />
                    </div>
                    <Button
                      onClick={() => removeIngredient(ingredient.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Instructions Tab */}
            <TabsContent value="instructions" className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Instructions</h3>
                <Button onClick={addInstruction} size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-4">
                {lessonData.instructions.map((instruction) => (
                  <div key={instruction.id} className="flex gap-2 items-start">
                    <div className="w-7 h-7 bg-purple-600 rounded-md flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 mt-1">
                      {instruction.step}
                    </div>
                    <div className="flex-1">
                      <Textarea
                        placeholder="Describe this step..."
                        value={instruction.text}
                        onChange={(e) => updateInstruction(instruction.id, e.target.value)}
                        rows={2}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <Button
                      onClick={() => removeInstruction(instruction.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 p-1 mt-1"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Nutrition Tab */}
            <TabsContent value="nutrition" className="space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Calories</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={lessonData.nutrition_info?.calories ?? ''}
                      onChange={(e) => setLessonData({
                        ...lessonData,
                        nutrition_info: { ...(lessonData.nutrition_info || { protein:0, carbs:0, fat:0, calories:0 }), calories: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-blue-900/40 border-blue-700 text-blue-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Protein (g)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={lessonData.nutrition_info?.protein ?? ''}
                      onChange={(e) => setLessonData({
                        ...lessonData,
                        nutrition_info: { ...(lessonData.nutrition_info || { protein:0, carbs:0, fat:0, calories:0 }), protein: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-blue-900/40 border-blue-700 text-blue-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Carbs (g)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={lessonData.nutrition_info?.carbs ?? ''}
                      onChange={(e) => setLessonData({
                        ...lessonData,
                        nutrition_info: { ...(lessonData.nutrition_info || { protein:0, carbs:0, fat:0, calories:0 }), carbs: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-blue-900/40 border-blue-700 text-blue-100"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">Fat (g)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={lessonData.nutrition_info?.fat ?? ''}
                      onChange={(e) => setLessonData({
                        ...lessonData,
                        nutrition_info: { ...(lessonData.nutrition_info || { protein:0, carbs:0, fat:0, calories:0 }), fat: parseInt(e.target.value) || 0 }
                      })}
                      className="bg-blue-900/40 border-blue-700 text-blue-100"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-400">Optional: fill what you know; leave blank to skip.</div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );

  const lessonSectionsSection = (
    <Card className="bg-blue-950 border-blue-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-white">Lesson Sections</CardTitle>
            <Switch
              checked={sectionStates.lessonSections}
              onCheckedChange={(checked) => updateSectionState('lessonSections', checked)}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-48">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600" style={{zIndex: 100006}}>
                {Object.entries(SECTION_TEMPLATES).map(([key, template]) => (
                  <SelectItem key={key} value={key} className="text-white">
                    {template.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => addSection("about")}
              size="sm"
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Section
            </Button>
          </div>
        </div>
      </CardHeader>
      {sectionStates.lessonSections && (
        <CardContent className="space-y-4">
          {lessonData.sections?.map((section, index) => (
            <div
              key={index}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-gray-400" />
                  {editingSection === index ? (
                    <Input
                      value={section.title}
                      onChange={(e) =>
                        updateSection(index, { title: e.target.value })
                      }
                      className="bg-gray-700 border-gray-600 text-white"
                      autoFocus
                    />
                  ) : (
                    <h3 className="font-medium text-white">{section.title}</h3>
                  )}
                  {section.template_id && (
                    <Badge className="bg-purple-600 text-white text-xs">
                      {SECTION_TEMPLATES[section.template_id]?.title}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => moveSection(index, "up")}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 p-1"
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    onClick={() => moveSection(index, "down")}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 p-1"
                    disabled={index === (lessonData.sections?.length || 0) - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    onClick={() => setEditingSection(editingSection === index ? null : index)}
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 p-1"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => deleteSection(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {editingSection === index ? (
                <Textarea
                  value={section.content}
                  onChange={(e) => updateSection(index, { content: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white"
                  rows={6}
                  placeholder="Enter section content..."
                />
              ) : (
                <div className="text-gray-300 whitespace-pre-wrap">
                  {section.content || "No content yet. Click edit to add content."}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );

  const containerContent = (
    <div className={`bg-gray-800 rounded-lg w-full ${isInline ? 'max-h-[88vh] h-[88vh]' : 'max-w-7xl h-[90vh]'} flex flex-col ${isMobile ? 'h-[97vh] rounded-none' : ''} relative`}>
        {/* Header */}
        <div className="border-b border-gray-700 p-2 md:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{lessonData.emoji || "🍽️"}</span>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {lessonData.id ? "Edit Lesson" : "Create New Lesson"}
                </h2>
                <p className="text-sm text-gray-400">
                  Design your meal plan lesson with video, recipes, and educational content
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isMobile && (
                <>
                  <Button
                    onClick={handlePreview}
                    variant="outline"
                    className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button
                    onClick={() => saveLessonMutation.mutate(lessonData)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={saveLessonMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saveLessonMutation.isPending ? "Saving..." : "Save Lesson"}
                  </Button>
                </>
              )}
              <Button onClick={onClose} variant="ghost" className="text-gray-400">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {isMobile && (
            <div className="mt-3 grid grid-cols-1 gap-2">
              <Button
                onClick={handlePreview}
                variant="outline"
                className="w-full border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                onClick={() => saveLessonMutation.mutate(lessonData)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                disabled={saveLessonMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveLessonMutation.isPending ? "Saving..." : "Save Lesson"}
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className={`flex-1 ${isMobile ? 'relative overflow-hidden' : 'overflow-y-auto p-6 space-y-6'} ${isInline ? 'min-h-0' : ''}`}>
          {isMobile ? (
            <div className="flex-1 relative h-full">
              {/* Progress Dots */}
              <div className="flex justify-center gap-2 p-1 bg-gray-800">
                {sections.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full ${currentSection === index ? 'bg-purple-500' : 'bg-gray-600'}`}
                    onClick={() => setCurrentSection(index)}
                    aria-label={`Go to section ${index + 1}`}
                  />
                ))}
              </div>

              {/* Scrollable Container */}
              <div
                className="flex h-full transition-transform duration-300"
                style={{ transform: `translateX(-${currentSection * 100}%)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Section 1: Basic Info */}
                <div className="w-full flex-shrink-0 p-1 sm:p-3 overflow-y-auto">
                  {basicInfoSection}
                </div>

                {/* Section 2: Media & Video */}
                <div className="w-full flex-shrink-0 p-1 sm:p-3 overflow-y-auto">
                  {mediaVideoSection}
                </div>

                {/* Section 3: Recipe Details */}
                <div className="w-full flex-shrink-0 p-1 sm:p-3 overflow-y-auto">
                  {recipeDetailsSection}
                </div>

                {/* Section 4: Lesson Sections */}
                <div className="w-full flex-shrink-0 p-1 sm:p-3 overflow-y-auto">
                  {lessonSectionsSection}
                </div>
              </div>

              {/* Navigation Arrows */}
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-gray-700 p-2 rounded-full disabled:opacity-50"
                onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
                disabled={currentSection === 0}
                aria-label="Previous section"
              >
                ←
              </button>
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-gray-700 p-2 rounded-full disabled:opacity-50"
                onClick={() => setCurrentSection(Math.min(sections.length - 1, currentSection + 1))}
                disabled={currentSection === sections.length - 1}
                aria-label="Next section"
              >
                →
              </button>
            </div>
          ) : (
            <div className="overflow-y-auto p-6 space-y-6 h-full">
              {basicInfoSection}
              {mediaVideoSection}
              {recipeDetailsSection}
              {lessonSectionsSection}
            </div>
          )}
        </div>
        {/* Mobile Preview Overlay (inline fast render) - use RecipeDisplay card */}
        {isMobile && mobilePreviewOpen && (
          <div className="fixed inset-0 z-[2000000] bg-gray-900 overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-3 flex items-center">
              <button className="text-gray-300" onClick={() => setMobilePreviewOpen(false)} aria-label="Back">← Back</button>
              <div className="ml-2 font-semibold text-white">Preview</div>
            </div>
            <div className="max-w-md mx-auto p-3">
              <RecipeDisplay 
                recipe={mapLessonToRecipe(lessonData)} 
                variant="dark" 
                headerAboveVideo={true}
                forceDescriptionOpen={true}
                hideDescriptionToggle={true}
              />
              {lessonData.sections && lessonData.sections.length > 0 && (
                <div className="mt-4 bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                  <div className="text-white font-semibold">Lesson Sections</div>
                  <div className="space-y-2">
                    {lessonData.sections.map((section: any, idx: number) => (
                      <div key={idx} className="bg-gray-900 border border-gray-800 rounded p-3">
                        <div className="text-white font-medium mb-1">
                          {section.title || `Section ${idx + 1}`}
                        </div>
                        {section.content ? (
                          <div className="text-gray-300 whitespace-pre-wrap">{section.content}</div>
                        ) : (
                          <div className="text-gray-500 text-sm">No content yet.</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );

  return isInline ? (
    containerContent
  ) : (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1 sm:p-4">
      {containerContent}
    </div>
  );
}

