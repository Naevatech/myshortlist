/** The match score as a light pill ("94%"). Always shown with its reason on the same screen. */
export function ScorePill({ score }: { score: number }) {
  return (
    <span className="pill">
      {score}%<span className="sr-only"> match score</span>
    </span>
  );
}
