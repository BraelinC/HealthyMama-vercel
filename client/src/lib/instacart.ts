export interface RecipeIngredient {
  name: string;
  display_text: string;
  measurements: {
    quantity: number;
    unit: string;
  }[];
}

export interface InstacartRecipe {
  title: string;
  image_url: string;
  link_type: string;
  instructions: string[];
  ingredients: RecipeIngredient[];
  landing_page_configuration?: {
    partner_linkback_url?: string;
    enable_pantry_items?: boolean;
  };
}

export interface InstacartResponse {
  products_link_url: string;
  [key: string]: any;
}

export const formatRecipeForInstacart = (recipe: any): InstacartRecipe => {
  return {
    title: recipe.title,
    image_url: recipe.image_url,
    link_type: "recipe",
    instructions: recipe.instructions,
    ingredients: recipe.ingredients,
    landing_page_configuration: {
      partner_linkback_url: window.location.origin,
      enable_pantry_items: true
    }
  };
};
