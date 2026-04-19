# syntax=docker/dockerfile:1.7
#
# Adonis demo (placeholder pattern, matching dotnet/spring/phoenix demos).
#
# Bootstraps an AdonisJS Inertia starter non-interactively, then overlays a
# tiny /demo route. The escalated-adonis package is intentionally NOT
# installed here because of a tracked package-source issue
# (https://github.com/escalated-dev/escalated-adonis/issues/34) — the
# package's TypeScript build produces 314 errors and the configure.ts
# calls publishMigrations which @adonisjs/core@6 no longer exports. Once
# #34 lands, layering the package back in is a small follow-up.

FROM node:22-alpine AS host

RUN apk add --no-cache git

WORKDIR /host

# create-adonisjs is non-interactive when given --kit + --adapter + --no-ssr.
# --no-git skips git init; we don't need a repo inside the demo container.
# Use the slim API kit (no Vite/Inertia/SSR setup) — the placeholder demo
# only serves static HTML, so we keep the host minimal until #34 is fixed.
RUN npm install -g create-adonisjs --silent && \
    create-adonisjs \
        --kit=api \
        --db=postgres \
        --auth-guard=session \
        --pkg=npm \
        --git-init=false \
        .

# Overlay the /demo placeholder route + controller.
COPY docker/host-app/demo_routes.ts /host/start/demo_routes.ts
COPY docker/host-app/demo_controller.ts /host/app/controllers/demo_controller.ts

# Wire the demo route file into start/routes.ts (idempotent).
RUN grep -q "demo_routes" /host/start/routes.ts || \
    echo "import './demo_routes.js'" >> /host/start/routes.ts

FROM node:22-alpine AS runtime

RUN apk add --no-cache postgresql-client

WORKDIR /host
COPY --from=host /host ./

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "ace.js", "serve"]
