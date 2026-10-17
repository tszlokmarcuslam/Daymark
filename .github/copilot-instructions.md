# Daymark Study Planner

- Keep the app dependency-free and browser-only unless the user asks otherwise.
- Preserve device-local storage; do not add accounts, cloud sync, or upload course documents or student data.
- The PWA service worker may cache only static app-shell assets, never events, calendar feeds, or user responses.
- Keep study scheduling deterministic, editable, and clear when availability cannot fit all estimated work.
- Validate user-entered and imported timeline data; escape user-provided text before rendering HTML.
- Keep the interface responsive and accessible, with semantic controls and visible focus states.
- Verify JavaScript syntax with `node --check app.js` after changes.
