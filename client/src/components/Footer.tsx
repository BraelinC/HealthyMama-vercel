import { Link } from "wouter";
import { 
  HandPlatter, 
  Facebook, 
  Twitter, 
  Instagram, 
  Send 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Footer = () => {
  return (
    <footer className="bg-white border-t border-neutral-200 py-10">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <HandPlatter className="text-primary h-6 w-6" />
              <h3 className="text-xl font-display font-bold text-neutral-800">Healthy Mama</h3>
            </div>
            <p className="text-neutral-600 mb-4">
              AI-powered meal planning and recipe generation for smart, cost-effective cooking.
            </p>
            <div className="flex gap-4">
              <a 
                href="#" 
                className="text-neutral-500 hover:text-primary transition-colors" 
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="text-neutral-500 hover:text-primary transition-colors" 
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a 
                href="#" 
                className="text-neutral-500 hover:text-primary transition-colors" 
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-neutral-800 mb-4">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-neutral-600 hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/browse" className="text-neutral-600 hover:text-primary transition-colors">
                  Browse Recipes
                </Link>
              </li>
              <li>
                <a href="#generate" className="text-neutral-600 hover:text-primary transition-colors">
                  Generate Recipe
                </a>
              </li>
              <li>
                <Link to="/my-recipes" className="text-neutral-600 hover:text-primary transition-colors">
                  My Favorites
                </Link>
              </li>
              <li>
                <a href="#tips" className="text-neutral-600 hover:text-primary transition-colors">
                  Cooking Tips
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-neutral-800 mb-4">Support</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/help" className="text-neutral-600 hover:text-primary transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-neutral-600 hover:text-primary transition-colors">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-neutral-600 hover:text-primary transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-neutral-600 hover:text-primary transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-neutral-600 hover:text-primary transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-neutral-800 mb-4">Newsletter</h4>
            <p className="text-neutral-600 mb-4">
              Subscribe to receive new recipes and cooking tips.
            </p>
            <form className="flex">
              <Input 
                type="email" 
                placeholder="Your email" 
                className="rounded-r-none"
              />
              <Button 
                type="submit" 
                className="bg-primary text-white rounded-l-none hover:bg-primary/90"
              >
                <Send className="h-5 w-5" />
              </Button>
            </form>
          </div>
        </div>
        
        <div className="mt-10 pt-6 border-t border-neutral-200 text-center text-neutral-500 text-sm">
          <p>© {new Date().getFullYear()} Healthy Mama. All rights reserved. Powered by AI meal planning technology.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
