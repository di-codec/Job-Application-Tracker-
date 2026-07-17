import { hasReachedInterview } from './timelineStages.js';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeWeeklyInterviewAverage(applications) {
  const interviews = applications.filter((app) => hasReachedInterview(app.status));

  if (interviews.length === 0) {
    return {
      averagePerWeek: null,
      totalInterviews: 0,
      weekSpan: 0,
      fromDate: null,
      toDate: null,
    };
  }

  const dates = interviews
    .map((app) => parseLocalDate(app.applied_date))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (dates.length === 0) {
    return {
      averagePerWeek: null,
      totalInterviews: interviews.length,
      weekSpan: 0,
      fromDate: null,
      toDate: null,
    };
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const weekSpan = Math.max(1, Math.floor((last - first) / MS_PER_WEEK) + 1);
  const averagePerWeek = interviews.length / weekSpan;

  return {
    averagePerWeek,
    totalInterviews: interviews.length,
    weekSpan,
    fromDate: toIsoDate(first),
    toDate: toIsoDate(last),
  };
}

export function formatWeeklyInterviewAverage(average) {
  if (average === null || average === undefined) return '—';
  return average.toFixed(1);
}
