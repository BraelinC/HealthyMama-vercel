import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Sheet, 
  SheetContent, 
  SheetTrigger 
} from "@/components/ui/sheet";
import { HandPlatter, Menu } from "lucide-react";

const Header = () => {
  const [location] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const navLinks = [
    { name: "Home", path: "/" },
    { name: "My Recipes", path: "/my-recipes" },
    { name: "About", path: "/about" },
    { name: "Help", path: "/help" }
  ];
  
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2">
          <HandPlatter className="text-primary h-6 w-6" />
          <h1 className="text-xl md:text-2xl font-display font-bold text-neutral-800">NutriMa</h1>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link 
              key={link.path} 
              to={link.path} 
              className={`text-neutral-700 hover:text-primary transition-colors font-medium ${
                location === link.path ? "text-primary" : ""
              }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>
        
        <div className="flex items-center gap-3">
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="md:hidden text-neutral-700 hover:text-primary transition-colors"
                aria-label="Menu"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="md:hidden">
              <div className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <Link 
                    key={link.path} 
                    to={link.path} 
                    className={`text-neutral-700 hover:text-primary transition-colors font-medium text-lg ${
                      location === link.path ? "text-primary" : ""
                    }`}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.name}
                  </Link>
                ))}
                <Button className="mt-4">Sign In</Button>
              </div>
            </SheetContent>
          </Sheet>
          
          <Button className="hidden md:block">Sign In</Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
