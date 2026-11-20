import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import { RecipeListPage } from './pages/RecipeListPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipeFormPage } from './pages/RecipeFormPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { RequireAuth } from './components/RequireAuth';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <RecipeListPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/recipes/:id', element: <RecipeDetailPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/recipes/new', element: <RecipeFormPage /> },
          { path: '/recipes/:id/edit', element: <RecipeFormPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
