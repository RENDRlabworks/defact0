# defact0

A local-first infinite canvas for the screenshots, diagrams, code snippets and other visual output that Claude Code produces during your chats. Built with React, TypeScript and [tldraw](https://tldraw.dev).

Nothing leaves your browser: the canvas and every image are stored in IndexedDB.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Other scripts: `npm test` (unit tests), `npm run build` (typecheck and production build), `npm run preview`.

tldraw runs without a license on `localhost`. To host it anywhere else, get a tldraw license key and set `VITE_TLDRAW_LICENSE_KEY` in a `.env` file.

## What you can do

**Canvas.** Pan with space+drag, the hand tool, or the trackpad; zoom with the wheel or pinch. A minimap sits in the bottom-left corner.

**Cards.** Drop images or code/text files from your desktop, or paste screenshots and text with ⌘V. Images become image cards; code files and pasted text become snippet cards, with the language detected automatically. A card can hold an image, text, or both. Cards move, resize and rotate like any tldraw shape.

**Preview and edit.** Double-click a card (or press Enter or P) to open a large preview where you can edit its title, notes or code, tags and chat session. Use ← and → to step through cards.

**Frames, notes, drawing.** tldraw's own tools: frame (F, or ⌘⌥G to frame the selection), sticky note (N), draw (D), text (T), arrows (A).

**Arrange.** After dropping several items at once, a toast offers to arrange them in a grid or by visual similarity. You can do the same for any selection from the context menu or with shortcuts. Similarity uses a small color and layout fingerprint of each image and k-means clustering, so no ML model is needed.

**Tags.** Shift+T tags the selection (for example "auth flow", "bug", "frontend", "API design"). Tags show on cards and work as search filters.

**Search.** ⌘K opens full-text search across card titles and snippets, sticky notes, text and frame names, with filters for tag, date range and chat session. Click a result to jump to it, or frame all the results.

**Chat sessions.** Group cards by the Claude Code conversation they came from. Create a session with a name and the session URL, assign cards with Shift+C, then jump back to the cards or open the chat from the Sessions panel (Shift+S). Sessions are listed as a timeline by day.

**AI organize.** Shift+I takes an instruction such as "group all the authentication related screenshots together", finds the matching items and moves them into a new frame. It currently runs a local keyword and synonym matcher (`src/lib/organize.ts`); `planOrganize()` is the place to swap in a real LLM call.

**Export.** ⌘⇧E exports the selection as a PNG; the download button exports the viewport when nothing is selected. ⌘⇧J exports the whole canvas as JSON with images inlined. Import it again from the main menu under Export.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Search | ⌘K |
| Sessions panel | Shift+S |
| New snippet card | C |
| Preview selected card | P, Enter, or double-click |
| Tag selection | Shift+T |
| Assign to chat session | Shift+C |
| Arrange in grid | Shift+A |
| Arrange by similarity | Shift+M |
| Cluster into frames by similarity | Shift+Alt+M |
| AI organize | Shift+I |
| Export selection as PNG | ⌘⇧E |
| Export canvas as JSON | ⌘⇧J |
| Delete, duplicate, group, frame selection | ⌫, ⌘D, ⌘G, ⌘⌥G |

Press ⌘/ for the full list, tldraw's own shortcuts included.

## Project layout

```
src/
  shapes/   the custom "card" shape
  lib/      search, arrange, similarity, sessions, drop/paste handling, export
  ui/       panels, dialogs, preview modal, tldraw menu and shortcut overrides
```
