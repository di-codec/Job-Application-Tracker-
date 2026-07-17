import { useMemo } from 'react';
import {
  computeWeeklyInterviewAverage,
  formatWeeklyInterviewAverage,
} from '../utils/interviewStats.js';

export default function InterviewWeeklyStats({ applications }) {
  const stats = useMemo(
    () => computeWeeklyInterviewAverage(applications),
    [applications],
  );

  return (
    <div className="home-interview-stats">
      <h3 className="home-interview-stats__title">Average interviews per week</h3>
      <p className="home-interview-stats__value">
        {formatWeeklyInterviewAverage(stats.averagePerWeek)}
      </p>
      {stats.totalInterviews === 0 && (
        <p className="home-interview-stats__detail page__text--muted">
          No applications have reached the interview stage yet.
        </p>
      )}
    </div>
  );
}
