Project: Personal PixiJS slot demo
Tech: TypeScript + PixiJS (frontend) + Express + PostgreSQL (backend)

Structure:
- frontend/ — Vite + PixiJS client (deploy: Vercel)
- backend/ — Express API server (deploy: Koyeb)
- shared/ — Shared types between frontend and backend

Local dev:
- Frontend: cd frontend && npm run dev
- Backend: cd backend && npm run dev (requires DATABASE_URL env var)
- Backend env vars: DATABASE_URL, JWT_SECRET, PORT, CORS_ORIGIN

General:
- Prefer simple and maintainable solutions.
- Keep the codebase easy to read and modify.
- Small, focused functions.

TypeScript:
- Use strict typing.
- Avoid "any" except for tests or very specific cases.

Naming conventions:
- camelCase for functions and variables.
- _camelCase for private variables.
- kebab-case for file names.
- PascalCase for classes and Pixi objects.
- Boolean prefixes: should, has, is.
- UPPERCASE for constants.

Git:
- Commits must never include "Claude" or "Co-Authored-By: Claude" in the message. Only the real author should appear.

PixiJS:
- Prioritize real-time performance.
- Avoid creating objects inside the game loop.
- Reuse sprites and containers.
- Separate game logic from rendering.
