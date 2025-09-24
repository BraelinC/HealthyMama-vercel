import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CulturalFreeTextInputProps {
  onSubmit: (text: string) => Promise<void>;
  isLoading?: boolean;
}

export default function CulturalFreeTextInput({
  onSubmit,
  isLoading = false
}: CulturalFreeTextInputProps) {
  const [freeText, setFreeText] = useState('');

  const handleSubmit = async () => {
    if (freeText.trim()) {
      await onSubmit(freeText.trim());
      setFreeText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            Can't find your culture? Describe it here and we'll help identify it:
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g., My family is from Northern Italy and we cook lots of pasta and risotto..."
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={handleSubmit}
              disabled={!freeText.trim() || isLoading}
              className="px-4"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Identify'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}