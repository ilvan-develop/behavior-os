/** Knowledge Memory — o que já aprendemos (MISSION-120 decisões)
 * Separado de Knowledge (graph) e Evidence (prova).
 */
export interface MemoryEntry {
  missionId: string;
  lesson: string;
  timestamp: string;
  tags: string[];
}

const store: MemoryEntry[] = [];

export function remember(entry: MemoryEntry): void {
  store.push(entry);
}

export function recall(missionId?: string): MemoryEntry[] {
  return missionId ? store.filter((m) => m.missionId === missionId) : [...store];
}

export function clearMemory(): void {
  store.length = 0;
}
