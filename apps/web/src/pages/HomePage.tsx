import { Link } from 'react-router';
import { paths } from '../lib/paths';

/** The areas of the site. Add a new entry here to show it on the start page. */
const areas = [
  {
    to: paths.recipes,
    icon: '🍳',
    title: 'Recept',
    description: 'Bläddra bland, sök i och lägg till våra recept.',
  },
];

export function HomePage() {
  return (
    <>
      <h1>Välkommen</h1>
      <p className="lead">Vad vill du göra?</p>
      <div className="grid">
        {areas.map((area) => (
          <Link key={area.to} to={area.to} className="card area-card">
            <span className="area-icon" aria-hidden="true">
              {area.icon}
            </span>
            <h2 className="card-title">{area.title}</h2>
            <p className="card-desc">{area.description}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
