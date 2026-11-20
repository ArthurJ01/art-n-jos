import { Link } from 'react-router';
import { paths } from '../lib/paths';

export function NotFoundPage() {
  return (
    <div>
      <h1>Sidan hittades inte</h1>
      <p className="muted">
        <Link to={paths.home}>Till startsidan</Link>
      </p>
    </div>
  );
}
