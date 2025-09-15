import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BookOpen, 
  Plus, 
  X,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Edit,
  Trash2,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SingleImageUploader } from "@/components/SingleImageUploader";
import { LessonEditor } from "@/components/community/LessonEditor";

interface CourseManagementProps {
  isOpen: boolean;
  onClose: () => void;
  communityId: string;
}

interface Course {
  id: number;
  title: string;
  description?: string;
  emoji?: string;
  category: string;
  is_published: boolean;
  lesson_count: number;
  created_at: string;
}

export default function CourseManagement({ isOpen, onClose, communityId }: CourseManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [showCourseCreationForm, setShowCourseCreationForm] = useState(false);
  const [draggedCourse, setDraggedCourse] = useState<Course | null>(null);
  
  // Course creation form state
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [courseCategory, setCourseCategory] = useState("");
  const [courseEmoji, setCourseEmoji] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  
  // Module creation form state
  const [showModuleCreationForm, setShowModuleCreationForm] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDescription, setModuleDescription] = useState("");
  const [moduleEmoji, setModuleEmoji] = useState("");
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [isCreatingModule, setIsCreatingModule] = useState(false);
  const [showLessonCreationForm, setShowLessonCreationForm] = useState(false);
  // Course picker overlay (shown first when dialog opens)
  const [showCoursePicker, setShowCoursePicker] = useState<boolean>(false);

  // Lesson editing state
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [selectedLessonData, setSelectedLessonData] = useState<any>(null);
  const [loadingLessonId, setLoadingLessonId] = useState<string | null>(null);

  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // When dialog opens, show picker first if no course is selected yet
  useEffect(() => {
    if (isOpen) {
      // Show the course picker immediately; it will collapse once chosen
      setShowCoursePicker(true);
    } else {
      setShowCoursePicker(false);
    }
  }, [isOpen]);

  // Fetch courses for this community
  const { data: courses = [], isLoading } = useQuery({
    queryKey: [`/api/communities/${communityId}/courses`],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/communities/${communityId}/courses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch courses');
      return await response.json();
    },
    enabled: isOpen && !!communityId,
  });

  // Get modules for the currently selected course
  const selectedCourse = courses.find((course: any) => course.id === selectedCourseId);
  const modules = selectedCourse?.modules || [];

  // Auto-select first course if none selected
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // Auto-select first module if none selected and modules exist
  useEffect(() => {
    if (modules.length > 0 && !selectedModuleId) {
      setSelectedModuleId(modules[0].id);
    }
  }, [modules, selectedModuleId]);

  // Clear form function
  const clearForm = () => {
    setCourseTitle("");
    setCourseDescription("");
    setCourseCategory("");
    setCourseEmoji("");
    setCoverImageUrl("");
  };

  // Clear module form function
  const clearModuleForm = () => {
    setModuleTitle("");
    setModuleDescription("");
    setModuleEmoji("");
    setIsCreatingModule(false);
  };

  // Course creation mutation
  const createCourseMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/communities/${communityId}/courses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: courseTitle,
          description: courseDescription,
          category: courseCategory,
          emoji: courseEmoji,
          cover_image: coverImageUrl,
          is_published: false
        })
      });
      if (!response.ok) throw new Error('Failed to create course');
      return await response.json();
    },
    onSuccess: (newCourse) => {
      queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
      clearForm();
      setShowCourseCreationForm(false);
      setSelectedCourseId(newCourse.id); // Select the new course
      setShowCoursePicker(false); // jump straight to editor view
      toast({
        title: "Course Created",
        description: "Your new course has been created successfully!"
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Lesson editing function
  const handleEditLesson = async (lesson: any) => {
    console.log('🔍 Edit button clicked for lesson:', lesson);
    console.log('🏠 Current communityId:', communityId);
    console.log('📚 Current courseId:', selectedCourseId);
    console.log('📖 Current moduleId:', selectedModuleId);

    // Optimistic open with existing lesson object so UI shows immediately
    setSelectedLessonData(lesson);
    setEditingLessonId(lesson.id);
    setShowLessonCreationForm(true);

    // Background fetch to hydrate with full data when available
    setLoadingLessonId(lesson.id);
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = `/api/communities/${communityId}/lessons/${lesson.id}`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.warn('Background fetch failed; continuing with optimistic data:', errorText);
        return; // keep optimistic data if fetch fails
      }
      const lessonData = await response.json();
      setSelectedLessonData(lessonData);
    } catch (error) {
      console.warn('Background lesson fetch failed, using optimistic data');
    } finally {
      setLoadingLessonId(null);
    }
  };

  // Delete lesson mutation
  const deleteLessonMutation = useMutation({
    mutationFn: async (lessonId: string) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/communities/${communityId}/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error('Failed to delete lesson');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Lesson Deleted",
        description: "The lesson has been deleted successfully."
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/communities/${communityId}/courses`]
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete lesson",
        variant: "destructive"
      });
    }
  });

  const handleDeleteLesson = (lessonId: string) => {
    if (confirm('Are you sure you want to delete this lesson? This action cannot be undone.')) {
      deleteLessonMutation.mutate(lessonId);
    }
  };


  const handleDragStart = (course: Course) => {
    setDraggedCourse(course);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetCourse: Course, dropPosition: 'above' | 'below' = 'above') => {
    if (!draggedCourse || draggedCourse.id === targetCourse.id) return;
    
    // Find indices
    const draggedIndex = courses.findIndex((c: Course) => c.id === draggedCourse.id);
    const targetIndex = courses.findIndex((c: Course) => c.id === targetCourse.id);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Create new array with reordered courses
    const newCourses = [...courses];
    const [removed] = newCourses.splice(draggedIndex, 1);
    
    // Insert at the target position
    const insertIndex = dropPosition === 'above' ? targetIndex : targetIndex + 1;
    newCourses.splice(draggedIndex < targetIndex ? insertIndex - 1 : insertIndex, 0, removed);
    
    // Update React Query cache immediately for instant UI feedback
    queryClient.setQueryData([`/api/communities/${communityId}/courses`], newCourses);
    
    // TODO: Call backend API to persist the new order if needed
    // For now, just show success feedback
    toast({
      title: "Course Reordered", 
      description: "Course order updated successfully!"
    });
    
    setDraggedCourse(null);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/80 z-[100000]" />
      <DialogContent className="max-w-7xl w-[98vw] max-h-[95vh] bg-gray-900 border-gray-700 text-white z-[100001] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-gray-700">
          <DialogTitle className="text-2xl font-bold text-white">Course Management</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* Initial Course Picker Overlay */}
          {showCoursePicker && (
            <div className="absolute inset-0 z-[2000001] bg-gray-900/95 backdrop-blur-sm">
              <div className="max-w-2xl mx-auto p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold">Courses</h3>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => {
                      setShowCourseCreationForm(true);
                      setShowCoursePicker(false);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Course
                  </Button>
                </div>
                <div className="space-y-2">
                  {courses.map((course: Course) => (
                    <div
                      key={course.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        course.id === selectedCourseId 
                          ? 'bg-blue-600/20 border-blue-500' 
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                      }`}
                      onClick={() => {
                        setSelectedCourseId(course.id);
                        setShowCoursePicker(false);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{course.emoji || '📚'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{course.title}</div>
                          <div className="text-xs text-gray-400">
                            {course.lesson_count} lessons • {course.category}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">Beginner</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Left Sidebar - Course List */}
          <div className="w-full md:w-80 bg-gray-800 md:border-r border-gray-700 flex flex-col">
            {/* Mobile: Compact dropdown when course selected, full list otherwise */}
            {isMobile && selectedCourseId ? (
              // Compact Dropdown for Mobile
              <div className="p-4 border-b border-gray-700">
                <Select 
                  value={selectedCourseId.toString()} 
                  onValueChange={(value) => setSelectedCourseId(parseInt(value))}
                >
                  <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white">
                    <SelectValue>
                      {(() => {
                        const selectedCourse = courses.find((c: Course) => c.id === selectedCourseId);
                        return selectedCourse ? `${selectedCourse.emoji || '📚'} ${selectedCourse.title}` : 'Select Course';
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600 z-[100003]">
                    {courses.map((course: Course) => (
                      <SelectItem key={course.id} value={course.id.toString()} className="text-white hover:bg-gray-700">
                        {course.emoji || '📚'} {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              // Full Course List Header (Desktop or Mobile without selection)
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Courses</h3>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowCourseCreationForm(true);
                      setSelectedCourseId(null); // Clear selected course to show form
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Course
                  </Button>
                </div>
              </div>
            )}

            {/* Draggable Course List - Only show if not mobile-compact mode */}
            {!(isMobile && selectedCourseId) && (
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {courses.map((course: Course) => (
                <div
                  key={course.id}
                  draggable
                  onDragStart={() => handleDragStart(course)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(course)}
                  className={`p-3 rounded-lg border cursor-move transition-colors ${
                    course.id === selectedCourseId 
                      ? 'bg-blue-600/20 border-blue-500' 
                      : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
                  }`}
                  onClick={() => setSelectedCourseId(course.id)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-gray-400" />
                    <span className="text-lg">{course.emoji || '📚'}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">
                        {course.title}
                      </h4>
                      <p className="text-xs text-gray-400">
                        {course.lesson_count} lessons • {course.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button 
                        size="sm"
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast({
                            title: "Coming Soon",
                            description: "Course editing will be available soon!"
                          });
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm"
                        variant="ghost" 
                        className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast({
                            title: "Coming Soon",
                            description: "Course deletion will be available soon!"
                          });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Content - Course Details or Creation Form */}
          <div className={`w-full md:flex-1 p-6 overflow-y-auto ${
            isMobile && selectedCourseId ? 'flex-1' : 'h-2/3 md:flex-1'
          }`}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : showCourseCreationForm ? (
              // Course Creation Form
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Create New Course</h2>
                  <p className="text-gray-400">Set up your meal planning course with lessons and content.</p>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-6">
                  <form className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Course Title</label>
                      <Input
                        placeholder="Enter course title..."
                        value={courseTitle}
                        onChange={(e) => setCourseTitle(e.target.value)}
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Course Cover Image</label>
                      <div className="space-y-3">
                        <SingleImageUploader
                          onImageUploaded={(url) => setCoverImageUrl(url)}
                          className="w-full"
                        />
                        {coverImageUrl && (
                          <div className="relative">
                            <img
                              src={coverImageUrl}
                              alt="Course cover preview"
                              className="w-full h-32 object-cover rounded-lg border border-gray-600"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setCoverImageUrl("")}
                              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Description</label>
                      <textarea
                        placeholder="Describe what students will learn in this course..."
                        rows={4}
                        value={courseDescription}
                        onChange={(e) => setCourseDescription(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Category</label>
                      <Select value={courseCategory} onValueChange={setCourseCategory}>
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-700 border-gray-600 z-[100004]">
                          <SelectItem value="beginner" className="text-white hover:bg-gray-600">Beginner</SelectItem>
                          <SelectItem value="intermediate" className="text-white hover:bg-gray-600">Intermediate</SelectItem>
                          <SelectItem value="advanced" className="text-white hover:bg-gray-600">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Course Emoji (Optional)</label>
                      <Select value={courseEmoji} onValueChange={(v) => setCourseEmoji(v)}>
                        <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                          <SelectValue placeholder="Pick an emoji" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700 z-[100004]">
                          {['📚','🍽️','🔥','⭐','🥗','🍝','⚡','💪','🧠','🍔','🥑','🍱','🍜','🍩','🧁'].map((e) => (
                            <SelectItem key={e} value={e} className="text-white hover:bg-gray-700">
                              {e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex gap-3 pt-6">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          clearForm();
                          setShowCourseCreationForm(false);
                          setSelectedCourseId(courses[0]?.id || null);
                        }}
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={createCourseMutation.isPending || !courseTitle.trim() || !courseCategory}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!courseTitle.trim()) {
                            toast({
                              title: "Course Title Required",
                              description: "Please enter a title for your course.",
                              variant: "destructive"
                            });
                            return;
                          }
                          if (!courseCategory) {
                            toast({
                              title: "Category Required", 
                              description: "Please select a category for your course.",
                              variant: "destructive"
                            });
                            return;
                          }
                          createCourseMutation.mutate();
                        }}
                      >
                        {createCourseMutation.isPending ? "Creating..." : "Create Course"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            ) : selectedCourse ? (
              // Course Content Management
              <div>
                {/* Course Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{selectedCourse.emoji || '📚'}</span>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-white">{selectedCourse.title}</h2>
                      <p className="text-gray-400 capitalize">{selectedCourse.category} • {selectedCourse.lesson_count} lessons</p>
                    </div>
                  </div>
                  {selectedCourse.description && (
                    <p className="text-gray-300 mb-4">{selectedCourse.description}</p>
                  )}
                </div>

                {/* Course Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{selectedCourse.lesson_count || 0}</div>
                    <div className="text-sm text-gray-400">Lessons</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">0</div>
                    <div className="text-sm text-gray-400">Modules</div>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-4 text-center">
                    <Button
                      className={`${selectedCourse.is_published ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'} text-white w-full`}
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem('auth_token');
                          const resp = await fetch(`/api/communities/${communityId}/courses/${selectedCourse.id}`, {
                            method: 'PUT',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`,
                            },
                            body: JSON.stringify({ is_published: !selectedCourse.is_published })
                          });
                          if (!resp.ok) throw new Error('Failed to update publish status');
                          await queryClient.invalidateQueries({ queryKey: [`/api/communities/${communityId}/courses`] });
                        } catch (e) {
                          console.error(e);
                        }
                      }}
                    >
                      {selectedCourse.is_published ? 'Unpost' : 'Post'}
                    </Button>
                    <div className="text-sm text-gray-400 mt-2">Status</div>
                  </div>
                </div>

                {/* Course Content Structure */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Course Content</h3>
                    <Button 
                      onClick={() => setShowModuleCreationForm(true)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Module
                    </Button>
                  </div>

                  {/* Modules and Lessons */}
                  <div className="space-y-3 -mx-3 md:mx-0">
                    {/* Module Selection and Display */}
                    {(() => {
                      // Get current module from real API data
                      const currentModule = modules.find((m: any) => m.id === selectedModuleId) || modules[0];

                      // Show modules UI if modules exist
                      if (modules.length > 0) {
                        return (
                          <div className="bg-gray-800 rounded-lg border border-gray-700">
                            {/* Module Selection Dropdown */}
                            <div className="p-4 border-b border-gray-700">
                              <Select 
                                value={selectedModuleId?.toString() || ""} 
                                onValueChange={(value) => setSelectedModuleId(Number(value))}
                              >
                                <SelectTrigger className="w-full bg-gray-700 border-gray-600 text-white h-12 px-4 rounded-lg text-left">
                                  <SelectValue placeholder="Select a module" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-800 border-gray-700" style={{zIndex: 100005}}>
                                  {modules.map((module: any) => (
                                    <SelectItem 
                                      key={module.id} 
                                      value={module.id.toString()}
                                      className="text-white hover:bg-gray-700 focus:bg-gray-700"
                                    >
                                      {module.emoji} {module.title}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Lessons within selected module */}
                            <div className="p-1 md:p-4 space-y-2">
                              {showLessonCreationForm ? (
                                // Inline Lesson Creation Form
                                <div className="min-h-0 flex-1 -mx-2 md:mx-0">
                                  <LessonEditor
                                    communityId={communityId}
                                    courseId={selectedCourseId!}
                                    moduleId={selectedModuleId!}
                                    lessonData={selectedLessonData}
                                    isInline={true}
                                    onClose={() => {
                                      setShowLessonCreationForm(false);
                                      setEditingLessonId(null);
                                      setSelectedLessonData(null);
                                    }}
                                    onSave={() => {
                                      setShowLessonCreationForm(false);
                                      setEditingLessonId(null);
                                      setSelectedLessonData(null);
                                      // Cache invalidation is handled by LessonEditor
                                    }}
                                  />
                                </div>
                              ) : (
                                <>
                                  {currentModule?.lessons?.map((lesson: any) => (
                                    <div key={lesson.id} className="flex items-center justify-between py-3 md:py-2 px-3 md:px-3 bg-gray-700 rounded">
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-base md:text-sm">{lesson.emoji}</span>
                                        <span className="text-white truncate">{lesson.title}</span>
                                      </div>
                                      <div className="flex items-center gap-3 md:gap-2">
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="text-gray-400 hover:text-white h-8 w-8 md:h-6 md:w-6 p-0"
                                          onClick={() => handleEditLesson(lesson)}
                                          disabled={loadingLessonId === lesson.id}
                                        >
                                          {loadingLessonId === lesson.id ? (
                                            <Loader2 className="h-4 w-4 md:h-3 md:w-3 animate-spin" />
                                          ) : (
                                            <Edit className="h-4 w-4 md:h-3 md:w-3" />
                                          )}
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="text-gray-400 hover:text-white h-8 w-8 md:h-6 md:w-6 p-0"
                                          onClick={() => handleDeleteLesson(lesson.id)}
                                        >
                                          <Trash2 className="h-4 w-4 md:h-3 md:w-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  )) || (
                                    <div className="text-center py-6 text-gray-400">
                                      No lessons in this module yet
                                    </div>
                                  )}

                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full border-gray-600 text-gray-300 hover:bg-gray-700 py-3 md:py-2"
                                    onClick={() => setShowLessonCreationForm(true)}
                                  >
                                    <Plus className="h-4 w-4 md:h-3 md:w-3 mr-2" />
                                    Add Lesson
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      }
                      
                      // Show empty state message when no modules exist
                      return (
                        <div className="text-center py-8 text-gray-400">
                          <BookOpen className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                          <p>No modules created yet. Use "Add Module" to create your first module.</p>
                        </div>
                      );
                    })()}

                    {/* Module Creation Form */}
                    {showModuleCreationForm && (
                      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="module-title" className="block text-sm font-medium text-white mb-2">
                              Module Title
                            </label>
                            <input
                              type="text"
                              id="module-title"
                              value={moduleTitle}
                              onChange={(e) => setModuleTitle(e.target.value)}
                              placeholder="Enter module title..."
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="module-description" className="block text-sm font-medium text-white mb-2">
                              Module Description
                            </label>
                            <textarea
                              id="module-description"
                              value={moduleDescription}
                              onChange={(e) => setModuleDescription(e.target.value)}
                              placeholder="Enter module description..."
                              rows={3}
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="module-emoji" className="block text-sm font-medium text-white mb-2">
                              Module Emoji
                            </label>
                            <input
                              type="text"
                              id="module-emoji"
                              value={moduleEmoji}
                              onChange={(e) => setModuleEmoji(e.target.value)}
                              placeholder="📚"
                              className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
                            />
                          </div>
                          
                          <div className="flex gap-3 pt-2">
                            <Button 
                              onClick={async () => {
                                if (isCreatingModule) return;
                                
                                setIsCreatingModule(true);
                                try {
                                  const response = await fetch(`/api/communities/${communityId}/courses/${selectedCourseId}/modules`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                                    },
                                    body: JSON.stringify({
                                      title: moduleTitle,
                                      description: moduleDescription,
                                      emoji: moduleEmoji || '📚'
                                    })
                                  });

                                  if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({}));
                                    throw new Error(errorData.message || `Failed to create module (${response.status})`);
                                  }

                                  const newModule = await response.json();
                                  console.log('Module created successfully:', newModule);
                                  
                                  // Invalidate courses query to refresh modules data
                                  queryClient.invalidateQueries({
                                    queryKey: [`/api/communities/${communityId}/courses`]
                                  });
                                  
                                  // Auto-select the newly created module
                                  setSelectedModuleId(newModule.id);
                                  
                                  // Show success toast
                                  toast({
                                    title: "Module Created",
                                    description: `"${moduleTitle}" has been added to your course.`,
                                  });
                                  
                                  clearModuleForm();
                                  setShowModuleCreationForm(false);
                                } catch (error) {
                                  console.error('Error creating module:', error);
                                  toast({
                                    title: "Creation Failed",
                                    description: error instanceof Error ? error.message : "Failed to create module. Please try again.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setIsCreatingModule(false);
                                }
                              }}
                              className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                              disabled={!moduleTitle.trim() || isCreatingModule}
                            >
                              {isCreatingModule ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Creating...
                                </>
                              ) : (
                                'Create Module'
                              )}
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                if (!isCreatingModule) {
                                  clearModuleForm();
                                  setShowModuleCreationForm(false);
                                }
                              }}
                              className="border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50"
                              disabled={isCreatingModule}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-20">
                <BookOpen className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Courses Yet</h3>
                <p className="text-gray-400 mb-6">
                  Create your first course to get started with meal planning lessons.
                </p>
                <Button
                  onClick={() => {
                    setShowCourseCreationForm(true);
                    setSelectedCourseId(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Course
                </Button>
              </div>
            ) : (
              <div className="text-center py-20">
                <BookOpen className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Select a Course</h3>
                <p className="text-gray-400">
                  Choose a course from the list to manage its content.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

    </Dialog>
  );
}