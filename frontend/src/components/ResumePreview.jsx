import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import mammoth from 'mammoth';
import { getResumeUrl } from '../api/applications.js';

function getResumeExtension(resumeFile) {
  const name = resumeFile?.originalName ?? '';
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
}

const ResumePreview = forwardRef(function ResumePreview(
  { applicationId, resumeFile, onCopyAvailabilityChange },
  ref,
) {
  const [docxHtml, setDocxHtml] = useState('');
  const [docxPlainText, setDocxPlainText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pdfFrameRef = useRef(null);
  const docxPreviewRef = useRef(null);

  const extension = getResumeExtension(resumeFile);
  const previewUrl = getResumeUrl(applicationId, true);
  const downloadUrl = getResumeUrl(applicationId);

  useImperativeHandle(ref, () => ({
    getCopyText() {
      if (!resumeFile) return '';

      if (extension === '.docx') {
        return docxPlainText || docxPreviewRef.current?.innerText?.trim() || '';
      }

      if (extension === '.pdf') {
        try {
          return pdfFrameRef.current?.contentDocument?.body?.innerText?.trim() || '';
        } catch {
          return '';
        }
      }

      return '';
    },
  }));

  useEffect(() => {
    if (extension !== '.docx') {
      setDocxHtml('');
      setDocxPlainText('');
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function loadDocx() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(previewUrl);
        if (!response.ok) {
          throw new Error('Failed to load resume');
        }
        const buffer = await response.arrayBuffer();
        const [htmlResult, textResult] = await Promise.all([
          mammoth.convertToHtml({ arrayBuffer: buffer }),
          mammoth.extractRawText({ arrayBuffer: buffer }),
        ]);
        if (!cancelled) {
          setDocxHtml(htmlResult.value);
          setDocxPlainText(textResult.value);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDocx();
    return () => {
      cancelled = true;
    };
  }, [applicationId, extension, previewUrl]);

  useEffect(() => {
    if (!onCopyAvailabilityChange) return;

    if (!resumeFile) {
      onCopyAvailabilityChange(false);
      return;
    }

    if (extension === '.docx') {
      onCopyAvailabilityChange(!loading && !error && Boolean(docxPlainText));
      return;
    }

    if (extension === '.pdf') {
      onCopyAvailabilityChange(true);
      return;
    }

    onCopyAvailabilityChange(false);
  }, [
    resumeFile,
    extension,
    loading,
    error,
    docxPlainText,
    onCopyAvailabilityChange,
  ]);

  if (!resumeFile) {
    return (
      <div className="resume-preview resume-preview--empty">
        <p className="page__text--muted">No resume attached to this application.</p>
      </div>
    );
  }

  return (
    <div className="resume-preview">
      <div className="resume-preview__toolbar">
        <span className="resume-preview__filename">{resumeFile.originalName}</span>
        <a
          href={downloadUrl}
          className="table__button"
          download={resumeFile.originalName}
        >
          Download
        </a>
      </div>

      {extension === '.pdf' && (
        <iframe
          ref={pdfFrameRef}
          src={previewUrl}
          title={`Resume ${resumeFile.originalName}`}
          className="resume-preview__pdf"
        />
      )}

      {extension === '.docx' && loading && (
        <p className="page__text page__text--muted">Loading document…</p>
      )}

      {extension === '.docx' && error && <p className="form__error">{error}</p>}

      {extension === '.docx' && !loading && !error && (
        <div
          ref={docxPreviewRef}
          className="resume-preview__docx"
          dangerouslySetInnerHTML={{ __html: docxHtml }}
        />
      )}

      {extension !== '.pdf' && extension !== '.docx' && (
        <p className="page__text--muted">
          Preview not available for this format.{' '}
          <a href={downloadUrl} className="table__link" download={resumeFile.originalName}>
            Download file
          </a>
        </p>
      )}
    </div>
  );
});

export default ResumePreview;
