# Policy as Code — OPA/Rego style (LEARN-04)
# high risk → security-audit obrigatório, low risk → warn
package behavioros.governance

default allow = false
default action = "block"

allow if {
  input.risk != "high"
}

allow if {
  input.risk == "high"
  input.workflowId == "security-audit"
}

allow if {
  input.risk == "high"
  input.workflowId == "incident"
}

deny contains msg if {
  input.risk == "high"
  not allow
  msg := sprintf("high risk mission requires security-audit or incident workflow, got %v", [input.workflowId])
}

# audit log imutável (hash chain) — ideia #2 do brainstorm
# audit.log -> behavior-os/runtime/audit.log
