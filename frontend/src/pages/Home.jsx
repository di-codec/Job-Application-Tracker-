import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getApplications } from '../api/applications.js';
import ApplicationTimeline from '../components/ApplicationTimeline.jsx';
import FunnelSankey from '../components/FunnelSankey.jsx';
import InterviewWeeklyStats from '../components/InterviewWeeklyStats.jsx';
import { shouldShowInTimeline } from '../utils/timelineStages.js';

export default function Home() {
  const location = useLocation();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getApplications();
      setApplications(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== '/') return undefined;

    loadApplications();

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadApplications();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [location.pathname, loadApplications]);

  const timelineApplications = useMemo(
    () => applications.filter((app) => shouldShowInTimeline(app.status)),
    [applications],
  );

  return (
    <section className="page page--wide">
      <h2 className="page__title">Home</h2>

      {loading && <p className="page__text page__text--muted">Loading…</p>}
      {error && <p className="form__error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="home-funnel">
            <p className="page__text page__text--muted home-funnel__intro">
              Application funnel: from submission to final outcome.
            </p>
            <FunnelSankey applications={applications} />
          </div>

          <ApplicationTimeline
            applications={timelineApplications}
            hasApplications={applications.length > 0}
          />

          <InterviewWeeklyStats applications={applications} />
        </>
      )}
    </section>
  );
}
