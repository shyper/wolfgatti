# Verification record

Date: 7 November 2026. Scope: the current local Wolfgatti implementation, approved canvas appearance,
illustrated helpers, Docker packaging, GitHub CI and GHCR configuration.

## Current results

| Check | Result |
|---|---|
| Engine and room tests | All 27 tests passed locally and again during the Docker build |
| TypeScript | All three application packages passed |
| Translation keys | 238 matching German and English keys |
| Asset integrity | 168 unique motifs, three characters, one active canvas background, eight helper faces and 11 retained vector assets passed |
| Artwork fingerprints | All 180 active raster files match their content fingerprints |
| Full-pixel alpha | All active rasters have transparent and near-opaque pixels; illustrations/helpers fit 768 pixels, the shared background fits 1170 pixels |
| Production build | Vite client and bundled Node server built successfully |
| Clean dependency installation | `npm ci` passed inside the Docker build |
| Docker image | `wolfgatti:qa` built successfully from the project Dockerfile |
| Container health | Container started successfully as the non-root image user; Docker healthcheck reported `healthy` |
| Container game smoke test | Full three-player match plus spectator passed in five rounds, including helpers, reconnect, role rotation, hidden information, scoring and return to lobby |
| Container image delivery | All 180 versioned raster URLs returned WebP with exact source bytes and expected hashes |
| Container HTTP | Health, home and missing static files behaved as expected; private-path requests did not expose private files |
| Compose | Configuration validation passed; service uses `ghcr.io/shyper/wolfgatti:latest` without a local build directive |
| GitHub workflow | YAML, shell syntax, triggers, publication gate, matching registry tags and job-scoped permissions checked locally |
| Documentation | Local Markdown links resolve; repository/registry names and current visual status reconciled |
| Dependency notices | All 33 inventoried package versions match the lockfile |
| Package manifests | All five manifests match their dependency/engine entries in the lockfile |
| Provenance paths | All recorded master, export and project-local reference paths exist |
| Release file list | No files over 50 MiB and no ignored runtime/helper directories, environment files or key files among Git release candidates |

The Docker check caught an incorrect `tools/package.json` containing lockfile data. It was replaced with the
intended `@wolfgatti/tools` workspace manifest, and the root lockfile metadata was synchronized. The corrected
image installed dependencies, passed tests, built and served the application successfully.

## Visual and browser evidence

All 168 motifs were reviewed against the subject catalog in overview, with ambiguous details checked individually.
Earlier interactive browser checks covered home, language switching, room creation, a three-player lobby,
requests, painter selection, sorting, scoring, rules, card zoom and a 390-pixel mobile viewport.

After the visual revisions, the current unframed canvas was reviewed in production browser rules examples with
real motifs at small card sizes. The illustrated helper fronts were also reviewed against the actual dark page
background. These were interactive checks, not a committed Playwright suite.

The owner approved both the illustrated helpers and the final canvas appearance. The active background is
`packages/client/public/card-backgrounds/canvas-brushed-v1.webp`, without woven fabric texture. Motifs use an
88-percent surface area with six-percent insets. The earlier gold and wooden studies are retained as alternatives.
The shared component applies the active background to motif/character surfaces, zoom and rules examples.
Used helpers show their gray numbered reverses: 3, 4, 5 and 6.

Card p058 uses a narrow geometric ski crossing; p073 shows an impact mark without visible glass. Earlier artwork
versions are retained. Image creation/export details and prompts are under `assets/provenance/` and
[ARTWORK.md](ARTWORK.md). Review data and scripts remain in the ignored project-local `.work/` directory.

## GitHub publication and remaining limits

The destination selected by the owner is [shyper/wolfgatti](https://github.com/shyper/wolfgatti).
Compose pulls `ghcr.io/shyper/wolfgatti:latest`. After the verification job passes, the publication job runs only
for push events on `refs/heads/main` in that repository. It uses `GITHUB_TOKEN` with job-scoped `packages: write`
to publish `latest` and `sha-<full-commit-sha>`. Pull requests, other branches and manual runs do not publish.
No extra secret is required. The workflow does not deploy or restart a hosted instance.

These checks were completed before the initial commit and push, which the owner has now authorized.
Actual GitHub runner execution and GHCR publication require the first push. No hosting environment or
domain has been selected. Technical checks do not imply trademark clearance or independent legal review.
