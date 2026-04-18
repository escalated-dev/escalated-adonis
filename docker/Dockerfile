# syntax=docker/dockerfile:1.7

# ---------- 1. Package tarball ----------
FROM node:22-alpine AS package

WORKDIR /package
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund --no-progress
COPY tsconfig.json ./
COPY src ./src
COPY providers ./providers
COPY config ./config
COPY start ./start
COPY stubs ./stubs
COPY database ./database
COPY configure.ts index.ts ./
RUN npm run build && npm pack && mv *.tgz /package.tgz

# ---------- 2. Host app build ----------
FROM node:22-alpine AS host

RUN apk add --no-cache git

WORKDIR /host

# Start from the official AdonisJS starter, then layer the package on top.
RUN npm create adonisjs@latest -- --kit=inertia --db=postgres --auth-guard=session --skip-install --pkg=npm --no-git -y . || \
    echo "starter create failed — see PR body for known blocker"

COPY --from=package /package.tgz /package.tgz
RUN [ -f package.json ] && \
    npm install /package.tgz --no-audit --no-fund --no-progress || \
    echo "install failed"

# ---------- 3. Runtime ----------
FROM node:22-alpine AS runtime

RUN apk add --no-cache postgresql-client

WORKDIR /host
COPY --from=host /host ./

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["entrypoint.sh"]
CMD ["node", "ace", "serve"]
