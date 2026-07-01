import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getInterviewNotesList,
  saveInterviewNotes,
} from '../api/interviewNotes.js';
import MarkdownField from '../components/MarkdownField.jsx';
import { STATUS_LABELS } from '../constants.js';
import { formatDate } from '../utils/formatDate.js';

function hasNoteContent(item) {
  return Boolean(item.preparation_plan?.trim() || item.live_notes?.trim());
}

export default function InterviewNotes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [preparationPlan, setPreparationPlan] = useState('');
  const [liveNotes, setLiveNotes] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [listQuery, setListQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const requestedApplicationId = Number(searchParams.get('applicationId'));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getInterviewNotesList();
        if (cancelled) return;

        setItems(data);

        const preferredId = data.some((item) => item.application_id === requestedApplicationId)
          ? requestedApplicationId
          : data[0]?.application_id ?? null;

        setSelectedId(preferredId);
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
  }, [requestedApplicationId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.application_id === selectedId) ?? null,
    [items, selectedId],
  );

  useLayoutEffect(() => {
    if (!selectedItem) {
      setPreparationPlan('');
      setLiveNotes('');
      setUpdatedAt(null);
      return;
    }

    setPreparationPlan(selectedItem.preparation_plan ?? '');
    setLiveNotes(selectedItem.live_notes ?? '');
    setUpdatedAt(selectedItem.updated_at ?? null);
    setSaveMessage('');
  }, [selectedItem]);

  const filteredItems = useMemo(() => {
    const trimmed = listQuery.trim().toLowerCase();
    if (!trimmed) return items;

    return items.filter(
      (item) =>
        item.company_name.toLowerCase().includes(trimmed) ||
        item.job_title.toLowerCase().includes(trimmed),
    );
  }, [items, listQuery]);

  function handleSelectApplication(applicationId) {
    setSelectedId(applicationId);
    setSearchParams({ applicationId: String(applicationId) });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!selectedId) return;

    setSaving(true);
    setError('');
    setSaveMessage('');

    try {
      const saved = await saveInterviewNotes(selectedId, {
        preparationPlan,
        liveNotes,
      });

      setUpdatedAt(saved.updated_at ?? null);
      setItems((prev) =>
        prev.map((item) =>
          item.application_id === selectedId
            ? {
                ...item,
                preparation_plan: saved.preparation_plan,
                live_notes: saved.live_notes,
                updated_at: saved.updated_at,
              }
            : item,
        ),
      );
      setSaveMessage('Notes saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page page--wide page--interview-notes">
      <h2 className="page__title">Interview Notes</h2>
      <p className="page__text page__text--muted">
        Keep a preparation plan and quick bullet points for each application. Type directly
        in the fields — headings, bold text, lists, checkboxes, and tables apply instantly. Notes are
        saved as Markdown for every vacancy.
      </p>

      {loading && <p className="page__text page__text--muted">Loading…</p>}
      {error && <p className="form__error">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="page__text page__text--muted">
          No applications yet. Add an application first, then return here to write
          interview notes.
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="interview-notes">
          <aside className="interview-notes__sidebar">
            <input
              type="search"
              className="interview-notes__search form__input"
              placeholder="Search vacancies"
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              aria-label="Search vacancies"
            />

            {filteredItems.length === 0 ? (
              <p className="page__text page__text--muted">No matching vacancies</p>
            ) : (
              <ul className="interview-notes__list">
                {filteredItems.map((item) => {
                  const isActive = item.application_id === selectedId;
                  return (
                    <li key={item.application_id}>
                      <button
                        type="button"
                        className={`interview-notes__list-item${
                          isActive ? ' interview-notes__list-item--active' : ''
                        }`}
                        onClick={() => handleSelectApplication(item.application_id)}
                      >
                        <span className="interview-notes__list-title">{item.job_title}</span>
                        <span className="interview-notes__list-company">{item.company_name}</span>
                        <span className="interview-notes__list-meta">
                          {formatDate(item.applied_date)} · {STATUS_LABELS[item.status]}
                          {hasNoteContent(item) ? ' · Notes saved' : ''}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <div className="interview-notes__editor">
            {selectedItem ? (
              <form className="interview-notes__form" onSubmit={handleSave}>
                <header className="interview-notes__editor-header">
                  <div>
                    <h3 className="interview-notes__editor-title">{selectedItem.job_title}</h3>
                    <p className="interview-notes__editor-subtitle">
                      {selectedItem.company_name} · {STATUS_LABELS[selectedItem.status]}
                    </p>
                  </div>
                  <div className="interview-notes__editor-actions">
                    {updatedAt && (
                      <span className="interview-notes__saved-at page__text--muted">
                        Last saved {formatDate(updatedAt.slice(0, 10))}
                      </span>
                    )}
                    {saveMessage && (
                      <span className="interview-notes__save-message">{saveMessage}</span>
                    )}
                    <button
                      type="submit"
                      className="form__button"
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save notes'}
                    </button>
                  </div>
                </header>

                <MarkdownField
                  key={`plan-${selectedId}`}
                  label="Preparation plan"
                  initialMarkdown={selectedItem.preparation_plan ?? ''}
                  onChange={setPreparationPlan}
                  enableTables
                  className="interview-notes__field interview-notes__field--plan"
                  editorClassName="interview-notes__editor-surface interview-notes__editor-surface--plan"
                  placeholder="Type ## for a heading, **bold**, - for bullets, [ ] for checkboxes, or use Insert table…"
                />

                <MarkdownField
                  key={`live-${selectedId}`}
                  label="Live interview bullets"
                  initialMarkdown={selectedItem.live_notes ?? ''}
                  onChange={setLiveNotes}
                  className="interview-notes__field interview-notes__field--live"
                  editorClassName="interview-notes__editor-surface interview-notes__editor-surface--live"
                  placeholder="Type - for bullets or [ ] for checkboxes during the interview…"
                />
              </form>
            ) : (
              <p className="page__text page__text--muted">Select a vacancy to view notes.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
