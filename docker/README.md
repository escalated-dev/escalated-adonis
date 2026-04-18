# Escalated AdonisJS — Docker demo (scaffold, not end-to-end)

Draft scaffold. The host app is bootstrapped from `npm create adonisjs@latest` with Inertia + Postgres + session auth, then the bundle is installed from a tarball built from the repo root.

**Current state:** scaffold only — not verified `docker compose up --build` end-to-end. Adonis v6 needs a custom `node ace configure @escalated-dev/escalated-adonis` run to publish config / register the provider / copy migrations, which wants interactive input and doesn't cleanly run in the Docker entrypoint. That plus a demo User model, seeders, and the click-to-login routes are the remaining work to get this to boot.

See the PR body for a full punch list.
