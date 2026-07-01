import { getTimelineStages } from '../utils/timelineStages.js';

export default function ApplicationTimeline({ applications }) {
  if (applications.length === 0) {
    return (
      <div className="timeline timeline--empty">
        <div className="timeline__header">
          <div className="timeline__title-row">
            <h3 className="timeline__title">Timeline for each application</h3>
            <span className="timeline__badge">Most honest for details</span>
          </div>
          <p className="timeline__subtitle">
            Each application is a row; stages are chips in the order they actually happened.
            No aggregation, so no made-up steps.
          </p>
        </div>
        <p className="page__text page__text--muted timeline__empty-text">
          No applications yet.
        </p>
      </div>
    );
  }

  return (
    <div className="timeline">
      <div className="timeline__header">
        <div className="timeline__title-row">
          <h3 className="timeline__title">Timeline for each application</h3>
          <span className="timeline__badge">Most honest for details</span>
        </div>
        <p className="timeline__subtitle">
          Each application is a row; stages are chips in the order they actually happened. No
          aggregation, so no made-up steps.
        </p>
      </div>

      <ul className="timeline__list">
        {applications.map((app) => {
          const stages = getTimelineStages(app.status);

          return (
            <li key={app.id} className="timeline__row">
              <span className="timeline__company">{app.company_name}</span>
              <div className="timeline__stages">
                {stages.map((stage, index) => (
                  <span key={`${app.id}-${index}`} className="timeline__stage-group">
                    {index > 0 && <span className="timeline__arrow" aria-hidden="true">→</span>}
                    <span className={`timeline__chip timeline__chip--${stage.variant}`}>
                      {stage.label}
                    </span>
                  </span>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
