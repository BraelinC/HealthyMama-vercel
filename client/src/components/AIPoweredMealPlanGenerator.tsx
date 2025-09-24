import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { CheckCircle, RotateCcw, Save, Bot, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QuestionnaireResult {
  primaryGoal: string;
  weights: {
    cost: number;
    health: number;
    cultural: number;
    variety: number;
    time: number;
  };
}

interface ProfileData {
  id: number;
  primaryGoal?: string | null;
  goalWeights: {
    cost: number;
    health: number;
    cultural: number;
    variety: number;
    time: number;
  };
}

const goalLabels = {
  cost: 'Cost Efficiency',
  health: 'Health Focus',
  cultural: 'Cultural Variety',
  variety: 'Food Variety',
  time: 'Time Saving'
};

const goalDescriptions = {
  cost: 'Prioritize budget-friendly meal options',
  health: 'Focus on nutritious and healthy choices',
  cultural: 'Explore diverse cultural cuisines',
  variety: 'Maximize food diversity and options',
  time: 'Quick and convenient meal solutions'
};

export default function AIPoweredMealPlanGenerator() {
  const { toast } = useToast();
  const [currentWeights, setCurrentWeights] = useState({
    cost: 0.5,
    health: 0.5,
    cultural: 0.5,
    variety: 0.5,
    time: 0.5
  });
  
  const [questionnaireResult, setQuestionnaireResult] = useState<QuestionnaireResult | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);

  const queryClient = useQueryClient();

  // Fetch current profile data
  const { data: profileData, isLoading } = useQuery<ProfileData>({
    queryKey: ['/api/profile/weight-based'],
    queryFn: () => apiRequest('/api/profile/weight-based')
  });

  // Update current weights when profile data loads
  useEffect(() => {
    if (profileData?.goalWeights) {
      console.log('🤖 AI Generator: Loading saved weights from profile:', profileData.goalWeights);
      setCurrentWeights(profileData.goalWeights);
    }
  }, [profileData]);

  // Save weights mutation with enhanced logging and validation
  const saveWeightsMutation = useMutation({
    mutationFn: async ({ weights, primaryGoal }: { weights: typeof currentWeights; primaryGoal?: string | null }) => {
      console.log('🤖 AI Generator: Starting save process');
      console.log('🤖 AI Generator: Weights to save:', weights);
      
      // Validate weights before sending
      const validatedWeights = Object.fromEntries(
        Object.entries(weights).map(([key, value]) => [
          key, 
          Math.max(0, Math.min(1, Number(value) || 0.5))
        ])
      );
      console.log('🤖 AI Generator: Validated weights:', validatedWeights);
      
      const fallbackGoal = questionnaireResult?.primaryGoal || profileData?.primaryGoal || undefined;
      const result = await apiRequest('/api/profile/weight-based', {
        method: 'PUT',
        body: JSON.stringify({ goalWeights: validatedWeights, primaryGoal: primaryGoal ?? fallbackGoal })
      });
      
      console.log('🤖 AI Generator: Save successful, response:', result);
      return result;
    },
    onSuccess: async (data) => {
      console.log('✅ AI Generator: Weights saved successfully:', data);
      setHasUnsavedChanges(false);
      
      // Invalidate and refetch to verify the save worked
      await queryClient.invalidateQueries({ queryKey: ['/api/profile/weight-based'] });
      
      // Verify the save by checking what was actually stored
      setTimeout(async () => {
        try {
          const verifyData = await apiRequest('/api/profile/weight-based');
          console.log('🔍 AI Generator: Verification check - stored weights:', verifyData.goalWeights);
        } catch (error) {
          console.warn('🔍 AI Generator: Verification check failed:', error);
        }
      }, 1000);
      
      toast({
        title: "🤖 AI Priorities Updated!",
        description: "Your meal planning priorities have been saved and will power your AI recommendations."
      });
    },
    onError: (error) => {
      console.error('❌ AI Generator: Failed to save weights:', error);
      toast({
        title: "Error",
        description: "Failed to save AI meal planning priorities",
        variant: "destructive"
      });
    }
  });

  // Handle questionnaire completion
  const handleQuestionnaireComplete = (result: QuestionnaireResult) => {
    console.log('🤖 AI Generator: Questionnaire completed with result:', result);
    setQuestionnaireResult(result);
    setCurrentWeights(result.weights);
    setHasUnsavedChanges(true);
    setShowQuestionnaire(false);
    
    // Auto-save the questionnaire results
    saveWeightsMutation.mutate({ weights: result.weights, primaryGoal: result.primaryGoal });
    
    toast({
      title: "🤖 AI Profile Complete!",
      description: `Your AI is now optimized for ${goalLabels[result.primaryGoal as keyof typeof goalLabels]}!`
    });
  };

  // Handle manual slider changes
  const handleSliderChange = (goal: string, value: number[]) => {
    const newWeight = value[0] / 100;
    console.log(`🤖 AI Generator: Weight adjusted - ${goal}: ${newWeight}`);
    
    setCurrentWeights(prev => ({
      ...prev,
      [goal]: newWeight
    }));
    setHasUnsavedChanges(true);
  };

  // Reset to questionnaire results
  const resetToQuestionnaire = () => {
    if (questionnaireResult) {
      console.log('🔄 AI Generator: Resetting to questionnaire results:', questionnaireResult.weights);
      setCurrentWeights(questionnaireResult.weights);
      setHasUnsavedChanges(true);
    }
  };

  // Save current weights
  const handleSave = () => {
    console.log('🤖 AI Generator: Manual save triggered');
    saveWeightsMutation.mutate({ weights: currentWeights, primaryGoal: profileData?.primaryGoal });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your AI preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Show questionnaire when active, otherwise show main card */}
      {showQuestionnaire ? (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Bot className="h-8 w-8 text-purple-600" />
              AI Intelligence Configuration
            </CardTitle>
            <p className="text-gray-600 mt-2 text-lg">
              Answer a few questions to train your AI meal planning assistant
            </p>
          </CardHeader>
          <CardContent>
            <QuestionnaireComponent onComplete={handleQuestionnaireComplete} />
            <div className="mt-4">
              <Button 
                variant="outline" 
                onClick={() => setShowQuestionnaire(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-to-br from-purple-50 via-blue-50 to-emerald-50 border-0 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Bot className="h-8 w-8 text-purple-600" />
                  🤖 AI-Powered Meal Plan Generator
                </CardTitle>
                <p className="text-gray-600 mt-2 text-lg">
                  Take a smart questionnaire to determine your meal planning priorities, then get an intelligent meal plan tailored to your preferences using advanced AI ranking.
                </p>
              </div>
              <Button 
                onClick={() => setShowQuestionnaire(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600 text-white border-0"
              >
                <Zap className="w-4 h-4" />
                Configure AI
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Current questionnaire result display */}
      {questionnaireResult && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  AI Configuration Active
                </p>
                <p className="text-sm text-emerald-600">
                  Primary Focus: {goalLabels[questionnaireResult.primaryGoal as keyof typeof goalLabels]}
                </p>
              </div>
              <Button 
                onClick={resetToQuestionnaire}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset AI
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Weight Controls - Hidden but functionality preserved */}
      <div className="hidden">
        <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-600" />
                AI Meal Planning Priorities
              </CardTitle>
              {hasUnsavedChanges && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  AI Updates Pending
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Fine-tune how your AI prioritizes different aspects of meal planning
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(currentWeights).map(([goal, weight]) => (
              <div key={goal} className="space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-sm font-medium">
                      {goalLabels[goal as keyof typeof goalLabels]}
                    </label>
                    <p className="text-xs text-gray-500">
                      {goalDescriptions[goal as keyof typeof goalDescriptions]}
                    </p>
                  </div>
                  <span className="text-sm font-mono bg-gradient-to-r from-purple-100 to-emerald-100 px-3 py-1 rounded-full">
                    {Math.round(weight * 100)}%
                  </span>
                </div>
                <Slider
                  value={[weight * 100]}
                  onValueChange={(value) => handleSliderChange(goal, value)}
                  max={100}
                  min={0}
                  step={5}
                  className="w-full"
                />
              </div>
            ))}

            <Separator />

            <div className="flex justify-end gap-2">
              <Button 
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saveWeightsMutation.isPending}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-600 hover:to-emerald-600 text-white border-0"
              >
                <Save className="w-4 h-4" />
                {saveWeightsMutation.isPending ? 'Training AI...' : 'Update AI'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Simple questionnaire component with AI branding
function QuestionnaireComponent({ onComplete }: { onComplete: (result: QuestionnaireResult) => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  const questions = [
    {
      question: "What's most important for your AI meal planner to prioritize?",
      options: [
        { id: 'cost', label: 'Staying within budget', goal: 'cost' },
        { id: 'health', label: 'Eating healthy and nutritious food', goal: 'health' },
        { id: 'time', label: 'Quick and easy preparation', goal: 'time' },
        { id: 'variety', label: 'Trying different foods', goal: 'variety' }
      ]
    },
    {
      question: "How should your AI discover new meal ideas for you?",
      options: [
        { id: 'cultural', label: 'Exploring different cuisines and cultures', goal: 'cultural' },
        { id: 'health', label: 'Finding healthy alternatives', goal: 'health' },
        { id: 'cost', label: 'Looking for budget-friendly options', goal: 'cost' },
        { id: 'variety', label: 'Trying seasonal or trending foods', goal: 'variety' }
      ]
    },
    {
      question: "What's your biggest challenge that the AI should help solve?",
      options: [
        { id: 'time', label: 'Not enough time to cook', goal: 'time' },
        { id: 'cost', label: 'Food costs too much', goal: 'cost' },
        { id: 'variety', label: 'Getting bored with the same foods', goal: 'variety' },
        { id: 'health', label: 'Maintaining a healthy diet', goal: 'health' }
      ]
    }
  ];

  const handleAnswer = (goalType: string) => {
    const newAnswers = [...answers, goalType];
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Calculate weights based on answers
      const goalCounts = newAnswers.reduce((acc, goal) => {
        acc[goal] = (acc[goal] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Find primary goal (most selected)
      const primaryGoal = Object.entries(goalCounts).reduce((a, b) => 
        goalCounts[a[0]] > goalCounts[b[0]] ? a : b
      )[0];

      // Calculate weights with primary goal getting boost
      const baseWeight = 0.3;
      const primaryWeight = 0.8;
      const weights = {
        cost: goalCounts.cost ? (goalCounts.cost / newAnswers.length) * 0.7 + baseWeight : baseWeight,
        health: goalCounts.health ? (goalCounts.health / newAnswers.length) * 0.7 + baseWeight : baseWeight,
        cultural: goalCounts.cultural ? (goalCounts.cultural / newAnswers.length) * 0.7 + baseWeight : baseWeight,
        variety: goalCounts.variety ? (goalCounts.variety / newAnswers.length) * 0.7 + baseWeight : baseWeight,
        time: goalCounts.time ? (goalCounts.time / newAnswers.length) * 0.7 + baseWeight : baseWeight
      };

      // Boost primary goal
      weights[primaryGoal as keyof typeof weights] = primaryWeight;

      console.log('🤖 AI Configuration complete:', {
        primaryGoal,
        weights,
        answers: newAnswers
      });

      onComplete({
        primaryGoal,
        weights
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Training Step {currentQuestion + 1} of {questions.length}</span>
          <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-purple-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>

        <h3 className="text-lg font-medium">{questions[currentQuestion].question}</h3>
        
        <div className="grid gap-2">
          {questions[currentQuestion].options.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              className="text-left justify-start h-auto p-4"
              onClick={() => handleAnswer(option.goal)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
