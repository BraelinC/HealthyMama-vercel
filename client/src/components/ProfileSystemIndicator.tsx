import { Badge } from '@/components/ui/badge';
import { Target, Users } from 'lucide-react';
import { useProfileSystem } from '@/hooks/useProfileSystem';

export default function ProfileSystemIndicator() {
  const { isSmartProfileEnabled } = useProfileSystem();

  return (
    <Badge 
      variant="outline" 
      className={`flex items-center gap-2 ${
        isSmartProfileEnabled 
          ? 'border-purple-300 bg-purple-50 text-purple-700' 
          : 'border-emerald-300 bg-emerald-50 text-emerald-700'
      }`}
    >
      {isSmartProfileEnabled ? (
        <>
          <Target className="h-3 w-3" />
          Advanced Planner
        </>
      ) : (
        <>
          <Users className="h-3 w-3" />
          Traditional Planner
        </>
      )}
    </Badge>
  );
}