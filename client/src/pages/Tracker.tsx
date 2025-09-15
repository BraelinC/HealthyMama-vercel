import { useState } from 'react';
import { Camera, Plus, Calendar, TrendingUp, X, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeApiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import CameraView from '@/components/tracker/CameraView';
import FoodReviewModal from '@/components/tracker/FoodReviewModal';
import FoodHistory from '@/components/tracker/FoodHistory';
import DetectionLoadingOverlay from '@/components/tracker/DetectionLoadingOverlay';
import { detectFoods, getModelInfo } from '@/lib/foodDetection';
import { useToast } from '@/hooks/use-toast';

export default function TrackerPage() {
  const [showCamera, setShowCamera] = useState(false);
  const [reviewData, setReviewData] = useState<any>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch today's food logs
  const { data: todayData, isLoading } = useQuery({
    queryKey: ['/api/food-logs/today'],
    queryFn: () => safeApiRequest('/api/food-logs/today'),
  });

  // Fetch week's data for stats
  const { data: weekData } = useQuery({
    queryKey: ['/api/food-logs/week'],
    queryFn: () => safeApiRequest('/api/food-logs/week'),
  });

  // Handle camera capture
  const handleCapture = async (imageData: string) => {
    console.log('📸 Camera capture initiated');
    console.log('📊 Image data size:', imageData.length, 'characters');
    
    // Hide camera and show loading overlay
    setShowCamera(false);
    setCapturedImage(imageData);
    setIsDetecting(true);
    
    // Add a small delay to ensure smooth transition
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Detect foods using Google Vision API
      console.log('🌐 Starting Google Vision API detection...');
      const startTime = Date.now();
      
      // This now calls Google Vision API through our backend
      const detections = await detectFoods(imageData);
      
      const elapsed = Date.now() - startTime;
      console.log(`⏱️ Detection completed in ${elapsed}ms`);
      console.log('📊 Detections received:', detections.length, 'items');
      
      // Log detection details
      if (detections.length > 0) {
        console.log('🥘 Detected items:');
        detections.forEach((item, i) => {
          console.log(`  ${i + 1}. ${item.name} - ${item.amount}${item.unit} (${(item.confidence * 100).toFixed(1)}% confidence)`);
        });
      } else {
        console.log('⚠️ No items detected by Vision API');
      }
      
      // Ensure minimum loading time for smooth UX
      const minLoadingTime = 3000;
      if (elapsed < minLoadingTime) {
        const waitTime = minLoadingTime - elapsed;
        console.log(`⏳ Waiting ${waitTime}ms for smooth UX...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      setReviewData({ 
        image: imageData, 
        detections 
      });
      
      // Show success message if foods were detected
      if (detections.length > 0) {
        toast({
          title: "Detection Complete",
          description: `Found ${detections.length} food item${detections.length > 1 ? 's' : ''}`,
        });
      } else {
        toast({
          title: "No Foods Detected",
          description: "You can manually add items in the next screen",
        });
      }
    } catch (error) {
      console.error('❌ Error detecting foods:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let userMessage = "Unable to detect foods. You can add them manually.";
      
      // Provide specific guidance based on error type
      if (errorMessage.includes('rate limit') || errorMessage.includes('quota') || errorMessage.includes('limit') || errorMessage.includes('429')) {
        userMessage = "Daily API limit reached (200 calls/day). You can add ingredients manually or try again tomorrow.";
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        userMessage = "Network error. Check your connection and try again.";
      }
      
      toast({
        title: "Detection Error",
        description: userMessage,
        variant: "destructive"
      });
      
      // Still show review modal even if detection fails
      setReviewData({ 
        image: imageData, 
        detections: [] 
      });
    } finally {
      setIsDetecting(false);
      setCapturedImage(null);
      console.log('✅ Detection process complete');
    }
  };

  // Handle save completion
  const handleSaveComplete = () => {
    setReviewData(null);
    // Refresh today's logs
    queryClient.invalidateQueries({ queryKey: ['/api/food-logs/today'] });
    queryClient.invalidateQueries({ queryKey: ['/api/food-logs/week'] });
  };

  // Calculate week stats
  const weekStats = {
    totalCalories: weekData?.reduce((sum: number, log: any) => 
      sum + (log.total_calories || 0), 0) || 0,
    dailyAverage: weekData?.length ? 
      Math.round((weekData.reduce((sum: number, log: any) => 
        sum + (log.total_calories || 0), 0) || 0) / 7) : 0
  };

  // Show camera view
  if (showCamera) {
    return (
      <CameraView 
        onCapture={handleCapture}
        onClose={() => setShowCamera(false)}
      />
    );
  }
  
  // Show detection loading overlay
  if (isDetecting && capturedImage) {
    return (
      <DetectionLoadingOverlay
        imageUrl={capturedImage}
        onComplete={() => {
          // Detection already completed, this is just for animation
        }}
      />
    );
  }

  // Show food review modal
  if (reviewData) {
    return (
      <FoodReviewModal 
        data={reviewData}
        onClose={() => setReviewData(null)}
        onSave={handleSaveComplete}
      />
    );
  }

  // Get model info for display
  const modelInfo = getModelInfo();
  
  // Main dashboard view
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="px-4 py-6">
          <h1 className="text-2xl font-bold">Food Tracker</h1>
          <p className="text-gray-600">Track your daily nutrition</p>
          <div className="text-xs text-gray-500 mt-1 space-y-1">
            <p>Powered by {modelInfo.name} • 1300+ food types</p>
            <p className="text-green-600">API calls preserved with smart caching</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Daily Summary Card */}
          <div className="px-4 py-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-gray-600">Today's Calories</p>
                    <p className="text-3xl font-bold">{todayData?.totalCalories || 0}</p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span>P: {todayData?.totalProtein || 0}g</span>
                      <span>C: {todayData?.totalCarbs || 0}g</span>
                      <span>F: {todayData?.totalFat || 0}g</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Goal</p>
                    <p className="text-lg">2000</p>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-4 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: Math.min(100, ((todayData?.totalCalories || 0) / 2000) * 100) + '%'
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Food Button - Manual Entry Only */}
          <div className="px-4">
            <Button
              onClick={() => setShowCamera(true)}
              className="w-full bg-primary text-white py-4 flex items-center justify-center gap-2"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              Add Food Manually
            </Button>
          </div>

          {/* Today's Meals */}
          <div className="px-4 py-6">
            <h2 className="text-lg font-semibold mb-3">Today's Meals</h2>
            <FoodHistory logs={todayData?.logs || []} />
          </div>

          {/* Quick Stats */}
          <div className="px-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">This Week</span>
                  </div>
                  <p className="text-xl font-semibold">
                    {weekStats.totalCalories.toLocaleString()} cal
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Daily Avg</span>
                  </div>
                  <p className="text-xl font-semibold">
                    {weekStats.dailyAverage.toLocaleString()} cal
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Manual entry modal */}
      {showCamera && (
        <FoodReviewModal
          data={{
            image: '',
            detections: []
          }}
          onClose={() => setShowCamera(false)}
          onSave={() => {
            setShowCamera(false);
            queryClient.invalidateQueries({ queryKey: ['/api/food-logs/today'] });
            queryClient.invalidateQueries({ queryKey: ['/api/food-logs/week'] });
          }}
        />
      )}
    </div>
  );
}