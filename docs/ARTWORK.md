# Artwork and provenance

## Visual direction

Wolfgatti uses isolated ink-and-watercolour illustrations: slightly irregular dark contours, restrained washes,
and enough detail to recognise each subject at card size. Colour and shape are meaningful association cues.
An ordinary object stays an ordinary object; do not invent a face, costume, extra prop, or story around it.

The approved initial references are the brass key, red pump, and simplified second elephant study in
`docs/style-studies/2026-11-07/`. The first, heavily wrinkled elephant is not the style reference. Animals use
clear, friendly simplified forms and a small number of deliberate details.

Character illustrations have a separate role: elephant painters wear classic artist clothing, refined peacock
curators dress formally, and Wolfgatti is a mischievous wolf art forger. Their costumes and props are intentional.

## Files

| Location | Contents |
|---|---|
| `assets/catalog.json` | Stable IDs, subjects, English descriptions, German/English names, internal tags |
| `assets/masters/` | Original image outputs retained for future exports |
| `assets/provenance/` | Prompts, generation information, source references, and review records |
| `packages/client/public/motifs/p001.webp` … `p168.webp` | Web versions of the 168 transparent picture motifs |
| `packages/client/public/characters/` | Wolf, painter elephant, and curator peacock illustrations |
| `packages/client/public/cards/helper-*.webp` | Four illustrated helper fronts and four numbered reverses |
| `docs/style-studies/` | Design references and retained variants; not a separate playable deck |

Frames, card backgrounds, backs, helper illustrations, and game markers are separate assets. Changing a frame
must not require regenerating the motif. Use a uniform outer card shape and back so hidden cards do not reveal
their subject.

## Generation

The 168 general subjects match the existing private game by the owner's decision, but the illustrations are newly
created. Old scanned motif artwork is used only for internal subject identification and is not an image-generation style
reference or a distributed asset. Prompts describe subjects independently and use Wolfgatti's approved original
studies as style references where needed.

For the helper redesign, the owner requested a composition closer to the original helper cards. The private
swap-themes helper was used as a layout reference for the first study. The shipped illustrations are newly
generated, with Wolfgatti's peacock curator and elephant painter. Subsequent helpers reference the approved
Wolfgatti study: warm yellow dossier folders, clipped monochrome portraits, clear action symbols, soft contours
and subtle wear. The heavily distressed and sharply notched studies were rejected. Gray reverses carry the
recovery numbers 3 (themes), 4 (hand), 5 (request), and 6 (question); the game shows them when helpers are used.
The previous SVG helper designs remain as unused earlier designs.

Record the asset ID, full prompt, available generator/model information, date, references, original output, export
path, and review status. Use explicit statuses rather than treating every generated result as approved. A stored
prompt does not guarantee identical regeneration; preserve the image file as the master.

Artwork is produced with the built-in image-generation tool. Switching to a different API or CLI workflow requires
separate agreement. The owner authorised copying generated outputs from the tool's output directory into this
project. All other working and temporary files stay inside the project.

## Quality review

- Keep the complete subject inside the canvas with comfortable padding.
- Check readability at actual small card size and consistent perceived scale across subjects.
- Check colours, proportions, anatomy, recognisable details, and unwanted writing or extra objects.
- Require a real alpha channel outside the subject and in openings such as key bows and bicycle frames.
- Review on both light and dark backgrounds. RGB colour data in pixels with alpha zero is invisible and is not,
  by itself, a visible background defect. Do not regenerate an image merely because a preview ignores alpha.
- Keep decorative frames, paper rectangles, nails, scenery, and external drop shadows out of motif exports.
- Check the catalog ID against the exported filename and make sure each required image is present.

Format conversion and optimisation must preserve alpha. A transparent edge is different from an opaque white
rectangle or a painted checkerboard. Retain variants separately instead of silently overwriting accepted work.

The final game needs real play sessions as well as image review: the same subject rendered with a different colour
or emphasis can change which associations players recognise.

## Export tools

`tools/prepare-artwork.py` preserves a generated PNG master and exports a WebP with a longest edge of at most
768 pixels. It also records file dimensions and a provenance entry. Supply the full generation prompt and the
correct stable asset name (`p001`–`p168`, a character name with `--kind character`, or a helper name with `--kind helper`). Keep source artwork and
working files inside the project unless its generation location has been expressly authorised.

The conversion and full-pixel alpha check use Pillow; its development requirements are listed in
`tools/requirements-artwork.txt`. If those packages are not available, use a project-local virtual environment.
The Node-based `npm run assets:check` does not require Pillow. `npm run assets:check:alpha` provides the additional
pixel-level check when Python/Pillow is available.

## Rights

The project's MIT License applies to original project content to the extent the contributors can grant those
rights. AI-assisted provenance is recorded without claiming that every output carries exclusive copyright.
Third-party rights and third-party software notices are unaffected. Do not distribute original scanned graphics
or unlicensed references with the release.

## Cache fingerprints

After changing web artwork, run `npm run assets:version`. The build does this automatically and rejects a missing
card or character. The client appends a content fingerprint to every motif and character URL, so changing an
illustration does not require players to clear their browser cache. Commit the updated fingerprint file with the
artwork. `npm run assets:check` also rejects stale fingerprints.

## Requested card revisions

The active shared background is `packages/client/public/card-backgrounds/canvas-brushed-v1.webp`: an unframed
painted canvas with subtle wrapped corners and side depth. At the owner's request it has no woven fabric texture;
the warm ivory/ochre brushed background is retained. Motifs use 88 percent of the surface with six-percent insets.
The owner approved the final red-shoe canvas preview; the reusable master has an empty interior for separate motifs.
Earlier gold and wooden frame studies are retained but are no longer used by the shared card surface.

Card p058 uses a restrained narrow ski crossing above the bindings. Card p073 shows the black impact hole and
cracks without a visible glass surface or shards. Previous generated versions are retained in `assets/variants/`.

## Geometric ski composition

For p058, the owner explicitly approved geometric editing after generated edits distorted the skis.
`python3 tools/recompose-skis.py` separates the two skis from the first generated version into complete layers,
rotates them by opposite 10-degree angles and overlaps them at 30 percent of their length. It preserves their
shape, colour and bindings without repainting or scaling. The transparent result is exported through the normal
artwork preparation pipeline. Previous versions remain in `assets/variants/`.
