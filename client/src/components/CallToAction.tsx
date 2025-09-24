import { Button } from "@/components/ui/button";

interface CallToActionProps {
  onGenerateClick: () => void;
}

const CallToAction = ({ onGenerateClick }: CallToActionProps) => {
  return (
    <section className="mb-16">
      <div className="bg-primary/10 rounded-xl p-8 md:p-12 text-center">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-neutral-800 mb-4">
          Ready to Transform Your Cooking Experience?
        </h2>
        <p className="text-neutral-600 max-w-2xl mx-auto mb-6">
          Generate custom recipes tailored to your preferences and get ingredients delivered with just a few clicks.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 py-3"
            onClick={onGenerateClick}
          >
            Generate Your First Recipe
          </Button>
          <Button 
            variant="outline" 
            className="border border-neutral-300 bg-white text-neutral-700 rounded-lg px-6 py-3 hover:bg-neutral-50"
          >
            Learn More
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
