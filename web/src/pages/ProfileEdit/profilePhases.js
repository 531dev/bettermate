export function getProfilePhases(data) {
  return Array.isArray(data?.phases) ? data.phases : [];
}

export function updatePhaseAt(phases, index, value) {
  const next = [...phases];
  next[index] = value;
  return next;
}

export function removePhaseAt(phases, index) {
  return phases.filter((_, i) => i !== index);
}

// Swaps a phase with its neighbour: `offset` -1 moves it earlier, 1 later. Out of range is no move.
export function movePhaseAt(phases, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= phases.length) return phases;
  const next = [...phases];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
