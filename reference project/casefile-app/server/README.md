# Casefile — Server (Next.js: API + Web)

## Setup

```bash
npm install
npm run dev
```

Opens at http://localhost:3000.

Data is stored in `data/db.json`, created automatically on first write.
Delete that file to reset to an empty state.

## API

All routes return/accept JSON and have permissive CORS enabled (for the
mobile app, which calls from a different origin).

| Method | Path                                   | Purpose                     |
|--------|-----------------------------------------|------------------------------|
| GET    | `/api/applications`                     | list all applications        |
| POST   | `/api/applications`                     | create an application        |
| GET    | `/api/applications/:id`                 | get one application          |
| PATCH  | `/api/applications/:id`                 | update fields on it          |
| DELETE | `/api/applications/:id`                 | delete it                    |
| POST   | `/api/applications/:id/communications`  | log a communication entry    |
| GET    | `/api/resume`                           | get the master resume text   |
| PUT    | `/api/resume`                           | set the master resume text   |
| GET    | `/api/stats`                            | totals + counts per stage    |

## Pages

- `/` — Case Board (kanban, drag-and-drop between stages)
- `/resume` — Master Resume editor
- `/reminders` — Follow-ups due/overdue

## Swapping in a real database

Everything reads/writes exclusively through the functions in `lib/db.js`.
To move to Postgres: add Prisma, define a schema matching the shape in that
file's comments, and reimplement each exported function — no changes needed
in `app/api/*` or the frontend.
