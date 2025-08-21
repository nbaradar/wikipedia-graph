# Repository Guidelines

## Project Structure
- `index.html`: App shell and DOM structure.
- `styles.css`: UI styles, animations, and themes (light/dark).
- `script.js`: Core logic in `WikipediaGraphExplorer` (search, fetch, D3 graph, preview).
- `README.md`: User-facing overview and features.

## Develop & Run
- Local server (recommended for CORS):
  - Python: `python3 -m http.server 8080` then open `http://localhost:8080`.
  - Node (optional): `npx serve`.
- Open directly: double-click `index.html` (works, but some features may behave better via a server).

## Coding Style
- Indentation: 4 spaces; keep lines readable (<100 cols where practical).
- JavaScript: ES6+; class methods `camelCase`, classes `PascalCase` (e.g., `WikipediaGraphExplorer`).
- Files: lowercase, kebab-case for new assets (e.g., `graph-utils.js`).
- D3: prefer clear, chained selections; avoid magic numbers—group constants near usage.
- Comments: brief, purposeful; avoid inline TODOs without issue links.

## Testing Guidelines
- Framework: none; prioritize manual verification.
- Run flows: search, suggestions dropdown, graph render, node hover/click, article preview, theme toggle, resize behavior.
- Browsers: test Chrome/Firefox; confirm responsive layout on a small viewport/devices.
- Console/network: no errors; Wikipedia API requests include `origin=*` and handle non-200 responses.

## Commit & PR Guidelines
- Commits: imperative, concise, scoped. Examples:
  - `feat(graph): tune force layout and collisions`
  - `fix(ui): correct suggestions positioning on mobile`
  - `docs: clarify CORS notes in README`
- Pull Requests:
  - Description: what changed and why; user impact.
  - Evidence: before/after screenshot or short GIF for UI changes.
  - Testing: steps taken to verify; edge cases considered.
  - Link related issues; keep PRs small and focused.

## Security & Config
- No secrets in repo; only call public Wikipedia APIs.
- Respect CORS: keep `origin=*` where required; prefer running via a local server.
- Do not add third-party keys or proxies; if a proxy is needed for experimentation, use local env only and exclude from commits.

