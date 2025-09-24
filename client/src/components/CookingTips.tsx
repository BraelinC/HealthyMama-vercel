import { Card, CardContent } from "@/components/ui/card";

const CookingTips = () => {
  const tips = [
    {
      title: "Master Basic Knife Skills",
      description: "Learning proper knife techniques will save you time and improve the quality of your dishes. Start with the right grip and practice the rocking motion.",
      imageUrl: "https://images.unsplash.com/photo-1542010589005-d1eacc3918f2?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
      link: "#"
    },
    {
      title: "Cook with Fresh Herbs",
      description: "Fresh herbs can transform ordinary dishes into extraordinary ones. Learn which herbs pair well with different foods and when to add them during cooking.",
      imageUrl: "https://images.unsplash.com/photo-1600166898405-da9535204843?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=400",
      link: "#"
    }
  ];
  
  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-800">
          Cooking Tips
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tips.map((tip, index) => (
          <Card key={index} className="bg-white rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 h-48 md:h-auto">
              <img 
                src={tip.imageUrl} 
                alt={tip.title} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="w-full md:w-2/3 p-4">
              <h3 className="font-display font-semibold text-lg text-neutral-800 mb-2">
                {tip.title}
              </h3>
              <p className="text-neutral-600 text-sm">
                {tip.description}
              </p>
              <a 
                href={tip.link} 
                className="text-primary hover:text-primary/90 text-sm font-medium mt-2 inline-block"
              >
                Learn more →
              </a>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
};

export default CookingTips;
