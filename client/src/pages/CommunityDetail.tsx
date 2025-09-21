import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { 
  Users, 
  ChefHat, 
  Heart, 
  MessageSquare, 
  Share2, 
  Clock, 
  DollarSign,
  Star,
  Trophy,
  TrendingUp,
  ArrowLeft,
  Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import MealPlanShareCard from "@/components/community/MealPlanShareCard";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CommunityDetails {
  id: number;
  name: string;
  description: string;
  creator_id: string;
  cover_image?: string;
  category: string;
  member_count: number;
  memberInfo?: {
    role: string;
    points: number;
    level: number;
  };
  topContributors: Array<{
    user_id: string;
    points: number;
    level: number;
    role: string;
  }>;
}

interface SharedMealPlan {
  id: number;
  title: string;
  description?: string;
  preview_images: string[];
  tags: string[];
  metrics: {
    cost_per_serving: number;
    total_prep_time: number;
    average_difficulty: number;
    nutrition_score: number;
    total_calories: number;
    total_recipes: number;
  };
  likes: number;
  tries: number;
  success_rate?: number;
  sharer_id: string;
  created_at: string;
}

export default function CommunityDetail() {
  const params = useParams();
  const communityId = params.id ? parseInt(params.id) : null;
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("meal-plans");
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [selectedMealPlanId, setSelectedMealPlanId] = useState<number | null>(null);
  const [shareTitle, setShareTitle] = useState("");
  const [shareDescription, setShareDescription] = useState("");

  // Fetch community details
  const { data: community, isLoading: loadingCommunity } = useQuery({
    queryKey: ["/api/communities", communityId],
    queryFn: async () => {
      if (!communityId) throw new Error("No community ID");
      const response = await fetch(`/api/communities/${communityId}`);
      if (!response.ok) throw new Error("Failed to fetch community");
      return response.json();
    },
    enabled: !!communityId,
  });

  // Fetch community meal plans
  const { data: mealPlans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ["/api/communities", communityId, "meal-plans"],
    queryFn: async () => {
      if (!communityId) throw new Error("No community ID");
      const response = await fetch(`/api/communities/${communityId}/meal-plans`);
      if (!response.ok) throw new Error("Failed to fetch meal plans");
      return response.json();
    },
    enabled: !!communityId,
  });

  // Fetch user's saved meal plans for sharing
  const { data: userMealPlans = [] } = useQuery({
    queryKey: ["/api/meal-plans"],
    queryFn: async () => {
      const response = await fetch("/api/meal-plans");
      if (!response.ok) throw new Error("Failed to fetch user meal plans");
      return response.json();
    },
    enabled: isAuthenticated && showShareDialog,
  });

  // Join/Leave community mutation
  const joinCommunity = useMutation({
    mutationFn: async () => {
      const endpoint = community?.memberInfo 
        ? `/api/communities/${communityId}/leave`
        : `/api/communities/${communityId}/join`;
      
      const token = localStorage.getItem("auth_token");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update membership");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", communityId] });
      toast({
        title: "Success",
        description: community?.memberInfo ? "You've left the community" : "You've joined the community!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Share meal plan mutation
  const shareMealPlan = useMutation({
    mutationFn: async () => {
      if (!selectedMealPlanId || !shareTitle) {
        throw new Error("Please select a meal plan and provide a title");
      }

      const response = await fetch(`/api/communities/${communityId}/share-meal-plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meal_plan_id: selectedMealPlanId,
          title: shareTitle,
          description: shareDescription,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to share meal plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", communityId, "meal-plans"] });
      toast({
        title: "Success",
        description: "Your meal plan has been shared with the community!",
      });
      setShowShareDialog(false);
      setSelectedMealPlanId(null);
      setShareTitle("");
      setShareDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Like meal plan mutation
  const likeMealPlan = useMutation({
    mutationFn: async (planId: number) => {
      const response = await fetch(`/api/meal-plans/${planId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to like meal plan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", communityId, "meal-plans"] });
    },
  });

  // Try meal plan mutation
  const tryMealPlan = useMutation({
    mutationFn: async (planId: number) => {
      const response = await fetch(`/api/meal-plans/${planId}/try`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (!response.ok) {
        throw new Error("Failed to mark meal plan as tried");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", communityId, "meal-plans"] });
      toast({
        title: "Success",
        description: "Marked as trying this meal plan!",
      });
    },
  });

  if (loadingCommunity) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Community not found</p>
          <Link href="/communities">
            <Button className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Communities
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-emerald-600 text-white">
        <div className="container mx-auto px-4 py-6">
          <Link href="/communities">
            <Button variant="ghost" className="text-white hover:bg-white/20 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Communities
            </Button>
          </Link>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
              <p className="text-white/90 max-w-2xl">{community.description}</p>
              <div className="flex items-center gap-4 mt-4">
                <Badge className="bg-white/20 text-white">
                  <Users className="w-3 h-3 mr-1" />
                  {community.member_count} members
                </Badge>
                <Badge className="bg-white/20 text-white capitalize">
                  {community.category}
                </Badge>
              </div>
            </div>
            
            {isAuthenticated && (
              <div className="flex gap-2">
                {/* Share button - Only for creators who are members */}
                {community.memberInfo && (user as any)?.is_creator && (
                  <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                    <DialogTrigger asChild>
                      <Button variant="secondary">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share Meal Plan
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Share a Meal Plan</DialogTitle>
                        <DialogDescription>
                          Share one of your saved meal plans with the {community.name} community
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label htmlFor="meal-plan">Select Meal Plan</Label>
                          <Select 
                            value={selectedMealPlanId?.toString()}
                            onValueChange={(value) => setSelectedMealPlanId(parseInt(value))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a meal plan to share" />
                            </SelectTrigger>
                            <SelectContent>
                              {userMealPlans.map((plan: any) => (
                                <SelectItem key={plan.id} value={plan.id.toString()}>
                                  {plan.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label htmlFor="title">Title for Shared Plan</Label>
                          <input
                            id="title"
                            type="text"
                            className="w-full px-3 py-2 border rounded-md"
                            placeholder="Give your shared plan a catchy title"
                            value={shareTitle}
                            onChange={(e) => setShareTitle(e.target.value)}
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="description">Description (Optional)</Label>
                          <Textarea
                            id="description"
                            placeholder="Share tips, modifications, or why you love this plan..."
                            value={shareDescription}
                            onChange={(e) => setShareDescription(e.target.value)}
                            rows={3}
                          />
                        </div>
                        
                        <Button 
                          onClick={() => shareMealPlan.mutate()}
                          className="w-full"
                          disabled={!selectedMealPlanId || !shareTitle || shareMealPlan.isPending}
                        >
                          {shareMealPlan.isPending ? "Sharing..." : "Share with Community"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                
                {/* Show Manage button for creators, Join/Leave for others */}
                {community.creator_id === (user as any)?.id ? (
                  <Link href={`/community/${communityId}/manage`}>
                    <Button variant="secondary" className="bg-white text-purple-600">
                      Manage Community
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    variant={community.memberInfo ? "outline" : "secondary"}
                    onClick={() => joinCommunity.mutate()}
                    disabled={joinCommunity.isPending}
                    className={community.memberInfo ? "bg-white text-purple-600" : ""}
                  >
                    {joinCommunity.isPending 
                      ? (community.memberInfo ? "Leaving..." : "Joining...") 
                      : (community.memberInfo ? "Leave Community" : "Join Community")
                    }
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Member Status Bar */}
      {community.memberInfo && (
        <div className="bg-white border-b">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="font-semibold">Level {community.memberInfo.level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-purple-500" />
                  <span>{community.memberInfo.points} points</span>
                </div>
                <Badge variant="outline" className="capitalize">
                  {community.memberInfo.role} Member
                </Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Area */}
          <div className="lg:col-span-3">
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="meal-plans">Meal Plans</TabsTrigger>
                <TabsTrigger value="discussions">Discussions</TabsTrigger>
                <TabsTrigger value="challenges">Challenges</TabsTrigger>
              </TabsList>

              {/* Meal Plans Tab */}
              <TabsContent value="meal-plans" className="mt-6">
                {loadingPlans ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : mealPlans.length === 0 ? (
                  <Card className="text-center py-12">
                    <CardContent>
                      <ChefHat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">No meal plans shared yet</p>
                      {community.memberInfo && (user as any)?.is_creator && (
                        <Button onClick={() => setShowShareDialog(true)}>
                          Be the first to share!
                        </Button>
                      )}
                      {community.memberInfo && !(user as any)?.is_creator && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-500">
                            Creator mode required to share meal plans
                          </p>
                          <Badge variant="outline" className="text-purple-600">
                            Enable creator mode in your profile
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mealPlans.map((plan: SharedMealPlan) => (
                      <MealPlanShareCard
                        key={plan.id}
                        plan={plan}
                        onLike={() => likeMealPlan.mutate(plan.id)}
                        onTry={() => tryMealPlan.mutate(plan.id)}
                        isAuthenticated={isAuthenticated}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Discussions Tab */}
              <TabsContent value="discussions" className="mt-6">
                <Card className="text-center py-12">
                  <CardContent>
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Discussions coming soon!</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Share tips, ask questions, and connect with other members
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Challenges Tab */}
              <TabsContent value="challenges" className="mt-6">
                <Card className="text-center py-12">
                  <CardContent>
                    <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Weekly challenges coming soon!</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Participate in community challenges to earn points and badges
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {community.topContributors.slice(0, 5).map((contributor: any, index: number) => (
                    <div key={contributor.user_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={index < 3 ? "default" : "outline"}
                          className="w-6 h-6 p-0 justify-center"
                        >
                          {index + 1}
                        </Badge>
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs bg-gradient-to-br from-purple-500 to-emerald-500 text-white font-semibold">
                            U{index + 1}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">User</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{contributor.points}</p>
                        <p className="text-xs text-gray-500">Level {contributor.level}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Community Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Community Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Plans Shared</span>
                    <span className="font-semibold">{mealPlans.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Members</span>
                    <span className="font-semibold">{community.member_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">This Week</span>
                    <span className="font-semibold flex items-center gap-1">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      +12%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
