const STATUS_NODE_PATHS = {
  no_answer: [3],
  rejected: [2],
  interviewing: [1, 8],
  no_offer: [1, 5],
  offer: [1, 4, 9],
  accepted: [1, 4, 6],
  declined: [1, 4, 7],
};

const CHIP_BY_NODE = {
  1: { label: 'Interview', variant: 'interview' },
  2: { label: 'Rejected', variant: 'rejected' },
  3: { label: 'No answer', variant: 'neutral' },
  4: { label: 'Offer', variant: 'offer' },
  5: { label: 'No offer', variant: 'negative' },
  6: { label: 'Accepted ✓', variant: 'accepted' },
  7: { label: 'Declined', variant: 'declined' },
  8: { label: 'In progress ⏳', variant: 'neutral' },
  9: { label: 'In progress ⏳', variant: 'neutral' },
};

export function getTimelineStages(status) {
  const nodes = STATUS_NODE_PATHS[status] ?? [];
  return nodes.map((node) => CHIP_BY_NODE[node]).filter(Boolean);
}

export function shouldShowInTimeline(status) {
  if (status === 'no_offer') return false;
  const nodes = STATUS_NODE_PATHS[status] ?? [];
  return nodes.includes(1);
}

export function hasReachedInterview(status) {
  const nodes = STATUS_NODE_PATHS[status] ?? [];
  return nodes.includes(1);
}
