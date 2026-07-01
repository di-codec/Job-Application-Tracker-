export function formatSalaryGbp(value) {
  if (value == null || value === '') return '—';
  return `£${Number(value).toLocaleString('en-GB')}`;
}
