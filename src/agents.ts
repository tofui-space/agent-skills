import type { AgentDefinition, AgentId } from './types.ts'

/**
 * Skills are portable: both agents read `<config>/skills/<name>/SKILL.md`.
 * Prose rules are not. Claude Code loads `<config>/rules/**.md` directly and
 * honors `paths:` frontmatter. Codex has no equivalent — its `rules/`
 * directory holds a sandbox approval DSL (`prefix_rule(...)`), not
 * instructions — so rules reach Codex through an AGENTS.md block instead.
 */
export const AGENTS: Record<AgentId, AgentDefinition> = {
  claude: {
    id: 'claude',
    label: 'Claude Code',
    homeEnv: 'CLAUDE_CONFIG_DIR',
    configDir: '.claude',
    ruleDelivery: 'files',
  },
  codex: {
    id: 'codex',
    label: 'Codex',
    homeEnv: 'CODEX_HOME',
    configDir: '.codex',
    ruleDelivery: 'agents-md',
  },
}

export const AGENT_IDS = Object.keys(AGENTS) as AgentId[]

export function isAgentId(value: string): value is AgentId {
  return Object.hasOwn(AGENTS, value)
}

/**
 * Parses `--agent` values: a comma-separated list, or `all`.
 * Defaults to Claude Code so existing invocations keep their behavior.
 */
export function parseAgents(value: string | undefined): AgentDefinition[] {
  if (value === undefined) return [AGENTS.claude]

  const requested = value
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0)

  if (requested.includes('all')) return AGENT_IDS.map((id) => AGENTS[id])

  const unknown = requested.filter((part) => !isAgentId(part))
  if (unknown.length > 0) {
    throw new Error(
      `Unknown agent: ${unknown.join(', ')}. Known agents: ${AGENT_IDS.join(', ')}, all.`,
    )
  }

  const seen = new Set<AgentId>()
  const chosen: AgentDefinition[] = []
  for (const part of requested) {
    if (!isAgentId(part) || seen.has(part)) continue
    seen.add(part)
    chosen.push(AGENTS[part])
  }
  return chosen
}
