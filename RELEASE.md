# Releasing `@escalated-dev/escalated-adonis`

Publishing a GitHub release publishes the package to npm through
[`.github/workflows/npm-publish.yml`](.github/workflows/npm-publish.yml).

## How a release publishes

1. Bump `version` in `package.json`, update `CHANGELOG.md`, merge to `main`.
2. Create a GitHub release with tag `v<version>` (e.g. `v0.7.2`).
3. The **Publish to npm** workflow checks out the tag and:
   - fails if `package.json` `version` does not equal the tag without its `v`;
   - runs `npm ci`, the build and the tests;
   - checks the `npm pack` tarball contains `main`/`types` and no tests, CI or docker files;
   - runs `npm publish --provenance --access public` (prereleases such as `1.0.0-rc.1` go to the `next` dist-tag).

If neither `NPM_TOKEN` nor trusted publishing is configured, the publish step logs
`skipping: NPM_TOKEN not configured` and exits 0, so the release does not go red.
A version that is already on npm is skipped the same way.

## One-time setup (pick one)

- **Token:** create an npm granular access token with read and write access to the
  `@escalated-dev` scope, then add it as the repository secret `NPM_TOKEN`
  (Settings -> Secrets and variables -> Actions).
- **Trusted publishing (no token):** on npmjs.com, add a Trusted Publisher for
  `@escalated-dev/escalated-adonis` (GitHub Actions, repository `escalated-dev/escalated-adonis`, workflow
  `npm-publish.yml`), then set the repository **variable** `NPM_TRUSTED_PUBLISHING`
  to `true`. npm only allows this once the package exists, so the very first publish
  usually needs the token.

## Publishing a release that already exists

After adding the secret, open Actions -> **Publish to npm** -> **Run workflow**, keep
the branch at `main`, and enter the tag.

The existing `v0.7.1` release can be published this way.
