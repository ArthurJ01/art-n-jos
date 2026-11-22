import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { RecipeImport, RecipeInput } from '@art-web/shared';
import { ApiRequestError, useImportRecipe, useRecipe, useSaveRecipe } from '../lib/api';
import { toTags } from '../lib/format';
import { paths } from '../lib/paths';
import { linesFromRows, rowsFromLines } from '../lib/rows';
import { RowListEditor } from '../components/recipe/RowListEditor';

/** Used for both "new recipe" and "edit recipe". */
export function RecipeFormPage() {
  const params = useParams();
  const id = params.id ? Number(params.id) : undefined;
  const { data: existing, isPending } = useRecipe(id ?? NaN);

  // A recipe fetched from a link ("Hämta recept"), to fill the form with.
  const [imported, setImported] = useState<{ count: number; result: RecipeImport } | null>(null);
  // Has anything been typed? Then fetching from a link asks before replacing it.
  const [dirty, setDirty] = useState(false);

  if (id && isPending) return <p className="muted">Laddar…</p>;

  const onImported = (result: RecipeImport) => {
    setImported((previous) => ({ count: (previous?.count ?? 0) + 1, result }));
    setDirty(false);
  };

  return (
    <div className="builder">
      <h1>{id ? 'Redigera recept' : 'Nytt recept'}</h1>
      {/* Its own <form>, next to the recipe form and not inside it: forms
          can't be nested, and Enter in the link box should fetch, not save. */}
      {!id && (
        <ImportBox
          imported={imported?.result ?? null}
          confirmReplace={() =>
            !dirty || window.confirm('Ersätta det du har fyllt i med receptet från länken?')
          }
          onImported={onImported}
        />
      )}
      {/* `key` throws the form's state away and starts over from `initial`:
          when switching between recipes, and when a recipe has been fetched. */}
      <RecipeForm
        key={`${id ?? 'new'}:${imported?.count ?? 0}`}
        id={id}
        initial={imported?.result.recipe ?? existing}
        onEdit={() => setDirty(true)}
      />
    </div>
  );
}

interface ImportBoxProps {
  /** The latest fetched recipe, to say how it went. */
  imported: RecipeImport | null;
  /** Asks before a filled-in form is replaced. False means "don't". */
  confirmReplace: () => boolean;
  onImported: (result: RecipeImport) => void;
}

/** "Paste a link, get the recipe": fills the form from a recipe on another site. */
function ImportBox({ imported, confirmReplace, onImported }: ImportBoxProps) {
  const [url, setUrl] = useState('');
  const importRecipe = useImportRecipe();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const typed = url.trim();
    if (!typed || !confirmReplace()) return;
    // "arla.se/recept/..." copied without the https:// in front still works.
    const address = /^https?:\/\//i.test(typed) ? typed : `https://${typed}`;
    importRecipe.mutate(address, { onSuccess: onImported });
  };

  return (
    <form className="import-box" onSubmit={onSubmit}>
      <label htmlFor="import-url">
        Hämta från en länk <span className="hint">klistra in adressen till ett recept</span>
      </label>
      <div className="import-row">
        <input
          id="import-url"
          className="input"
          // Not type="url": that would refuse an address without https://.
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://www.arla.se/recept/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit" className="button" disabled={importRecipe.isPending}>
          {importRecipe.isPending ? 'Hämtar…' : 'Hämta recept'}
        </button>
      </div>
      {/* role="status": read out by screen readers when it appears. */}
      <div role="status">
        {importRecipe.error && <p className="error">{importRecipe.error.message}</p>}
        {!importRecipe.error && !importRecipe.isPending && imported && (
          <p className="import-note">
            {imported.found === 'full'
              ? 'Receptet är hämtat. Kontrollera att allt stämmer och spara.'
              : 'Sidan beskriver inte sitt recept på ett sätt som går att läsa av, så bara titel och beskrivning följde med. Fyll i resten själv.'}
          </p>
        )}
      </div>
    </form>
  );
}

interface RecipeFormProps {
  id?: number;
  /** What the form starts with: the recipe being edited, or one fetched from a link. */
  initial?: RecipeInput;
  /** Called when something in the form is changed. */
  onEdit: () => void;
}

function RecipeForm({ id, initial, onEdit }: RecipeFormProps) {
  const navigate = useNavigate();
  const save = useSaveRecipe(id);
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    servings: initial?.servings?.toString() ?? '',
    prepMinutes: initial?.prepMinutes?.toString() ?? '',
    cookMinutes: initial?.cookMinutes?.toString() ?? '',
    tips: initial?.tips ?? '',
    tags: initial?.tags?.join(', ') ?? '',
    sourceUrl: initial?.sourceUrl ?? '',
    createdBy: initial?.createdBy ?? '',
  });
  // One row per ingredient and per step (see lib/rows.ts).
  const [ingredients, setIngredients] = useState(() => rowsFromLines(initial?.ingredients ?? []));
  const [steps, setSteps] = useState(() => rowsFromLines(initial?.steps ?? []));

  const set = (field: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    onEdit();
  };

  const toNumber = (s: string) => (s.trim() === '' ? null : Number(s));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const input: RecipeInput = {
      title: form.title,
      description: form.description || null,
      servings: toNumber(form.servings),
      prepMinutes: toNumber(form.prepMinutes),
      cookMinutes: toNumber(form.cookMinutes),
      ingredients: linesFromRows(ingredients),
      steps: linesFromRows(steps),
      tips: form.tips || null,
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
    <form className="form form-wide" onSubmit={onSubmit}>
      <label>
        Titel
        <input className="input" required value={form.title} onChange={set('title')} />
      </label>
      <label>
        Beskrivning
        <textarea
          className="input"
          rows={3}
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

      {/* The same two columns as the finished recipe page. */}
      <div className="builder-body">
        <RowListEditor
          legend="Ingredienser"
          hint="mängden först: 2 dl grädde"
          itemName="Ingrediens"
          placeholder="2 dl grädde"
          rows={ingredients}
          onChange={(rows) => {
            setIngredients(rows);
            onEdit();
          }}
        />
        <RowListEditor
          legend="Gör så här"
          hint="ett steg per rad"
          itemName="Steg"
          placeholder="Beskriv steget"
          numbered
          rows={steps}
          onChange={(rows) => {
            setSteps(rows);
            onEdit();
          }}
        />
      </div>

      <label>
        {/* In a span of their own, to stay on one line (a label stacks its children). */}
        <span>
          Tips <span className="hint">visas under stegen</span>
        </span>
        <textarea className="input" rows={3} value={form.tips} onChange={set('tips')} />
      </label>
      <label>
        <span>
          Taggar <span className="hint">separera med komma</span>
        </span>
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
