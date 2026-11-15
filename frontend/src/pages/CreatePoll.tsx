import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Contract } from "ethers";
import { useWallet } from "../wallet";
import { getVotingContract } from "../lib/contract";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

export function cleanOptions(options: string[]): string[] {
  return options.map((o) => o.trim()).filter((o) => o.length > 0);
}

/** Sends createPoll and returns the new poll id read from the PollCreated event. */
export async function createPollTx(voting: Contract, question: string, options: string[]): Promise<bigint> {
  const tx = await voting.createPoll(question, options);
  const receipt = await tx.wait();
  const log = receipt.logs.find((l: any) => l.fragment?.name === "PollCreated");
  if (!log) throw new Error("PollCreated event not found in receipt");
  return BigInt(log.args[0]);
}

export default function CreatePoll() {
  const { signer, chainOk } = useWallet();
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const cleaned = cleanOptions(options);
  const valid =
    question.trim().length > 0 && cleaned.length >= MIN_OPTIONS && cleaned.length <= MAX_OPTIONS;
  const canSubmit = valid && !!signer && chainOk && !busy;

  async function submit() {
    if (!signer) return;
    setBusy(true);
    setError(undefined);
    try {
      const id = await createPollTx(getVotingContract(signer), question.trim(), cleaned);
      navigate(`/poll/${id}`);
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? String(e));
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Create a poll</h2>
      <label htmlFor="question">Question</label>
      <input id="question" value={question} onChange={(e) => setQuestion(e.target.value)} />
      {options.map((o, i) => (
        <div key={i}>
          <label htmlFor={`opt-${i}`}>{`Option ${i + 1}`}</label>
          <div className="row">
            <input
              id={`opt-${i}`}
              value={o}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {options.length > MIN_OPTIONS && (
              <button
                type="button"
                className="secondary"
                aria-label={`Remove option ${i + 1}`}
                onClick={() => setOptions(options.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="row" style={{ marginTop: "1rem" }}>
        <button
          type="button"
          className="secondary"
          disabled={options.length >= MAX_OPTIONS}
          onClick={() => setOptions([...options, ""])}
        >
          + Add option
        </button>
        <button type="button" disabled={!canSubmit} onClick={submit}>
          {busy ? "Creating…" : "Create poll"}
        </button>
      </div>
      {!signer && <p className="muted">Connect a wallet to create a poll.</p>}
      {error && <p className="warn">{error}</p>}
    </div>
  );
}
