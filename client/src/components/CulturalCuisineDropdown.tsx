import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import cuisineData from '@/data/cultural_cuisine_masterlist.json';

interface CuisineOption {
  label: string;
  aliases: string[];
}

interface CulturalCuisineDropdownProps {
  selectedCuisines: string[];
  onCuisineChange: (cuisines: string[]) => void;
  placeholder?: string;
}

export default function CulturalCuisineDropdown({
  selectedCuisines,
  onCuisineChange,
  placeholder = "Search for your cultural cuisine..."
}: CulturalCuisineDropdownProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<CuisineOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (searchTerm.length === 0) {
      setFilteredOptions([]);
      setIsOpen(false);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = cuisineData.filter((cuisine) => {
      // Check if the label matches
      if (cuisine.label.toLowerCase().includes(searchLower)) {
        return true;
      }
      // Check if any alias matches
      return cuisine.aliases.some(alias => 
        alias.toLowerCase().includes(searchLower)
      );
    });

    setFilteredOptions(filtered);
    setIsOpen(true);
  }, [searchTerm]);

  const handleSelectCuisine = (cuisine: CuisineOption) => {
    setIsSelecting(true);
    if (!selectedCuisines.includes(cuisine.label)) {
      onCuisineChange([...selectedCuisines, cuisine.label]);
    }
    setSearchTerm('');
    setIsOpen(false);
    // Reset selection flag after a brief delay
    setTimeout(() => setIsSelecting(false), 100);
  };

  const handleRemoveCuisine = (cuisineToRemove: string) => {
    onCuisineChange(selectedCuisines.filter(cuisine => cuisine !== cuisineToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            if (searchTerm.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            // Only close if we're not in the middle of selecting
            if (!isSelecting) {
              // Delay closing to allow for click events
              setTimeout(() => setIsOpen(false), 200);
            }
          }}
          className="w-full"
        />
        
        {isOpen && filteredOptions.length > 0 && (
          <Card className="absolute z-10 w-full mt-1 max-h-64 overflow-y-auto">
            <CardContent className="p-0">
              {filteredOptions.map((cuisine, index) => (
                <div
                  key={index}
                  className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                  onMouseDown={() => handleSelectCuisine(cuisine)}
                >
                  <div className="font-medium text-sm">{cuisine.label}</div>
                  {cuisine.aliases.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Also known as: {cuisine.aliases.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Selected cuisines */}
      {selectedCuisines.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedCuisines.map((cuisine) => (
            <Badge key={cuisine} variant="secondary" className="flex items-center gap-1">
              {cuisine}
              <X
                size={14}
                className="cursor-pointer hover:text-red-500"
                onClick={() => handleRemoveCuisine(cuisine)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}