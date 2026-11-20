import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteRecipe, useMe, useRecipe } from '../lib/api';
import { formatMinutes, formatServings } from '../lib/format';
import { paths } from '../lib/paths';

export function RecipeDetailPage() {
  const id = Number(useParams().id);
  const { data: recipe, isPending, error } = useRecipe(id);
  const { data: me } = useMe();
  const del = useDeleteRecipe();
  const navigate = useNavigate();

  if (isPending) return <p className="muted">Laddar…</p>;
  if (error || !recipe)
    return <p className="error">{error?.message ?? 'Receptet hittades inte'}</p>;

  const onDelete = () => {
    if (!window.confirm(`Ta bort "${recipe.title}"?`)) return;
    del.mutate(recipe.id, { onSuccess: () => navigate(paths.recipes) });
  };

  const meta = [
    recipe.servings && formatServings(recipe.servings),
    formatMinutes(recipe.prepMinutes) && `Förberedelse ${formatMinutes(recipe.prepMinutes)}`,
    formatMinutes(recipe.cookMinutes) && `Tillagning ${formatMinutes(recipe.cookMinutes)}`,
  ].filter(Boolean);

  return (
    <article className="recipe">
      <Link to={paths.recipes} className="back">
        ← Alla recept
      </Link>
      <h1>{recipe.title}</h1>
      {recipe.description && <p className="lead">{recipe.description}</p>}
      <div className="card-meta">
        {meta.map((m) => (
          <span key={String(m)}>{m}</span>
        ))}
        {recipe.tags.map((t) => (
          <Link key={t} to={`${paths.recipes}?tag=${encodeURIComponent(t)}`} className="tag">
            {t}
          </Link>
        ))}
      </div>

      <div className="recipe-body">
        <section>
          <h2>Ingredienser</h2>
          <ul className="ingredients">
            {recipe.ingredients.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Gör så här</h2>
          <ol className="steps">
            {recipe.steps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="recipe-footer muted">
        {recipe.createdBy && <span>Tillagt av {recipe.createdBy}. </span>}
        {recipe.sourceUrl && (
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            Originalkälla ↗
          </a>
        )}
      </footer>

      {me?.authenticated && (
        <div className="actions">
          <Link to={paths.editRecipe(recipe.id)} className="button">
            Redigera
          </Link>
          <button type="button" className="button button-danger" onClick={onDelete}>
            Ta bort
          </button>
        </div>
      )}
    </article>
  );
}
