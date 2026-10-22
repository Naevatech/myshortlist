/** A hairline with a word in the middle, for example "or" between sign-in options. */
export function Divider({ label = 'or' }: { label?: string }) {
  return (
    <div className="h g16" aria-hidden="true">
      <hr className="hr" style={{ flex: 1 }} />
      <span className="sm mut">{label}</span>
      <hr className="hr" style={{ flex: 1 }} />
    </div>
  );
}
