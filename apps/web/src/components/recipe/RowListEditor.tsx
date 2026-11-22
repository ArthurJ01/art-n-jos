import {
  useEffect,
  useLayoutEffect,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { newRow, rowsFromPaste, type Row } from '../../lib/rows';

// Read out to screen reader users who pick a row up with the keyboard.
const screenReaderInstructions = {
  draggable:
    'Tryck på mellanslag för att lyfta raden. Flytta med piltangenterna, släpp med mellanslag och avbryt med Escape.',
};

interface Props {
  /** "Ingredienser" */
  legend: string;
  /** Shown next to the legend: how to use the list. */
  hint: string;
  rows: Row[];
  onChange: (rows: Row[]) => void;
  /** Steps get a number in front, like on the finished page. */
  numbered?: boolean;
  /** What one row is called, for the buttons: "Ingrediens" / "Steg". */
  itemName: string;
  /** Example text in an empty row: "2 dl grädde". */
  placeholder: string;
}

/**
 * A list of text rows, used for both the ingredients and the steps of the
 * recipe builder: one field per row, buttons to move and remove a row, and
 * heading rows ("Sås") that split the list into groups. A row can also be
 * dragged to another place by its handle (the six dots).
 *
 * Made for typing without the mouse: Enter starts the next row, Backspace in
 * an empty row removes it, and pasting several lines gives one row per line.
 */
export function RowListEditor({
  legend,
  hint,
  rows,
  onChange,
  numbered = false,
  itemName,
  placeholder,
}: Props) {
  const fields = useRef(new Map<number, HTMLTextAreaElement>());
  // The row to put the cursor in once React has drawn it (a row just added,
  // or the one before a row just removed).
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current === null) return;
    fields.current.get(focusNext.current)?.focus();
    focusNext.current = null;
  });

  const update = (id: number, text: string) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, text } : row)));

  /** Puts `added` in after row `index` and moves the cursor to the last of them. */
  const insertAfter = (index: number, added: Row[], base = rows) => {
    focusNext.current = added[added.length - 1]!.id;
    onChange([...base.slice(0, index + 1), ...added, ...base.slice(index + 1)]);
  };

  const remove = (index: number) => {
    const rest = rows.filter((_, i) => i !== index);
    // Never an empty list: there should always be a row to type in.
    const next = rest.length > 0 ? rest : [newRow()];
    focusNext.current = (next[index - 1] ?? next[0]!).id;
    onChange(next);
  };

  const move = (index: number, step: -1 | 1) => {
    const target = index + step;
    if (target < 0 || target >= rows.length) return;
    focusNext.current = rows[index]!.id;
    onChange(arrayMove(rows, index, target));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    if (e.key === 'Enter') {
      // Enter means "next row" here. Without this it would add a line break,
      // or in a plain text box send the whole form.
      e.preventDefault();
      insertAfter(index, [newRow()]);
    } else if (e.key === 'Backspace' && rows[index]!.text === '' && rows.length > 1) {
      e.preventDefault();
      remove(index);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>, index: number) => {
    const pasted = rowsFromPaste(e.clipboardData.getData('text'));
    // One line is an ordinary paste into the row. Several lines become rows.
    if (pasted.length < 2) return;
    e.preventDefault();
    const row = rows[index]!;
    // An empty row is replaced by the first pasted line instead of left behind.
    if (row.text.trim() === '') {
      const [first, ...others] = pasted;
      const base = rows.map((r, i) => (i === index ? { ...first!, id: r.id } : r));
      insertAfter(index, others, base);
    } else {
      insertAfter(index, pasted);
    }
  };

  // ---- Drag and drop (dnd-kit's "sortable" add-on) ----
  const sensors = useSensors(
    // Pointer events cover mouse, touch and pen. Only the handle starts a
    // drag, so the text boxes can still be clicked, selected in and scrolled.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Space on the handle picks the row up, and the arrow keys move it.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** 1 for the first row, 2 for the second... */
  const placeOf = (id: UniqueIdentifier) => rows.findIndex((row) => row.id === id) + 1;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    // Dropped where it was, or outside the list: nothing to do.
    if (!over || active.id === over.id) return;
    onChange(arrayMove(rows, placeOf(active.id) - 1, placeOf(over.id) - 1));
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Lyfte rad ${placeOf(active.id)} av ${rows.length}.`,
    onDragOver: ({ over }) => (over ? `Plats ${placeOf(over.id)} av ${rows.length}.` : undefined),
    onDragEnd: ({ over }) =>
      over
        ? `Släppte raden på plats ${placeOf(over.id)}.`
        : 'Släppte utanför listan. Inget ändrades.',
    onDragCancel: () => 'Avbröt. Inget ändrades.',
  };

  // The number in front of each step: headings don't count.
  const numberOf = (index: number) =>
    rows.slice(0, index + 1).filter((row) => row.kind === 'item').length;

  return (
    <fieldset className="row-editor">
      <legend>
        {legend} <span className="hint">{hint}</span>
      </legend>
      <DndContext
        sensors={sensors}
        // A dragged row lands at the place whose middle it is closest to.
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        {/* Tells dnd-kit which rows there are, in what order, and that they are
            stacked: the other rows then slide out of the way during a drag. */}
        <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
          <ol className="editor-rows">
            {rows.map((row, index) => {
              const isHeading = row.kind === 'heading';
              // What the buttons act on, for screen readers: "Ta bort ingrediens 2 dl grädde".
              const name = isHeading ? 'rubrik' : itemName.toLowerCase();
              const label = `${name} ${row.text || index + 1}`;
              return (
                <SortableRow
                  key={row.id}
                  id={row.id}
                  className={isHeading ? 'editor-row editor-row-heading' : 'editor-row'}
                  handleLabel={`Dra ${label}`}
                >
                  {(handle) => (
                    <>
                      {numbered && (
                        <span className="editor-row-number">
                          {isHeading ? '' : `${numberOf(index)}.`}
                        </span>
                      )}
                      <GrowingTextarea
                        ref={(node) => {
                          if (node) fields.current.set(row.id, node);
                          else fields.current.delete(row.id);
                        }}
                        className="input editor-row-input"
                        aria-label={isHeading ? `Rubrik ${index + 1}` : `${itemName} ${index + 1}`}
                        placeholder={isHeading ? 'Rubrik, t.ex. Sås' : placeholder}
                        value={row.text}
                        onChange={(e) => update(row.id, e.target.value)}
                        onKeyDown={(e) => onKeyDown(e, index)}
                        onPaste={(e) => onPaste(e, index)}
                      />
                      <span className="editor-row-buttons">
                        {handle}
                        <button
                          type="button"
                          className="icon-button"
                          title="Flytta upp"
                          aria-label={`Flytta upp ${label}`}
                          disabled={index === 0}
                          onClick={() => move(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Flytta ner"
                          aria-label={`Flytta ner ${label}`}
                          disabled={index === rows.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="icon-button"
                          title="Ta bort"
                          aria-label={`Ta bort ${label}`}
                          onClick={() => remove(index)}
                        >
                          ×
                        </button>
                      </span>
                    </>
                  )}
                </SortableRow>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="editor-add">
        <button
          type="button"
          className="button"
          onClick={() => insertAfter(rows.length - 1, [newRow()])}
        >
          + {itemName}
        </button>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => insertAfter(rows.length - 1, [newRow('', 'heading')])}
        >
          + Rubrik
        </button>
      </div>
    </fieldset>
  );
}

interface SortableRowProps {
  id: number;
  className: string;
  /** For screen readers: "Dra ingrediens 2 dl grädde". */
  handleLabel: string;
  /**
   * The contents of the row, as a function: it is handed the drag handle, to
   * put it where it belongs (next to the arrow buttons).
   */
  children: (handle: ReactNode) => ReactNode;
}

/**
 * One row that can be dragged to another place in its list.
 *
 * `useSortable` does the work. It says how far the row should be shifted
 * right now (`transform`, while it or a row near it is being dragged), and
 * gives the handle what it needs to start a drag (`listeners`, `attributes`).
 * It is a hook, and a hook can't be called inside a loop, which is why a row
 * is a component of its own.
 */
function SortableRow({ id, className, handleLabel, children }: SortableRowProps) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, attributes: { roleDescription: 'dragbar' } });

  const handle = (
    <button
      // The handle, not the whole row, is what starts a drag.
      ref={setActivatorNodeRef}
      type="button"
      className="icon-button drag-handle"
      title="Dra för att flytta"
      {...attributes}
      {...listeners}
      aria-label={handleLabel}
    >
      {/* Six dots: the usual sign for "this can be dragged". */}
      <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden="true">
        {[3, 8, 13].flatMap((y) =>
          [2.5, 7.5].map((x) => <circle key={`${x}:${y}`} cx={x} cy={y} r="1.3" />),
        )}
      </svg>
    </button>
  );

  return (
    <li
      ref={setNodeRef}
      className={isDragging ? `${className} editor-row-dragging` : className}
      style={{
        // Only up and down: a row has nowhere to go sideways.
        transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined,
        transition,
      }}
    >
      {children(handle)}
    </li>
  );
}

/**
 * A text box that is one line tall and grows with its text, so a long step
 * can be read in full while it is typed. (A plain <input> can't wrap.)
 */
function GrowingTextarea({
  ref,
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref: (node: HTMLTextAreaElement | null) => void;
}) {
  const own = useRef<HTMLTextAreaElement | null>(null);

  // After every change: shrink to nothing, then grow to exactly fit the text.
  // useLayoutEffect runs before the browser paints, so there is no flicker.
  useLayoutEffect(() => {
    const node = own.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight + 2}px`; // + the borders
  }, [value]);

  return (
    <textarea
      ref={(node) => {
        own.current = node;
        ref(node);
      }}
      rows={1}
      value={value}
      {...props}
    />
  );
}
