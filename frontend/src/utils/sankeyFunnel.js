/** Имена всех возможных узлов воронки. Индекс узла используется в SANKEY_LINKS. */
export const SANKEY_NODES = [
  'Applications',   // 0 — вход: все заявки
  'Interviews',     // 1 — идёт интервью
  'Rejected',       // 2 — отказ без интервью
  'Ghosted',        // 3 — отправлено, ответа нет (no_answer)
  'Offers',         // 4 — получен оффер
  'No Offer',       // 5 — после интервью без оффера
  'Accepted',       // 6 — оффер принят
  'Declined',       // 7 — оффер отклонён
  'In progress',    // 8 — интервью в процессе
  'Open offer',     // 9 — оффер ещё не закрыт (ожидание решения)
];

/** Цвет каждого узла (порядок совпадает с SANKEY_NODES). */
export const SANKEY_NODE_COLORS = [
  '#b0b0b0',
  '#64E864',
  '#f5a962',
  '#E68192',
  '#6ec4be',
  '#e8878f',
  '#7cb87c',
  '#e8c547',
  '#42DB42',
  '#7ecfb8',
];

/** Все допустимые рёбра графа воронки: [индекс источника, индекс цели]. */
const SANKEY_LINKS = [
  [0, 1], // Applications → Interviews
  [0, 2], // Applications → Rejected
  [0, 3], // Applications → Applied
  [1, 4], // Interviews → Offers
  [1, 5], // Interviews → No Offer
  [1, 8], // Interviews → In progress
  [4, 6], // Offers → Accepted
  [4, 7], // Offers → Declined
  [4, 9], // Offers → Open offer
];

/**
 * «Дорожка» узла внутри колонки (сверху вниз). Меньше lane → выше узел.
 * Успешный путь сверху, отказы снизу, промежуточные — посередине.
 */
const NODE_LANE = {
  0: 1,             // Applications
  1: 0, 3: 1, 2: 2, // col 1: Interviews / Applied / Rejected
  4: 0, 8: 1, 5: 2, // col 2: Offers / In progress / No Offer
  6: 0, 9: 1, 7: 2, // col 3: Accepted / Open offer / Declined
};

/** X-координата для каждой колонки (стадии). */
const X_BY_COLUMN = { 0: 0.02, 1: 0.33, 2: 0.64, 3: 0.95 };

// Вертикальные границы раскладки.
const Y_MIN = 0.06;
const Y_MAX = 0.94;

/** Колонка (глубина) каждого узла, вычисленная из графа. */
function computeNodeColumns(links) {
  const column = {};
  const hasIncoming = new Set(links.map(([, target]) => target));
  for (const [source] of links) {
    if (!hasIncoming.has(source)) column[source] = 0;
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [source, target] of links) {
      const sourceColumn = column[source] ?? 0;
      if ((column[target] ?? -1) < sourceColumn + 1) {
        column[target] = sourceColumn + 1;
        changed = true;
      }
    }
  }
  return column; // { 0:0, 1:1, 2:1, 3:1, 4:2, 5:2, 8:2, 6:3, 7:3, 9:3 }
}

const NODE_COLUMN = computeNodeColumns(SANKEY_LINKS);

/** Путь заявки по воронке в зависимости от status в БД. */
const STATUS_PATHS = {
  no_answer: [[0, 3]],
  rejected: [[0, 2]],
  interviewing: [[0, 1], [1, 8]],
  no_offer: [[0, 1], [1, 5]],
  offer: [[0, 1], [1, 4], [4, 9]],
  accepted: [[0, 1], [1, 4], [4, 6]],
  declined: [[0, 1], [1, 4], [4, 7]],
};

function linkKey(source, target) {
  return `${source}-${target}`;
}

function hexToRgba(hex, alpha) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function round4(value) {
  return Number(value.toFixed(4));
}

/**
 * Координаты x/y только для активных узлов.
 * @param {Set<number>} activeNodes
 * @returns {{ x: Record<number, number>, y: Record<number, number>, activeColumns: number[] }}
 */
function positionsForActive(activeNodes) {
  const activeColumns = [
    ...new Set([...activeNodes].map((node) => NODE_COLUMN[node])),
  ].sort((a, b) => a - b);

  const x = {};
  const y = {};

  for (const node of activeNodes) {
    x[node] = X_BY_COLUMN[NODE_COLUMN[node]] ?? 0.5;
  }

  for (const column of activeColumns) {
    const inColumn = [...activeNodes]
      .filter((node) => NODE_COLUMN[node] === column)
      .sort((a, b) => (NODE_LANE[a] ?? 99) - (NODE_LANE[b] ?? 99));

    inColumn.forEach((node, position) => {
      const t = (position + 0.5) / inColumn.length;
      y[node] = round4(Y_MIN + (Y_MAX - Y_MIN) * t);
    });
  }

  return { x, y, activeColumns };
}

export function computeSankeyHeight({ activeNodeCount, activeStageCount, totalApplications }) {
  const height =
    220 +
    activeNodeCount * 26 +
    activeStageCount * 16 +
    Math.min(totalApplications, 20) * 5;

  return Math.max(320, Math.min(400, Math.round(height)));
}

/**
 * Главная функция: массив заявок → объект для компонента FunnelSankey.
 */
export function buildSankeyFunnel(applications) {
  // --- 1. Подсчёт потоков по каждому ребру ---
  const counts = new Map(
    SANKEY_LINKS.map(([source, target]) => [linkKey(source, target), 0]),
  );

  for (const application of applications) {
    const path = STATUS_PATHS[application.status] ?? [];
    for (const [source, target] of path) {
      const key = linkKey(source, target);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // --- 2. Ненулевые рёбра (в старых индексах узлов) ---
  const rawSource = [];
  const rawTarget = [];
  const value = [];

  for (const [linkSource, linkTarget] of SANKEY_LINKS) {
    const count = counts.get(linkKey(linkSource, linkTarget)) ?? 0;
    if (count > 0) {
      rawSource.push(linkSource);
      rawTarget.push(linkTarget);
      value.push(count);
    }
  }

  // --- 3. Активные узлы + перенумерация (старый индекс → новый) ---
  const activeNodes = new Set([...rawSource, ...rawTarget]);
  const activeList = [...activeNodes].sort((a, b) => a - b);
  const remap = new Map(activeList.map((original, newIndex) => [original, newIndex]));

  const { x, y, activeColumns } = positionsForActive(activeNodes);

  // --- 4. Узлы и ссылки строим ТОЛЬКО для активных узлов ---
  const node = {
    pad: 14,
    thickness: 18,
    line: { color: 'transparent', width: 0 },
    label: activeList.map((index) => SANKEY_NODES[index]),
    color: activeList.map((index) => SANKEY_NODE_COLORS[index]),
    x: activeList.map((index) => x[index]),
    y: activeList.map((index) => y[index]),
  };

  const link = {
    source: rawSource.map((index) => remap.get(index)),
    target: rawTarget.map((index) => remap.get(index)),
    value,
    color: rawTarget.map((index) => hexToRgba(SANKEY_NODE_COLORS[index], 0.45)),
  };

  console.log('=============NEW STAGE=========');
  console.table(
    activeList.map((index, newIndex) => ({
      newIndex,
      label: SANKEY_NODES[index],
      column: NODE_COLUMN[index],
      lane: NODE_LANE[index],
      x: x[index],
      y: y[index],
    })),
  );

  const chartHeight = computeSankeyHeight({
    activeNodeCount: activeList.length,
    activeStageCount: activeColumns.length,
    totalApplications: applications.length,
  });

  return {
    hasFlows: value.length > 0,
    total: applications.length,
    activeStages: activeColumns,
    activeNodeCount: activeList.length,
    chartHeight,
    nodeX: node.x,
    nodeY: node.y,
    trace: {
      type: 'sankey',
      orientation: 'h',
      arrangement: 'freedom',
      node,
      link,
    },
  };
}