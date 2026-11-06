import { useEffect, useState } from 'react';
import { getSkills } from '../api/skills.js';

// Client-side de-duplication only (case/whitespace). The backend also
// resolves aliases such as "Amazon Web Services" → "AWS" on save.
function skillKey(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export default function MissingSkillsField({
  skills,
  onSkillsChange,
  includeInGapStats,
  onIncludeInGapStatsChange,
  idPrefix = '',
}) {
  const [draft, setDraft] = useState('');
  const [knownSkills, setKnownSkills] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getSkills()
      .then((data) => {
        if (!cancelled) setKnownSkills(data);
      })
      .catch(() => {
        // Autocomplete is optional; typing still works without suggestions.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const inputId = `${idPrefix}missing_skills`;
  const listId = `${inputId}_suggestions`;
  const selectedKeys = new Set(skills.map(skillKey));
  const suggestions = knownSkills.filter((skill) => !selectedKeys.has(skillKey(skill.name)));

  function addSkills(raw) {
    const names = raw
      .split(',')
      .map((name) => name.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
    if (names.length === 0) return;

    const next = [...skills];
    const keys = new Set(next.map(skillKey));
    for (const name of names) {
      const key = skillKey(name);
      if (!keys.has(key)) {
        keys.add(key);
        next.push(name);
      }
    }
    onSkillsChange(next);
    setDraft('');
  }

  function removeSkill(name) {
    onSkillsChange(skills.filter((skill) => skill !== name));
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault(); // don't submit the form
      addSkills(draft);
    } else if (event.key === 'Backspace' && !draft && skills.length > 0) {
      removeSkill(skills[skills.length - 1]);
    }
  }

  function handleChange(event) {
    const { value } = event.target;
    // Picking a datalist option fires a change without a keydown; add it right away.
    const picked = suggestions.find((skill) => skill.name === value);
    if (picked && event.nativeEvent?.inputType !== 'insertText') {
      addSkills(picked.name);
      return;
    }
    setDraft(value);
  }

  return (
    <div className="form__field">
      <label className="form__label" htmlFor={inputId}>
        Missing skills
      </label>

      <div className="skills-input">
        {skills.length > 0 && (
          <ul className="skills-input__chips" aria-label="Missing skills">
            {skills.map((name) => (
              <li key={name} className="skills-input__chip">
                <span>{name}</span>
                <button
                  type="button"
                  className="skills-input__remove"
                  onClick={() => removeSkill(name)}
                  aria-label={`Remove ${name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          id={inputId}
          type="text"
          className="form__input skills-input__field"
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => addSkills(draft)}
          list={listId}
          placeholder="e.g. AWS, Kubernetes"
          autoComplete="off"
        />
        <datalist id={listId}>
          {suggestions.map((skill) => (
            <option key={skill.id} value={skill.name} />
          ))}
        </datalist>
      </div>
      <p className="form__hint">
        Requirements from the job description you don&apos;t meet. Press Enter or comma to add.
      </p>

      <label className="skills-input__toggle" htmlFor={`${idPrefix}include_in_gap_stats`}>
        <input
          id={`${idPrefix}include_in_gap_stats`}
          type="checkbox"
          checked={includeInGapStats}
          onChange={(event) => onIncludeInGapStatsChange(event.target.checked)}
        />
        <span>Include in skill gap stats</span>
      </label>
    </div>
  );
}
