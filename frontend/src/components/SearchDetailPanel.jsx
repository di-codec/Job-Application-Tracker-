import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ResumePreview from './ResumePreview.jsx';
import CopyButton from './CopyButton.jsx';
import { getResumeUrl } from '../api/applications.js';
import { STATUS_LABELS } from '../constants.js';
import { formatWorkMode } from './WorkModeFields.jsx';
import { formatDate } from '../utils/formatDate.js';
import { formatSalaryGbp } from '../utils/formatSalary.js';

function buildJobDetailsCopyText(application) {
  const lines = [
    `Company: ${application.company_name}`,
    `Job title: ${application.job_title}`,
    `Applied: ${formatDate(application.applied_date)}`,
    `Status: ${STATUS_LABELS[application.status]}`,
    `Salary: ${formatSalaryGbp(application.salary_gbp)}`,
    `Work format: ${formatWorkMode(application.work_mode, application.office_days_per_week)}`,
  ];

  if (application.job_description_link) {
    lines.push(`Posting: ${application.job_description_link}`);
  }

  if (application.job_description_text) {
    lines.push('', application.job_description_text);
  }

  return lines.join('\n');
}

export default function SearchDetailPanel({ application, onClose }) {
  const resumePreviewRef = useRef(null);
  const [resumeCopyReady, setResumeCopyReady] = useState(false);

  useEffect(() => {
    setResumeCopyReady(false);
  }, [application.id]);

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

  if (!application) return null;

  const jobDetailsCopyText = buildJobDetailsCopyText(application);

  return (
    <div className="search-panel" role="presentation" onClick={onClose}>
      <div
        className="search-panel__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-panel-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="search-panel__header">
          <div>
            <h3 id="search-panel-title" className="search-panel__title">
              {application.job_title}
            </h3>
            <p className="search-panel__subtitle">{application.company_name}</p>
            <Link
              to={`/interview-notes?applicationId=${application.id}`}
              className="search-panel__notes-link table__link"
              onClick={onClose}
            >
              Open interview notes →
            </Link>
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

        <div className="search-panel__body">
          <section className="search-panel__job">
            <div className="search-panel__section-header">
              <h4 className="search-panel__section-title">Job details</h4>
              <CopyButton getText={() => jobDetailsCopyText} label="Copy job details" />
            </div>

            <dl className="search-panel__details">
              <div className="search-panel__detail">
                <dt>Company</dt>
                <dd>{application.company_name}</dd>
              </div>
              <div className="search-panel__detail">
                <dt>Job title</dt>
                <dd>{application.job_title}</dd>
              </div>
              <div className="search-panel__detail">
                <dt>Applied</dt>
                <dd>{formatDate(application.applied_date)}</dd>
              </div>
              <div className="search-panel__detail">
                <dt>Status</dt>
                <dd>{STATUS_LABELS[application.status]}</dd>
              </div>
              <div className="search-panel__detail">
                <dt>Salary</dt>
                <dd>{formatSalaryGbp(application.salary_gbp)}</dd>
              </div>
              <div className="search-panel__detail">
                <dt>Work format</dt>
                <dd>
                  {formatWorkMode(application.work_mode, application.office_days_per_week)}
                </dd>
              </div>
              {application.job_description_link && (
                <div className="search-panel__detail">
                  <dt>Posting</dt>
                  <dd>
                    <a
                      href={application.job_description_link}
                      className="table__link"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open job posting
                    </a>
                  </dd>
                </div>
              )}
            </dl>

            <div className="search-panel__description">
              {application.job_description_text ? (
                <p className="search-panel__description-text">
                  {application.job_description_text}
                </p>
              ) : (
                <p className="page__text--muted">No job description provided.</p>
              )}
            </div>
          </section>

          <section className="search-panel__resume">
            <div className="search-panel__section-header">
              <h4 className="search-panel__section-title">Resume</h4>
              <CopyButton
                getText={() => resumePreviewRef.current?.getCopyText() ?? ''}
                disabled={!resumeCopyReady}
                label="Copy resume text"
              />
            </div>
            <ResumePreview
              ref={resumePreviewRef}
              applicationId={application.id}
              resumeFile={application.resume_file}
              onCopyAvailabilityChange={setResumeCopyReady}
            />
            {application.resume_file && (
              <a
                href={getResumeUrl(application.id)}
                className="search-panel__download-link table__link"
                download={application.resume_file.originalName}
              >
                Open / download resume
              </a>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
