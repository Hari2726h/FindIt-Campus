import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h2>Page not found</h2>
      <p className="muted">That page doesn't exist, or the link might be out of date.</p>
      <Link to="/">Back to the board</Link>
    </div>
  );
}
