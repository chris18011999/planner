# planner

A view of Markdown Notes and the Todos inside them. The Notes live in Postgres.

## Development

1. Copy `.env.example` to `.env.local` and set the values.
2. `npm run db:up` starts a local Postgres with Docker.
3. `npm run db:migrate` runs the migrations and creates the User of `OWNER_EMAIL`.
4. `npm run dev` starts the app on `127.0.0.1:3000`.

`npm test` needs the same Postgres. Each test file creates and removes its own database.

## Database

- `npm run db:generate` makes a migration in `drizzle/` from `src/db/schema.ts`.
- `npm run import -- <folder> --owner <email>` copies the `.md` files of a folder into the database. It creates only. `--dry-run` lists what it would create.
- `npm run export -- <folder> --owner <email>` writes the Notes of a User to an empty folder.
