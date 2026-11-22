import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteRecipe, useMe, useRecipe } from '../lib/api';
import { formatMinutes, formatServings } from '../lib/format';
import { paths } from '../lib/paths';
import { IngredientList } from '../components/recipe/IngredientList';
import { ScreenOnSwitch } from '../components/recipe/ScreenOnSwitch';
import { StepList } from '../components/recipe/StepList';

/** "arla.se" from "https://www.arla.se/recept/butter-chicken/" */
function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Originalkälla';
  }
}

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

  const prep = formatMinutes(recipe.prepMinutes);
  const cook = formatMinutes(recipe.cookMinutes);
  const total = formatMinutes((recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0));

  return (
    <article className="recipe">
      <div className="recipe-top">
        <Link to={paths.recipes} className="back">
          ← Alla recept
        </Link>
        {me?.authenticated && (
          <div className="recipe-actions">
            <Link to={paths.editRecipe(recipe.id)} className="button">
              Redigera
            </Link>
            <button type="button" className="button button-danger" onClick={onDelete}>
              Ta bort
            </button>
          </div>
        )}
      </div>

      <header className="recipe-head">
        <h1>{recipe.title}</h1>
        <div className="recipe-meta">
          {total && (
            <span className="recipe-fact">
              {total}
              {/* The split is only worth showing when there are two parts. */}
              {prep && cook && (
                <span className="recipe-fact-detail">
                  {' '}
                  ({prep} förberedelse, {cook} tillagning)
                </span>
              )}
            </span>
          )}
          {recipe.servings && (
            <span className="recipe-fact">{formatServings(recipe.servings)}</span>
          )}
          {recipe.tags.map((t) => (
            <Link key={t} to={`${paths.recipes}?tag=${encodeURIComponent(t)}`} className="tag">
              {t}
            </Link>
          ))}
        </div>
        {recipe.description && <p className="lead">{recipe.description}</p>}
        {(recipe.createdBy || recipe.sourceUrl) && (
          <p className="recipe-byline muted">
            {recipe.createdBy && <span>Tillagt av {recipe.createdBy}</span>}
            {recipe.sourceUrl && (
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
                Från {siteName(recipe.sourceUrl)} ↗
              </a>
            )}
          </p>
        )}
      </header>

      {/* Like a cookbook page: what you need on the left, what to do on the right. */}
      <div className="recipe-body">
        <IngredientList ingredients={recipe.ingredients} servings={recipe.servings} />
        <div className="recipe-method">
          <ScreenOnSwitch />
          <StepList steps={recipe.steps} />
          {recipe.tips && (
            <section className="recipe-tips" aria-labelledby="tips-heading">
              <h2 id="tips-heading">Tips</h2>
              <p>{recipe.tips}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
