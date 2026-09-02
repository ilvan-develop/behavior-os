/** Planner — v3.0 Universal Team Composition
 * Escolhe equipa dinâmica baseada em capabilities, não em workflow fixo.
 * Prova que Behavior OS pode orquestrar qualquer equipa (3-10 agents) sem mudar Kernel.
 */
export interface AgentCap {
    id: string;
    capabilities: string[];
    level: number;
}
export declare function planTeam(objective: string, requiredCapabilities?: string[]): string[];
export declare function listAgents(): AgentCap[];
