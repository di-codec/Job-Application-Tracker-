import { useEffect, useState } from 'react';
import { updateApplication } from '../api/applications.js';
import {
  APPLICATION_STATUSES,
  STATUS_LABELS,
  ALLOWED_RESUME_EXTENSIONS,
} from '../constants.js';
import WorkModeFields, {
  appendWorkModeToFormData,
  validateWorkMode,
} from './WorkModeFields.jsx';
import { formatDate } from '../utils/formatDate.js';

function isAllowedResumeFile(file) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return ALLOWED_RESUME_EXTENSIONS.includes(ext);
}

export default function EditApplicationModal({ application, onClose, onSaved }) {
  const [form, setForm] = useState({
    job_title: application.job_title,
    company_name: application.company_name,
    job_description_link: application.job_description_link ?? '',
    job_description_text: application.job_description_text ?? '',
    salary_gbp: application.salary_gbp ?? '',
    work_mode: application.work_mode ?? '',
    office_days_per_week: application.office_days_per_week ?? '',
    status: application.status,
  });
  const [resume, setResume] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleWorkModeChange(workMode) {
    setForm((prev) => ({
      ...prev,
      work_mode: workMode,
      office_days_per_week: workMode === 'hybrid' ? prev.office_days_per_week : '',
    }));
  }

  function handleOfficeDaysChange(value) {
    setForm((prev) => ({ ...prev, office_days_per_week: value }));
  }

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (!file) {
      setResume(null);
      return;
    }
    if (!isAllowedResumeFile(file)) {
      setError('Only PDF and DOCX files are allowed');
      event.target.value = '';
      setResume(null);
      return;
    }
    setError('');
    setResume(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!form.job_title.trim() || !form.company_name.trim()) {
      setError('Job title and company name are required');
      return;
    }

    const workModeError = validateWorkMode(form.work_mode, form.office_days_per_week);
    if (workModeError) {
      setError(workModeError);
      return;
    }

    const formData = new FormData();
    formData.append('job_title', form.job_title.trim());
    formData.append('company_name', form.company_name.trim());
    if (form.job_description_link.trim()) {
      formData.append('job_description_link', form.job_description_link.trim());
    }
    formData.append('job_description_text', form.job_description_text.trim());
    formData.append('salary_gbp', form.salary_gbp === '' ? '' : form.salary_gbp);
    appendWorkModeToFormData(formData, form.work_mode, form.office_days_per_week);
    formData.append('status', form.status);
    if (resume) {
      formData.append('resume', resume);
    }

    setSubmitting(true);
    try {
      const updated = await updateApplication(application.id, formData);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="search-panel" role="presentation" onClick={onClose}>
      <div
        className="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="search-panel__header">
          <div>
            <h3 id="edit-modal-title" className="search-panel__title">
              Edit application
            </h3>
            <p className="search-panel__subtitle">
              Applied: {formatDate(application.applied_date)}
            </p>
          </div>
          <button
            type="button"
            className="search-panel__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        <form className="form edit-modal__form" onSubmit={handleSubmit} noValidate>
          <div className="form__field">
            <label className="form__label" htmlFor="edit_job_title">
              Job title <span className="form__required">*</span>
            </label>
            <input
              id="edit_job_title"
              name="job_title"
              type="text"
              className="form__input"
              value={form.job_title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form__field">
            <label className="form__label" htmlFor="edit_company_name">
              Company <span className="form__required">*</span>
            </label>
            <input
              id="edit_company_name"
              name="company_name"
              type="text"
              className="form__input"
              value={form.company_name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form__field">
            <label className="form__label" htmlFor="edit_job_description_link">
              Job posting URL
            </label>
            <input
              id="edit_job_description_link"
              name="job_description_link"
              type="url"
              className="form__input"
              value={form.job_description_link}
              onChange={handleChange}
              placeholder="https://"
            />
          </div>

          <div className="form__field">
            <label className="form__label" htmlFor="edit_salary_gbp">
              Salary
            </label>
            <div className="form__input-group">
              <span className="form__input-prefix">£</span>
              <input
                id="edit_salary_gbp"
                name="salary_gbp"
                type="number"
                min="0"
                step="1000"
                className="form__input form__input--with-prefix"
                value={form.salary_gbp}
                onChange={handleChange}
                placeholder="50000"
              />
            </div>
          </div>

          <WorkModeFields
            idPrefix="edit_"
            workMode={form.work_mode}
            officeDaysPerWeek={form.office_days_per_week}
            onWorkModeChange={handleWorkModeChange}
            onOfficeDaysChange={handleOfficeDaysChange}
          />

          <div className="form__field">
            <label className="form__label" htmlFor="edit_job_description_text">
              Job description
            </label>
            <textarea
              id="edit_job_description_text"
              name="job_description_text"
              className="form__textarea"
              value={form.job_description_text}
              onChange={handleChange}
              rows={5}
            />
          </div>

          <div className="form__field">
            <label className="form__label" htmlFor="edit_resume">
              Resume (PDF, DOCX)
            </label>
            {application.resume_file && !resume && (
              <p className="form__hint">
                Current file: {application.resume_file.originalName}
              </p>
            )}
            <input
              id="edit_resume"
              name="resume"
              type="file"
              className="form__input form__input--file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
            {resume && <p className="form__hint">New file: {resume.name}</p>}
          </div>

          <div className="form__field">
            <label className="form__label" htmlFor="edit_status">
              Status
            </label>
            <select
              id="edit_status"
              name="status"
              className="form__select"
              value={form.status}
              onChange={handleChange}
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="form__error">{error}</p>}

          <div className="form__actions">
            <button type="button" className="form__button form__button--secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="form__button" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
