# Worktree Colors Theme 3000

A VS Code extension that automatically assigns unique color themes to different git worktree directories, so you can visually distinguish between multiple worktree windows at a glance.

## How it Works

When you open a workspace inside a git worktree, the extension:

1. Detects the worktree path
2. Generates a deterministic color based on that path
3. Applies the color to your title bar, activity bar, and status bar

Same worktree = same color, every time. No configuration needed.

## Features

- Automatic worktree detection via git
- Deterministic color assignment (consistent across sessions)
- Dark and light theme awareness
- Configurable saturation, lightness, and color targets
- Commands to refresh, reset, or randomize colors
- Zero dependencies, no files written to your repo

## Development

See [TECH_DESIGN.md](./TECH_DESIGN.md) for the full technical design.

```bash
npm install
npm run compile
# Press F5 in VS Code to launch Extension Development Host
```

## License

MIT
