# Lego It

**Live:** https://lego-it.vercel.app/

Turn anything into a brick model you can actually build, with:

1. **Build animation** – the whole model assembles brick by brick in 3D: parts drop in and click into place, sub-assemblies are built on the side and flown in, and the camera follows the model as it grows. Scrub, change speed, step through, hover any brick to identify it, and record the build as a video.
2. **Instructions that look like a real LEGO manual** – cover page, numbered steps with the rounded “parts needed” callout (`2x`), framed sub-assemblies with their own step numbers, attach arrows, “turn the model” icons, bag numbers, a finished-model page and the parts inventory at the back. Print it or save it as a PDF.
3. **Piece overview** – every element with a render, count, part number and color, grouped by color or type, plus exports: **LDraw `.ldr`** (with build steps; opens in BrickLink Studio, LeoCAD, LDView), a **BrickLink Wanted List XML** and **CSV**.
4. **Build anything** – type an idea (“Millennium Falcon”, “a dragon”, “the Eiffel Tower”) and Claude designs it. Needs your own Claude API key (Settings ⚙). Without a key, prompts that match a sample open that sample.

| Build animation | Instruction pages | Sub-assembly page |
|---|---|---|
| ![Build animation](docs/screenshots/build-animation.png) | ![Instruction steps](docs/screenshots/instructions-steps.png) | ![Sub-assembly](docs/screenshots/instructions-subassembly.png) |

Each model also shows piece count, step count, age, difficulty, estimated build time and real-world size, and has a **Manual** (flat colors with outlines) and **Realistic** (glossy plastic, shadows) render style.

## Sample builds (least → most complex)

| Model | Pieces | Steps | Highlights |
|---|---:|---:|---|
| Rubber Duck | 18 | 8 | First build: bricks, slopes, tiles |
| Formula Racer | 42 | 13 | Wheels on wheel-holder plates, a driver, rear-wing sub-assembly |
| Cozy Cottage | 92 | 27 | Running-bond walls with windows and a door, gabled roof, tree sub-assembly |
| Island Lighthouse | 331 | 69 | Rocky island, striped tower, lamp-room sub-assembly, 2 bags |
| Space Freighter | 593 | 150 | Falcon-style saucer: mandibles, offset cockpit and radar dish sub-assemblies, 4 bags |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npx tsx scripts/stats.ts   # piece/step stats + overlap check for every sample
npm run build:artifact     # build + dist/artifact.html for the claude.ai-hosted page
```

## Deploy to Vercel

The repo is ready for Vercel with no extra settings (`vercel.json`: Vite, `npm ci`, `npm run build`, output `dist/`).

1. Go to https://vercel.com/new and import `willyclayton/lego-it`.
2. Keep the detected settings and click **Deploy**.
3. Every push redeploys. Pushes to the production branch (usually `main`) update the live site; other branches get preview URLs. To go live from a different branch, change it under *Project → Settings → Git → Production Branch*.

On Vercel, "Build anything" uses the visitor's own Claude API key (entered in Settings, kept in their browser). The samples, animation, instructions, exports and print work without any key.

### Hosted vs. self-hosted

The same build runs in both places and adapts at runtime (`src/host.ts`):

| | Hosted on claude.ai | Local / any static host |
|---|---|---|
| Build anything | Viewer's own Claude account (asked to allow it once); no key | Your Claude API key (Settings) |
| Exports & video | Save prompt; `.ldr` and `.xml` arrive zipped | Direct downloads |
| Print / PDF | Not available (the host blocks printing) | Available |

## How it works

```
idea ─► Claude (optional) ─► shape program ─┐
                     sample shape programs ─┼─► voxels ─► bricks ─► steps ─► 3D animation
                       hand-placed samples ─┘   (1 stud × 1 plate)          instruction book
                                                                            parts list / exports
```

- **Shape programs** (`src/lego/shapes.ts`): a model is an ordered list of solid shapes (box, ellipsoid, cylinder, wedge, torus) that are added, subtracted or painted, in studs on every axis so round things stay round. Claude writes these as JSON (structured outputs), and the larger samples use the same format, so both paths share one pipeline.
- **Voxels → bricks** (`src/lego/voxel.ts`): cells are 1 stud × 1 plate. Uniform 3-plate columns become bricks, the rest plates (or tiles). Packing is greedy largest-part-first with the preferred orientation alternating every course and a bonus for bridging seams below, which gives a proper running bond. A slope pass turns one-brick stair-steps into 45° slopes.
- **Steps** (`src/lego/steps.ts`): bottom-up, every part must rest on or hang from something already placed, back-to-front from the camera so new parts aren't hidden, compact clusters, limited parts and types per step. Sub-assemblies are sequenced separately and attached as one step. Rotations are suggested when new parts would be occluded; big builds are split into numbered bags.
- **Rendering** (`src/render/`): procedural part geometry (no external part library) with LDraw-style hard edges plus *conditional* lines that only draw where a curved surface forms a silhouette (stud sides, round bricks, wheels). The whole model is merged into four draw calls; a per-brick float texture holds visibility, offset and highlight, so animating any brick is a texel write. Outlines fade toward the part color when bricks get small on screen.
- **Animation** (`src/render/timeline.ts`, `player.ts`): every brick's state is a pure function of time, so scrubbing, speed changes and video export are trivial. Drop from 4 brick heights, ease-out-cubic, a white flash on landing, a synthesized plastic click (Web Audio, no assets), side-bay sub-assemblies, and an auto camera that reframes as the model grows and orbits slowly.
- **Instruction pages** (`src/ui/Instructions.tsx`, `src/render/pageRenderer.ts`): orthographic renders at a 30° elevation 3/4 view, laid out 1–4 steps per page depending on how big the model is at that point; sub-assemblies get a 6-up framed page.

### Build anything (Claude)

`src/ai/generate.ts` calls `claude-opus-5-5` from the browser with the official TypeScript SDK (`dangerouslyAllowBrowser`), streaming, effort `high`, a JSON-schema structured output for the shape program, and server-side refusal fallback (`fallbacks: "default"`). The key is entered in Settings, kept in memory (or in `localStorage` only if you tick *Remember*), and only ever sent to `api.anthropic.com`. Use a key with a spending limit; one design typically costs a few tens of cents. The SDK is code-split so it only downloads when you generate.

## Project layout

```
src/lego/      parts catalog, colors, voxel grid + brick converter, shape programs,
               step generator, inventory, LDraw/BrickLink/CSV export
src/render/    part geometry, merged brick mesh + shaders, viewer, page renderer,
               animation timeline, playback engine
src/samples/   the five built-in models
src/ai/        Claude-powered generation
src/ui/        React app: build player, instruction book, parts list
docs/          research notes behind the design
```

## Notes

- Research behind the visual style, animation timing, part geometry and generation approach is summarized in [docs/RESEARCH.md](docs/RESEARCH.md).
- Lego It is a fan-made tool. LEGO® is a trademark of the LEGO Group, which does not sponsor, authorize or endorse this project. No LEGO logos are used and studs are rendered plain. Part numbers and colors follow the LDraw and BrickLink catalogs.
