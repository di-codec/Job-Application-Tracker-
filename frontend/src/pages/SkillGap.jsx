import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGapStats } from '../api/skills.js';

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export default function SkillGap() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getGapStats();
        if (!cancelled) setStats(data);
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

  const hasData = stats && stats.skills.length > 0;

  return (
    <section className="page page--wide">
      <h2 className="page__title">Skill Gap</h2>
      <p className="page__text page__text--muted">
        Skills you were missing, ranked by how many applications asked for them. Each skill
        counts once per application.
      </p>

      {loading && <p className="page__text page__text--muted">Loading…</p>}
      {error && <p className="form__error">{error}</p>}

      {!loading && !error && !hasData && (
        <p className="page__text page__text--muted">
          No missing skills recorded yet. Open an application in the{' '}
          <Link to="/applications" className="table__link">
            Application Manager
          </Link>
          , click Edit and add the skills you don&apos;t have.
        </p>
      )}

      {!loading && !error && hasData && (
        <>
          <p className="page__text skill-gap__summary">
            Based on {pluralize(stats.total_applications, 'application')} where you marked
            missing skills
            {stats.excluded_applications > 0 &&
              ` (${pluralize(stats.excluded_applications, 'application')} excluded from stats)`}
            .
          </p>

          <div className="table-wrap">
            <table className="table skill-gap__table">
              <thead>
                <tr>
                  <th className="skill-gap__rank">#</th>
                  <th>Skill</th>
                  <th>Applications</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {stats.skills.map((skill) => (
                  <tr key={skill.id}>
                    <td className="skill-gap__rank">{skill.rank}</td>
                    <td>{skill.name}</td>
                    <td>
                      {skill.count} of {stats.total_applications}
                    </td>
                    <td>
                      <div className="skill-gap__share">
                        <div className="skill-gap__bar" aria-hidden="true">
                          <div
                            className="skill-gap__bar-fill"
                            style={{ width: `${skill.percentage}%` }}
                          />
                        </div>
                        <span className="skill-gap__percent">{skill.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
