# syntax=docker/dockerfile:1.7
#
# Adonis demo (full e2e: picker + click-login + agent profile page).
#
# Bootstraps an AdonisJS Inertia starter non-interactively, installs
# escalated-adonis from the local checkout, runs `node ace configure` to
# publish the migrations, runs them against postgres, then overlays a
# /demo controller (picker + login + agent page) that proves the
# package's models and schema work end-to-end. Mirrors the pattern shipped
# in dotnet #16, spring #18, and phoenix #28.

FROM node:22-alpine AS host

RUN apk add --no-cache git

# 1) Build a minimal tarball of the escalated-adonis package so we can
#    `npm install` it from disk without copying the whole repo into the
#    host's node_modules tree (avoids the symlink-circular-dep pitfall
#    when the source tree is itself the host).
WORKDIR /pkg
COPY package.json package-lock.json tsconfig.json index.ts configure.ts ./
COPY src/ ./src/
COPY providers/ ./providers/
COPY stubs/ ./stubs/
COPY database/ ./database/
COPY start/ ./start/
COPY scripts/ ./scripts/
RUN mkdir -p /pkg-out && \
    npm ci --silent && \
    npm run build && \
    npm pack --pack-destination=/pkg-out

# 2) Bootstrap the AdonisJS host.
WORKDIR /host
RUN npm install -g create-adonisjs --silent && \
    create-adonisjs \
        --kit=api \
        --db=postgres \
        --auth-guard=session \
        --pkg=npm \
        --git-init=false \
        .

# 3) Install the escalated-adonis tarball + its peer/optional deps that
#    the host will actually exercise (lucid is already in --kit=api;
#    add the rest the package declares as peers).
RUN cp /pkg-out/escalated-dev-escalated-adonis-*.tgz /host/escalated-adonis.tgz && \
    npm install --no-audit --no-fund --legacy-peer-deps \
        ./escalated-adonis.tgz \
        @adonisjs/auth@^9 \
        @adonisjs/cache@^1 \
        @adonisjs/drive@^3 \
        @adonisjs/inertia@^1 \
        @adonisjs/mail@^9 \
        luxon

# 4) Configure the package — publishes config + migrations into the host.
#    --force overwrites any existing escalated config (this is a fresh
#    bootstrap, but the flag also picks up the stub re-publish path).
RUN node ace.js configure @escalated-dev/escalated-adonis --force

# 5) Overlay the demo controller + routes (seed runs lazily on first
#    /demo request — see seedIfEmpty in demo_controller.ts).
#    REPLACE the default scaffold's start/routes.ts so its `GET /` doesn't
#    collide with the demo's redirect-to-/demo handler.
COPY docker/host-app/demo_controller.ts /host/app/controllers/demo_controller.ts
COPY docker/host-app/demo_routes.ts /host/start/routes.ts

FROM node:22-alpine AS runtime

RUN apk add --no-cache postgresql-client

WORKDIR /host
COPY --from=host /host ./

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "ace.js", "serve"]
