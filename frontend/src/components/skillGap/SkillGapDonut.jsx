import { categoryColorVar } from '../../utils/skillCategories.js';

const SIZE = 220;
const STROKE = 30;
const RADIUS = (SIZE - STROKE) / 2 - 6; // room for the hover "grow"
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 2; // px of surface between sectors

/**
 * Donut of category weights with the total in the centre and a legend.
 * Hover/focus on a sector or legend row dims the others and shows its numbers in the
 * centre; click selects the category (expands its card). The selected sector is drawn
 * thicker but does not dim the rest, so the whole stays readable.
 */
export default function SkillGapDonut({ grouped, hoveredId, selectedId, onHover, onSelect }) {
  const { groups, totalMentions } = grouped;
  const active = groups.find((group) => group.id === hoveredId);
  const singleGroup = groups.length === 1;

  let offset = 0;
  const sectors = groups.map((group) => {
    const length = group.share * CIRCUMFERENCE;
    const sector = {
      group,
      dash: Math.max(length - (singleGroup ? 0 : GAP), 0.5),
      offset,
    };
    offset += length;
    return sector;
  });

  const summary = groups
    .map((group) => `${group.label} ${group.weight}%`)
    .join(', ');

  return (
    <div className="gap-overview">
      <div className="gap-donut">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="gap-donut__svg"
          role="img"
          aria-label={`${totalMentions} skill-gap mentions by category: ${summary}`}
        >
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {sectors.map(({ group, dash, offset: sectorOffset }) => {
              const isActive = group.id === hoveredId || group.id === selectedId;
              const isDimmed = hoveredId && group.id !== hoveredId;
              return (
                <circle
                  key={group.id}
                  className={`gap-donut__sector${isActive ? ' gap-donut__sector--active' : ''}${
                    isDimmed ? ' gap-donut__sector--dimmed' : ''
                  }`}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={categoryColorVar(group)}
                  strokeWidth={isActive ? STROKE + 6 : STROKE}
                  strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                  strokeDashoffset={-sectorOffset}
                  onMouseEnter={() => onHover(group.id)}
                  onMouseLeave={() => onHover(null)}
                  onClick={() => onSelect(group.id)}
                >
                  <title>
                    {`${group.label}: ${group.mentions} of ${totalMentions} mentions (${group.weight}%)`}
                  </title>
                </circle>
              );
            })}
          </g>
        </svg>

        <div className="gap-donut__center" aria-hidden="true">
          <span className="gap-donut__total">{active ? active.mentions : totalMentions}</span>
          <span className="gap-donut__caption">
            {active ? `${active.label} · ${active.weight}%` : 'skill-gap mentions'}
          </span>
        </div>
      </div>

      <ul className="gap-legend" aria-label="Categories">
        {groups.map((group) => {
          const isActive = group.id === hoveredId || group.id === selectedId;
          return (
            <li key={group.id}>
              <button
                type="button"
                className={`gap-legend__item${isActive ? ' gap-legend__item--active' : ''}`}
                onMouseEnter={() => onHover(group.id)}
                onMouseLeave={() => onHover(null)}
                onFocus={() => onHover(group.id)}
                onBlur={() => onHover(null)}
                onClick={() => onSelect(group.id)}
              >
                <span
                  className="gap-legend__swatch"
                  style={{ background: categoryColorVar(group) }}
                  aria-hidden="true"
                />
                <span className="gap-legend__label">{group.label}</span>
                <span className="gap-legend__count">{group.mentions}</span>
                <span className="gap-legend__weight">{group.weight}%</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
