import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useMe, useRecipes } from '../lib/api';
import { paths } from '../lib/paths';
import { RecipeCard } from '../components/RecipeCard';

export function RecipeListPage() {
  // Keep search state in the URL so it survives reloads and can be shared.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';
  const [search, setSearch] = useState(q);
  const { data: me } = useMe();

  // Debounce: only update the URL (and refetch) 250 ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search === q) return;
      const next = new URLSearchParams(params);
      if (search) next.set('q', search);
      else next.delete('q');
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [search, q, params, setParams]);

  const {
    data: recipes,
    isPending,
    error,
  } = useRecipes({ q: q || undefined, tag: tag || undefined });

  const clearTag = () => {
    const next = new URLSearchParams(params);
    next.delete('tag');
    setParams(next);
  };

  return (
    <>
      <h1>Recept</h1>
      <div className="toolbar">
        <input
          type="search"
          className="input"
          placeholder="Sök recept…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Sök recept"
        />
        {tag && (
          <button type="button" className="tag tag-active" onClick={clearTag}>
            {tag} ×
          </button>
        )}
        {me?.authenticated && (
          <Link to={paths.newRecipe} className="button button-primary toolbar-action">
            + Nytt recept
          </Link>
        )}
      </div>

      {isPending && <p className="muted">Laddar…</p>}
      {error && <p className="error">Kunde inte hämta recepten: {error.message}</p>}
      {recipes && recipes.length === 0 && (
        <p className="muted">{q || tag ? 'Inga recept matchar sökningen.' : 'Inga recept än.'}</p>
      )}
      <div className="grid">
        {recipes?.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </>
  );
}
