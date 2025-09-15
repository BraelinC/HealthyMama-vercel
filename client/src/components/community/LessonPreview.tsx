import { useParams, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Eye } from "lucide-react";
import InlineLessonEditor from "./InlineLessonEditor";

interface PreviewData {
  // Basic Info
  title: string;
  description: string;
  emoji?: string;
  
  // Media & Video
  image_url?: string;
  youtube_video_id?: string;
  
  // Recipe Details (Rich Format)
  recipe_name?: string;
  meal_type?: string;
  cuisine?: string;
  difficulty_level?: number;
  prep_time?: number;
  cook_time?: number;
  servings?: number;
  
  // Rich Recipe Data
  ingredients: any[];
  instructions: any[];
  
  // Lesson Sections
  lesson_sections: any[];
  
  // Section Toggle States
  sectionStates: {
    basicInfo: boolean;
    mediaVideo: boolean;
    recipeDetails: boolean;
    lessonSections: boolean;
  };
  
  // Lesson metadata
  id?: string;
  course_id?: string;
  community_id?: string;
}

export default function LessonPreview() {
  const { communityId, lessonId } = useParams();
  const [, setLocation] = useLocation();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  const loadPreviewData = () => {
    const savedData = sessionStorage.getItem(`lesson-preview-${lessonId}`);
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setPreviewData(parsedData);
      } catch (error) {
        console.error('Error parsing preview data:', error);
      }
    }
  };

  useEffect(() => {
    // Initial load
    loadPreviewData();
    
    // Focus this window to bring it to front
    window.focus();
    
    // Listen for storage changes (works for same-origin tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `lesson-preview-${lessonId}`) {
        loadPreviewData();
      }
    };
    
    // Listen for custom events from the editor
    const handleCustomEvent = (e: CustomEvent) => {
      setPreviewData(e.detail);
    };
    
    // Manual polling as fallback (every 500ms)
    const pollInterval = setInterval(() => {
      loadPreviewData();
    }, 500);
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('lessonPreviewUpdate', handleCustomEvent as EventListener);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('lessonPreviewUpdate', handleCustomEvent as EventListener);
      clearInterval(pollInterval);
    };
  }, [lessonId]);

  const handleClose = () => {
    // Close the preview tab
    window.close();
    // If window.close() doesn't work (some browsers block it), redirect back
    setTimeout(() => {
      setLocation(`/community/${communityId}`);
    }, 100);
  };

  if (!previewData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-2 text-gray-400 text-sm">Loading preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 relative z-[9999]">
      {/* Preview Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-[9999]">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Button 
              onClick={handleClose}
              variant="ghost" 
              className="text-gray-400 hover:text-white p-2"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Eye className="w-6 h-6 text-purple-400" />
              <div>
                <h1 className="text-xl font-bold text-white">
                  {previewData.title || "Untitled Lesson"}
                </h1>
                <p className="text-sm text-purple-400 font-medium">
                  PREVIEW MODE - This is how students will see your lesson
                </p>
                <div className="text-xs text-gray-400 mt-1">
                  Sections: Basic({previewData?.sectionStates?.basicInfo ? '✓' : '✗'}) 
                  Media({previewData?.sectionStates?.mediaVideo ? '✓' : '✗'}) 
                  Recipe({previewData?.sectionStates?.recipeDetails ? '✓' : '✗'}) 
                  Lessons({previewData?.sectionStates?.lessonSections ? '✓' : '✗'})
                </div>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="border-purple-500 text-purple-400">
            Preview
          </Badge>
        </div>
      </div>

      {/* Use InlineLessonEditor in student view mode with preview data */}
      <InlineLessonEditor
        lesson={previewData}
        communityId={communityId || ''}
        courseId={previewData.course_id || 0}
        isCreator={false} // Force student view
        onClose={handleClose}
      />
    </div>
  );
}