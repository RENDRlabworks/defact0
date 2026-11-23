# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:46cd31e7 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest unit tests (pure logic in src/lib)
npm run build      # typecheck + production build
```

## Architecture Overview

React + TypeScript + Vite. The canvas engine is our own code in `src/engine/` (no canvas library). The only runtime dependency besides React is `perfect-freehand` for pen strokes.

- `src/engine/` the canvas engine.
  - `types.ts` document model: shapes (`card`, `note`, `frame`, `draw`), assets, chat sessions. Plain JSON.
  - `Editor.ts` the engine API: immutable doc store, undo/redo (`run()` groups changes, `beginInteraction()`/`endInteraction()` for drags), selection, z-order, frames (children keep page coordinates, moving a frame moves them), camera, hit testing.
  - `geometry.ts` pure math: camera transforms, rotated-box hit tests, resize/rotate. Unit tested.
  - `interaction.ts` pointer/wheel/touch state machine (select, marquee, move, resize, rotate, pan, pinch, draw, note, frame).
  - `render/` DOM rendering: `Canvas` (world layer transformed by the camera), `ShapeViews` (memoized per shape), `Overlay` (screen-space selection handles and frame labels), `Minimap`.
  - `persistence.ts` / `assets.ts` IndexedDB for the doc and image blobs. `exportImage.ts` renders PNGs with canvas 2D.
  - `store.ts` tiny observable store + `useStore` hook; `react.tsx` context and `useEditor`/`useUi`/`useDoc`.
- `src/lib/` app logic. Pure and unit tested: `arrange.ts`, `search.ts`, `organize.ts`, `detect.ts`. Editor-bound: `canvas.ts`, `clipboard.ts` (paste/drop/copy), `arrangeActions.ts`, `similarity.ts`, `sessions.ts`, `exportImport.ts`, `boot.ts` (load + autosave), `uiState.ts` (panels, dialogs, toasts).
- `src/ui/` app chrome: `actions.ts` (single registry for shortcuts, menus and the shortcuts dialog), `Chrome.tsx` (toolbar, menus, context menu, zoom/minimap, toasts), panels, dialogs, preview modal.

## Conventions & Patterns

- Every shape has `tags`, `sessionId`, `createdAt` and `parentId` (frame). Shapes in frames keep page coordinates.
- Mutate through `Editor` methods only. Wrap multi-step changes in `editor.run()` so they undo as one step.
- New user commands go in `src/ui/actions.ts`; they get a shortcut, menu entries and a row in the shortcuts dialog automatically.
- Selectors passed to `useUi`/`useDoc` may return new arrays; results are compared shallowly.
- Keep pure logic free of DOM and editor imports so it stays testable under `vitest` in node.
- In dev, `window.editor` exposes the editor for debugging.
