import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApplication } from '../api/applications.js';
import { APPLICATION_STATUSES, STATUS_LABELS, ALLOWED_RESUME_EXTENSIONS } from '../constants.js';
import WorkModeFields, {
  appendWorkModeToFormData,
  validateWorkMode,
} from '../components/WorkModeFields.jsx';

const initialForm = {
  job_title: '',
  company_name: '',
  job_description_link: '',
  job_description_text: '',
  salary_gbp: '',
  work_mode: '',
  office_days_per_week: '',
  status: 'no_answer',
};

function isAllowedResumeFile(file) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return ALLOWED_RESUME_EXTENSIONS.includes(ext);
}

export default function AddApplication() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [resume, setResume] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    if (form.job_description_text.trim()) {
      formData.append('job_description_text', form.job_description_text.trim());
    }
    if (form.salary_gbp !== '') {
      formData.append('salary_gbp', form.salary_gbp);
    }
    appendWorkModeToFormData(formData, form.work_mode, form.office_days_per_week);
    formData.append('status', form.status);
    if (resume) {
      formData.append('resume', resume);
    }

    setSubmitting(true);
    try {
      await createApplication(formData);
      navigate('/applications');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page">
      <h2 className="page__title">Add Application</h2>

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="form__field">
          <label className="form__label" htmlFor="job_title">
            Job title <span className="form__required">*</span>
          </label>
          <input
            id="job_title"
            name="job_title"
            type="text"
            className="form__input"
            value={form.job_title}
            onChange={handleChange}
            required
            autoComplete="organization-title"
          />
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="company_name">
            Company <span className="form__required">*</span>
          </label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            className="form__input"
            value={form.company_name}
            onChange={handleChange}
            required
            autoComplete="organization"
          />
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="job_description_link">
            Job posting URL
          </label>
          <input
            id="job_description_link"
            name="job_description_link"
            type="url"
            className="form__input"
            value={form.job_description_link}
            onChange={handleChange}
            placeholder="https://"
          />
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="salary_gbp">
            Salary
          </label>
          <div className="form__input-group">
            <span className="form__input-prefix">£</span>
            <input
              id="salary_gbp"
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
          workMode={form.work_mode}
          officeDaysPerWeek={form.office_days_per_week}
          onWorkModeChange={handleWorkModeChange}
          onOfficeDaysChange={handleOfficeDaysChange}
        />

        <div className="form__field">
          <label className="form__label" htmlFor="job_description_text">
            Job description
          </label>
          <textarea
            id="job_description_text"
            name="job_description_text"
            className="form__textarea"
            value={form.job_description_text}
            onChange={handleChange}
            rows={6}
          />
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="resume">
            Resume (PDF, DOCX)
          </label>
          <input
            id="resume"
            name="resume"
            type="file"
            className="form__input form__input--file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
          />
          {resume && <p className="form__hint">Selected file: {resume.name}</p>}
        </div>

        <div className="form__field">
          <label className="form__label" htmlFor="status">
            Status
          </label>
          <select
            id="status"
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
          <button type="submit" className="form__button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save application'}
          </button>
        </div>
      </form>
    </section>
  );
}
