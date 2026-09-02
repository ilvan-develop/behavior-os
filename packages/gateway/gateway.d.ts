export interface GatewayDecision {
    allowed: boolean;
    reason: string;
    evidence?: string;
}
export declare function canExecute(tool: string, agent: string, workflowId: string): GatewayDecision;
