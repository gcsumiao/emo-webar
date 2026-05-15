# AGENTS.md

## Project Context

This repo is a Vite + React WebAR prototype using A-Frame and MindAR image tracking.

The current implementation uses a static `public/assets/mindar/targets.mind` file and hard-coded target metadata in `src/ar/arTargets.js`.

The product direction is to evolve toward a Kivicube-like architecture:

- Cloud recognition determines which target/scene was detected.
- The frontend loads a scene manifest dynamically.
- MindAR remains responsible for local image tracking after a target is recognized.
- Do not try to build a full production cloud recognition backend in one step.

## Working Rules

- Prefer small, reviewable changes.
- Do not remove the existing EMO AR flow unless replacing it with a compatible path.
- Do not modify large binary assets unless explicitly required.
- Do not add new production dependencies unless necessary.
- Preserve the existing visual design and AR sprite behavior.
- Keep GitHub Pages / Vercel base-path compatibility through the existing `asset()` helper.
- After JavaScript changes, run `npm run build`.
- Add documentation for any new manifest/API contract.
