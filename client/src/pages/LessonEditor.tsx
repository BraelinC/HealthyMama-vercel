import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import InlineLessonEditor from "@/components/community/InlineLessonEditor";
// Types will be inferred from the API response

export default function LessonEditor() {
  const { communityId, lessonId } = useParams();
  const [, setLocation] = useLocation();

  // Fetch the specific lesson data
  const { data: courses, isLoading } = useQuery({
    queryKey: [`/api/communities/${communityId}/courses`],
  });

  // Find the lesson in the courses data
  const lesson = courses && Array.isArray(courses) 
    ? courses.flatMap((course: any) => 
        (course.modules || []).flatMap((module: any) => module.lessons || [])
      ).find((l: any) => l.id === parseInt(lessonId || '0'))
    : null;

  // Always show loading state first, then transition to editor
  if (isLoading || !courses || !lesson) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-2 text-gray-400 text-sm">Loading lesson...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <InlineLessonEditor
        lesson={lesson}
        communityId={communityId || ''}
        courseId={lesson.course_id}
        isCreator={true}
        onClose={() => setLocation(`/community/${communityId}`)}
      />
    </div>
  );
}