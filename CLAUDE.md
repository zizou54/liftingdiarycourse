s
# CLAUDE.md

@AGENTS.md

## IMPORTANT: Always Read the Relevant /docs File First

**Before generating ANY code, Claude Code MUST ALWAYS first read the relevant documentation file(s) in the `/docs` directory and follow the standards they define.**

- Check `/docs` for the file(s) that cover the area you're about to work on, and read them before writing or changing code.
- The standards in `/docs` are mandatory and take precedence over general conventions or habits.
- If several docs apply, read and follow all of them.
- When new docs are added to `/docs`, list them below.

### Docs Index

| File          | Covers                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `docs/ui.md`  | UI standards: shadcn/ui components only (no custom components), date formatting with date-fns |
| `docs/data-fetching.md` | Data fetching: Server Components only, DB queries only via Drizzle helpers in `src/data/`, users can only access their own data |
| `docs/data-mutations.md` | Data mutations: DB writes only via Drizzle helpers in `src/data/`, Server Actions only in colocated `actions.ts` files, typed params (no `FormData`), Zod validation of all action arguments |
| `docs/auth.md` | Auth: Clerk only (no other auth libraries or custom auth), route protection in `src/proxy.ts`, `auth()` checks in every data helper and Server Action, Clerk UI components |

~ /docs/ui.md