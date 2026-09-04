import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "behavior-os": path.resolve(__dirname, "src/index.ts"),
      "behavior-os/ports": path.resolve(__dirname, "src/domain/ports.ts"),
      "behavior-os/domain": path.resolve(__dirname, "src/domain/types.ts"),
      "behavior-os/workflow": path.resolve(__dirname, "src/workflow/engine.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // plugin-guard e plugin-intelligence compartilham o journal físico
    // behavior-os/runtime/gate-journal.jsonl — serializa arquivos (evita corrida)
    fileParallelism: false,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "lcov", "json", "html"],
      include: [
        "packages/governance/**/*.{ts,js}",
        "packages/observability/**/*.{ts,js}",
        "packages/control-plane/**/*.{ts,js}",
        "packages/mcp/**/*.{ts,js}",
        "packages/sdk/**/*.{ts,js}",
        "packages/knowledge/**/*.{ts,js}"
      ],
      exclude: [
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "node_modules/**",
        "dist/**",
        "graphify-out/**",
        ".opencode/**",
        "coverage/**"
      ],
      thresholds: {
        lines: 95,
        branches: 95,
        functions: 95,
        statements: 95
      },
      all: true,
      clean: true
    }
  },
});
