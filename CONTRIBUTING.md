# Contributing to Wolfgatti

## Scope

Wolfgatti is an independent visual adaptation built from the project owner's game code. Keep the 168 catalogued
picture subjects and current rule values unless a change has been discussed first. Propose substantial architecture,
rule, or design changes before implementing them.

Do not import original scanned artwork, logos, screenshots, runtime data, or private deployment configuration
from the source game.

## Development

Use Node.js 24 and npm. Install with `npm ci`, then use `npm run dev:server` and `npm run dev:client` in separate
terminals. The project uses npm workspaces; keep package names under `@wolfgatti/`.

Before submitting a change, run the checks relevant to it:

```bash
npm test
npm run typecheck
npm run i18n:check
npm run assets:check
npm run build
```

Explain what changed, why it matters, and which checks you ran. Add meaningful tests for changed game or server
behaviour. Preserve the server's authority and filtered player views: another player's hand and card ownership
must not become visible before the rules allow it.

## GitHub Actions

`.github/workflows/ci.yml` runs on pushes, pull requests, and manual dispatch. It uses Node.js 24 to run the
tests, type checks, translation checks, artwork/provenance checks, full-pixel transparency checks, and production
build. Committed artwork fingerprints are checked before the build regenerates them.

The same job validates Compose, builds the Docker image, starts it, waits for the health endpoint, and runs the
existing full-match Socket.IO smoke test against the container. Docker build layers and npm downloads are cached.
Container logs are printed on failure and the test container and its anonymous data volume are removed on completion.

After those checks pass, pushes to `main` in `shyper/wolfgatti` publish `ghcr.io/shyper/wolfgatti:latest` and
`ghcr.io/shyper/wolfgatti:sha-<full-commit-sha>`. Pull requests, other branches, and manual runs only run checks.
Publishing uses the built-in `GITHUB_TOKEN` with `packages: write` confined to the publish job; no additional
secret is required. The image has an OCI source label linking it to the repository. See GitHub's
[container publishing documentation](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images).
Compose pulls the published image. The workflow does not deploy or restart any hosted instance.

## Language and accessibility

Write comments, documentation, development notes, test descriptions, identifiers, and commit messages in English.
The user interface remains bilingual. Update both `packages/client/src/locales/en.json` and `de.json` together;
German interface text and German card names are intentional localized content.

Keep keyboard operation, visible focus, accessible names, and mobile layouts working. Do not add visible labels
or category hints to picture cards, because those can influence players' associations.

## Artwork

Follow [ARTWORK.md](docs/ARTWORK.md). Keep transparent subjects separate from card backgrounds, frames, and game
markers. Retain original generated files and provenance. Use only material you are entitled to contribute;
do not trace or import the old game's pictures. Do not remove other contributors' copyright or license notices.

## Repository boundaries

Follow the applicable project instructions. Keep working files, caches, test output, and temporary files inside
the project. Never commit secrets, environment files, reconnect tokens, room snapshots, or local test data.
Generated-image outputs may be copied from an explicitly authorised generation location; that does not grant
broader access outside the project.

Contributions to Wolfgatti's own content are made under the project's MIT License. Identify any third-party
material and its license separately.
