import { useEffect, useMemo, useState } from 'react';
import { getApplications } from '../api/applications.js';
import SearchDetailPanel from '../components/SearchDetailPanel.jsx';
import { STATUS_LABELS } from '../constants.js';
import { formatDate } from '../utils/formatDate.js';

export default function Search() {
  const [applications, setApplications] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getApplications();
        if (!cancelled) setApplications(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return applications;

    return applications.filter((app) =>
      app.company_name.toLowerCase().includes(trimmed),
    );
  }, [applications, query]);

  return (
    <section className="page page--wide">
      <h2 className="page__title">JD Details</h2>
      <p className="page__text page__text--muted">
        All applications are listed below. Enter a company name to filter, then click a
        role to view details.
      </p>

      <div className="search">
        <input
          type="search"
          className="search__input form__input"
          placeholder="Company name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          aria-label="Search by company name"
        />

        {loading && <p className="page__text page__text--muted">Loading…</p>}
        {error && <p className="form__error">{error}</p>}

        {!loading && !error && results.length === 0 && (
          <p className="search__empty page__text--muted">
            {query.trim() ? 'No results found' : 'No applications yet'}
          </p>
        )}

        {!loading && !error && results.length > 0 && (
          <ul className="search__results">
            {results.map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  className="search__item"
                  onClick={() => setSelectedApplication(app)}
                >
                  <div className="search__info">
                    <p className="search__company">{app.company_name}</p>
                    <p className="search__meta">
                      {app.job_title} · {formatDate(app.applied_date)} ·{' '}
                      {STATUS_LABELS[app.status]}
                    </p>
                  </div>
                  <span className="search__hint">View details →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {selectedApplication && (
        <SearchDetailPanel
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      )}
    </section>
  );
}
