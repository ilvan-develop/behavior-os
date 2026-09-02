export interface KernelEvent { type: string; missionId: string; timestamp: string; [key: string]: unknown; }

const bus: KernelEvent[] = [];

export function emit(event: KernelEvent): void {
  bus.push(event);
}

export function getEvents(missionId?: string): KernelEvent[] {
  return missionId ? bus.filter((e) => e.missionId === missionId) : [...bus];
}

export function clearEvents(): void {
  bus.length = 0;
}
