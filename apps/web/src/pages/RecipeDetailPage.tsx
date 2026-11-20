import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteRecipe, useMe, useRecipe } from '../lib/api';
import { formatMinutes } from '../lib/format';

export function RecipeDetailPage() {
  const id = Number(useParams().id);
  const { data: recipe, isPending, error } = useRecipe(id);
  const { data: me } = useMe();
  const del = useDeleteRecipe();
  const navigate = useNavigate();

  if (isPending) return <p className="muted">Loading…</p>;
  if (error || !recipe) return <p className="error">{error?.message ?? 'Recipe not found'}</p>;

  const onDelete = () => {
    if (!window.confirm(`Delete "${recipe.title}"?`)) return;
    del.mutate(recipe.id, { onSuccess: () => navigate('/') });
  };

  const meta = [
    recipe.servings && `${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`,
    formatMinutes(recipe.prepMinutes) && `Prep ${formatMinutes(recipe.prepMinutes)}`,
    formatMinutes(recipe.cookMinutes) && `Cook ${formatMinutes(recipe.cookMinutes)}`,
  ].filter(Boolean);

  return (
    <article className="recipe">
      <Link to="/" className="back">
        ← All recipes
      </Link>
      <h1>{recipe.title}</h1>
      {recipe.description && <p className="lead">{recipe.description}</p>}
      <div className="card-meta">
        {meta.map((m) => (
          <span key={String(m)}>{m}</span>
        ))}
        {recipe.tags.map((t) => (
          <Link key={t} to={`/?tag=${encodeURIComponent(t)}`} className="tag">
            {t}
          </Link>
        ))}
      </div>

      <div className="recipe-body">
        <section>
          <h2>Ingredients</h2>
          <ul className="ingredients">
            {recipe.ingredients.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Steps</h2>
          <ol className="steps">
            {recipe.steps.map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        </section>
      </div>

      <footer className="recipe-footer muted">
        {recipe.createdBy && <span>Added by {recipe.createdBy}. </span>}
        {recipe.sourceUrl && (
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            Original source ↗
          </a>
        )}
      </footer>

      {me?.authenticated && (
        <div className="actions">
          <Link to={`/recipes/${recipe.id}/edit`} className="button">
            Edit
          </Link>
          <button type="button" className="button button-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
