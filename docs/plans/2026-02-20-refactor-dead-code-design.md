# Refactor: Dead Code Removal & KISS/SOLID/YAGNI Cleanup

**Date:** 2026-02-20
**Approach:** Surgical (Option A) — file-by-file, independently verifiable steps
**Files touched:** `src/instance.js`, `src/behavior.js`, `src/behaviorConfig.js`

---

## Section 1 — Dead Code Removal (`instance.js`)

Three removals, no behavior change:

1. **`transformDrawVerts`** (lines 1327–1380) — entire function. Never called, not exported, not referenced anywhere.
2. **`hasQuaternion` + `quat` locals** in `_postCreate` GltfStatic branch — assigned immediately after the `else if (pluginId === "GltfStatic")` check, never read.
3. **`dimensionSource` variable** in `_create3DObjectShape` — assigned one of four strings depending on branch, never read. Remove all four assignments.

---

## Section 2 — Bug Fixes

1. **`behavior.js`** — `this.cmdTickCount, (this.tickCount = 0)` — comma operator leaves `cmdTickCount` as `undefined`. Fix: two separate statements.
2. **`instance.js` `_Raycast`** — `maxToI / vec3.length(dir)` after normalising `dir` always divides by 1. Remove the division.
3. **`instance.js` `_SetSizeOverride` SpritePlugin branch** — sends `CommandType.UpdateBody` instead of `CommandType.SetSizeOverride`. Fix the command type.

---

## Section 3 — `_buildBodyCommand` Helper (`instance.js`)

Extract a `_buildBodyCommand(type, overrides = {})` private method to eliminate ~120 lines of near-identical command object construction duplicated across `DefineBody`, `_UpdateBody`, and `_SetSizeOverride`.

The helper:
- Reads `inst`, computes `zHeight`, `initialQuat`, `enableRot` based on `this.pluginType`
- Builds the shared base command object
- Accepts `overrides` spread for caller-specific fields (shape number, meshPoints, size overrides)
- Returns the merged command — caller pushes it to `PhysicsType.commands`

Each caller collapses from ~30 lines to ~5–10 lines.

---

## Section 4 — Mark Missing Deprecations (`behaviorConfig.js`)

Fix incorrect field name on two deprecated ACEs:

- `SetCollisionFilterGroup`: `isDeprecated: true` → `deprecated: true`
- `SetCollisionFilterMask`: `isDeprecated: true` → `deprecated: true`

`AttachSpring` already has `deprecated: true` — no change.
`WorldGravityX/Y/Z` and `VelocityX/Y/Z` remain in the API as unimplemented stubs (returning 0) — no deprecation, no removal.

---

## Implementation Tasks

| # | Subject |
|---|---------|
| T1 | Remove dead code from instance.js |
| T2 | Fix bugs (behavior.js cmdTickCount, _Raycast no-op, _SetSizeOverride CommandType) |
| T3 | Extract _buildBodyCommand helper in instance.js |
| T4 | Fix deprecated field names in behaviorConfig.js |

Dependencies: T2 and T3 can run in parallel after T1. T4 is independent.
