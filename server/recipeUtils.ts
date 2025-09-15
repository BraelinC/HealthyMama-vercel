/**
 * Recipe-specific utility functions for ingredient and instruction generation
 */

/**
 * Provides ingredients for specific recipe types
 */
export function getRecipeIngredients(recipeQuery: string): string[] {
  // Default ingredients for common cuisines
  const query = recipeQuery.toLowerCase();
  
  // For any Peruvian cuisine
  if (query.includes('ceviche')) {
    return [
      "1 pound white fish (sea bass, tilapia, or sole), diced",
      "1 red onion, thinly sliced",
      "2-3 limes, juiced",
      "1-2 lemons, juiced",
      "1-2 oranges, juiced (optional)",
      "1-2 chili peppers (aji, jalapeño), finely diced",
      "1/4 cup chopped cilantro",
      "Salt and pepper to taste",
      "1 cup cooked sweet potato, cubed (for serving)"
    ];
  } 
  else if (query.includes('seco de res') || query.includes('seco de carne')) {
    return [
      "2 pounds beef chuck, cut into 1-inch cubes",
      "1 cup cilantro, chopped",
      "1 red onion, chopped",
      "4 garlic cloves, minced",
      "1 cup beer or beef broth",
      "2 tablespoons vegetable oil",
      "1 tablespoon aji amarillo paste",
      "1 teaspoon cumin",
      "Salt and pepper to taste"
    ];
  }
  else if (query.includes('lomo saltado')) {
    return [
      "1 pound beef sirloin, sliced into thin strips",
      "2 tablespoons vegetable oil",
      "1 red onion, sliced",
      "2 tomatoes, sliced into wedges",
      "2 cloves garlic, minced",
      "1 yellow chili pepper (aji amarillo), sliced",
      "3 tablespoons soy sauce",
      "2 tablespoons red wine vinegar",
      "1 tablespoon fresh cilantro, chopped",
      "1 pound french fries (freshly made or frozen)",
      "Salt and pepper to taste",
      "2 cups cooked white rice (for serving)"
    ];
  }
  // For any Mexican cuisine
  else if (query.includes('taco') || query.includes('burrito') || query.includes('quesadilla')) {
    return [
      "1 pound ground beef or chicken",
      "1 onion, diced",
      "2 cloves garlic, minced",
      "1 tablespoon chili powder",
      "1 teaspoon cumin",
      "1/2 teaspoon paprika",
      "1/4 teaspoon oregano",
      "Salt and pepper to taste",
      "8 small tortillas (corn or flour)",
      "1 cup shredded cheese",
      "1 tomato, diced",
      "1/2 cup lettuce, shredded",
      "1/4 cup sour cream (optional)",
      "1/4 cup salsa (optional)"
    ];
  }
  // For any Italian cuisine
  else if (query.includes('pasta') || query.includes('spaghetti') || query.includes('fettuccine')) {
    return [
      "1 pound pasta of your choice",
      "2 tablespoons olive oil",
      "3 cloves garlic, minced",
      "1 onion, diced",
      "1 can (14 oz) crushed tomatoes",
      "1/2 teaspoon dried basil",
      "1/2 teaspoon dried oregano",
      "1/4 teaspoon red pepper flakes (optional)",
      "Salt and pepper to taste",
      "1/4 cup grated Parmesan cheese",
      "Fresh basil leaves for garnish"
    ];
  }
  // For any Asian cuisine
  else if (query.includes('stir fry') || query.includes('fried rice') || query.includes('noodle')) {
    return [
      "2 cups cooked rice or noodles",
      "2 tablespoons vegetable oil",
      "1 pound protein (chicken, beef, shrimp, or tofu), diced",
      "1 onion, sliced",
      "2 carrots, julienned",
      "1 bell pepper, sliced",
      "2 cloves garlic, minced",
      "1 tablespoon ginger, minced",
      "3 tablespoons soy sauce",
      "1 tablespoon oyster sauce",
      "1 teaspoon sesame oil",
      "2 green onions, sliced",
      "1/4 cup chopped cilantro for garnish"
    ];
  }
  // For any soup
  else if (query.includes('soup') || query.includes('stew') || query.includes('chowder')) {
    return [
      "1 pound protein (chicken, beef, or seafood)",
      "2 tablespoons olive oil or butter",
      "1 onion, diced",
      "2 carrots, diced",
      "2 celery stalks, diced",
      "3 cloves garlic, minced",
      "6 cups broth (chicken, beef, or vegetable)",
      "1 bay leaf",
      "1 teaspoon thyme",
      "Salt and pepper to taste",
      "Fresh herbs for garnish"
    ];
  }
  // For any baked goods
  else if (query.includes('cake') || query.includes('cookie') || query.includes('pie') || query.includes('bread')) {
    return [
      "2 cups all-purpose flour",
      "1 cup granulated sugar",
      "1/2 cup butter, softened",
      "2 eggs",
      "1 teaspoon vanilla extract",
      "1 teaspoon baking powder",
      "1/2 teaspoon baking soda",
      "1/4 teaspoon salt",
      "1 cup milk or buttermilk"
    ];
  }
  // For any breakfast
  else if (query.includes('pancake') || query.includes('waffle') || query.includes('breakfast')) {
    return [
      "1 1/2 cups all-purpose flour",
      "3 1/2 teaspoons baking powder",
      "1 teaspoon salt",
      "1 tablespoon white sugar",
      "1 1/4 cups milk",
      "1 egg",
      "3 tablespoons butter, melted",
      "1 teaspoon vanilla extract",
      "Maple syrup for serving"
    ];
  }
  // For any salad
  else if (query.includes('salad')) {
    return [
      "4 cups mixed greens",
      "1 cucumber, sliced",
      "1 carrot, grated",
      "1 bell pepper, sliced",
      "1/2 red onion, thinly sliced",
      "1/2 cup cherry tomatoes, halved",
      "1/4 cup nuts or seeds (walnuts, almonds, sunflower seeds)",
      "1/4 cup crumbled cheese (feta, goat, blue)",
      "2 tablespoons olive oil",
      "1 tablespoon vinegar (balsamic, red wine, apple cider)",
      "1 teaspoon Dijon mustard",
      "Salt and pepper to taste"
    ];
  }
  
  // Default ingredients for any recipe
  return [
    "1 pound main ingredient (meat, vegetables, etc.)",
    "1 onion, diced",
    "2 cloves garlic, minced",
    "2 tablespoons olive oil",
    "1 teaspoon salt",
    "1/2 teaspoon black pepper",
    "1 teaspoon herbs or spices (based on cuisine)",
    "1 cup liquid (broth, water, or sauce)",
    "2 cups optional vegetables or side items"
  ];
}

/**
 * Provides instructions for specific recipe types
 */
export function getRecipeInstructions(recipeQuery: string): string[] {
  // Default instructions for common cuisines
  const query = recipeQuery.toLowerCase();
  
  // For any Peruvian cuisine
  if (query.includes('ceviche')) {
    return [
      "Gather and prepare all ingredients as listed in the recipe.",
      "Follow the cooking steps demonstrated in the video.",
      "Combine the diced fish with lime and lemon juice in a glass bowl. Mix well and let it marinate for 15-20 minutes until the fish turns opaque.",
      "Add the sliced onion, diced chili peppers, and chopped cilantro to the fish. Mix gently.",
      "Season with salt and pepper, tasting to adjust as needed.",
      "Serve immediately with sweet potato on the side."
    ];
  } 
  else if (query.includes('seco de res') || query.includes('seco de carne')) {
    return [
      "Cut the beef into small chunks and season with salt and pepper.",
      "Heat the vegetable oil in a large pot over medium heat. Add the beef and brown on all sides.",
      "Remove the beef from the pot and set aside. In the same pot, add the chopped onion and garlic, sautéing until the onion is translucent.",
      "Blend the cilantro with some beef broth or beer to make a smooth paste. Add this paste to the pot.",
      "Return the beef to the pot, add the remaining broth, aji amarillo paste, and cumin. Stir well.",
      "Cover and simmer on low heat for 1.5-2 hours until the beef is tender and the sauce has thickened."
    ];
  }
  else if (query.includes('lomo saltado')) {
    return [
      "Heat oil in a large wok or skillet over high heat.",
      "Season the beef with salt and pepper, then sear in the hot pan until browned (about 2 minutes).",
      "Add the garlic and chili pepper, stir-fry for 30 seconds.",
      "Add the onion and stir-fry for another minute.",
      "Add tomatoes and stir-fry for 1 minute.",
      "Pour in soy sauce and red wine vinegar, stir to combine.",
      "Add the french fries and toss gently to coat in the sauce.",
      "Remove from heat and sprinkle with chopped cilantro.",
      "Serve immediately with white rice on the side."
    ];
  }
  // For any Mexican cuisine
  else if (query.includes('taco') || query.includes('burrito') || query.includes('quesadilla')) {
    return [
      "Heat a skillet over medium heat and add oil.",
      "Add the diced onion and cook until translucent, about 3-4 minutes.",
      "Add the garlic and cook for another 30 seconds.",
      "Add the ground meat and break it up with a spoon as it cooks.",
      "Once the meat is browned, add the chili powder, cumin, paprika, oregano, salt, and pepper. Stir well to combine.",
      "Cook for another 5 minutes until the meat is fully cooked and the flavors have melded.",
      "Warm the tortillas in a dry pan or microwave.",
      "Assemble your dish with the meat mixture, cheese, tomato, lettuce, sour cream, and salsa."
    ];
  }
  // For any Italian cuisine
  else if (query.includes('pasta') || query.includes('spaghetti') || query.includes('fettuccine')) {
    return [
      "Bring a large pot of salted water to a boil and cook the pasta according to package instructions.",
      "While the pasta is cooking, heat olive oil in a large pan over medium heat.",
      "Add garlic and onion, sauté until the onion is translucent, about 3-4 minutes.",
      "Add crushed tomatoes, dried herbs, and red pepper flakes. Stir to combine.",
      "Simmer the sauce for 10-15 minutes, stirring occasionally.",
      "Drain the pasta, reserving 1/4 cup of pasta water.",
      "Add the pasta to the sauce, along with a splash of pasta water to help the sauce coat the pasta.",
      "Serve topped with grated Parmesan and fresh basil."
    ];
  }
  // For any Asian cuisine
  else if (query.includes('stir fry') || query.includes('fried rice') || query.includes('noodle')) {
    return [
      "Prepare all ingredients before starting to cook, as stir-frying goes quickly.",
      "Heat vegetable oil in a wok or large skillet over high heat until it's shimmering.",
      "Add the protein and cook until nearly done, about 2-3 minutes. Remove and set aside.",
      "Add more oil if needed, then add onion, carrots, and bell pepper. Stir-fry for 2 minutes.",
      "Add garlic and ginger, stir-fry for 30 seconds until fragrant.",
      "Return the protein to the wok, add the cooked rice or noodles.",
      "Pour in soy sauce, oyster sauce, and sesame oil. Toss everything together until well combined and heated through.",
      "Garnish with sliced green onions and cilantro before serving."
    ];
  }
  // For any soup
  else if (query.includes('soup') || query.includes('stew') || query.includes('chowder')) {
    return [
      "Heat oil or butter in a large pot over medium heat.",
      "Add onion, carrots, and celery. Cook until the vegetables begin to soften, about 5 minutes.",
      "Add garlic and cook for another 30 seconds until fragrant.",
      "Add the protein and cook until browned (if using raw meat).",
      "Pour in the broth, add the bay leaf and thyme.",
      "Bring to a boil, then reduce heat to low and simmer for 30-45 minutes until the meat is tender and flavors have melded.",
      "Season with salt and pepper to taste.",
      "Serve hot, garnished with fresh herbs."
    ];
  }
  // For any baked goods
  else if (query.includes('cake') || query.includes('cookie') || query.includes('pie') || query.includes('bread')) {
    return [
      "Preheat the oven to 350°F (175°C). Grease and flour your baking pan.",
      "In a large bowl, cream together the butter and sugar until light and fluffy.",
      "Add eggs one at a time, beating well after each addition. Stir in the vanilla.",
      "In a separate bowl, combine flour, baking powder, baking soda, and salt.",
      "Gradually add the dry ingredients to the butter mixture, alternating with milk, mixing just until incorporated.",
      "Pour the batter into the prepared pan, spreading it evenly.",
      "Bake for 30-35 minutes, or until a toothpick inserted into the center comes out clean.",
      "Allow to cool before serving or decorating."
    ];
  }
  // For any breakfast
  else if (query.includes('pancake') || query.includes('waffle') || query.includes('breakfast')) {
    return [
      "In a large bowl, sift together the flour, baking powder, salt, and sugar.",
      "Make a well in the center and pour in the milk, egg, melted butter, and vanilla. Mix until smooth.",
      "Heat a lightly oiled griddle or frying pan over medium-high heat.",
      "Pour or scoop the batter onto the griddle, using approximately 1/4 cup for each pancake.",
      "Cook until bubbles form on the surface and the edges look dry, about 2-3 minutes.",
      "Flip and cook until browned on the other side, about 1-2 minutes more.",
      "Serve hot with maple syrup."
    ];
  }
  // For any salad
  else if (query.includes('salad')) {
    return [
      "Wash and prepare all vegetables, then place the mixed greens in a large bowl.",
      "Add the cucumber, carrot, bell pepper, red onion, and cherry tomatoes on top of the greens.",
      "Sprinkle the nuts or seeds and crumbled cheese over the vegetables.",
      "In a small bowl, whisk together olive oil, vinegar, Dijon mustard, salt, and pepper to make the dressing.",
      "Just before serving, drizzle the dressing over the salad and toss gently to coat.",
      "Serve immediately while the greens are still crisp."
    ];
  }
  
  // Default instructions for any recipe
  return [
    "Gather and prepare all ingredients as listed in the recipe.",
    "Follow the cooking steps demonstrated in the video.",
    "Cook until all ingredients are properly done and flavors have combined well.",
    "Adjust seasoning to taste with salt, pepper, or other spices as needed.",
    "Let the dish rest for a few minutes before serving if applicable.",
    "Serve hot and enjoy your delicious meal!"
  ];
}