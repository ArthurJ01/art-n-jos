import { createBrowserRouter, Navigate } from 'react-router';
import { Layout } from './components/Layout';
import { LegacyRecipeRedirect } from './components/LegacyRedirects';
import { HomePage } from './pages/HomePage';
import { RecipeListPage } from './pages/RecipeListPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RequireAuth } from './components/RequireAuth';
import { paths } from './lib/paths';

/**
 * The recipe builder, loaded on demand like the planner: it uses the same
 * drag-and-drop library, and only someone who is logged in ever opens it.
 */
const recipeFormPage = async () => {
  const { RecipeFormPage } = await import('./pages/RecipeFormPage');
  return { Component: RecipeFormPage };
};

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: paths.home, element: <HomePage /> },
      { path: paths.login, element: <LoginPage /> },
      { path: paths.recipes, element: <RecipeListPage /> },
      { path: paths.recipe(':id'), element: <RecipeDetailPage /> },
      {
        path: paths.mealPlanner,
        // Loaded on demand: the drag-and-drop code is only downloaded when
        // someone opens the planner, so the recipe pages stay light.
        lazy: async () => {
          const { MealPlannerPage } = await import('./pages/MealPlannerPage');
          return { Component: MealPlannerPage };
        },
        // The week calendar needs more room than the text pages (see Layout).
        handle: { wide: true },
      },
      {
        element: <RequireAuth />,
        children: [
          { path: paths.newRecipe, lazy: recipeFormPage },
          { path: paths.editRecipe(':id'), lazy: recipeFormPage },
        ],
      },

      // Old English URLs: redirect so existing bookmarks keep working.
      { path: '/login', element: <Navigate to={paths.login} replace /> },
      { path: '/recipes', element: <Navigate to={paths.recipes} replace /> },
      { path: '/recipes/new', element: <Navigate to={paths.newRecipe} replace /> },
      { path: '/recipes/:id', element: <LegacyRecipeRedirect /> },
      { path: '/recipes/:id/edit', element: <LegacyRecipeRedirect edit /> },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
