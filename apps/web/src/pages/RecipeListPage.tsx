import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useRecipes } from '../lib/api';
import { RecipeCard } from '../components/RecipeCard';

export function RecipeListPage() {
  // Keep search state in the URL so it survives reloads and can be shared.
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';
  const [search, setSearch] = useState(q);

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
      <div className="toolbar">
        <input
          type="search"
          className="input"
          placeholder="Search recipes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recipes"
        />
        {tag && (
          <button type="button" className="tag tag-active" onClick={clearTag}>
            {tag} ×
          </button>
        )}
      </div>

      {isPending && <p className="muted">Loading…</p>}
      {error && <p className="error">Could not load recipes: {error.message}</p>}
      {recipes && recipes.length === 0 && (
        <p className="muted">No recipes yet{q || tag ? ' matching that' : ''}.</p>
      )}
      <div className="grid">
        {recipes?.map((r) => (
          <RecipeCard key={r.id} recipe={r} />
        ))}
      </div>
    </>
  );
}
