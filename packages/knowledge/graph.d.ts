export declare function knowledgeGraphSummary(): {
    provider: "graphify";
    functional: boolean;
    nodeCount: number | undefined;
    freshness: "fresh" | "stale" | "missing" | undefined;
    provenance: readonly ["EXTRACTED", "INFERRED", "AMBIGUOUS"];
};
