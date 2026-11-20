import { Link } from 'react-router';
import type { Recipe } from '@art-web/shared';
import { formatMinutes, formatServings } from '../lib/format';
import { paths } from '../lib/paths';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const total = formatMinutes((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0));
  return (
    <Link to={paths.recipe(recipe.id)} className="card">
      <h2 className="card-title">{recipe.title}</h2>
      {recipe.description && <p className="card-desc">{recipe.description}</p>}
      <div className="card-meta">
        {total && <span>{total}</span>}
        {recipe.servings && <span>{formatServings(recipe.servings)}</span>}
        {recipe.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}
