# OpenCode Instructions — behaviorOS

- Este projeto usa **AGENTS.md** na raiz (não CLAUDE.md).
- Agentes em `.opencode/agents/*.md`, skills em `.opencode/skills/*/SKILL.md`.
- Tools em `.opencode/tools/*.ts`, plugins em `.opencode/plugins/*.ts`.
- MCP Graphify declarado em `opencode.json` → `python -m graphify.serve graphify-out/graph.json`.
- Permissões em `opencode.json` + por agente; última regra vence.
- Comandos em `.opencode/commands/*.md` + `command` em opencode.json.
- Config merge: global `~/.config/opencode/opencode.json` + projeto. Reiniciar opencode após editar config.

Ver `AGENTS.md` para regra de ouro (evidência).
