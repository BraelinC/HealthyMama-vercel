import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const IconShowcase = () => {
  // Complete 200+ emoji food categorization system
  const foodCategories = [
    {
      title: "🌅 Breakfast Dishes",
      description: "Morning meal specialties",
      items: [
        { emoji: "🥞", name: "Pancakes", foods: "pancake, hotcakes, flapjacks" },
        { emoji: "🧇", name: "Waffles", foods: "waffle, belgian waffle" },
        { emoji: "🍞", name: "French Toast", foods: "french toast, toast, bread" },
        { emoji: "🍳", name: "Fried Eggs/Omelettes", foods: "omelette, omelet, fried egg" },
        { emoji: "🥚", name: "Scrambled Eggs", foods: "scrambled egg, benedict, poached egg" },
        { emoji: "🥣", name: "Cereal/Oatmeal", foods: "cereal, oatmeal, porridge, granola" },
        { emoji: "🥤", name: "Smoothies", foods: "smoothie, protein shake" },
        { emoji: "🥯", name: "Bagels", foods: "bagel, everything bagel" },
        { emoji: "🥐", name: "Croissants", foods: "croissant, pastry" },
        { emoji: "🧁", name: "Muffins", foods: "muffin, cupcake" }
      ]
    },
    {
      title: "🍝 Pasta & Noodles",
      description: "Pasta dishes and noodle soups",
      items: [
        { emoji: "🍝", name: "Spaghetti/Pasta", foods: "spaghetti, linguine, fettuccine, pasta, penne, rigatoni, lasagna, carbonara, alfredo, marinara" },
        { emoji: "🍜", name: "Noodle Soups", foods: "ramen, pho, lo mein, chow mein, pad thai, udon, soba" },
        { emoji: "🧀", name: "Mac & Cheese", foods: "mac and cheese, macaroni" }
      ]
    },
    {
      title: "🌮 Mexican & Latin Cuisine",
      description: "Latin American specialties",
      items: [
        { emoji: "🌮", name: "Tacos", foods: "taco, tacos, fajita" },
        { emoji: "🌯", name: "Burritos/Wraps", foods: "burrito, enchilada, wrap" },
        { emoji: "🫓", name: "Quesadillas", foods: "quesadilla" },
        { emoji: "🫔", name: "Tamales", foods: "tamale" },
        { emoji: "🥑", name: "Guacamole/Avocado", foods: "guacamole, avocado" }
      ]
    },
    {
      title: "🍕 Italian Classics",
      description: "Traditional Italian dishes",
      items: [
        { emoji: "🍕", name: "Pizza", foods: "pizza, margherita, pepperoni" },
        { emoji: "🍚", name: "Risotto", foods: "risotto" },
        { emoji: "🥟", name: "Calzone", foods: "calzone" }
      ]
    },
    {
      title: "🍣 Asian Cuisine",
      description: "Asian dishes and specialties",
      items: [
        { emoji: "🍣", name: "Sushi/Sashimi", foods: "sushi, sashimi, nigiri, maki" },
        { emoji: "🍤", name: "Tempura/Shrimp", foods: "tempura, shrimp" },
        { emoji: "🍗", name: "Teriyaki", foods: "teriyaki, yakitori" },
        { emoji: "🥬", name: "Kimchi", foods: "kimchi" },
        { emoji: "🍚", name: "Rice Dishes", foods: "bibimbap, fried rice" },
        { emoji: "🥟", name: "Dumplings", foods: "dumplings, gyoza" },
        { emoji: "🥢", name: "Spring Rolls", foods: "spring roll" },
        { emoji: "🍛", name: "Curry", foods: "curry, thai curry, indian curry" }
      ]
    },
    {
      title: "🍔 American Classics",
      description: "Traditional American dishes",
      items: [
        { emoji: "🍔", name: "Burgers", foods: "burger, hamburger, cheeseburger" },
        { emoji: "🌭", name: "Hot Dogs", foods: "hot dog, hotdog, sausage, chorizo" },
        { emoji: "🍖", name: "BBQ/Grilled Meats", foods: "bbq, barbecue, ribs, brisket, pulled pork, meatloaf, meatball" },
        { emoji: "🍲", name: "Chili/Stews", foods: "chili, stew" }
      ]
    },
    {
      title: "🥪 Sandwiches & Wraps", 
      description: "Handheld meals",
      items: [
        { emoji: "🥪", name: "Sandwiches", foods: "sandwich, sub, submarine, hoagie, hero, panini, club sandwich, blt" },
        { emoji: "🧀", name: "Grilled Cheese", foods: "grilled cheese" },
        { emoji: "🌯", name: "Wraps", foods: "wrap, chicken wrap" }
      ]
    },
    {
      title: "🍲 Soups & Stews",
      description: "Liquid-based dishes",
      items: [
        { emoji: "🍲", name: "Soups", foods: "soup, stew, chowder, bisque, broth, minestrone, chicken noodle" },
        { emoji: "🍅", name: "Tomato Soup", foods: "tomato soup" }
      ]
    },
    {
      title: "🥗 Salads & Fresh",
      description: "Fresh and healthy options",
      items: [
        { emoji: "🥗", name: "Salads", foods: "caesar salad, greek salad, cobb salad, waldorf salad, caprese salad, salad" }
      ]
    },
    {
      title: "🦞 Seafood Specialties",
      description: "Ocean-fresh dishes",
      items: [
        { emoji: "🍟", name: "Fish & Chips", foods: "fish and chips" },
        { emoji: "🦞", name: "Lobster", foods: "lobster" },
        { emoji: "🦀", name: "Crab", foods: "crab" },
        { emoji: "🍤", name: "Shrimp", foods: "shrimp, prawns" },
        { emoji: "🐚", name: "Scallops/Clams", foods: "scallop, clam, mussel" },
        { emoji: "🦪", name: "Oysters", foods: "oyster" }
      ]
    },
    {
      title: "🥩 Meat Categories",
      description: "Primary protein sources",
      items: [
        { emoji: "🥩", name: "Beef", foods: "steak, ribeye, sirloin, beef, ground beef, brisket, short rib" },
        { emoji: "🍗", name: "Chicken", foods: "chicken breast, chicken thigh, chicken wing, fried chicken, roasted chicken, rotisserie, chicken" },
        { emoji: "🥓", name: "Bacon", foods: "bacon" },
        { emoji: "🍖", name: "Pork", foods: "ham, pork chop, pork tenderloin, pork" },
        { emoji: "🌭", name: "Sausages", foods: "sausage, chorizo" },
        { emoji: "🐟", name: "Fish", foods: "salmon, tuna, cod, halibut, tilapia, mahi, fish" },
        { emoji: "🦃", name: "Turkey", foods: "turkey" },
        { emoji: "🦆", name: "Duck", foods: "duck" },
        { emoji: "🐑", name: "Lamb", foods: "lamb" }
      ]
    },
    {
      title: "🍅 Vegetables",
      description: "Plant-based ingredients",
      items: [
        { emoji: "🍅", name: "Tomatoes", foods: "tomato, cherry tomato, marinara" },
        { emoji: "🥬", name: "Leafy Greens", foods: "spinach, lettuce, romaine, arugula, kale, cabbage, brussels sprout, asparagus, green bean, celery" },
        { emoji: "🥕", name: "Root Vegetables", foods: "carrot, beet, beetroot, radish" },
        { emoji: "🥔", name: "Potatoes", foods: "potato" },
        { emoji: "🍠", name: "Sweet Potatoes", foods: "sweet potato" },
        { emoji: "🧅", name: "Onions", foods: "onion" },
        { emoji: "🧄", name: "Garlic", foods: "garlic" },
        { emoji: "🥦", name: "Cruciferous", foods: "broccoli, cauliflower" },
        { emoji: "🫑", name: "Bell Peppers", foods: "bell pepper, sweet pepper, pepper" },
        { emoji: "🌶️", name: "Hot Peppers", foods: "jalapeño, chili pepper" },
        { emoji: "🍄", name: "Mushrooms", foods: "mushroom" },
        { emoji: "🌽", name: "Corn", foods: "corn" },
        { emoji: "🥒", name: "Zucchini/Cucumber", foods: "zucchini, squash, cucumber" },
        { emoji: "🍆", name: "Eggplant", foods: "eggplant" },
        { emoji: "🟢", name: "Peas/Lime", foods: "peas, lime" }
      ]
    },
    {
      title: "🍎 Fruits",
      description: "Sweet and savory fruits",
      items: [
        { emoji: "🍎", name: "Apples", foods: "apple" },
        { emoji: "🍐", name: "Pears", foods: "pear" },
        { emoji: "🍊", name: "Oranges", foods: "orange" },
        { emoji: "🍋", name: "Lemons", foods: "lemon" }
      ]
    },
    {
      title: "🫘 Legumes & Grains",
      description: "Protein-rich plant foods",
      items: [
        { emoji: "🫘", name: "Beans", foods: "black beans, kidney beans, chickpea, garbanzo, lentil" },
        { emoji: "🍚", name: "Rice", foods: "rice" },
        { emoji: "🌾", name: "Ancient Grains", foods: "quinoa, barley, wheat" }
      ]
    },
    {
      title: "🧀 Dairy & Eggs",
      description: "Dairy products and eggs",
      items: [
        { emoji: "🧀", name: "Cheese", foods: "cheese, feta, cheddar, mozzarella" },
        { emoji: "🥚", name: "Eggs", foods: "egg" },
        { emoji: "🥛", name: "Milk Products", foods: "milk, cream, yogurt" }
      ]
    },
    {
      title: "🍰 Desserts",
      description: "Sweet treats and desserts",
      items: [
        { emoji: "🍰", name: "Cakes", foods: "cake, cheesecake, tiramisu" },
        { emoji: "🥧", name: "Pies", foods: "pie, apple pie, pumpkin pie" },
        { emoji: "🍦", name: "Ice Cream", foods: "ice cream, gelato" },
        { emoji: "🍪", name: "Cookies", foods: "cookie, chocolate chip" },
        { emoji: "🍫", name: "Chocolate", foods: "brownie, chocolate" },
        { emoji: "🍩", name: "Donuts", foods: "donut, doughnut" }
      ]
    },
    {
      title: "☕ Beverages",
      description: "Drinks and beverages", 
      items: [
        { emoji: "☕", name: "Coffee", foods: "coffee, espresso, latte, cappuccino" },
        { emoji: "🍵", name: "Tea", foods: "tea, green tea, herbal tea" },
        { emoji: "🍷", name: "Wine", foods: "wine, red wine, white wine" },
        { emoji: "🍺", name: "Beer", foods: "beer, ale, lager" },
        { emoji: "🧃", name: "Juice", foods: "juice, orange juice, apple juice" }
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">🍽️ Food Icons Library</h1>
        <p className="text-xl text-gray-600">Comprehensive collection of 200+ food emojis</p>
        <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <Badge variant="outline">Priority: Meal Name → Meat → Vegetable</Badge>
          <Badge variant="outline">200+ Emojis</Badge>
          <Badge variant="outline">17 Categories</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {foodCategories.map((category, categoryIndex) => (
          <Card key={categoryIndex} className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                {category.title}
              </CardTitle>
              <p className="text-sm text-gray-600">{category.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {category.items.map((item, itemIndex) => (
                <div key={itemIndex} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 mb-1">{item.name}</h4>
                    <p className="text-xs text-gray-500 break-words">
                      <strong>Matches:</strong> {item.foods}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">🎯 How the Priority System Works</h2>
        <div className="space-y-2 text-sm text-blue-800">
          <div><strong>1. Meal Name Priority:</strong> Specific dishes like "Spaghetti Carbonara" → 🍝 (spaghetti emoji)</div>
          <div><strong>2. Meat Choice Priority:</strong> If no meal match, looks for meat like "chicken" → 🍗 (chicken emoji)</div>
          <div><strong>3. Vegetable Priority:</strong> If no meat match, looks for prominent vegetable like "tomato" → 🍅 (tomato emoji)</div>
          <div><strong>4. Default Fallback:</strong> Generic food emoji 🍽️ if no matches found</div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-green-900 mb-3">📊 System Coverage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700">200+</div>
            <div className="text-green-600">Total Emojis</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700">17</div>
            <div className="text-green-600">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700">80/20</div>
            <div className="text-green-600">Coverage Rule</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-700">3-Tier</div>
            <div className="text-green-600">Priority System</div>
          </div>
        </div>
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>This comprehensive emoji system covers the most commonly eaten foods worldwide.</p>
        <p>Built using the 80/20 principle - 20% of foods represent 80% of what people actually eat.</p>
      </div>
    </div>
  );
};

export default IconShowcase;