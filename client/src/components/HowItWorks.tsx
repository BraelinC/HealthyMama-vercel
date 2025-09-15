import { 
  Wand2, 
  FileText, 
  ShoppingCart 
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const HowItWorks = () => {
  const steps = [
    {
      icon: <Wand2 className="h-6 w-6 text-primary" />,
      title: "1. Generate Recipe",
      description: "Enter your preferences, dietary needs, or available ingredients to create a custom recipe with AI."
    },
    {
      icon: <FileText className="h-6 w-6 text-primary" />,
      title: "2. View Recipe",
      description: "Get a complete recipe with ingredients, step-by-step instructions, and cooking tips."
    },
    {
      icon: <ShoppingCart className="h-6 w-6 text-primary" />,
      title: "3. Shop Ingredients",
      description: "Order all ingredients with one click through Instacart integration for convenient delivery."
    }
  ];
  
  return (
    <section className="mb-16">
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-800 mb-3">
          How It Works
        </h2>
        <p className="text-neutral-600 max-w-2xl mx-auto">
          Generate custom recipes with AI and easily shop for ingredients with Instacart integration
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, index) => (
          <Card key={index} className="bg-white rounded-xl shadow-md">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                {step.icon}
              </div>
              <h3 className="font-display font-semibold text-xl mb-2">
                {step.title}
              </h3>
              <p className="text-neutral-600">
                {step.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
