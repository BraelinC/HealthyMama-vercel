import { Star, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Testimonial {
  rating: number;
  content: string;
  name: string;
  title: string;
}

const Testimonials = () => {
  const testimonials: Testimonial[] = [
    {
      rating: 5,
      content: "RecipeAI has been a game changer for our family meals. We get creative recipes based on what's in our fridge, and the Instacart integration makes shopping effortless.",
      name: "Sarah Johnson",
      title: "Busy parent of three"
    },
    {
      rating: 5,
      content: "As someone with dietary restrictions, finding creative meals was always a challenge. The AI understands my needs and generates perfect recipes every time.",
      name: "Michael Chen",
      title: "Gluten-free home cook"
    },
    {
      rating: 4.5,
      content: "I love how I can click one button and get all my ingredients delivered through Instacart. It's saved me so much time planning meals and grocery shopping.",
      name: "Jessica Ramirez",
      title: "Working professional"
    }
  ];
  
  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} className="h-5 w-5 fill-yellow-400 text-yellow-400" />);
    }
    
    if (hasHalfStar) {
      stars.push(
        <div key="half" className="relative">
          <Star className="h-5 w-5 text-yellow-400" />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          </div>
        </div>
      );
    }
    
    const emptyStars = 5 - stars.length;
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="h-5 w-5 text-yellow-400" />);
    }
    
    return stars;
  };
  
  return (
    <section className="mb-16">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-800 mb-3">
          What Our Users Say
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((testimonial, index) => (
          <Card key={index} className="bg-white rounded-xl shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-1 text-yellow-400 mb-4">
                {renderStars(testimonial.rating)}
              </div>
              
              <p className="text-neutral-700 mb-4">
                "{testimonial.content}"
              </p>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neutral-200 text-neutral-500 flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-neutral-800">{testimonial.name}</p>
                  <p className="text-sm text-neutral-500">{testimonial.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default Testimonials;
