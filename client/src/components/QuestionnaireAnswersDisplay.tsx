import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ChevronDown, 
  ChevronUp, 
  Brain, 
  CheckCircle,
  RotateCcw
} from 'lucide-react';

interface QuestionnaireSelection {
  questionId: string;
  questionTitle: string;
  optionId: string;
  optionLabel: string;
  optionDescription: string;
}

interface QuestionnaireAnswersDisplayProps {
  answers: Record<string, string[]>;
  selectedOptions: QuestionnaireSelection[];
  onRetakeQuestionnaire?: () => void;
  showRetakeButton?: boolean;
}

export default function QuestionnaireAnswersDisplay({ 
  answers, 
  selectedOptions, 
  onRetakeQuestionnaire,
  showRetakeButton = true 
}: QuestionnaireAnswersDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (!selectedOptions || selectedOptions.length === 0) {
    return null;
  }

  // Group selections by question
  const groupedSelections = selectedOptions.reduce((acc, selection) => {
    if (!acc[selection.questionId]) {
      acc[selection.questionId] = {
        questionTitle: selection.questionTitle,
        options: []
      };
    }
    acc[selection.questionId].options.push(selection);
    return acc;
  }, {} as Record<string, { questionTitle: string; options: QuestionnaireSelection[] }>);

  const questionCount = Object.keys(groupedSelections).length;
  const totalSelections = selectedOptions.length;

  return (
    <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            Smart Profile Questionnaire Results
            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
              {questionCount} question{questionCount !== 1 ? 's' : ''}, {totalSelections} selection{totalSelections !== 1 ? 's' : ''}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {showRetakeButton && onRetakeQuestionnaire && (
              <Button 
                onClick={onRetakeQuestionnaire} 
                variant="outline" 
                size="sm"
                className="flex items-center gap-1"
              >
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>
            )}
            <Button
              onClick={() => setIsExpanded(!isExpanded)}
              variant="ghost"
              size="sm"
              className="flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Show Details
                </>
              )}
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          Your intelligent meal planning preferences were determined from this questionnaire
        </p>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="space-y-4">
          {Object.entries(groupedSelections).map(([questionId, group]) => (
            <div key={questionId} className="space-y-2">
              <h4 className="font-medium text-gray-900">{group.questionTitle}</h4>
              <div className="space-y-2">
                {group.options.map((option, index) => (
                  <div 
                    key={`${option.optionId}-${index}`}
                    className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-blue-900">{option.optionLabel}</div>
                      <div className="text-sm text-blue-700 mt-1">{option.optionDescription}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">How This Works</span>
            </div>
            <p className="text-xs text-purple-700">
              Your answers above were analyzed to automatically calculate personalized priority weights for 
              cost, health, cultural preferences, variety, and time considerations. These weights guide 
              our AI meal planning algorithm to generate recommendations that match your lifestyle and preferences.
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}