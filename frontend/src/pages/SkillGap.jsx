import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getGapStats } from '../api/skills.js';
import SkillGapDonut from '../components/skillGap/SkillGapDonut.jsx';
import SkillCategoryCard from '../components/skillGap/SkillCategoryCard.jsx';
import { groupSkillGaps } from '../utils/groupSkillGaps.js';

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export default function SkillGap() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const cardRefs = useRef({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getGapStats();
        if (!cancelled) setStats(data);
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

  const grouped = useMemo(() => (stats ? groupSkillGaps(stats) : null), [stats]);
  const hasData = grouped && grouped.groups.length > 0;

  function toggleCard(id) {
    setExpandedId((current) => (current === id ? null : id));
  }

  // Clicking a donut sector or legend row opens that card and brings it into view.
  function selectFromChart(id) {
    setExpandedId(id);
    requestAnimationFrame(() => {
      cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  return (
    <section className="page page--wide">
      <h2 className="page__title">Skill Gap</h2>
      <p className="page__text page__text--muted">
        Skills you were missing, grouped by area. Each skill counts once per application.
      </p>

      {loading && <p className="page__text page__text--muted">Loading…</p>}
      {error && <p className="form__error">{error}</p>}

      {!loading && !error && !hasData && (
        <p className="page__text page__text--muted">
          No missing skills recorded yet. Open an application in the{' '}
          <Link to="/applications" className="table__link">
            Application Manager
          </Link>
          , click Edit and add the skills you don&apos;t have.
        </p>
      )}

      {!loading && !error && hasData && (
        <>
          <p className="page__text skill-gap__summary">
            Based on {pluralize(grouped.totalApplications, 'application')} where you marked
            missing skills
            {grouped.excludedApplications > 0 &&
              ` (${pluralize(grouped.excludedApplications, 'application')} excluded from stats)`}
            .
          </p>

          <div className="gap-panel">
            <SkillGapDonut
              grouped={grouped}
              hoveredId={hoveredId}
              selectedId={expandedId}
              onHover={setHoveredId}
              onSelect={selectFromChart}
            />
            <p className="gap-panel__note">
              Category percentages are shares of all {grouped.totalMentions} skill-gap
              mentions (one mention = one skill missing in one application). Inside a card,
              each skill shows in how many of the {grouped.totalApplications} applications it
              was missing.
            </p>
          </div>

          <div className="gap-cards">
            {grouped.groups.map((group) => (
              <SkillCategoryCard
                key={group.id}
                ref={(node) => {
                  cardRefs.current[group.id] = node;
                }}
                group={group}
                totalMentions={grouped.totalMentions}
                totalApplications={grouped.totalApplications}
                expanded={expandedId === group.id}
                highlighted={hoveredId === group.id}
                onToggle={() => toggleCard(group.id)}
                onHover={setHoveredId}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
