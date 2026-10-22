import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Block, Segment } from '../lib/types';

export interface DocumentPreviewHandle {
  /** Reads the edited sheet back into blocks. Edited text is no longer marked as adjusted. */
  getBlocks(): Block[];
}

interface Props {
  blocks: Block[];
  editing: boolean;
  label: string;
  id?: string;
  labelledBy?: string;
}

function Segments({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.changed ? (
          <span key={i} className="t">
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </>
  );
}

const plain = (text: string): Segment[] => [{ text, changed: false }];
const NBSP = new RegExp(String.fromCharCode(160), 'g');
const textOf = (el: Element) => ((el as HTMLElement).innerText ?? el.textContent ?? '').replace(NBSP, ' ');

function readBlocks(root: HTMLElement): Block[] {
  const out: Block[] = [];
  for (const el of Array.from(root.children)) {
    const kind = (el as HTMLElement).dataset.b;
    if (kind === 'bullets') {
      const items = Array.from(el.querySelectorAll('li'))
        .map((li) => textOf(li).trim())
        .filter(Boolean)
        .map(plain);
      if (items.length) out.push({ type: 'bullets', items });
      continue;
    }
    if (kind === 'entry') {
      const title = el.querySelector('[data-part="title"]');
      const aside = el.querySelector('[data-part="aside"]');
      const t = title ? textOf(title).trim() : textOf(el).trim();
      if (t) out.push({ type: 'entry', segments: plain(t), aside: aside ? textOf(aside).trim() || undefined : undefined });
      continue;
    }
    const text = textOf(el).replace(/\n{3,}/g, '\n\n').trim();
    if (!text) continue;
    const type = kind === 'heading' || kind === 'meta' || kind === 'section' ? kind : 'paragraph';
    out.push({ type, segments: plain(text) });
  }
  return out;
}

/**
 * A white sheet showing a generated document. Phrases adjusted for the role are underlined.
 * In edit mode the sheet becomes contentEditable. Remount it (change its key) after saving.
 */
export const DocumentPreview = forwardRef<DocumentPreviewHandle, Props>(function DocumentPreview(
  { blocks, editing, label, id, labelledBy },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({ getBlocks: () => (root.current ? readBlocks(root.current) : blocks) }), [blocks]);

  return (
    <div
      ref={root}
      id={id}
      role="tabpanel"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={editing ? 'doc ed' : 'doc'}
      contentEditable={editing}
      suppressContentEditableWarning
      tabIndex={editing ? undefined : 0}
      spellCheck={editing}
    >
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <h3 key={i} data-b="heading">
                <Segments segments={b.segments} />
              </h3>
            );
          case 'meta':
            return (
              <p key={i} data-b="meta" className="meta">
                <Segments segments={b.segments} />
              </p>
            );
          case 'section':
            return (
              <h4 key={i} data-b="section">
                <Segments segments={b.segments} />
              </h4>
            );
          case 'entry':
            return (
              <p key={i} data-b="entry">
                <span className="med" data-part="title">
                  <Segments segments={b.segments} />
                </span>
                {b.aside && (
                  <>
                    {' '}
                    <span className="mut" data-part="aside">
                      {b.aside}
                    </span>
                  </>
                )}
              </p>
            );
          case 'bullets':
            return (
              <ul key={i} data-b="bullets">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Segments segments={item} />
                  </li>
                ))}
              </ul>
            );
          default:
            return (
              <p key={i} data-b="paragraph">
                <Segments segments={b.segments} />
              </p>
            );
        }
      })}
    </div>
  );
});
