import { proposeEvolution } from "../dna/evolution.js";
import { computeCoverage } from "../verification/coverage.js";
export interface SelfEvolutionDiscovery {
    missionId: string;
    gaps: string[];
    proposals: ReturnType<typeof proposeEvolution>[];
    coverage: ReturnType<typeof computeCoverage>;
}
export declare function discoverSelfEvolution(missionId?: string): SelfEvolutionDiscovery;
