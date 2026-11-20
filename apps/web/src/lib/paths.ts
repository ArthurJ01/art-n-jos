/**
 * Every URL in the web app, in one place.
 * Components link with `paths.recipe(id)` instead of hand-written strings,
 * so a URL only has to be changed here (and in router.tsx).
 */
export const paths = {
  home: '/',
  login: '/logga-in',
  mealPlanner: '/matplanering',
  recipes: '/recept',
  newRecipe: '/recept/ny',
  recipe: (id: number | string) => `/recept/${id}`,
  editRecipe: (id: number | string) => `/recept/${id}/redigera`,
} as const;
