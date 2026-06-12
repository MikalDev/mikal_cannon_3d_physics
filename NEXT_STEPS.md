# Next Steps

Deferred items from the 2.36.0 patch-port review and the 2.37.x work, in priority order.
(Severity × likelihood × effort; details in the review: all were CONFIRMED findings.)

## 1. Worker command batch survives a throwing command — HIGH, small
`runCommands` has no per-command try/catch: one throwing handler silently kills the rest of
that frame's command batch (fire-and-forget messages swallow the error — no log, no trigger).
Wrap each command, log failures. This is the cheap mitigation for #2 and protects everything
else too.

## 2. Joint identity is per body PAIR, not per joint — HIGH, medium
`jointMap` and `pendingJointCommands` key on the uid pair, so a second joint between the same
bodies (revolute + the newly un-deprecated spring — a natural wheel+suspension setup)
overwrites the first. `SetRevoluteMotor` then resolves to the spring joint and
`configureMotorVelocity` THROWS (spring has no motor methods) — combined with #1, physics
commands randomly stop applying with no error. Needs per-joint keying (e.g. pair+type) and
pending-queue keys to match.

## 3. Per-collider actions skip merged compound colliders — MEDIUM-HIGH, small
`setCollisionGroups` and `setMass` still operate on `collider(0)` only; compound bodies keep
stale groups/mass on merged colliders, and **Set Light Occluder routes through groups so it's
broken on compound bodies too**. `applyToBodyColliders` already exists — use it (mass needs a
distribution decision: scale per-collider masses vs `additionalMass`).

## 4. Compound collider lifecycle — MEDIUM, medium
All inherited from the community patch, all confirmed:
- destroy the joint parent → helpers freeze forever (no re-enable/cleanup path)
- destroy a helper → its merged collider stays welded to the parent (no removal command exists)
- save/load: `_saveToJson`/`_loadFromJson` are empty stubs, so compound state (and all physics
  state generally) doesn't survive a load
Decide the intended semantics first (e.g. parent destroy → helpers get their bodies back?).

## 5. Test coverage: Sprite / 3D Shape / GltfStatic — MEDIUM, small-medium
The template only has Model3D objects, so the Sprite trimesh path, Shape3D origin handling,
and GltfStatic bbox sizing have zero in-C3 coverage. Matters more soon: r489 added
`isRotatable3d` SDK prep — when Scirra enables full 3D rotation for 3D Shape, the addon's
Z-only Shape3D path needs reworking, and tests should exist before that lands.

## 6. Unbounded worker buffers — MEDIUM-LOW, small
- `pendingJointCommands`: a typo'd targetUID pair is never pruned while the source body lives;
  per-tick motor commands accumulate (JSON-cloned) and replay as one giant batch if the joint
  ever appears. Cap + last-write-wins per (pair, command type).
- `postDefineCommands`: per-tick commands for a body that never defines (Model3D bbox
  extraction failure) grow forever; `removeBody` early-returns before pruning never-defined
  uids. Cap + prune on instance destroy.

## 7. Boolean coercion hardening — LOW, tiny
- Worker joint creators read `preserveRelativePosition/Rotation` via raw truthiness while
  `contactsEnabled` beside them uses `boolParam()` — `"false"`/`"0"` would be treated as true.
- `_SetRevoluteLimits` scripting footgun: `1`/`"1"`/`"true"` disable limits (combo-index
  semantics); whitelist the string forms at least.
- Extract a shared `boolParam()` in instance.js (currently pasted inline twice).

## 8. Quality cleanups — LOW, small each
- Miss/empty cast-result shape is hand-maintained in 5 places; the per-axis scalar mirrors
  (`hitPointWorldX`, `witness1X`, …) are written but never read — single-source the shape and
  consider dropping the dead fields (minor per-cast perf too).
- `setPrismaticMotor/Limits` are verbatim copies of the revolute handlers — merge.
- `_knownJointTypes` is optimistic (JointExists can report phantom joints) — fine if
  documented; worker-confirmed joint state would ride the existing results batch.

## Watch list
- **C3 3D Shape full rotation** (r489 `SetIsRotatable3D` prep): when enabled, Shape3D needs
  the quaternion path Model3D/GltfStatic already have.
- Scale-test learning: the editor recomputes a Model3D's box from the model — box dims in
  layout JSON are not authoritative; runtime is covered by the resize watch since 2.37.0.
