# Security Policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub's private vulnerability reporting](https://github.com/1tomye/agent-agency/security/advisories/new).
Do not open a public issue for security problems.

## Scope

Agent Agency reads Claude Code session transcripts, can install hook entries into
`~/.claude/settings.json` (only after you consent), and runs a local HTTP/WebSocket server bound to
`127.0.0.1` by default. Issues in any of those areas are in scope, as is anything that could expose
the standalone server's access token.
