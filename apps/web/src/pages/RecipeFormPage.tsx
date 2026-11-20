import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { Recipe, RecipeInput } from '@art-web/shared';
import { ApiRequestError, useRecipe, useSaveRecipe } from '../lib/api';
import { toLines, toTags } from '../lib/format';
import { paths } from '../lib/paths';

/** Used for both "new recipe" and "edit recipe". */
export function RecipeFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const { data: existing, isPending } = useRecipe(id ?? NaN);

  if (id && isPending) return <p className="muted">Laddar…</p>;
  // `key` resets the form state when switching between recipes.
  return <RecipeForm key={id ?? 'new'} id={id} initial={existing} />;
}

function RecipeForm({ id, initial }: { id?: number; initial?: Recipe }) {
  const navigate = useNavigate();
  const save = useSaveRecipe(id);
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    servings: initial?.servings?.toString() ?? '',
    prepMinutes: initial?.prepMinutes?.toString() ?? '',
    cookMinutes: initial?.cookMinutes?.toString() ?? '',
    ingredients: initial?.ingredients.join('\n') ?? '',
    steps: initial?.steps.join('\n') ?? '',
    tags: initial?.tags.join(', ') ?? '',
    sourceUrl: initial?.sourceUrl ?? '',
    createdBy: initial?.createdBy ?? '',
  });

  const set = (field: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const toNumber = (s: string) => (s.trim() === '' ? null : Number(s));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input: RecipeInput = {
      title: form.title,
      description: form.description || null,
      servings: toNumber(form.servings),
      prepMinutes: toNumber(form.prepMinutes),
      cookMinutes: toNumber(form.cookMinutes),
      ingredients: toLines(form.ingredients),
      steps: toLines(form.steps),
      tags: toTags(form.tags),
      sourceUrl: form.sourceUrl || null,
      createdBy: form.createdBy || null,
    };
    save.mutate(input, { onSuccess: (r) => navigate(paths.recipe(r.id)) });
  };

  const error = save.error;
  const fieldErrors =
    error instanceof ApiRequestError && Array.isArray(error.details)
      ? (error.details as { path: (string | number)[]; message: string }[])
          .map((d) => `${d.path.join('.')}: ${d.message}`)
          .join(', ')
      : null;

  return (
    <form className="form" onSubmit={onSubmit}>
      <h1>{id ? 'Redigera recept' : 'Nytt recept'}</h1>

      <label>
        Titel
        <input className="input" required value={form.title} onChange={set('title')} />
      </label>
      <label>
        Beskrivning
        <textarea
          className="input"
          rows={2}
          value={form.description}
          onChange={set('description')}
        />
      </label>

      <div className="row">
        <label>
          Portioner
          <input
            className="input"
            type="number"
            min={1}
            value={form.servings}
            onChange={set('servings')}
          />
        </label>
        <label>
          Förberedelse (min)
          <input
            className="input"
            type="number"
            min={0}
            value={form.prepMinutes}
            onChange={set('prepMinutes')}
          />
        </label>
        <label>
          Tillagning (min)
          <input
            className="input"
            type="number"
            min={0}
            value={form.cookMinutes}
            onChange={set('cookMinutes')}
          />
        </label>
      </div>

      <label>
        Ingredienser <span className="hint">en per rad</span>
        <textarea
          className="input"
          rows={8}
          value={form.ingredients}
          onChange={set('ingredients')}
        />
      </label>
      <label>
        Gör så här <span className="hint">ett steg per rad</span>
        <textarea className="input" rows={8} value={form.steps} onChange={set('steps')} />
      </label>
      <label>
        Taggar <span className="hint">separera med komma</span>
        <input
          className="input"
          value={form.tags}
          onChange={set('tags')}
          placeholder="pasta, snabbt"
        />
      </label>

      <div className="row">
        <label>
          Länk till källa
          <input className="input" type="url" value={form.sourceUrl} onChange={set('sourceUrl')} />
        </label>
        <label>
          Tillagt av
          <input className="input" value={form.createdBy} onChange={set('createdBy')} />
        </label>
      </div>

      {error && <p className="error">{fieldErrors ?? error.message}</p>}

      <div className="actions">
        <button type="submit" className="button button-primary" disabled={save.isPending}>
          {save.isPending ? 'Sparar…' : 'Spara'}
        </button>
        <button type="button" className="button button-ghost" onClick={() => navigate(-1)}>
          Avbryt
        </button>
      </div>
    </form>
  );
}
