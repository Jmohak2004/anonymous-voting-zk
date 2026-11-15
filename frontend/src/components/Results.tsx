interface Props {
  options: string[];
  tally: bigint[];
}

const plural = (n: bigint, word: string) => `${n} ${word}${n === 1n ? "" : "s"}`;

export default function Results({ options, tally }: Props) {
  const total = tally.reduce((a, b) => a + b, 0n);
  return (
    <div style={{ marginTop: "1rem" }}>
      {options.map((o, i) => {
        const count = tally[i] ?? 0n;
        const pct = total === 0n ? 0 : Math.round(Number((count * 10000n) / total) / 100);
        return (
          <div key={i} style={{ marginBottom: ".75rem" }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: ".25rem" }}>
              <span>{o}</span>
              <span className="muted">{plural(count, "vote")} · {pct}%</span>
            </div>
            <div className="bar"><div style={{ width: `${pct}%` }} /></div>
          </div>
        );
      })}
      <p className="muted">{plural(total, "vote")} total</p>
    </div>
  );
}
