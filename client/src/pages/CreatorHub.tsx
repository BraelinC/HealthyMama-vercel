import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Users, 
  TrendingUp, 
  Plus, 
  ChefHat, 
  DollarSign, 
  Globe, 
  Heart,
  BookOpen,
  Award,
  BarChart3,
  Settings,
  Play,
  Zap,
  Target,
  MessageSquare,
  Calendar,
  Trophy,
  Star,
  ArrowRight,
  Check,
  Lock
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CreatorStats {
  totalFollowers: number;
  totalCommunities: number;
  totalSharedPlans: number;
  totalEarnings: number;
  engagementRate: number;
  averageRating: number;
  thisMonthGrowth: number;
  activeMemberships: number;
}

interface CreatorCommunity {
  id: number;
  name: string;
  memberCount: number;
  monthlyRevenue: number;
  engagementRate: number;
  coverImage?: string;
}

export default function CreatorHub() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Check if user is a creator
  const isCreator = (user as any)?.is_creator;
  
  // Navigate to create community
  const handleCreateCommunity = async () => {
    console.log("🔄 Navigating to community creation page...");
    console.log("🔍 Current user creator status:", (user as any)?.is_creator);
    
    // If not creator, enable creator mode first
    if (!(user as any)?.is_creator) {
      console.log("🔄 Enabling creator mode first...");
      try {
        await becomeCreator.mutateAsync();
        console.log("✅ Creator mode enabled, now navigating...");
      } catch (error) {
        console.error("❌ Failed to enable creator mode:", error);
        return;
      }
    }
    
    console.log("🔍 Current location before navigation:", window.location.href);
    // TODO: Replace with new course creation flow
    toast({
      title: "Coming Soon",
      description: "Community creation is being redesigned with a new course-based approach!"
    });
    console.log("🔍 Community creation temporarily disabled");
  };

  // Fetch creator stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["/api/creator/stats"],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      return await apiRequest("/api/creator/stats");
    },
    enabled: isAuthenticated && isCreator,
  });

  // Fetch creator communities
  const { data: communities = [], isLoading: loadingCommunities } = useQuery({
    queryKey: ["/api/creator/communities"],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      return await apiRequest("/api/creator/communities");
    },
    enabled: isAuthenticated && isCreator,
  });

  // Become creator mutation
  const becomeCreator = useMutation({
    mutationFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      return await apiRequest("/api/user/toggle-creator", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      // Update token with new creator status
      if (data.token) {
        localStorage.setItem("auth_token", data.token);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Welcome to the Creator Program!",
        description: "You can now create communities and share content.",
      });
      console.log("✅ Creator mode mutation success, data:", data);
      
      // Force refetch user data to ensure UI updates
      setTimeout(async () => {
        await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
        console.log("🔄 User data refetched after creator mode toggle");
      }, 100);
      
      // Note: Community creation flow has been removed
      const referrer = document.referrer;
      console.log("🔍 Document referrer:", referrer);
      setShowOnboarding(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Onboarding steps
  const onboardingSteps = [
    {
      title: "Welcome to NutriMa Creator Hub",
      description: "Build your food community and monetize your expertise",
      icon: <ChefHat className="w-12 h-12" />,
      content: (
        <div className="space-y-4">
          <p>As a NutriMa creator, you can:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Create and manage food communities</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Share meal plans and recipes</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Monetize with membership tiers</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
              <span>Build a following and engage members</span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: "Create Your First Community",
      description: "Choose a niche and set up your community",
      icon: <Users className="w-12 h-12" />,
      content: (
        <div className="space-y-4">
          <p>Popular community types:</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg">
              <DollarSign className="w-6 h-6 text-green-500 mb-1" />
              <p className="font-semibold">Budget Meals</p>
              <p className="text-xs text-gray-500">$5-10 meals</p>
            </div>
            <div className="p-3 border rounded-lg">
              <Heart className="w-6 h-6 text-red-500 mb-1" />
              <p className="font-semibold">Healthy Living</p>
              <p className="text-xs text-gray-500">Nutrition focused</p>
            </div>
            <div className="p-3 border rounded-lg">
              <Globe className="w-6 h-6 text-purple-500 mb-1" />
              <p className="font-semibold">Cultural Cuisine</p>
              <p className="text-xs text-gray-500">Authentic recipes</p>
            </div>
            <div className="p-3 border rounded-lg">
              <Users className="w-6 h-6 text-blue-500 mb-1" />
              <p className="font-semibold">Family Meals</p>
              <p className="text-xs text-gray-500">Kid-friendly</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Set Your Monetization",
      description: "Choose how you'll earn from your community",
      icon: <DollarSign className="w-12 h-12" />,
      content: (
        <div className="space-y-4">
          <p>Monetization options:</p>
          <div className="space-y-3">
            <div className="p-3 border rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Free Tier</span>
                <Badge>Always Available</Badge>
              </div>
              <p className="text-sm text-gray-600">Basic access to community</p>
            </div>
            <div className="p-3 border rounded-lg border-purple-200 bg-purple-50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Premium Tier</span>
                <span className="text-purple-600 font-bold">$9.99/mo</span>
              </div>
              <p className="text-sm text-gray-600">Full access to all content</p>
            </div>
            <div className="p-3 border rounded-lg border-yellow-200 bg-yellow-50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">VIP Tier</span>
                <span className="text-yellow-600 font-bold">$19.99/mo</span>
              </div>
              <p className="text-sm text-gray-600">1-on-1 coaching + all benefits</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Start Creating Content",
      description: "Share your first meal plan",
      icon: <BookOpen className="w-12 h-12" />,
      content: (
        <div className="space-y-4">
          <p>Content that performs well:</p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <Zap className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <span className="font-semibold">Weekly Meal Prep Plans</span>
                <p className="text-xs text-gray-500">Save time and money</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Target className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <span className="font-semibold">Goal-Based Plans</span>
                <p className="text-xs text-gray-500">Weight loss, muscle gain</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Trophy className="w-5 h-5 text-purple-500 mt-0.5" />
              <div>
                <span className="font-semibold">Challenges</span>
                <p className="text-xs text-gray-500">30-day transformations</p>
              </div>
            </li>
          </ul>
        </div>
      ),
    },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>
              Please sign in to access the Creator Hub
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/auth">
              <Button className="w-full">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isCreator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent mb-4">
                Become a NutriMa Creator
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Share your culinary expertise, build a community, and earn from your passion
              </p>
              <Button 
                size="lg"
                onClick={async () => {
                  console.log("🔥 START YOUR CREATOR JOURNEY CLICKED!");
                  console.log("🔍 Current user:", user);
                  console.log("🔍 Current is_creator:", (user as any)?.is_creator);
                  
                  const currentUser = (user as any)?.user || user;
                  console.log("🔍 Checking current user creator status:", currentUser?.is_creator);
                  
                  if (!currentUser?.is_creator) {
                    console.log("🔄 Need to enable creator mode first...");
                    try {
                      const result = await becomeCreator.mutateAsync();
                      console.log("✅ Creator mode enabled, result:", result);
                      
                      // Wait for user data to update by polling
                      let attempts = 0;
                      const maxAttempts = 10;
                      const checkCreatorStatus = async () => {
                        attempts++;
                        console.log(`🔍 Checking creator status, attempt ${attempts}/${maxAttempts}`);
                        
                        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                        const freshUserData = await queryClient.fetchQuery({ queryKey: ["/api/auth/user"] });
                        const freshUser = (freshUserData as any)?.user || freshUserData;
                        
                        console.log("🔍 Fresh user data:", freshUser);
                        console.log("🔍 Fresh user is_creator:", freshUser?.is_creator);
                        
                        if (freshUser?.is_creator) {
                          console.log("✅ Creator status confirmed!");
                          // TODO: Navigate to new course creation
                          return true;
                        } else if (attempts < maxAttempts) {
                          console.log("⏳ Creator status not yet updated, retrying in 500ms...");
                          setTimeout(checkCreatorStatus, 500);
                          return false;
                        } else {
                          console.log("❌ Creator status not updated after max attempts, forcing page reload");
                          toast({
                            title: "Creator Mode Enabled",
                            description: "Refreshing page to complete setup...",
                          });
                          setTimeout(() => window.location.reload(), 1000);
                          return false;
                        }
                      };
                      
                      setTimeout(checkCreatorStatus, 200);
                      
                    } catch (error) {
                      console.error("❌ Failed to enable creator mode:", error);
                    }
                  } else {
                    console.log("✅ Already a creator");
                    // TODO: Navigate to new course creation
                  }
                }}
                disabled={becomeCreator.isPending}
                className="gap-2"
              >
                {becomeCreator.isPending ? "Processing..." : "Start Your Creator Journey"}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>

            {/* Benefits Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <CardTitle>Build Your Community</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Create a space for food enthusiasts who share your passion
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mb-4">
                    <DollarSign className="w-6 h-6 text-emerald-600" />
                  </div>
                  <CardTitle>Monetize Your Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Earn through memberships, premium content, and coaching
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <CardTitle>Grow Your Influence</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Reach thousands of food lovers and make an impact
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Success Stories */}
            <Card>
              <CardHeader>
                <CardTitle>Creator Success Stories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-full flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Sarah's Budget Kitchen</p>
                      <p className="text-sm text-gray-600">2,500 members • $5,000/month</p>
                      <p className="text-sm mt-1">"I turned my meal prep hobby into a full-time income!"</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Mike's Family Feasts</p>
                      <p className="text-sm text-gray-600">1,800 members • $3,600/month</p>
                      <p className="text-sm mt-1">"Helping families eat better together is so rewarding!"</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Creator Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Creator Hub</h1>
              <p className="text-gray-600">Manage your communities and content</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={async (e) => {
                  console.log("🔥 NEW COMMUNITY BUTTON CLICKED!", Date.now());
                  console.log("🔍 Button event:", e);
                  console.log("🔍 Current window location:", window.location.href);
                  console.log("🔍 Current user:", user);
                  console.log("🔍 User is_creator:", (user as any)?.is_creator);
                  
                  alert("Button clicked! Check console logs for details.");
                  
                  e.preventDefault();
                  e.stopPropagation();
                  
                  console.log("🔄 About to call handleCreateCommunity...");
                  await handleCreateCommunity();
                  console.log("✅ handleCreateCommunity completed");
                  
                  // Additional backup navigation removed
                  setTimeout(() => {
                    console.log("🔄 Community creation flow updated");
                  }, 2000);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Community
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Followers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalFollowers || 0}</div>
              <p className="text-xs text-green-600 mt-1">
                +{stats?.thisMonthGrowth || 0}% this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Communities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCommunities || 0}</div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.activeMemberships || 0} paid members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Monthly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${stats?.totalEarnings || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Next payout in 5 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Engagement Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.engagementRate || 0}%
              </div>
              <div className="flex items-center gap-1 mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i}
                    className={`w-3 h-3 ${
                      i < Math.floor(stats?.averageRating || 0) 
                        ? "text-yellow-500 fill-yellow-500" 
                        : "text-gray-300"
                    }`}
                  />
                ))}
                <span className="text-xs text-gray-500 ml-1">
                  {stats?.averageRating || 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="communities" className="space-y-6">
          <TabsList>
            <TabsTrigger value="communities">My Communities</TabsTrigger>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          {/* Communities Tab */}
          <TabsContent value="communities">
            {loadingCommunities ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              </div>
            ) : communities.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No communities yet</p>
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={async (e) => {
                      console.log("🔥 CREATE FIRST COMMUNITY BUTTON CLICKED!", Date.now());
                      alert("First community button clicked! Check console.");
                      e.preventDefault();
                      e.stopPropagation();
                      await handleCreateCommunity();
                    }}
                  >
                    Create Your First Community
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {communities.map((community: CreatorCommunity) => (
                  <Card key={community.id} className="hover:shadow-lg transition-shadow">
                    <div className="h-24 bg-gradient-to-br from-purple-400 to-emerald-400 rounded-t-lg" />
                    <CardHeader>
                      <CardTitle>{community.name}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {community.memberCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          ${community.monthlyRevenue}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Engagement</span>
                            <span>{community.engagementRate}%</span>
                          </div>
                          <Progress value={community.engagementRate} className="h-2" />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => setLocation(`/community/${community.id}/manage`)}
                          >
                            Manage
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1"
                            onClick={() => setLocation(`/community/${community.id}`)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle>Content Calendar</CardTitle>
                <CardDescription>
                  Plan and schedule your meal plans and posts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Content calendar coming soon!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Growth Analytics</CardTitle>
                <CardDescription>
                  Track your community growth and engagement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Detailed analytics coming soon!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Earnings Tab */}
          <TabsContent value="earnings">
            <Card>
              <CardHeader>
                <CardTitle>Earnings Overview</CardTitle>
                <CardDescription>
                  Track your revenue and payouts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Earnings dashboard coming soon!</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="resources">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Play className="w-5 h-5 text-purple-600" />
                    <CardTitle>Creator Academy</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Learn how to grow your community and create engaging content
                  </p>
                  <Button variant="outline" className="w-full">
                    Start Learning
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-blue-600" />
                    <CardTitle>Creator Forum</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Connect with other creators and share tips
                  </p>
                  <Button variant="outline" className="w-full">
                    Join Forum
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-600" />
                    <CardTitle>Best Practices</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Tips and strategies from successful creators
                  </p>
                  <Button variant="outline" className="w-full">
                    View Guide
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-600" />
                    <CardTitle>Growth Tools</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Templates and tools to accelerate your growth
                  </p>
                  <Button variant="outline" className="w-full">
                    Access Tools
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Onboarding Dialog */}
      <Dialog open={showOnboarding} onOpenChange={setShowOnboarding}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              {onboardingSteps[onboardingStep].icon}
            </div>
            <DialogTitle>{onboardingSteps[onboardingStep].title}</DialogTitle>
            <DialogDescription>
              {onboardingSteps[onboardingStep].description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {onboardingSteps[onboardingStep].content}
          </div>

          <div className="flex justify-between items-center mt-6">
            <div className="flex gap-1">
              {onboardingSteps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === onboardingStep 
                      ? "bg-purple-600" 
                      : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
            
            <div className="flex gap-2">
              {onboardingStep > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setOnboardingStep(onboardingStep - 1)}
                >
                  Back
                </Button>
              )}
              {onboardingStep < onboardingSteps.length - 1 ? (
                <Button onClick={() => setOnboardingStep(onboardingStep + 1)}>
                  Next
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    setShowOnboarding(false);
                    toast({
                      title: "Coming Soon",
                      description: "Community creation is being redesigned!"
                    });
                  }}
                >
                  Create Community
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}