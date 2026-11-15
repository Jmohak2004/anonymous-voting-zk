import { useState } from "react";
import { errorMessage } from "../lib/register";
import type { VoteStage } from "../lib/vote";

interface Props {
  options: string[];
  hasIdentity: boolean;
  canAct: boolean;
  submit: (option: bigint, onStage: (s: VoteStage) => void) => Promise<void>;
  onDone: () => void;
  /** Called with a backup JSON string pasted by the user. */
  onImport: (json: string) => Promise<void>;
}

export default function VotePanel({ options, hasIdentity, canAct, submit, onDone, onImport }: Props) {
  const [choice, setChoice] = useState<number>();
  const [stage, setStage] = useState<VoteStage | "done">();
  const [error, setError] = useState<string>();
  const [backup, setBackup] = useState("");

  if (!hasIdentity) {
    return (
      <div>
        <p className="warn">
          No voting identity found in this browser for this poll. If you registered from another
          browser, paste your identity backup below.
        </p>
        <textarea rows={3} value={backup} onChange={(e) => setBackup(e.target.value)} aria-label="Identity backup" />
        <button
          style={{ marginTop: ".5rem" }}
          disabled={!backup.trim()}
          onClick={async () => {
            try {
              setError(undefined);
              await onImport(backup);
            } catch (e: any) {
              setError(errorMessage(e));
            }
          }}
        >
          Import identity
        </button>
        {error && <p className="warn">{error}</p>}
      </div>
    );
  }

  const busy = stage === "proving" || stage === "sending";

  async function cast() {
    if (choice === undefined) return;
    setError(undefined);
    setStage("proving");
    try {
      await submit(BigInt(choice), setStage);
      setStage("done");
      onDone();
    } catch (e: any) {
      setStage(undefined);
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      {options.map((o, i) => (
        <label key={i} className="row" style={{ color: "inherit" }}>
          <input
            type="radio"
            name="option"
            style={{ width: "auto" }}
            checked={choice === i}
            disabled={busy || stage === "done"}
            onChange={() => setChoice(i)}
          />
          {o}
        </label>
      ))}
      <p className="muted">
        The proof hides which member you are, but the transaction sender is public: voting from the
        address you registered with links your vote to you. For real anonymity, vote from a fresh
        address after importing your identity backup.
      </p>
      <button disabled={!canAct || choice === undefined || busy || stage === "done"} onClick={cast}>
        Cast vote
      </button>
      {stage === "proving" && <p className="muted">Generating proof… (runs in your browser, may take several seconds)</p>}
      {stage === "sending" && <p className="muted">Submitting vote…</p>}
      {stage === "done" && <p className="ok">✓ Vote submitted.</p>}
      {error && <p className="warn">{error}</p>}
    </div>
  );
}
