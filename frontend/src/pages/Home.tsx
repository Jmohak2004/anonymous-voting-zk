import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useWallet } from "../wallet";
import { fetchPolls, getVotingContract, PollView } from "../lib/contract";
import { errorMessage } from "../lib/register";

export default function Home() {
  const { readProvider } = useWallet();
  const [polls, setPolls] = useState<PollView[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetchPolls(getVotingContract(readProvider))
      .then((p) => !cancelled && setPolls(p))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => { cancelled = true; };
  }, [readProvider]);

  if (error) return <p className="warn">Could not load polls: {error}. Is the local chain running and deployed?</p>;
  if (!polls) return <p className="muted">Loading polls…</p>;
  if (polls.length === 0) {
    return (
      <div className="card">
        <p>No polls yet.</p>
        <Link to="/create">Create the first poll</Link>
      </div>
    );
  }
  return (
    <>
      {polls.map((p) => (
        <div className="card" key={p.id.toString()}>
          <span className={`badge ${p.phase}`}>{p.phase}</span>
          <h3><Link to={`/poll/${p.id}`}>{p.question}</Link></h3>
          <p className="muted">{p.memberCount} voter{p.memberCount === 1 ? "" : "s"} · {p.options.length} options</p>
        </div>
      ))}
    </>
  );
}
