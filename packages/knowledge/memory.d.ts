/** Knowledge Memory — o que já aprendemos (MISSION-120 decisões)
 * Separado de Knowledge (graph) e Evidence (prova).
 */
export interface MemoryEntry {
    missionId: string;
    lesson: string;
    timestamp: string;
    tags: string[];
}
export declare function remember(entry: MemoryEntry): void;
export declare function recall(missionId?: string): MemoryEntry[];
export declare function clearMemory(): void;
