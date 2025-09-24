import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

interface RecipeCardProps {
  title: string;
  description: string;
  imageUrl: string;
  timeMinutes: number;
  tags: string[];
  onClick?: () => void;
}

const RecipeCard = ({
  title,
  description,
  imageUrl,
  timeMinutes,
  tags,
  onClick
}: RecipeCardProps) => {
  const [imgError, setImgError] = useState(false);
  
  // Generate a reliable fallback image based on recipe title
  const getFallbackImage = () => {
    // Use a selection of high-quality food images that are known to work
    const foodImages = [
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600", // pancakes
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600", // pizza
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600", // salad
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600", // soup
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600", // steak
    ];
    // Use title hash to consistently pick the same image for the same recipe
    const hash = (title || '').split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    return foodImages[Math.abs(hash) % foodImages.length];
  };

  return (
    <Card 
      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="relative h-48">
        <img 
          src={imgError ? getFallbackImage() : (imageUrl || getFallbackImage())} 
          alt={title} 
          className="w-full h-full object-cover" 
          onError={() => setImgError(true)}
        />
        <div className="absolute top-4 right-4">
          <span className="bg-white/90 text-neutral-700 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm">
            {timeMinutes} min
          </span>
        </div>
      </div>
      
      <CardContent className="p-6">
        <h3 className="font-display font-semibold text-lg text-neutral-800 mb-3 leading-tight">
          {title}
        </h3>
        
        <p className="text-neutral-600 text-sm mb-4 line-clamp-2 leading-relaxed">
          {description}
        </p>
        
        <div className="flex gap-2 flex-wrap">
          {tags.map((tag, index) => (
            <Badge 
              key={index} 
              variant="secondary" 
              className="bg-neutral-100 text-neutral-600 rounded-full text-xs px-3 py-1"
            >
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecipeCard;
