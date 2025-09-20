import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, TrendingUp, Plus, Search, ChefHat, DollarSign, Globe, Heart, X, ChevronDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";

interface Community {
  id: number;
  name: string;
  description: string;
  creator_id: string;
  cover_image?: string;
  category: string;
  member_count: number;
  is_public: boolean;
  created_at: string;
  isMember?: boolean;
}

interface SharedMealPlan {
  id: number;
  title: string;
  description?: string;
  preview_images: string[];
  metrics: {
    cost_per_serving: number;
    total_prep_time: number;
    average_difficulty: number;
    nutrition_score: number;
  };
  likes: number;
  tries: number;
  success_rate?: number;
  creator?: {
    id: string;
    name: string;
    profileImageUrl?: string;
  };
}

interface Creator {
  profile: {
    id: number;
    bio?: string;
    follower_count: number;
    total_plans_shared: number;
    average_rating?: number;
    verified_nutritionist: boolean;
  };
  user: {
    id: string;
    name: string;
    email: string;
    profileImageUrl?: string;
  };
}

const categoryIcons = {
  budget: <DollarSign className="w-4 h-4" />,
  family: <Users className="w-4 h-4" />,
  cultural: <Globe className="w-4 h-4" />,
  health: <Heart className="w-4 h-4" />,
};

const categoryColors = {
  budget: "bg-green-100 text-green-800",
  family: "bg-blue-100 text-blue-800",
  cultural: "bg-purple-100 text-purple-800",
  health: "bg-red-100 text-red-800",
};

export default function Communities() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [communityForm, setCommunityForm] = useState({
    name: "",
    description: "",
    category: "",
    cover_image: ""
  });
  // Use actual creator status from user account - fix nested user object
  // Handle both possible data structures: { user: {...} } or direct { ... }
  const isCreator = Boolean(user?.user?.is_creator || user?.is_creator);
  

  // Creator toggle mutation
  const toggleCreatorMutation = useMutation({
    mutationFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      return await apiRequest("/api/user/toggle-creator", {
        method: "POST",
      });
    },
    onSuccess: (data) => {
      console.log('🔍 [Creator Toggle] Success:', data);
      toast({
        title: "Creator Status Updated",
        description: `Creator status toggled successfully. New status: ${data.is_creator}`,
      });
      // Invalidate and refetch user data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      console.error('🔍 [Creator Toggle] Error:', error);
      toast({
        title: "Error",
        description: "Failed to toggle creator status",
        variant: "destructive",
      });
    },
  });

  // Create community mutation
  const createCommunityMutation = useMutation({
    mutationFn: async (formData: typeof communityForm) => {
      const { apiRequest } = await import("@/lib/queryClient");
      return await apiRequest("/api/communities", {
        method: "POST",
        body: JSON.stringify(formData),
      });
    },
    onSuccess: (data) => {
      console.log('🔍 [Community Creation] Success:', data);
      toast({
        title: "Community Created!",
        description: `Your community "${communityForm.name}" has been created successfully.`,
      });
      // Reset form and close modal
      setCommunityForm({ name: "", description: "", category: "", cover_image: "" });
      setShowCreateModal(false);
      // Refresh communities list
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
    },
    onError: (error) => {
      console.error('🔍 [Community Creation] Error:', error);
      toast({
        title: "Error",
        description: "Failed to create community. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch communities - only when authenticated
  const { data: communities = [], isLoading: loadingCommunities } = useQuery({
    queryKey: ["/api/communities", selectedCategory],
    queryFn: async () => {
      const { apiRequest } = await import("@/lib/queryClient");
      const params = new URLSearchParams();
      if (selectedCategory) params.append("category", selectedCategory);
      return await apiRequest(`/api/communities?${params}`, {
        method: "GET",
      });
    },
    enabled: isAuthenticated, // Only fetch when user is authenticated
  });

  // Auto-redirect to last visited community if present
  useEffect(() => {
    try {
      if (!isAuthenticated) return;
      const params = new URLSearchParams(window.location.search);
      if (params.get('list') === '1' || params.get('stay') === '1') return;
      const uid = (user as any)?.id || (user as any)?.user?.id;
      if (!uid) return;
      const key = `lastCommunityId:${uid}`;
      const lastId = localStorage.getItem(key);
      if (lastId) {
        setLocation(`/community/${lastId}`);
      }
    } catch {}
  }, [isAuthenticated]);

  // Fetch trending meal plans
  const { data: trendingPlans = [] } = useQuery({
    queryKey: ["/api/trending-meal-plans"],
    queryFn: async () => {
      const response = await fetch("/api/trending-meal-plans?limit=6");
      if (!response.ok) throw new Error("Failed to fetch trending plans");
      return response.json();
    },
  });

  // Handle query params for list/create behavior
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('create') === '1') {
        console.log('🟣 [COMMUNITIES QUERY] create=1 detected');
        if (isAuthenticated) {
          setShowCreateModal(true);
          toast({ title: 'Create Community', description: 'Opening creation form' });
        } else {
          toast({ title: 'Sign in required', description: 'Please log in to create a community', variant: 'destructive' });
        }
      }
    } catch {}
  }, [isAuthenticated]);

  // Fetch top creators
  const { data: topCreators = [] } = useQuery({
    queryKey: ["/api/creators/top"],
    queryFn: async () => {
      const response = await fetch("/api/creators/top?metric=followers&limit=5");
      if (!response.ok) throw new Error("Failed to fetch top creators");
      return response.json();
    },
  });

  // Join community mutation
  const joinCommunity = useMutation({
    mutationFn: async (communityId: number) => {
      const { apiRequest } = await import("@/lib/queryClient");
      return await apiRequest(`/api/communities/${communityId}/join`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      toast({
        title: "Success",
        description: "You've joined the community!",
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

  // Filter communities based on search
  const filteredCommunities = communities.filter((community: Community) =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    community.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-emerald-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              {/* Communities Title with Dropdown */}
              <div className="flex items-center gap-2 mb-2">
                <DropdownMenu
                  onOpenChange={(open) => {
                    console.log('🟣 [COMMUNITIES DROPDOWN] open:', open);
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-4xl font-bold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent mb-0 focus:outline-none cursor-pointer"
                      onClick={() => console.log('🟣 [COMMUNITIES DROPDOWN] trigger clicked')}
                      aria-haspopup="menu"
                      aria-expanded={false}
                    >
                      <span>Communities</span>
                      <ChevronDown className="w-7 h-7 text-purple-600/80" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    sideOffset={8}
                    className="z-[2147483647] pointer-events-auto w-56"
                  >
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        console.log('🟣 [DISCOVER] clicked');
                        toast({ title: 'Discover Communities', description: 'Showing all communities' });
                        setSearchQuery("");
                        setSelectedCategory(undefined);
                        setLocation('/communities?list=1');
                      }}
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Discover Communities
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        console.log('🟣 [CREATE] clicked');
                        if (!isAuthenticated) {
                          toast({ title: 'Sign in required', description: 'Please log in to create a community', variant: 'destructive' });
                          return;
                        }
                        toast({ title: 'Create Community', description: 'Opening community creation form' });
                        setShowCreateModal(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Community
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="text-gray-600 text-lg">
                Join communities to discover and share amazing meal plans with creators and food enthusiasts
              </p>
            </div>

          </div>
        </div>

        {/* DEBUG PANEL - TEMPORARY */}
        {isAuthenticated && (
          <Card className="mb-6 border-2 border-yellow-300 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-800">🐛 Creator Debug Panel (Temporary)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>User ID:</strong> {user?.user?.id || user?.id || 'Not found'}
                  </div>
                  <div>
                    <strong>Email:</strong> {user?.user?.email || user?.email || 'Not found'}
                  </div>
                  <div>
                    <strong>Is Creator (nested):</strong> 
                    <span className={`ml-2 px-2 py-1 rounded ${user?.user?.is_creator ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {String(user?.user?.is_creator)} ({typeof user?.user?.is_creator})
                    </span>
                  </div>
                  <div>
                    <strong>Is Creator (direct):</strong> 
                    <span className={`ml-2 px-2 py-1 rounded ${user?.is_creator ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {String(user?.is_creator)} ({typeof user?.is_creator})
                    </span>
                  </div>
                  <div>
                    <strong>Computed isCreator:</strong>
                    <span className={`ml-2 px-2 py-1 rounded ${isCreator ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {String(isCreator)}
                    </span>
                  </div>
                  <div>
                    <strong>Should Show Button:</strong>
                    <span className={`ml-2 px-2 py-1 rounded ${(isAuthenticated && isCreator) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {String(isAuthenticated && isCreator)}
                    </span>
                  </div>
                </div>
                
                <div className="border-t pt-3">
                  <div className="text-xs text-gray-600 mb-2">
                    <strong>Complete User Object:</strong>
                  </div>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(user, null, 2)}
                  </pre>
                </div>
                
                <div className="border-t pt-3 flex gap-3">
                  <Button
                    onClick={() => toggleCreatorMutation.mutate()}
                    disabled={toggleCreatorMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    {toggleCreatorMutation.isPending ? "Toggling..." : "Toggle Creator Status"}
                  </Button>
                  <Button
                    onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] })}
                    variant="outline"
                    size="sm"
                  >
                    Refresh User Data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <div 
              className="flex gap-2 overflow-x-auto scrollbar-hide"
              style={{ 
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitScrollbar: 'none'
              }}
            >
              <Button
                variant={!selectedCategory ? "default" : "outline"}
                onClick={() => setSelectedCategory(undefined)}
                size="sm"
                className="flex-shrink-0"
              >
                All
              </Button>
              {Object.keys(categoryIcons).map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  onClick={() => setSelectedCategory(category)}
                  size="sm"
                  className="flex-shrink-0"
                >
                  {categoryIcons[category as keyof typeof categoryIcons]}
                  <span className="ml-1 capitalize">{category}</span>
                </Button>
              ))}
            </div>
            {/* Fade gradient hints for scrollable content */}
            <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-white via-white to-transparent pointer-events-none opacity-70"></div>
          </div>
        </div>

        <Tabs defaultValue="communities" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="communities">Communities</TabsTrigger>
            <TabsTrigger value="trending">Trending Plans</TabsTrigger>
            <TabsTrigger value="creators">Top Creators</TabsTrigger>
          </TabsList>

          {/* Communities Tab */}
          <TabsContent value="communities" className="space-y-6">
            {loadingCommunities ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading communities...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCommunities.map((community: Community) => (
                  <Card key={community.id} className="hover:shadow-lg transition-shadow">
                    <div className="cursor-pointer" onClick={() => {
                      // Only navigate if not clicking on buttons
                      if (!community.creator_id === ((user as any)?.user?.id || (user as any)?.id) && !community.isMember) {
                        window.location.href = `/community/${community.id}`;
                      }
                    }}>
                      {community.cover_image && (
                        <div className="h-32 bg-gradient-to-br from-purple-400 to-emerald-400 rounded-t-lg" />
                      )}
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{community.name}</CardTitle>
                            <Badge 
                              className={`mt-1 ${categoryColors[community.category as keyof typeof categoryColors] || "bg-gray-100 text-gray-800"}`}
                            >
                              {categoryIcons[community.category as keyof typeof categoryIcons]}
                              <span className="ml-1 capitalize">{community.category}</span>
                            </Badge>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">{community.member_count} members</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="line-clamp-2 mb-4">
                          {community.description}
                        </CardDescription>
                        {isAuthenticated && (
                          // Show different buttons based on membership and creator status
                          community.creator_id === ((user as any)?.user?.id || (user as any)?.id) ? (
                            <Link href={`/community/${community.id}/manage`}>
                              <Button variant="secondary" size="sm" className="w-full">
                                Manage Community
                              </Button>
                            </Link>
                          ) : community.isMember ? (
                            <Link href={`/community/${community.id}`}>
                              <Button variant="outline" size="sm" className="w-full">
                                Enter Community
                              </Button>
                            </Link>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                joinCommunity.mutate(community.id);
                              }}
                              disabled={joinCommunity.isPending}
                            >
                              {joinCommunity.isPending ? "Joining..." : "Join Community"}
                            </Button>
                          )
                        )}
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Create Community Button - Only for Creators */}
            {isAuthenticated && isCreator && (
              <div className="mt-8 text-center">
                <Card className="inline-block p-6">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-emerald-500 rounded-full">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold">Create Your Own Community</h3>
                    <p className="text-gray-600 max-w-xs">
                      Start sharing your meal plans and build a following
                    </p>
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600"
                    >
                      Create Community
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* Become a Creator CTA - For non-creators */}
            {isAuthenticated && !isCreator && (
              <div className="mt-8 text-center">
                <Card className="inline-block p-6 border-dashed border-2 border-purple-300 bg-purple-50/50">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-3 bg-gradient-to-br from-purple-400 to-emerald-400 rounded-full opacity-60">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700">Want to Create Communities?</h3>
                    <p className="text-gray-600 max-w-xs">
                      Become a creator to share your meal plans and build your own community
                    </p>
                    <Badge className="bg-purple-100 text-purple-700">
                      Creator Account Required
                    </Badge>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Trending Plans Tab */}
          <TabsContent value="trending" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingPlans.map((plan: SharedMealPlan) => (
                <Card key={plan.id} className="hover:shadow-lg transition-shadow">
                  <div className="aspect-video relative bg-gray-100 rounded-t-lg overflow-hidden">
                    {plan.preview_images && plan.preview_images[0] ? (
                      <img 
                        src={plan.preview_images[0]} 
                        alt={plan.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ChefHat className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-white/90 text-gray-800">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Trending
                      </Badge>
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-1">{plan.title}</CardTitle>
                    {plan.creator && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-emerald-500" />
                        <span className="text-sm text-gray-600">{plan.creator.name}</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>${plan.metrics.cost_per_serving}/serving</span>
                      <span>{plan.metrics.total_prep_time} min</span>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4 text-red-500" />
                        {plan.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-blue-500" />
                        {plan.tries} tried
                      </span>
                      {plan.success_rate && (
                        <span className="text-green-600 font-semibold">
                          {plan.success_rate}% success
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Top Creators Tab */}
          <TabsContent value="creators" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topCreators.map((creator: Creator, index: number) => (
                <Card key={creator.user.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-emerald-500 flex items-center justify-center text-white font-bold">
                            {creator.user.name.charAt(0).toUpperCase()}
                          </div>
                          {index < 3 && (
                            <Badge className="absolute -top-1 -right-1 bg-yellow-500 text-white text-xs">
                              #{index + 1}
                            </Badge>
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{creator.user.name}</CardTitle>
                          {creator.profile.verified_nutritionist && (
                            <Badge variant="secondary" className="mt-1">
                              Verified Nutritionist
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {creator.profile.bio && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {creator.profile.bio}
                      </p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-2xl font-bold text-purple-600">
                          {creator.profile.follower_count}
                        </p>
                        <p className="text-xs text-gray-500">Followers</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-emerald-600">
                          {creator.profile.total_plans_shared}
                        </p>
                        <p className="text-xs text-gray-500">Plans</p>
                      </div>
                      {creator.profile.average_rating && (
                        <div>
                          <p className="text-2xl font-bold text-yellow-600">
                            {creator.profile.average_rating}
                          </p>
                          <p className="text-xs text-gray-500">Rating</p>
                        </div>
                      )}
                    </div>
                    <Button className="w-full mt-4" variant="outline">
                      View Profile
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Community Creation Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Community</DialogTitle>
            <DialogDescription>
              Create a community to share meal plans and connect with others who share your interests.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Community Name</Label>
              <Input
                id="name"
                placeholder="Enter community name"
                value={communityForm.name}
                onChange={(e) => setCommunityForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe your community"
                value={communityForm.description}
                onChange={(e) => setCommunityForm(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select value={communityForm.category} onValueChange={(value) => setCommunityForm(prev => ({ ...prev, category: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Budget">Budget</SelectItem>
                  <SelectItem value="Family">Family</SelectItem>
                  <SelectItem value="Cultural">Cultural</SelectItem>
                  <SelectItem value="Health">Health</SelectItem>
                  <SelectItem value="Fitness">Fitness</SelectItem>
                  <SelectItem value="Vegan">Vegan</SelectItem>
                  <SelectItem value="Keto">Keto</SelectItem>
                  <SelectItem value="Mediterranean">Mediterranean</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cover_image">Cover Image URL (Optional)</Label>
              <Input
                id="cover_image"
                placeholder="https://example.com/image.jpg"
                value={communityForm.cover_image}
                onChange={(e) => setCommunityForm(prev => ({ ...prev, cover_image: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!communityForm.name || !communityForm.description || !communityForm.category) {
                  toast({
                    title: "Missing Information",
                    description: "Please fill in all required fields.",
                    variant: "destructive",
                  });
                  return;
                }
                createCommunityMutation.mutate(communityForm);
              }}
              disabled={createCommunityMutation.isPending}
              className="bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600"
            >
              {createCommunityMutation.isPending ? "Creating..." : "Create Community"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
