export interface Coverage {
    architecture: number;
    domain: number;
    dependencies: number;
    documentation: number;
    tests: number;
    governance: number;
    global: number;
    pass: boolean;
}
export declare function computeCoverage(): Coverage;
