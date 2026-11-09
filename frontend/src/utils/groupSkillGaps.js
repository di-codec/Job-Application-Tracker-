import { OTHER_CATEGORY_ID, SKILL_CATEGORIES, getSkillCategoryId } from './skillCategories.js';

// Plain rounding to one decimal: equal counts always show equal percentages.
// The rounded weights may add up to 99.9 or 100.1.
function toPercent(part, total) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

/**
 * Groups the per-skill gap stats into categories.
 *
 * - totalMentions = sum of `count` over all skills (one mention = one skill missing in one
 *   application). This is the donut's whole.
 * - group.weight = group mentions / totalMentions, in percent (shares of one whole).
 *   Individual skill percentages are never summed - they share applications.
 * - group.skills keep the backend's per-application values (count of total_applications,
 *   percentage).
 * - Groups are sorted by weight (desc), then label; "Other" is always last.
 */
export function groupSkillGaps(stats) {
  const skills = stats?.skills ?? [];
  const totalMentions = skills.reduce((sum, skill) => sum + skill.count, 0);

  const byCategory = new Map();
  for (const skill of skills) {
    const categoryId = getSkillCategoryId(skill.name);
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, []);
    byCategory.get(categoryId).push(skill);
  }

  const groups = SKILL_CATEGORIES.filter((category) => byCategory.has(category.id))
    .map((category) => {
      const groupSkills = [...byCategory.get(category.id)].sort(
        (a, b) => b.count - a.count || a.name.localeCompare(b.name),
      );
      return {
        ...category,
        mentions: groupSkills.reduce((sum, skill) => sum + skill.count, 0),
        skills: groupSkills,
      };
    })
    .sort((a, b) => {
      if (a.id === OTHER_CATEGORY_ID) return 1;
      if (b.id === OTHER_CATEGORY_ID) return -1;
      return b.mentions - a.mentions || a.label.localeCompare(b.label);
    });

  return {
    totalMentions,
    totalApplications: stats?.total_applications ?? 0,
    excludedApplications: stats?.excluded_applications ?? 0,
    groups: groups.map((group) => ({
      ...group,
      weight: toPercent(group.mentions, totalMentions),
      share: totalMentions ? group.mentions / totalMentions : 0, // exact, for geometry
    })),
  };
}
