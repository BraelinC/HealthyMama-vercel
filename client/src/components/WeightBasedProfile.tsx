import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Edit3, ChefHat, Target, DollarSign, Heart, Clock, Shuffle, Globe, X, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { GoalWeights, SimplifiedUserProfile } from '@shared/schema';
import SmartCulturalPreferenceEditor from '@/components/SmartCulturalPreferenceEditor';

import QuestionnaireAnswersDisplay from '@/components/QuestionnaireAnswersDisplay';

const commonDietaryRestrictions = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo',
  'Low-Carb', 'High-Protein', 'Halal', 'Kosher', 'Nut-Free', 'Soy-Free',
  'Low-Sodium', 'Organic', 'Pescatarian', 'Mediterranean'
];

const goalDescriptions = {
  cost: "Prioritize budget-friendly meals and ingredients",
  health: "Focus on nutritious, balanced meals",
  cultural: "Include cultural and traditional dishes",
  variety: "Emphasize diverse cuisines and ingredients", 
  time: "Prefer quick and easy meal preparation"
};

const goalIcons = {
  cost: DollarSign,
  health: Heart,
  cultural: Globe,
  variety: Shuffle,
  time: Clock
};

export default function WeightBasedProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [familySize, setFamilySize] = useState(2);
  const [goalWeights, setGoalWeights] = useState<GoalWeights>({
    cost: 0.5,
    health: 0.5,
    cultural: 0.5,
    variety: 0.5,
    time: 0.5
  });
  const [dietaryRestrictions, setDietaryRestrictions] = useState<string[]>([]);
  const [culturalBackground, setCulturalBackground] = useState<string[]>([]);
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, string[]>>({});
  const [selectedOptions, setSelectedOptions] = useState<Array<{
    questionId: string;
    questionTitle: string;
    optionId: string;
    optionLabel: string;
    optionDescription: string;
  }>>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['/api/profile/weight-based'],
    enabled: !!user,
    retry: 2,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: Partial<SimplifiedUserProfile>) => {
      setSaveStatus('saving');
      try {
        const result = await apiRequest('/api/profile/weight-based', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        return result;
      } catch (error) {
        setSaveStatus('idle');
        throw error;
      }
    },
    onSuccess: () => {
      setSaveStatus('saved');
      toast({
        title: "Success",
        description: "Weight-based profile created successfully!"
      });
      setIsEditing(false);
      
      // Invalidate both profile queries to update all components
      queryClient.invalidateQueries({ queryKey: ['/api/profile/weight-based'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      
      // Reset to idle after showing saved state
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (error: any) => {
      setSaveStatus('idle');
      toast({
        title: "Error",
        description: error.message || "Failed to create profile. Please try again.",
        variant: "destructive"
      });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<SimplifiedUserProfile>) => {
      setSaveStatus('saving');
      try {
        const result = await apiRequest('/api/profile/weight-based', {
          method: 'PUT',
          body: JSON.stringify(data)
        });
        return result;
      } catch (error) {
        setSaveStatus('idle');
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('✅ Profile update successful, response:', data);
      setSaveStatus('saved');
      toast({
        title: "Success", 
        description: "Profile updated successfully!"
      });
      setIsEditing(false);
      
      // Invalidate both profile queries to update all components
      queryClient.invalidateQueries({ queryKey: ['/api/profile/weight-based'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      
      // Reset to idle after showing saved state
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: (error: any) => {
      setSaveStatus('idle');
      toast({
        title: "Error",
        description: error.message || "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Load profile data when available
  useEffect(() => {
    if (profile) {
      const profileData = profile as SimplifiedUserProfile;
      setProfileName(profileData.profileName || '');
      setFamilySize(profileData.familySize || 2);
      setGoalWeights(profileData.goalWeights || {
        cost: 0.5,
        health: 0.5,
        cultural: 0.5,
        variety: 0.5,
        time: 0.5
      });
      setDietaryRestrictions(profileData.dietaryRestrictions || []);
      setCulturalBackground(profileData.culturalBackground || []);
      setQuestionnaireAnswers(profileData.questionnaire_answers || {});
      setSelectedOptions(profileData.questionnaire_selections || []);
    }
  }, [profile]);

const handleSubmit = () => {
    if (!profileName?.trim()) {
      toast({
        title: "Error",
        description: "Profile name is required.",
        variant: "destructive"
      });
      return;
    }

    const profileData: Partial<SimplifiedUserProfile> & { primaryGoal?: string } = {
      profileName: profileName.trim(),
      familySize,
      goalWeights,
      dietaryRestrictions,
      culturalBackground,
      primaryGoal: (profile as any)?.primaryGoal || 'Gain Muscle',
      // Include questionnaire data if it exists
      ...(Object.keys(questionnaireAnswers).length > 0 && {
        questionnaire_answers: questionnaireAnswers,
        questionnaire_selections: selectedOptions
      })
    };

    if (profile) {
      updateProfileMutation.mutate(profileData);
    } else {
      createProfileMutation.mutate(profileData);
    }
  };

  const addDietaryRestriction = (restriction: string) => {
    if (!dietaryRestrictions.includes(restriction)) {
      setDietaryRestrictions([...dietaryRestrictions, restriction]);
    }
  };

  const removeDietaryRestriction = (restriction: string) => {
    setDietaryRestrictions(dietaryRestrictions.filter(r => r !== restriction));
  };

  const updateGoalWeight = (goal: keyof GoalWeights, value: number[]) => {
    setGoalWeights(prev => ({
      ...prev,
      [goal]: value[0]
    }));
  };

  const resetToBalanced = () => {
    setGoalWeights({
      cost: 0.5,
      health: 0.5,
      cultural: 0.5,
      variety: 0.5,
      time: 0.5
    });
  };

  const handleSaveCulturalPreferences = async (overrideCuisines?: string[]) => {
    if (!profile) return;
    
    const cuisinesToSave = overrideCuisines || culturalBackground;
    
    const profileData: Partial<SimplifiedUserProfile> = {
      profileName: profileName.trim() || (profile as any).profileName,
      familySize: familySize || (profile as any).familySize,
      goalWeights: goalWeights || (profile as any).goalWeights,
      dietaryRestrictions: dietaryRestrictions || (profile as any).dietaryRestrictions,
      culturalBackground: cuisinesToSave
    };

    try {
      await updateProfileMutation.mutateAsync(profileData);
      
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/profile/weight-based'] });
      }, 500);
      
      toast({
        title: "Cultural preferences updated!",
        description: "Your cultural cuisine preferences have been saved."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save cultural preferences. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleQuestionnaireComplete = (result: { weights: GoalWeights; answers: Record<string, string[]>; selectedOptions: any[] }) => {
    console.log('🎯 Questionnaire completed with weights:', result.weights);
    console.log('🎯 Current profile state:', profile);
    
    setGoalWeights(result.weights);
    setQuestionnaireAnswers(result.answers);
    setSelectedOptions(result.selectedOptions);
    setShowQuestionnaire(false);
    
    // Auto-save the profile with questionnaire results
    const profileData: Partial<SimplifiedUserProfile> = {
      profileName: profileName.trim() || 'My Smart Profile',
      familySize,
      goalWeights: result.weights,
      dietaryRestrictions,
      culturalBackground,
      questionnaire_answers: result.answers,
      questionnaire_selections: result.selectedOptions
    };

    console.log('🚀 Auto-saving profile with questionnaire results:', profileData);
    console.log('💾 Weights being saved:', result.weights);

    if (profile) {
      console.log('📝 Updating existing profile...');
      updateProfileMutation.mutate(profileData);
    } else {
      createProfileMutation.mutate(profileData);
    }
    
    toast({
      title: "Smart Profile Setup Complete!",
      description: "Your meal planning priorities have been saved and are now active."
    });
  };

  const handleQuestionnaireSkip = () => {
    setShowQuestionnaire(false);
    setIsEditing(true);
  };



  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-purple-500 to-emerald-500 p-3 rounded-full">
              <Target className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">
                Smart Meal Planning Profile
              </h1>
              <p className="text-gray-600 mt-1">Set your priorities with intelligent weight-based preferences</p>
            </div>
          </div>
          {!isEditing && profile && (
            <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600 text-white border-0">
              <Edit3 className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>

        {!profile && !isEditing && (
          <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="bg-gradient-to-r from-purple-100 to-emerald-100 p-6 rounded-full w-fit mx-auto mb-6">
                <Target className="h-16 w-16 text-purple-600 mx-auto" />
              </div>
              <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">
                Create Your Smart Profile
              </h2>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                Set up intelligent meal planning with weight-based priorities that adapt to your lifestyle.
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600 text-white border-0 px-8 py-3">
                  <Target className="h-5 w-5" />
                  Setup Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(isEditing || profile) && (
          <div className="space-y-6">
            {/* Basic Profile Info */}
            <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChefHat className="h-5 w-5 text-purple-600" />
                  Profile Basics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="profileName">Profile Name</Label>
                    <Input
                      id="profileName"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="e.g., My Smart Profile"
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="familySize">Family Size</Label>
                    <Input
                      id="familySize"
                      type="number"
                      min="1"
                      max="8"
                      value={familySize}
                      onChange={(e) => setFamilySize(parseInt(e.target.value) || 1)}
                      disabled={!isEditing}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goal Weight Sliders - Hidden but functionality preserved */}
            <div className="hidden">
            <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-purple-600" />
                    Goal Priorities
                  </CardTitle>
                  {isEditing && (
                    <div className="flex gap-2">
                      <Button onClick={() => setShowQuestionnaire(true)} variant="outline" size="sm">
                        <Wand2 className="h-4 w-4 mr-2" />
                        Smart Setup
                      </Button>
                      <Button onClick={resetToBalanced} variant="outline" size="sm">
                        Reset to Balanced
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  Set how important each factor is in your meal planning (0 = Not Important, 1 = Very Important)
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(goalWeights).map(([goal, weight]) => {
                  const Icon = goalIcons[goal as keyof GoalWeights];
                  const percentage = Math.round(weight * 100);
                  
                  // Determine priority level and colors
                  const getPriorityInfo = (weight: number) => {
                    if (weight >= 0.7) return { level: 'Very High', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' };
                    if (weight >= 0.5) return { level: 'High', color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-50' };
                    if (weight >= 0.3) return { level: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-50' };
                    return { level: 'Low', color: 'bg-gray-400', textColor: 'text-gray-600', bgColor: 'bg-gray-50' };
                  };
                  
                  const priorityInfo = getPriorityInfo(weight);
                  
                  return (
                    <div key={goal} className={`space-y-3 p-4 rounded-lg border-2 transition-all ${priorityInfo.bgColor} ${weight >= 0.5 ? 'border-purple-200' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${priorityInfo.bgColor}`}>
                            <Icon className={`h-5 w-5 ${priorityInfo.textColor}`} />
                          </div>
                          <div>
                            <Label className="capitalize font-semibold text-gray-800">{goal}</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className={`text-xs font-medium ${priorityInfo.textColor} border-current`}
                              >
                                {priorityInfo.level} Priority
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${priorityInfo.textColor}`}>
                            {percentage}%
                          </div>
                          <div className="text-xs text-gray-500">
                            Weight Value
                          </div>
                        </div>
                      </div>
                      
                      {/* Visual Progress Bar */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Not Important</span>
                          <span>Very Important</span>
                        </div>
                        <div className="relative">
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div 
                              className={`h-3 rounded-full transition-all duration-300 ${priorityInfo.color}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div 
                            className="absolute top-0 w-1 h-3 bg-white border border-gray-400 rounded-sm"
                            style={{ left: `${Math.max(0, Math.min(percentage - 0.5, 98))}%` }}
                          />
                        </div>
                      </div>
                      
                      {/* Slider for editing */}
                      {isEditing && (
                        <Slider
                          value={[weight]}
                          onValueChange={(value) => updateGoalWeight(goal as keyof GoalWeights, value)}
                          max={1}
                          min={0}
                          step={0.1}
                          disabled={!isEditing}
                          className="flex-1"
                        />
                      )}
                      
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {goalDescriptions[goal as keyof typeof goalDescriptions]}
                      </p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            </div>

            {/* Dietary Restrictions */}
            <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Dietary Restrictions (100% Compliance)
                </CardTitle>
                <p className="text-sm text-gray-600">
                  These restrictions will be strictly enforced in all meal suggestions
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing && (
                  <div>
                    <Label>Add Restrictions</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {commonDietaryRestrictions.map(restriction => (
                        <Button
                          key={restriction}
                          onClick={() => addDietaryRestriction(restriction)}
                          variant={dietaryRestrictions.includes(restriction) ? "default" : "outline"}
                          size="sm"
                          className="text-xs"
                        >
                          {restriction}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                {dietaryRestrictions.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Active Restrictions:</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {dietaryRestrictions.map((restriction) => (
                        <Badge key={restriction} variant="secondary" className="flex items-center gap-1">
                          {restriction}
                          {isEditing && (
                            <button
                              onClick={() => removeDietaryRestriction(restriction)}
                              className="ml-1 text-red-500 hover:text-red-700"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cultural Preferences */}
            <SmartCulturalPreferenceEditor
              culturalBackground={culturalBackground}
              onCulturalBackgroundChange={setCulturalBackground}
              onSave={handleSaveCulturalPreferences}
              isSaving={updateProfileMutation.isPending}
              showPreviewData={false}
            />

            {/* Questionnaire Answers Display */}
            {selectedOptions.length > 0 && (
              <QuestionnaireAnswersDisplay
                answers={questionnaireAnswers}
                selectedOptions={selectedOptions}
                onRetakeQuestionnaire={() => setShowQuestionnaire(true)}
                showRetakeButton={isEditing}
              />
            )}

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex gap-4 justify-end">
                <Button onClick={() => setIsEditing(false)} variant="outline">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmit} 
                  disabled={saveStatus === 'saving'}
                  className={`text-white border-0 transition-all duration-300 ${
                    saveStatus === 'saved' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600' 
                      : 'bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600'
                  }`}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Profile'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
