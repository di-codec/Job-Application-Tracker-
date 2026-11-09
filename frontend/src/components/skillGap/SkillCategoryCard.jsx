import { forwardRef } from 'react';
import CategoryIcon from './CategoryIcon.jsx';
import { categoryColorVar } from '../../utils/skillCategories.js';

/**
 * One category: header with the group's share of all skill-gap mentions; when expanded,
 * every skill with its own per-application numbers (a different denominator).
 */
const SkillCategoryCard = forwardRef(function SkillCategoryCard(
  { group, totalMentions, totalApplications, expanded, highlighted, onToggle, onHover },
  ref,
) {
  const bodyId = `gap-card-${group.id}`;

  return (
    <article
      ref={ref}
      className={`gap-card${expanded ? ' gap-card--expanded' : ''}${
        highlighted ? ' gap-card--highlighted' : ''
      }`}
      style={{ '--cat-color': categoryColorVar(group) }}
      onMouseEnter={() => onHover(group.id)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        className="gap-card__header"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span className="gap-card__icon">
          <CategoryIcon name={group.icon} />
        </span>
        <span className="gap-card__title">
          <span className="gap-card__name">{group.label}</span>
          <span className="gap-card__meta">
            {group.mentions} of {totalMentions} skill-gap mentions
          </span>
        </span>
        <span className="gap-card__weight">{group.weight}%</span>
        <span className="gap-card__chevron" aria-hidden="true" />
      </button>

      {expanded && (
        <div id={bodyId} className="gap-card__body">
          <table className="gap-card__skills">
            <caption className="gap-card__caption">
              Missing in how many of the {totalApplications} analysed applications
            </caption>
            <thead className="visually-hidden">
              <tr>
                <th scope="col">Skill</th>
                <th scope="col">Applications</th>
                <th scope="col">Share of applications</th>
              </tr>
            </thead>
            <tbody>
              {group.skills.map((skill) => (
                <tr key={skill.id}>
                  <th scope="row" className="gap-card__skill">
                    {skill.name}
                  </th>
                  <td className="gap-card__count">
                    {skill.count} of {totalApplications} apps
                  </td>
                  <td className="gap-card__percent">{skill.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
});

export default SkillCategoryCard;
