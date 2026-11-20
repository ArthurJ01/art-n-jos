import { Navigate, useParams } from 'react-router';
import { paths } from '../lib/paths';

/**
 * The URLs used to be English (/recipes/7). These keep old bookmarks and
 * shared links working by sending them to the Swedish URL.
 */
export function LegacyRecipeRedirect({ edit = false }: { edit?: boolean }) {
  const { id = '' } = useParams();
  return <Navigate to={edit ? paths.editRecipe(id) : paths.recipe(id)} replace />;
}
