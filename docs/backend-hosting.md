# Backend and hosting direction

## What is wired in this prototype

- Google OAuth authorization-code sign-in at `/api/auth/google`; callback at `/api/auth/google/callback`.
- A signed, `HttpOnly`, `SameSite=Lax` session cookie; logout at `/api/auth/logout`; session lookup at `/api/auth/me`.
- Signed-in users can create 30-day, read-only share links with `POST /api/project/:id/share`. The opaque token is stored as a SHA-256 hash in `projects/:id/sharing.json`.
- A share URL opens the project in read-only mode. Project writes through a share ID are rejected by the API.
- Set `PROPFLOW_REQUIRE_AUTH=true` in a hosted environment to require Google sign-in for project and library APIs. In that mode, the first authenticated project writer is its owner; later edits are owner-only.

The development backend still uses the repository's JSON project files. A project's first signed-in link creator becomes its owner; set `PROPFLOW_ALLOWED_EMAIL_DOMAIN=mit.edu` to limit sign-in to MIT email accounts. This is a prototype ownership rule, not a good long-term team permission system.

## Local OAuth setup

Copy `.env.example` to `.env`, create a Google OAuth client of type **Web application**, and add this exact authorized redirect URI:

`http://localhost:5173/api/auth/google/callback`

Set the client ID, secret, and a unique random session secret in `.env`. Never commit `.env`. When hosted, set `PROPFLOW_BASE_URL` to the final HTTPS origin and register its `/api/auth/google/callback` URL in the same Google client.

## MIT hosting options

The best fit to investigate first is the Rocket Team's group locker on **scripts.mit.edu**. SIPB documents dynamic apps, Node.js through a FastCGI adapter (`node-fastcgi`), and a MySQL service at `sql.mit.edu`. Scripts runs behind multiple servers, so an ordinary persistent Node/Express listener is not supported; the app needs the FastCGI entry point and shared persistence. Its support is volunteer, best-effort, and not guaranteed for mission-critical applications. Before deployment, move project and share records from JSON files into the team MySQL database and add migrations/backups.

The existing **MIT Rocket Team wiki** is Confluence on `wikis.mit.edu`, not a general application host. It documents an iframe macro, so a wiki page could embed a separately hosted app if browser framing policies allow it, or more reliably link to the app. Keep authentication and project storage on the app host; the wiki can remain the documentation and launch point.

`web.mit.edu` is for static files and cannot run a dynamic API. **MIT Sites** is the current self-service website product and is WordPress/CampusPress, suited to the public-facing team site rather than this custom interactive app. Recognized student organizations may be eligible for an official MIT domain; the team would need to confirm eligibility and maintenance requirements.

## Before real team use

1. Provision the Rocket Team group locker, Scripts access, and a group-owned SQL account; confirm the operational setup with SIPB.
2. Choose project roles (owner/editor/viewer) and an invite policy. Current links are bearer links: anyone who receives one can view until its 30-day expiry.
3. Move records to MySQL and add access checks, revocation, audit metadata, and backup/restore.
4. Set the production origin and Google redirect URI, restrict the allowed email domain, and keep secrets outside the web-served directory.
5. Decide how to handle student turnover and who owns the team locker and Google Cloud OAuth project.
