# Research notes

Five research passes informed the design: LEGO parts and geometry, the instruction-manual visual language, 3D rendering in Three.js, build animation and step generation, and text-to-brick generation. This is the condensed, actionable version. Values marked *est.* are estimates (official PDFs and lego.com could not be fetched from the research sandbox).

## 1. Parts and geometry

| Feature | LDraw units | Real | In Lego It |
|---|---|---|---|
| Stud pitch | 20 LDU | 8.0 mm | 1 unit |
| Brick height | 24 | 9.6 mm | 1.2 (3 plates) |
| Plate / tile height | 8 | 3.2 mm | 0.4 |
| Stud | Ø12 × 4 | Ø4.8 × ~1.7 mm | r 0.3, h 0.2 |
| Gap between bricks | 0 (LDraw) | 0.1 mm per side | 0.012 per side, so seams read |

- 2 studs = 5 plates exactly; a stud is 2.5 plates tall. Shapes are evaluated in studs on every axis and sampled at plate resolution so domes and cylinders stay round.
- **LDraw**: right-handed, −Y up. Map our grid with a 180° turn about X: `(x, y, z) → (x, −y, −z)` (flipping only Y would mirror the model). Bricks/plates/tiles have their origin at the center of the top face with the long axis along X; slopes face −Z with the origin at the center of the top stud row. `0 STEP` ends a step; submodels are MPD `0 FILE … 0 NOFILE` blocks.
- **Slope profiles** (side view): 45° slopes have a 1-stud flat lip with studs, drop 20 LDU over 20 and end in a 4 LDU vertical toe; "33°" slopes drop 20 over 40 (really 26.6°); inverted slopes have studs on the full top, only the back row underneath and a 4 LDU lip at the front.
- **Round 1×1 parts** (3062b, 6141/4073): r = 10 LDU body over an r = 8 collar at the bottom.
- **Colors**: LDraw `LDConfig.ldr` palette. Edge color is `#333333` for most colors and `#808080` for very dark ones (black, reddish brown, dark green, dark brown) so their edges stay visible.
- **Voxel → brick heuristics** (Gower et al. 1998; Testuz et al. 2013; Luo et al. 2015 "Legolization"; BrickGPT 2025): prefer large parts, prefer parts that bridge several parts below, avoid seams directly above seams, alternate long direction every course (running bond), merge 3 stacked identical plates into a brick, then fix weak spots. BrickGPT's `voxel2brick.py` (MIT) is a good reference for the refinement loop.
- **Trademark**: LEGO Fair Play asks fans not to use the logo, to use "LEGO" only as an adjective, and to include the disclaimer: *"LEGO® is a trademark of the LEGO Group of companies which does not sponsor, authorize or endorse this site."* Studs are rendered plain (no logo).

## 2. Instruction-manual look

| Token | Value |
|---|---|
| Page background | `#E1EBF3` pale blue-grey *est.* (post-2022 kids' sets use white) |
| Parts callout | `#F4F8FB` fill, 1 px `#9FB6C9` stroke, ~8 px radius *est.* |
| Sub-assembly frame | `#C9DCEB` fill, `#7F98AE` stroke; nested frames one shade darker *est.* |
| Text | `#1A1A1A`; page number `#4A4A4A`, bottom outer corner |
| Step number | Top-left of the step, bold, ~5% of page height |
| Quantity | `1x`, `2x` (number + lowercase x, no space), bold, under each part |

- Model renders are orthographic (or nearly), raised ~30°, turned so the front and one side show, with soft near-flat lighting, thin dark outlines and no cast shadows. Earlier parts are not faded and new parts are not outlined in printed manuals (Studio and the LEGO Builder app offer highlighting, so it is an option here).
- Parts in a callout share one scale (a 2×4 looks twice as long as a 2×2), larger parts first, same colors together.
- 1–6 steps per page depending on complexity; sub-assemblies are framed with their own numbering from 1 and a `2x` multiplier when built twice; an arrow shows where they attach. A rotate icon marks "turn the model around"; bag numbers mark sections of big sets.
- Cover: plain white page, model render, age mark (`9+`) in a rounded box. Back pages: inventory grid with `4x` counts and IDs, grouped roughly by color then type.
- Fonts: LEGO used Chalet, then Cera Pro, then LEGO Typewell (2024). Free stand-ins: **Outfit** (step numbers) and **Inter** (UI).

## 3. Rendering

- One merged geometry per part type, cached; edge lines must come from sharp (un-bevelled) geometry.
- LDraw-style **conditional lines** (type 5) draw stud and cylinder silhouettes only where the surface turns away from the camera; hard edges draw seams between bricks, which is what makes a model read like a manual.
- Three r187: `PCFSoftShadowMap` was removed (use `PCFShadowMap` + `shadow.radius`); `NeutralToneMapping` keeps LEGO primaries true where ACES shifts reds toward orange; `polygonOffset` on fills stops lines z-fighting; `MeshPhysicalMaterial` roughness ~0.3 with light clearcoat and a `RoomEnvironment` gives the plastic look.
- Share one offscreen WebGL context for every thumbnail and page render (browsers cap contexts at ~16).
- Prior art worth reading: EvanBacon/ldr (MIT), three.js `LDrawLoader`, buildinginstructions.js (BrickHub).

## 4. Animation and step generation

- Parts move along their attachment axis (drop from above for studs-down parts), from ~4 brick heights, 350–450 ms ease-out-cubic, with a short landing flash; parts in a step start 120–180 ms apart; ~350 ms hold between steps.
- Make every brick's state a pure function of time `t`: seeking, speed, reverse and frame-accurate export become "set t".
- Camera: start at a 3/4 view, orbit slowly (~7°/s), reframe to the placed bricks, never creep closer while the model grows.
- Step rules (Agrawala et al. 2003; Heiser et al. 2004; LEGO patents US 7,979,251 / 8,374,829; MEPNet 2022): base first; one layer at a time; every part must rest on or hang from placed parts; similar or symmetric parts together; keep new parts visible; ≤ ~10 parts and ≤ ~5 types per step (MEPNet's bounds). Presets: kids 1–3 parts/step, standard 3–5, expert 4–8.
- Sub-assemblies: small groups joined to the body by few connections, attached with one motion; built in a side bay, lifted, flown over and lowered.
- Polish: synthesized click (band-passed noise + short tick + low thock, randomized ±8%), a small fanfare at the end, video via `canvas.captureStream()` + `MediaRecorder` (MP4 in Chrome/Safari, WebM elsewhere).

## 5. "Build anything" generation

- **BrickGPT/LegoGPT** (CMU, ICCV 2025): fine-tuned Llama-3.2-1B, 20³ grid, 8 plain brick sizes, one color, physics-checked rollback; great stability but limited to its training categories. **BrickWright** (2026) and **LDraw Nova** show the winning pattern: the LLM writes a *program* against a geometry API and deterministic code places the bricks, with a validator.
- Ranking of formats for an LLM: a JSON list of solid shapes (chosen) > code against a shape API > per-layer ASCII grids > raw brick coordinates.
- Prompting: list the features that make the subject recognizable first, exaggerate them 20–50%, nothing that must read thinner than 2 studs, 2–4 main colors plus accents, everything connected and standing on the table.
- API: structured outputs via `output_config.format` (JSON schema; flat, `additionalProperties: false`, no numeric bounds — clamp afterwards); Opus 5.5 defaults to `medium` effort so set `high`; forced `tool_choice` is rejected on current models; stream long responses; browser calls need `anthropic-dangerous-direct-browser-access` (the SDK's `dangerouslyAllowBrowser`).
- Recognizability for a Falcon-style freighter: flat disc hull with a slight dome, two parallel front mandibles with a gap, cockpit tube offset on the right side, radar dish on top, full-width blue engine band at the back, grey with darker panels and a few red patches.
- Next step worth adding: render three views and send them back to Claude for one critique-and-revise round, which is the cheapest large gain in recognizability.
