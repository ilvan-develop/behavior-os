---
description: Build or update the Graphify knowledge graph
---

Run Graphify to produce `graphify-out/graph.json`. Inside TUI: `/graphify .` or from shell: `graphify .`. For incremental: `/graphify . --update`. After, verify with `graphify query "show auth flow" --graph graphify-out/graph.json`. The MCP server `python -m graphify.serve graphify-out/graph.json` then becomes functional.
