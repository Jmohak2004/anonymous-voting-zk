import { Link, Route, Routes } from "react-router-dom";
import { useWallet } from "./wallet";
import CreatePoll from "./pages/CreatePoll";
import Poll from "./pages/Poll";

function WalletBar() {
  const { address, connect, devWallets, devIndex, selectDev, chainOk, error } = useWallet();
  return (
    <div className="wallet">
      {devWallets.length > 0 ? (
        <select
          aria-label="Dev account"
          value={devIndex ?? ""}
          onChange={(e) => selectDev(Number(e.target.value))}
        >
          <option value="" disabled>Select dev account…</option>
          {devWallets.map((w, i) => (
            <option key={w.address} value={i}>
              #{i} {w.address.slice(0, 6)}…{w.address.slice(-4)}
            </option>
          ))}
        </select>
      ) : address ? (
        <span className="addr">{address.slice(0, 6)}…{address.slice(-4)}</span>
      ) : (
        <button onClick={connect}>Connect wallet</button>
      )}
      {!chainOk && <span className="warn">Wrong network</span>}
      {error && <span className="warn">{error}</span>}
    </div>
  );
}

export default function App() {
  return (
    <div className="app">
      <header>
        <Link to="/" className="brand">🗳️ Anonymous Voting <small>zk-SNARKs</small></Link>
        <nav><Link to="/create">New poll</Link></nav>
        <WalletBar />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<p>Polls will appear here.</p>} />
          <Route path="/create" element={<CreatePoll />} />
          <Route path="/poll/:id" element={<Poll />} />
        </Routes>
      </main>
    </div>
  );
}
