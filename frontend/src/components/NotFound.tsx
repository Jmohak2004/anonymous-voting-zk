import { Link } from "react-router-dom";

export default function NotFound({ what = "Page" }: { what?: string }) {
  return (
    <div className="card">
      <h2>{what} not found</h2>
      <Link to="/">← Back to all polls</Link>
    </div>
  );
}
