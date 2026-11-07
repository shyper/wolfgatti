# Wolfgatti implementation and release plan

Updated: 7 November 2026. This is the implementation plan for the new Wolfgatti repository, not the historical
plan for the private source game.

## Approved scope

- Work directly in the project root. Include only the owner's required source code, without private source
  history or deployment configuration.
- Use the existing TypeScript/npm architecture and preserve the established game rules.
- Keep the same 168 general picture subjects, with independently created illustrations.
- Use the agreed ink-and-watercolour direction: the key, red pump, and simplified elephant studies.
- Use a wolf art forger, elephant painters in classic artist clothing, and formally dressed peacock curators.
- Keep motifs transparent and separate from frames, backgrounds, and game markers.
- Apply MIT to the project's own code, documentation, and artwork to the extent those rights can be granted.
- Write comments and development documentation in English. Preserve the German/English user interface.
- No old database or saved games need to be migrated. Retaining JSON snapshots for future rooms does not require
  an external database.

The owner has approved full implementation, the illustrated helpers and the final unframed canvas appearance.
The repository destination is `shyper/wolfgatti` on GitHub. Compose uses `ghcr.io/shyper/wolfgatti:latest`;
CI publishes that tag after successful checks on pushes to `main`. Hosting has not been selected.
The owner has authorized the initial commit and push. GitHub CI and GHCR publication are verified after pushing.

## Existing foundation

The source application already implements the cooperative 3–7-player game, rotating roles, four shared helpers,
Normal/Easy difficulty, room invitations, reconnect tokens, spectators, seat takeover, host controls, and a game
log. The server controls the state and sends filtered views so hidden information stays hidden.

The new repository uses React/Vite and i18next on the client, a Node HTTP/Socket.IO server with zod validation,
and a shared pure game engine. Docker packages the static client and bundled server together. Existing tests were
retained, adapted to the new package names, and passed in the new repository.

## Implementation work

| Workstream | Deliverable | Current stage |
|---|---|---|
| Source adoption | Fresh root workspace without old assets, runtime data, or Git history | Complete; existing tests, typecheck and build passed |
| Motif catalog | Accurate IDs and descriptions for the same 168 subjects | Complete: 168 ordered IDs, bilingual names and English descriptions |
| Artwork production | Transparent motif masters, web exports, and provenance | Complete: 168 transparent motifs, PNG masters, WebP exports and exact generation prompts |
| Character art | Wolf, painter elephant, curator peacock | Integrated: three transparent character assets |
| Card rendering | Separate motif, frame, background, and game markers, including zoom and examples | Complete; browser layout, zoom and one full browser round verified |
| Final card appearance | Unframed brushed canvas with subtle wrapped edges and no fabric weave | Owner-approved final appearance integrated through the shared card surface, including zoom and rules examples; earlier frame studies retained |
| Identity and text | Own logo, favicon, helper/back designs, names, and rewritten DE/EN rules | Implemented; 238 matching translation keys |
| Packaging | Docker image, GitHub CI and GHCR-based Compose | Docker image built and complete container match passed; GitHub publication awaits the first push |
| Documentation | English setup, contribution, artwork, and license documents | Complete; English documentation and dependency notices included |
| Validation | Engine/room tests, types, translations, assets, build, and UI review | Passed: 27 tests, types, 238 translation keys, complete build, all asset/alpha checks, production match, HTTP and browser checks |
| Publication | GitHub repository, GHCR image, and hosting | Initial commit and push authorized; GitHub/GHCR publication checked after pushing; hosting unspecified |

Core local implementation is complete, including integration of the owner-approved unframed brushed canvas.
The canvas passed the build, type and asset checks and was reviewed with real motifs in the production browser rules examples.
Detailed verification evidence and remaining external release choices are recorded
in [VERIFICATION.md](docs/VERIFICATION.md).

## Artwork contract

All 168 existing cards have been viewed in overview. They are compact individual motifs: objects, animals, body
parts, food, vehicles, buildings, and symbols. Even a mountain, moon, campfire, or skyline is an isolated motif;
scenery with a sky is not a requirement.

The catalog records stable ID, slug, DE/EN names, English description, and internal association tags. Preserve
recognisable colour, shape, material, and function cues where the catalog specifies them. Tags are not visible
hints on the playable cards.

Masters live under `assets/masters/`, generation records under `assets/provenance/`, and web motifs at
`packages/client/public/motifs/p001.webp` through `p168.webp`. Character exports live under `public/characters/`.
File conversion preserves alpha; no original scanned graphics are included. See [ARTWORK.md](docs/ARTWORK.md).

## Rule values to preserve

- Three to seven players, two themes, and four randomly added forgeries per round.
- Starting hands: 18 cards for three players, nine for four or five, six for six or seven.
- Curator/painter counts: 2/1, 2/2, 3/2, 3/3, and 4/3; roles rotate each round.
- Curators request two to seven paintings in total; painters secretly assign each contribution to a theme.
- Curators set aside exactly four suspected forgeries and assign the remaining cards to themes.
- A genuine painting on its intended theme scores one team point. An accepted forgery scores one Wolfgatti point.
- Helpers swap themes, swap up to six hand cards, adjust the request by one, or query a card's origin.
- A perfect round recovers the used helper numbered 3/4/5/6 matching the final requested count.
- The adjusted request may be one to eight. A painter holding fewer than six cards swaps all of them.
- The game ends at six accepted forgeries; at least 15 team points are needed to win.
- An insufficient draw pile ends the game with the normal final scoring.

## Verification and release criteria

Run the integrated checks after the corresponding files and assets are complete:

```bash
npm test
npm run typecheck
npm run i18n:check
npm run assets:check
npm run build
```

Review the home page, rules example, small cards, theme cards, zoom, role portraits, helpers, mobile layout,
keyboard operation, role changes, reconnect, and a complete game flow. Preserve tests for information leaks.
Only add tests that exercise meaningful new or changed behaviour. Record any browser or multiplayer verification
that could not be completed; do not present planned Playwright coverage as existing evidence.

Check the release contents, Docker context, dependency notices, and new Git history for old graphics, runtime data,
private registry references, and local-only files. Include dependency notices with bundled distributions.

The selected name has not received a trademark clearance. Name review and any desired independent legal review
remain release preparation tasks; a new illustration or license notice is not such a clearance.

## Remaining external choices

The technical and artistic direction, GitHub repository `shyper/wolfgatti`, and GHCR destination are selected.
The owner has authorized the first commit and push. A target domain and hosting environment have not been
selected. GitHub Actions and actual registry publication are verified after pushing.
