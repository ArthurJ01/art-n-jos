import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div>
      <h1>Page not found</h1>
      <p className="muted">
        <Link to="/">Back to recipes</Link>
      </p>
    </div>
  );
}
