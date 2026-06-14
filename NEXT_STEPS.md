# Next Steps

Deferred items from the 2.36.0 patch-port review and the 2.37.x work, in priority order.
(Severity × likelihood × effort; details in the review: all were CONFIRMED findings.)

## ~~1. Worker command batch survives a throwing command~~ DONE (ecae356)
Per-command try/catch in `runCommands`, failures log type + uid. Node harness + adversarial
C3 suite (test_worker_resilience).

## ~~2. Joint identity is per body PAIR, not per joint~~ DONE (a2e5c70)
`jointMap`/`pendingJointCommands` keyed `"minUid:maxUid:type"`; typed lookup/queue/replay;
shared `pruneJointEntriesForUid`. Node harness (18 checks) + adversarial C3 suite
(test_joint_identity: revolute+spring same pair, typed queue replay). NOTE: re-creating the
SAME type on the same pair still overwrites without removing the old Rapier joint — see #9.

## ~~3. Per-collider actions skip merged compound colliders~~ DONE (9941f56)
`setCollisionGroups` applies to all colliders; `setMass` sets the body TOTAL by scaling
collider masses proportionally (zero-total → collider 0). Node multi-collider stubs +
adversarial C3 suite (test_compound_actions).

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

## 5b. Sprite body position ignores originX/originY — LOW, small
`_getBodyWorldPosition`/`_setBodyWorldTransform` hardcode `inst.x - width/2` for the Sprite
branch, assuming a centered origin. Per the SDK `inst.x` is the configurable origin point, so
a Sprite with a non-center origin gets its collider offset from its visual. The 3D plugins
honor origin correctly via `_originOffsetLocal`; only the Sprite special-case (top-left, for
trimesh vertex construction) doesn't. No demonstrated failure (Sprites default to centered);
fold the origin offset into the Sprite branch when touching that path. Verified the rest of
the origin/center handling is faithful to the r489 SDK contract (June 2026 review).

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
- Re-creating a joint of the same type on the same pair overwrites the registry entry
  without removing the old Rapier joint (leak); a remove-or-replace in `registerJoint`
  would close it.

## Watch list
- **C3 3D Shape full rotation** (r489 `SetIsRotatable3D` prep): when enabled, Shape3D needs
  the quaternion path Model3D/GltfStatic already have.
- Scale-test learning: the editor recomputes a Model3D's box from the model — box dims in
  layout JSON are not authoritative; runtime is covered by the resize watch since 2.37.0.
