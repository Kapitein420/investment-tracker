# Context budget — why `.claude/settings.json` disables 40 plugins

Every session on this repo loaded 41 bundled plugins before anything was typed:
~90 MCP servers, ~400 skill descriptions, and the session-start instruction
blocks some of them inject. That cost is paid on every turn, not once, and none
of it is specific to this project.

`enabledPlugins` in [`.claude/settings.json`](../.claude/settings.json) turns 40
of them off. It is committed rather than local-only so cloud sessions and the
second PC — which read the repo file, not `~/.claude` — get the same trim.

## How the list was chosen

From `pluginUsage` in `~/.claude.json`, not judgement. 34 of 41 plugins sit at
`usageCount: 0`. The three highest counts are **not** use: the counter
increments when a plugin *loads*, so `carta-investors` (2005) scores on
session-start injection and `cockroachdb` (5370) scores while its MCP servers
fail to connect. `skillUsage` is the honest table, because a skill only
increments when it is actually invoked.

`anthropic-skills@inline` is the one plugin kept — the only one with deliberate
invocations on record, and the source of the docx/pptx/xlsx/pdf and
skill-creator paths.

The full evidence, including the counter-lies-about-use finding, lives in
`agent-hq/docs/CONTEXT-BUDGET.md`. This repo's copy is the same decision applied
to the same machine-wide plugin set.

## Restoring one

One line, then restart the session — the setting only applies at session start:

```json
"figma@inline": true
```

Claude Code's own bundled skills are not plugins and are untouched
(`code-review`, `simplify`, `artifact-design`, `schedule`, `loop`). Do not set
`disableBundledSkills`.
