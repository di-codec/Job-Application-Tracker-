import { WORK_MODES, WORK_MODE_LABELS } from '../constants.js';

export function formatWorkMode(workMode, officeDaysPerWeek) {
  if (!workMode) return '—';

  if (workMode === 'hybrid' && officeDaysPerWeek != null) {
    return `${WORK_MODE_LABELS.hybrid} (${officeDaysPerWeek} days/week in office)`;
  }

  return WORK_MODE_LABELS[workMode] ?? workMode;
}

export function validateWorkMode(workMode, officeDaysPerWeek) {
  if (!workMode) return null;

  if (workMode === 'hybrid') {
    if (officeDaysPerWeek === '' || officeDaysPerWeek == null) {
      return 'Enter how many days per week are required in the office';
    }
    const days = Number(officeDaysPerWeek);
    if (!Number.isInteger(days) || days < 1 || days > 7) {
      return 'Office days per week must be between 1 and 7';
    }
  }

  return null;
}

export function appendWorkModeToFormData(formData, workMode, officeDaysPerWeek) {
  if (workMode) {
    formData.append('work_mode', workMode);
    if (workMode === 'hybrid') {
      formData.append('office_days_per_week', officeDaysPerWeek);
    }
  }
}

export default function WorkModeFields({
  workMode,
  officeDaysPerWeek,
  onWorkModeChange,
  onOfficeDaysChange,
  idPrefix = '',
}) {
  return (
    <div className="form__field">
      <span className="form__label">Work format</span>
      <div className="work-mode-options">
        {WORK_MODES.map((mode) => {
          const inputId = `${idPrefix}work_mode_${mode}`;
          const checked = workMode === mode;

          return (
            <label
              key={mode}
              htmlFor={inputId}
              className={`work-mode-option${checked ? ' work-mode-option--checked' : ''}`}
            >
              <input
                id={inputId}
                type="radio"
                name={`${idPrefix}work_mode`}
                value={mode}
                checked={checked}
                onChange={() => onWorkModeChange(mode)}
              />
              <span className="work-mode-option__box" aria-hidden="true" />
              <span className="work-mode-option__label">{WORK_MODE_LABELS[mode]}</span>
            </label>
          );
        })}
      </div>

      {workMode === 'hybrid' && (
        <div className="work-mode-hybrid">
          <label className="form__label" htmlFor={`${idPrefix}office_days_per_week`}>
            Days in office per week
          </label>
          <input
            id={`${idPrefix}office_days_per_week`}
            name="office_days_per_week"
            type="number"
            min="1"
            max="7"
            step="1"
            className="form__input work-mode-hybrid__input"
            value={officeDaysPerWeek}
            onChange={(event) => onOfficeDaysChange(event.target.value)}
            placeholder="3"
          />
        </div>
      )}
    </div>
  );
}
