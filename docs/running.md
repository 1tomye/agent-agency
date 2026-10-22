# Running Agent Agency

Agent Agency runs in two ways from the same build:

- **In VS Code**, as a panel next to the terminal (an extension you install from a `.vsix` file).
- **In a browser**, as a small local server (`node dist/cli.js`). No VS Code needed.

## What you need

- **Claude Code**, installed and signed in, with `claude` working in a new terminal
  (`npm install -g @anthropic-ai/claude-code`).
- **Node.js 22** (20 or newer works) and npm.
- **Git**.
- **VS Code 1.105 or newer**, only for the VS Code version.
- **Python 3.9+**, only if you want to regenerate the art.

Windows, macOS and Linux all work.

## 1. Get the code and build it

```sh
git clone https://github.com/1tomye/agent-agency.git
cd agent-agency
npm ci
npm run vsix
```

`npm run vsix` builds everything into `dist/` and packages it as `agent-agency.vsix`. It takes a
minute or two.

## 2a. Run it in VS Code

Install the package:

```sh
code --install-extension agent-agency.vsix
```

On Windows, if `code` isn't found, use the full path:

```powershell
& "C:\Program Files\Microsoft VS Code\bin\code" --install-extension agent-agency.vsix
```

You can also install it from VS Code itself: Extensions view → `...` menu → **Install from VSIX...**

Then:

1. Reload VS Code (Command Palette → **Developer: Reload Window**).
2. Open the **Agent Agency** tab in the bottom panel, next to Terminal. Or use Command Palette →
   **Agent Agency: Show Panel**.
3. Click **+ Agent**. Claude Code starts in a new terminal in your workspace folder, and a new
   member of staff walks to a desk.

Claude Code sessions you start yourself in that workspace show up too. To see sessions from every
project, turn on **Settings → Watch All Sessions**.

Two VS Code settings (search for "Agent Agency" in Settings):

| Setting                       | Default | What it does                                                       |
| ----------------------------- | ------- | ------------------------------------------------------------------ |
| `agent-agency.autoShowPanel`  | off     | Open the panel when VS Code starts                                 |
| `agent-agency.autoSpawnAgent` | off     | Start a Claude Code agent when VS Code starts, if none are running |

## 2b. Run it in a browser

Start the server **from the project folder whose Claude Code sessions you want to watch**:

```sh
cd path/to/your-project
node path/to/agent-agency/dist/cli.js --port 3200
```

It prints a URL like `http://127.0.0.1:3200/?token=...`. Open that URL in your browser.

- **With the token** you have full control: **+ Agent** launches Claude Code in a terminal built
  into the page.
- **Without the token** (just `http://127.0.0.1:3200/`) the page is watch-only.
- The token is saved in `~/.pixel-agents/standalone-token`, so the URL stays the same across
  restarts. Treat it like a password: anyone with it can type into your agents' terminals.

Stop the server with `Ctrl+C`.

Options (`node dist/cli.js --help`):

| Option                  | What it does                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `--port <n>`, `-p <n>`  | Port to listen on (default: any free port)                                                |
| `--host <name>`         | Address to bind to (default: `127.0.0.1`, this computer only)                             |
| `--allowed-host <name>` | Also accept the tokened URL at this host name, such as a Tailscale Serve name. Repeatable |
| `--rotate-token`        | Make a new token. Old URLs and bookmarks stop working                                     |
| `--no-terminal`         | Watch only: no launching or terminals from the browser                                    |

To open the office from a phone or another computer, the safest route is a private network tool
such as Tailscale Serve plus `--allowed-host`. Avoid exposing the server to a network you don't
trust.

## First run: instant detection (hooks)

The first time it runs, Agent Agency asks before adding a few hook entries to
`~/.claude/settings.json`. It backs the file up first. Hooks let the office react the moment an
agent starts a tool, finishes or needs your approval.

If you decline, everything still works: the office reads Claude Code's session transcripts
instead, which is a little slower. You can change your mind any time in **Settings → Instant
Detection (Hooks)**. Uninstalling the VS Code extension removes its hook entries.

## In the office

- **+ Agent** starts a new Claude Code agent.
- **Layout** opens the office editor: move furniture and paint floors and walls. Your layout is
  saved to `~/.pixel-agents/agent-agency-layout.json`.
- **Settings**: sound notifications, labels, hooks, watch-all-sessions and more.
- **+ / −** zoom in and out; the button under them switches to fullscreen.

Working agents sit at a desk and their screen lights up. Idle agents wander off to the break room,
the party room or the basketball court. The boss is always around.

## Updating

```sh
cd agent-agency
git pull
npm ci
npm run vsix
code --install-extension agent-agency.vsix --force
```

Then reload VS Code. For the browser version, restart the server.

## Uninstalling

- **VS Code:** uninstall **Agent Agency** from the Extensions view. Its hook entries are removed.
- **Browser version:** stop the server. To remove hooks it installed, turn off **Settings →
  Instant Detection (Hooks)** first.
- Settings and your layout stay in `~/.pixel-agents/`. That folder is shared with Pixel Agents, so
  delete only `agent-agency-layout.json` if you also use Pixel Agents.

## Troubleshooting

| Problem                                               | Fix                                                                                                                                    |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| The office is empty                                   | Click **+ Agent**, or start `claude` in the workspace folder. For sessions in other folders, turn on **Settings → Watch All Sessions** |
| `claude: command not found`                           | Install Claude Code, then open a new terminal so `claude` is on your PATH                                                              |
| `code: command not found`                             | Use VS Code's full path (above) or **Install from VSIX...**                                                                            |
| Port already in use                                   | Pick another `--port`, or leave it out to get a free port                                                                              |
| Browser shows the office but **+ Agent** does nothing | Open the URL with `?token=...`, and check the server log says "Terminal enabled". If not, run `npm ci` again                           |
| Changes don't show after updating                     | Reinstall with `--force` and reload the VS Code window                                                                                 |

## Working on Agent Agency

Open the repository in VS Code and press **F5** (**Run Extension**). It builds in watch mode and
opens a second VS Code window with your working copy of the extension loaded. See
[CONTRIBUTING.md](../CONTRIBUTING.md) for the checks to run and the README for regenerating the
art.
