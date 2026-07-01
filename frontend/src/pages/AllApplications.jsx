import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getApplications,
  updateApplicationStatus,
  deleteApplication,
  getResumeUrl,
} from '../api/applications.js';
import EditApplicationModal from '../components/EditApplicationModal.jsx';
import { formatWorkMode } from '../components/WorkModeFields.jsx';
import { APPLICATION_STATUSES, STATUS_LABELS } from '../constants.js';
import { formatDate } from '../utils/formatDate.js';
import { formatSalaryGbp } from '../utils/formatSalary.js';

export default function AllApplications() {
  const [applications, setApplications] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingApplication, setEditingApplication] = useState(null);

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

  async function handleStatusChange(id, newStatus, previousStatus) {
    setUpdatingId(id);
    setError('');

    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app)),
    );

    try {
      const updated = await updateApplicationStatus(id, newStatus);
      setApplications((prev) =>
        prev.map((app) => (app.id === id ? updated : app)),
      );
    } catch (err) {
      setApplications((prev) =>
        prev.map((app) => (app.id === id ? { ...app, status: previousStatus } : app)),
      );
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(app) {
    const confirmed = window.confirm(
      `Delete application for "${app.job_title}" at "${app.company_name}"?`,
    );
    if (!confirmed) return;

    setDeletingId(app.id);
    setError('');

    try {
      await deleteApplication(app.id);
      setApplications((prev) => prev.filter((item) => item.id !== app.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(updated) {
    setApplications((prev) =>
      prev.map((app) => (app.id === updated.id ? updated : app)),
    );
  }

  function toggleStatusFilter(status) {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status],
    );
  }

  const filteredApplications = useMemo(() => {
    let result = applications;

    const trimmed = query.trim().toLowerCase();
    if (trimmed) {
      result = result.filter(
        (app) =>
          app.company_name.toLowerCase().includes(trimmed) ||
          app.job_title.toLowerCase().includes(trimmed),
      );
    }

    if (statusFilter.length > 0) {
      result = result.filter((app) => statusFilter.includes(app.status));
    }

    return result;
  }, [applications, query, statusFilter]);

  return (
    <section className="page page--wide">
      <h2 className="page__title">Application Manager</h2>
      <p className="page__text page__text--muted">
        Search by company or job title and filter by status to find vacancies in the list
        below.
      </p>

      <div className="applications-filters">
        <div className="search search--table">
          <input
            type="search"
            className="search__input form__input"
            placeholder="Company or job title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            aria-label="Search by company or job title"
          />
        </div>

        <div className="applications-filters__status">
          <span className="applications-filters__label" id="status-filter-label">
            Status
          </span>
          <div
            className="applications-filters__chips"
            role="group"
            aria-labelledby="status-filter-label"
          >
            {APPLICATION_STATUSES.map((status) => {
              const isActive = statusFilter.includes(status);
              return (
                <button
                  key={status}
                  type="button"
                  className={`applications-filters__chip${
                    isActive ? ' applications-filters__chip--active' : ''
                  }`}
                  onClick={() => toggleStatusFilter(status)}
                  aria-pressed={isActive}
                >
                  {STATUS_LABELS[status]}
                </button>
              );
            })}
          </div>
          {(query.trim() || statusFilter.length > 0) && (
            <button
              type="button"
              className="applications-filters__clear"
              onClick={() => {
                setQuery('');
                setStatusFilter([]);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {loading && <p className="page__text page__text--muted">Loading…</p>}

      {error && <p className="form__error">{error}</p>}

      {!loading && !error && applications.length === 0 && (
        <p className="page__text page__text--muted">
          No applications yet.{' '}
          <Link to="/add" className="table__link">
            Add your first application
          </Link>
        </p>
      )}

      {!loading && !error && applications.length > 0 && filteredApplications.length === 0 && (
        <p className="search__empty page__text--muted">No results found</p>
      )}

      {!loading && filteredApplications.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Job title</th>
                <th>Company</th>
                <th>Salary</th>
                <th>Work format</th>
                <th>Applied</th>
                <th>Status</th>
                <th>Posting</th>
                <th>Resume</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApplications.map((app) => (
                <tr key={app.id}>
                  <td>{app.job_title}</td>
                  <td>{app.company_name}</td>
                  <td className="table__date">{formatSalaryGbp(app.salary_gbp)}</td>
                  <td>{formatWorkMode(app.work_mode, app.office_days_per_week)}</td>
                  <td className="table__date">{formatDate(app.applied_date)}</td>
                  <td>
                    <select
                      className="table__select"
                      value={app.status}
                      disabled={updatingId === app.id || deletingId === app.id}
                      onChange={(e) =>
                        handleStatusChange(app.id, e.target.value, app.status)
                      }
                      aria-label={`Status for ${app.job_title}`}
                    >
                      {APPLICATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {app.job_description_link ? (
                      <a
                        href={app.job_description_link}
                        className="table__link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="table__muted">—</span>
                    )}
                  </td>
                  <td>
                    {app.resume_file ? (
                      <a
                        href={getResumeUrl(app.id)}
                        className="table__button"
                        target="_blank"
                        rel="noopener noreferrer"
                        download={app.resume_file.originalName}
                      >
                        Download
                      </a>
                    ) : (
                      <span className="table__muted">—</span>
                    )}
                  </td>
                  <td>
                    <div className="table__actions">
                      <button
                        type="button"
                        className="table__button table__button--edit"
                        onClick={() => setEditingApplication(app)}
                        disabled={deletingId === app.id}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="table__button table__button--danger"
                        onClick={() => handleDelete(app)}
                        disabled={deletingId === app.id}
                      >
                        {deletingId === app.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingApplication && (
        <EditApplicationModal
          application={editingApplication}
          onClose={() => setEditingApplication(null)}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
