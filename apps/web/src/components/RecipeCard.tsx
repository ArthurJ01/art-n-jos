import { Link } from 'react-router';
import type { Recipe } from '@art-web/shared';
import { formatMinutes } from '../lib/format';

export function RecipeCard({ recipe }: { recipe: Recipe }) {
  const total = formatMinutes((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0));
  return (
    <Link to={`/recipes/${recipe.id}`} className="card">
      <h2 className="card-title">{recipe.title}</h2>
      {recipe.description && <p className="card-desc">{recipe.description}</p>}
      <div className="card-meta">
        {total && <span>{total}</span>}
        {recipe.servings && (
          <span>
            {recipe.servings} {recipe.servings === 1 ? 'serving' : 'servings'}
          </span>
        )}
        {recipe.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>
    </Link>
  );
}
