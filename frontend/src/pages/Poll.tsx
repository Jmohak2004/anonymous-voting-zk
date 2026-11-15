import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useWallet } from "../wallet";
import { DEPLOYMENT, fetchPoll, getVotingContract, PollView } from "../lib/contract";
import { exportIdentity, identityScope, importIdentity, loadIdentity, saveIdentity } from "../lib/identityStore";
import { errorMessage, registerFlow } from "../lib/register";
import { submitVote } from "../lib/vote";
import VotePanel from "../components/VotePanel";
import NotFound from "../components/NotFound";
import Results from "../components/Results";

/** Route entry: rejects ids that are not plain non-negative integers before any hook runs. */
export default function PollRoute() {
  const raw = useParams().id ?? "";
  if (!/^\d+$/.test(raw)) return <NotFound what="Poll" />;
  return <Poll pollId={BigInt(raw)} />;
}

function Poll({ pollId }: { pollId: bigint }) {
  const { address, signer, chainOk, readProvider } = useWallet();
  const [poll, setPoll] = useState<PollView>();
  const [commitments, setCommitments] = useState<bigint[]>([]);
  const [tally, setTally] = useState<bigint[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const [identityVersion, setIdentityVersion] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const reader = getVotingContract(readProvider);
      const [p, cs, t] = await Promise.all([
        fetchPoll(reader, pollId),
        reader.getCommitments(pollId),
        reader.getTally(pollId),
      ]);
      setPoll(p);
      setCommitments([...cs].map(BigInt));
      setTally([...t].map(BigInt));
      setLoadError(undefined);
    } catch (e: any) {
      setLoadError(errorMessage(e));
    }
  }, [readProvider, pollId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live updates: refresh whenever someone votes or the poll changes phase.
  useEffect(() => {
    const reader = getVotingContract(readProvider);
    const onEvent = () => refresh();
    for (const name of ["VoteCast", "MemberRegistered", "RegistrationClosed", "PollEnded"]) {
      reader.on?.(name, onEvent);
    }
    return () => {
      reader.removeAllListeners?.();
    };
  }, [readProvider, refresh]);

  const scope = identityScope(DEPLOYMENT.voting, address);
  const identity = useMemo(
    () => loadIdentity(DEPLOYMENT.chainId, scope, pollId),
    // re-evaluate when the member list changes (registration just confirmed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pollId, commitments, identityVersion, scope]
  );
  const registered = !!identity && commitments.includes(identity.commitment);
  const isCreator = !!address && !!poll && address.toLowerCase() === poll.creator.toLowerCase();

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await refresh();
    } catch (e: any) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loadError === "Poll not found.") return <NotFound what="Poll" />;
  if (loadError) return <p className="warn">Could not load poll: {loadError}</p>;
  if (!poll) return <p className="muted">Loading…</p>;

  const canAct = !!signer && chainOk && !busy;

  return (
    <div className="card">
      <Link to="/" className="muted">← All polls</Link>
      <br />
      <span className={`badge ${poll.phase}`}>{poll.phase}</span>
      <h2>{poll.question}</h2>
      <p className="muted">
        Poll #{poll.id.toString()} · {poll.memberCount} registered voter{poll.memberCount === 1 ? "" : "s"}
      </p>

      {poll.phase === "Registration" && (
        <>
          {registered ? (
            <p className="ok">✓ You are registered. Come back when voting opens.</p>
          ) : (
            <button
              disabled={!canAct}
              onClick={() =>
                run(async () =>
                  registerFlow({
                    voting: getVotingContract(signer!),
                    chainId: DEPLOYMENT.chainId,
                    votingAddress: scope,
                    pollId,
                  })
                )
              }
            >
              {busy ? "Registering…" : "Register to vote"}
            </button>
          )}
          {isCreator && (
            <button
              className="secondary"
              style={{ marginLeft: ".5rem" }}
              disabled={!canAct || poll.memberCount === 0}
              onClick={() => run(async () => (await getVotingContract(signer!).closeRegistration(pollId)).wait())}
            >
              Close registration
            </button>
          )}
        </>
      )}

      {poll.phase !== "Ended" && registered && identity && (
        <details style={{ marginTop: "1rem" }}>
          <summary className="muted">Back up your voting identity</summary>
          <p className="muted">Keep this private. It is the only way to vote if you clear browser data.</p>
          <textarea readOnly rows={3} value={exportIdentity(identity)} aria-label="Identity backup export" />
        </details>
      )}

      {poll.phase === "Voting" && (
        <VotePanel
          key={scope}
          options={poll.options}
          hasIdentity={registered}
          canAct={!!signer && chainOk}
          submit={(option, onStage) =>
            submitVote({
              voting: getVotingContract(signer!),
              reader: getVotingContract(readProvider),
              chainId: DEPLOYMENT.chainId,
              votingAddress: scope,
              pollId,
              option,
              onStage,
            })
          }
          onDone={refresh}
          onImport={async (json) => {
            const imported = await importIdentity(json);
            if (!commitments.includes(imported.commitment)) {
              throw new Error("That identity is not registered in this poll.");
            }
            saveIdentity(DEPLOYMENT.chainId, scope, pollId, imported);
            setIdentityVersion((v) => v + 1);
          }}
        />
      )}

      {(poll.phase === "Voting" || poll.phase === "Ended") && (
        <Results options={poll.options} tally={tally} />
      )}

      {isCreator && poll.phase === "Voting" && (
        <button
          className="secondary"
          style={{ marginTop: "1rem" }}
          disabled={!canAct}
          onClick={() => run(async () => (await getVotingContract(signer!).endPoll(pollId)).wait())}
        >
          End poll
        </button>
      )}

      {!signer && <p className="muted">Connect a wallet to take part.</p>}
      {error && <p className="warn">{error}</p>}
    </div>
  );
}
