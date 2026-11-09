/**
 * Skill gap categories - edit this file to regroup skills.
 *
 * - SKILL_CATEGORIES: the categories, in colour-slot order. Each one's colour is the CSS
 *   variable `--skill-cat-<slot>` from theme.css (light and dark values). The slot order
 *   was checked for colour-blind separation, so keep a category's slot when reordering.
 * - SKILL_TO_CATEGORY: skill name (lower case) -> category id. Wins over prefix rules.
 * - PREFIX_RULES: fallbacks for names not in the map, e.g. any "Azure ..." -> Azure.
 * - Anything else lands in "Other" automatically.
 *
 * Rule of thumb: a service of one cloud provider goes to that provider's category
 * (GKE -> GCP, Azure Data Factory -> Azure). Exception: Azure DevOps -> CI/CD.
 */

export const OTHER_CATEGORY_ID = 'other';

export const SKILL_CATEGORIES = [
  { id: 'aws', label: 'AWS', icon: 'cloud', slot: 1 },
  { id: 'data', label: 'Data Engineering & Databases', icon: 'database', slot: 2 },
  { id: 'endpoint', label: 'Endpoint & IT Administration', icon: 'laptop', slot: 3 },
  { id: 'languages', label: 'Languages & Frameworks', icon: 'code', slot: 4 },
  { id: 'cicd', label: 'CI/CD & Automation', icon: 'pipeline', slot: 5 },
  { id: 'azure', label: 'Azure', icon: 'cloud', slot: 6 },
  { id: 'containers', label: 'Containers & Orchestration', icon: 'box', slot: 7 },
  { id: 'security', label: 'Security & Identity', icon: 'shield', slot: 8 },
  { id: 'gcp', label: 'GCP', icon: 'cloud', slot: 9 },
  { id: 'ml', label: 'ML / AI', icon: 'spark', slot: 10 },
  { id: 'observability', label: 'Observability', icon: 'pulse', slot: 11 },
  { id: OTHER_CATEGORY_ID, label: 'Other', icon: 'grid', slot: 'other' },
];

const CATEGORY_SKILLS = {
  aws: ['AWS', 'AWS CloudWatch', 'AWS Lambda', 'Amazon S3', 'S3', 'EC2', 'Amazon RDS', 'Redshift'],
  data: [
    'Airflow', 'Pandas', 'NumPy', 'dbt', 'Databricks', 'Power BI', 'MongoDB', 'NoSQL',
    'Cassandra', 'ClickHouse', 'CockroachDB', 'FoundationDB', 'SQL', 'PostgreSQL', 'MySQL',
    'Snowflake', 'Spark', 'Apache Spark', 'Kafka', 'Apache Kafka', 'Redis', 'Elasticsearch',
    'Tableau',
  ],
  endpoint: [
    'macOS administration', 'MDM', 'Microsoft Intune', 'Intune', 'VMware', 'Jamf',
    'Google Workspace administration', 'Microsoft 365', 'VDI', 'Windows Server',
  ],
  languages: [
    'Java', '.NET', 'C#', 'Django', 'Rust', 'GraphQL', 'Python', 'Go', 'JavaScript',
    'TypeScript', 'Node.js', 'React', 'C++', 'Kotlin', 'Scala', 'Ruby', 'PHP',
  ],
  cicd: [
    'GitHub Actions', 'Argo CD', 'Bitbucket Pipelines', 'Bazel', 'AWX', 'Azure DevOps',
    'Jenkins', 'GitLab CI', 'CI/CD', 'Terraform', 'Ansible',
  ],
  azure: [
    'Azure', 'Azure App Service', 'Azure Application Gateway', 'Azure Data Factory',
    'Azure Data Lake Storage', 'Azure Monitor', 'Azure networking', 'Azure SQL',
    'Azure Synapse', 'Bicep',
  ],
  containers: [
    'Kubernetes production', 'Kubernetes', 'Docker', 'Helm', 'Harbor', 'Portainer',
    'Service mesh', 'Istio', 'OpenShift',
  ],
  security: [
    'Entra ID', 'Okta', 'SSO', 'PKI', 'HashiCorp Vault', 'Microsoft Purview',
    'SOC 2 / ISO 27001', 'Active Directory', 'IAM',
  ],
  gcp: ['GCP', 'GKE', 'BigQuery'],
  ml: ['Machine Learning', 'PyTorch', 'Scikit-learn', 'LangGraph', 'TensorFlow', 'LLMs', 'AI'],
  observability: ['Datadog', 'OpenTelemetry', 'PagerDuty', 'Prometheus', 'Grafana', 'Splunk'],
  // Listed for clarity only - unmapped skills go to Other anyway.
  [OTHER_CATEGORY_ID]: [
    'Network engineering', 'Cloudflare', 'Jira', 'Cloud cost optimisation',
    'Charles River OMS', 'VFX render pipelines',
  ],
};

const PREFIX_RULES = [
  ['aws ', 'aws'],
  ['amazon ', 'aws'],
  ['azure ', 'azure'],
  ['google cloud', 'gcp'],
  ['gcp ', 'gcp'],
];

function toKey(name) {
  return String(name).trim().replace(/\s+/g, ' ').toLowerCase();
}

export const SKILL_TO_CATEGORY = Object.fromEntries(
  Object.entries(CATEGORY_SKILLS).flatMap(([categoryId, names]) =>
    names.map((name) => [toKey(name), categoryId]),
  ),
);

export function getSkillCategoryId(skillName) {
  const key = toKey(skillName);
  if (SKILL_TO_CATEGORY[key]) return SKILL_TO_CATEGORY[key];
  const rule = PREFIX_RULES.find(([prefix]) => key.startsWith(prefix));
  return rule ? rule[1] : OTHER_CATEGORY_ID;
}

export function categoryColorVar(category) {
  return `var(--skill-cat-${category.slot})`;
}
