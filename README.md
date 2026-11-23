# defact0

A local-first infinite canvas for the screenshots, diagrams, code snippets and other visual output that Claude Code produces during your chats. Built with React and TypeScript on a canvas engine written for this project.

Nothing leaves your browser: the canvas and every image are stored in IndexedDB.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Other scripts: `npm test` (unit tests), `npm run build` (typecheck and production build), `npm run preview`.

It's a static site, so `npm run build` produces a `dist/` folder you can host anywhere (Vercel, Netlify, Cloudflare Pages). No license key or server is needed.

## What you can do

**Canvas.** Pan with space+drag, middle-drag, the hand tool (H) or two-finger scroll; zoom with the mouse wheel, pinch, or the zoom controls. The minimap in the bottom-left shows the whole canvas; click or drag it to move around.

**Cards.** Drop images or code/text files from your desktop, paste screenshots and text with ⌘V, or insert files with ⌘U. Images become image cards; code files and pasted text become snippet cards with the language detected. A card can hold an image, text, or both. Select, move, resize (Shift keeps the aspect ratio) and rotate (Shift snaps to 15°) any shape.

**Preview and edit.** Double-click a card (or press Enter or P) to open a large preview where you can edit its title, notes or code, tags and chat session. Use ← and → to step through cards.

**Frames, notes, drawing.** Frame tool (F) or ⌘G to put the selection in a frame; drag a frame by its name to move everything in it, and double-click the name to rename it. Sticky notes (N) and freehand drawing (D) come with color and stroke options.

**Arrange.** After adding several items at once, a toast offers to arrange them in a grid or by visual similarity. The same commands are in the context menu and on shortcuts. Similarity compares a small color and layout fingerprint of each image and groups similar ones (k-means), with no ML model.

**Tags.** Shift+T tags the selection (for example "auth flow", "bug", "frontend", "API design"). Tags show on cards and work as search filters.

**Search.** ⌘K opens full-text search across card titles and snippets, sticky notes and frame names, with filters for tag, date range and chat session. Click a result to jump to it, or frame all the results.

**Chat sessions.** Group cards by the Claude Code conversation they came from. Create a session with a name and the session URL, assign cards with Shift+C, then jump back to the cards or open the chat from the Sessions panel (Shift+S). Sessions are listed as a timeline by day.

**AI organize.** Shift+I takes an instruction such as "group all the authentication related screenshots together", finds the matching items and moves them into a new frame. It currently runs a local keyword and synonym matcher (`src/lib/organize.ts`); `planOrganize()` is the place to swap in a real LLM call.

**Export.** ⌘⇧E exports the selection as a PNG; the download button exports the viewport when nothing is selected. ⌘⇧J exports the whole canvas as JSON with images inlined; import it again from the menu.

**Light or dark.** Dark by default; ⌘⇧L or the menu switches.

## Keyboard shortcuts

Press `?` in the app for the full list.

| Action | Shortcut |
| --- | --- |
| Select, hand, draw, note, frame tools | V, H, D, N, F |
| New snippet card | C |
| Insert images or files | ⌘U |
| Search | ⌘K |
| Sessions panel | Shift+S |
| Open / edit selected | P or Enter, or double-click |
| Tag selection | Shift+T |
| Assign to chat session | Shift+C |
| Arrange in grid | Shift+A |
| Arrange by similarity | Shift+M |
| Cluster into frames by similarity | Shift+Alt+M |
| Group into frame / remove frame | ⌘G / ⌘⇧G |
| AI organize | Shift+I |
| Undo / redo | ⌘Z / ⌘⇧Z |
| Duplicate, delete | ⌘D, ⌫ |
| Copy, cut, paste | ⌘C, ⌘X, ⌘V |
| Bring forward / send backward | ] / [ (Shift for front/back) |
| Zoom in / out / 100% / fit / selection | = / - / Shift+0 / Shift+1 / Shift+2 |
| Export selection as PNG | ⌘⇧E |
| Export canvas as JSON | ⌘⇧J |
| Toggle dark mode | ⌘⇧L |

## Project layout

```
src/
  engine/   the canvas engine: document model, editor API, geometry, interactions, rendering, storage
  lib/      app features: search, arrange, similarity, sessions, clipboard and drop, export
  ui/       toolbar, menus, panels, dialogs, preview modal, shortcut registry
```
