import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { CheckCircle, RotateCcw, Save } from 'lucide-react';
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

export default function QuestionnaireSliderConnector() {
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
    queryKey: ['weight-based-profile'],
    queryFn: async () => {
      const response = await fetch('/api/profile/weight-based');
      if (!response.ok) throw new Error('Failed to fetch profile');
      return response.json();
    }
  });

  // Update current weights when profile data loads
  useEffect(() => {
    if (profileData?.goalWeights) {
      console.log('📊 Loading saved weights from profile:', profileData.goalWeights);
      setCurrentWeights(profileData.goalWeights);
    }
  }, [profileData]);

  // Save weights mutation
  const saveWeightsMutation = useMutation({
    mutationFn: async (weights: typeof currentWeights) => {
      console.log('💾 Saving weights to database:', weights);
      const response = await fetch('/api/profile/weight-based', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalWeights: weights })
      });
      if (!response.ok) throw new Error('Failed to save weights');
      return response.json();
    },
    onSuccess: (data) => {
      console.log('✅ Weights saved successfully:', data);
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['weight-based-profile'] });
      toast({
        title: "Success",
        description: "Goal weights saved successfully!"
      });
    },
    onError: (error) => {
      console.error('❌ Failed to save weights:', error);
      toast({
        title: "Error",
        description: "Failed to save goal weights",
        variant: "destructive"
      });
    }
  });

  // Handle questionnaire completion
  const handleQuestionnaireComplete = (result: QuestionnaireResult) => {
    console.log('📝 Questionnaire completed with result:', result);
    setQuestionnaireResult(result);
    setCurrentWeights(result.weights);
    setHasUnsavedChanges(true);
    setShowQuestionnaire(false);
    
    // Auto-save the questionnaire results
    saveWeightsMutation.mutate(result.weights);
    
    toast({
      title: "Questionnaire Complete",
      description: `Primary goal set to ${goalLabels[result.primaryGoal as keyof typeof goalLabels]}!`
    });
  };

  // Handle manual slider changes
  const handleSliderChange = (goal: string, value: number[]) => {
    const newWeight = value[0] / 100;
    console.log(`🎚️ Slider changed - ${goal}: ${newWeight}`);
    
    setCurrentWeights(prev => ({
      ...prev,
      [goal]: newWeight
    }));
    setHasUnsavedChanges(true);
  };

  // Reset to questionnaire results
  const resetToQuestionnaire = () => {
    if (questionnaireResult) {
      console.log('🔄 Resetting to questionnaire results:', questionnaireResult.weights);
      setCurrentWeights(questionnaireResult.weights);
      setHasUnsavedChanges(true);
    }
  };

  // Save current weights
  const handleSave = () => {
    saveWeightsMutation.mutate(currentWeights);
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading your preferences...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header with questionnaire trigger */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Goal Preferences</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Set your meal planning priorities using the questionnaire or manual sliders
              </p>
            </div>
            <Button 
              onClick={() => setShowQuestionnaire(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Take Questionnaire
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Questionnaire Modal */}
      {showQuestionnaire && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Quick Goal Assessment</CardTitle>
            <p className="text-sm text-muted-foreground">
              Answer a few questions to automatically set your preferences
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
      )}

      {/* Current questionnaire result display */}
      {questionnaireResult && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-green-800">
                  Latest Questionnaire Result
                </p>
                <p className="text-sm text-green-600">
                  Primary Goal: {goalLabels[questionnaireResult.primaryGoal as keyof typeof goalLabels]}
                </p>
              </div>
              <Button 
                onClick={resetToQuestionnaire}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset to Questionnaire
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual weight adjustment sliders */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Manual Adjustments</CardTitle>
            {hasUnsavedChanges && (
              <Badge variant="secondary">Unsaved Changes</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(currentWeights).map(([goal, weight]) => (
            <div key={goal} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <label className="text-sm font-medium">
                    {goalLabels[goal as keyof typeof goalLabels]}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {goalDescriptions[goal as keyof typeof goalDescriptions]}
                  </p>
                </div>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">
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
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saveWeightsMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Simple questionnaire component
function QuestionnaireComponent({ onComplete }: { onComplete: (result: QuestionnaireResult) => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);

  const questions = [
    {
      question: "What's most important when planning meals?",
      options: [
        { id: 'cost', label: 'Staying within budget', goal: 'cost' },
        { id: 'health', label: 'Eating healthy and nutritious food', goal: 'health' },
        { id: 'time', label: 'Quick and easy preparation', goal: 'time' },
        { id: 'variety', label: 'Trying different foods', goal: 'variety' }
      ]
    },
    {
      question: "How do you prefer to discover new foods?",
      options: [
        { id: 'cultural', label: 'Exploring different cuisines and cultures', goal: 'cultural' },
        { id: 'health', label: 'Finding healthy alternatives', goal: 'health' },
        { id: 'cost', label: 'Looking for budget-friendly options', goal: 'cost' },
        { id: 'variety', label: 'Trying seasonal or trending foods', goal: 'variety' }
      ]
    },
    {
      question: "What's your biggest challenge with meal planning?",
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

      onComplete({
        primaryGoal,
        weights
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Question {currentQuestion + 1} of {questions.length}</span>
          <span>{Math.round(((currentQuestion + 1) / questions.length) * 100)}%</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
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