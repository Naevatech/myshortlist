import { CloseIcon } from './icons';

/** 44px tag. Editable tags have a 44x44 remove button labelled "Remove {name}". */
export function Tag({ name, onRemove }: { name: string; onRemove?: () => void }) {
  if (!onRemove) return <span className="tag ro">{name}</span>;
  return (
    <span className="tag">
      {name}
      <button type="button" aria-label={`Remove ${name}`} onClick={onRemove}>
        <CloseIcon />
      </button>
    </span>
  );
}
