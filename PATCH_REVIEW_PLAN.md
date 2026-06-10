# Patched Addon Review & Source Mapping Plan

Reviewed: `patched-addon-for-review/` (v2.35.39) vs fresh build of `src/` (v2.35.3).
Raw diffs preserved in `review-diffs/` (`behavior.diff`, `worker.diff`, `aces.diff`, `lang.diff`, `addon.diff`, `editor.diff`).

All changes the user described were verified present in the patch. Everything in the patch
was made to **generated** files (`export`-style output), so each change must be mapped back to
`src/behaviorConfig.js`, `src/instance.js`, `src/behavior.js`, and `src/rapierWorkerLogic.js`
so `npm run build` reproduces it.

---

## 1. Verified change inventory

### A. Raycast fixes
| Patch change | Maps to |
|---|---|
| `sendCommandsToWorker()` once-per-tick guard removed — every call now flushes the queue (grab queue, clear, send). This is why raycasts "update every tick": previously commands pushed after the first flush waited a tick. Also delete now-unused `cmdTickCount` (behavior.js:76, 334-335) | `src/behavior.js` |
| `_Raycast` command now includes `excludeUID: this.uid` (self-exclusion). Note: `_RaycastFromSelf` already passes `excludeUID` and `noTrigger` (instance.js:794), and the worker's `raycast()` already supports `excludeUID` (rapierWorkerLogic.js:919) — only the `Raycast` action lacked it | `src/instance.js` |
| Raycast result objects now carry scalar fields (`hitPointX/Y/Z`, `hitNormalX/Y/Z`, `hitPointWorldX/…`, `hitNormalWorldX/…`), `distance = timeOfImpact * scale` (valid because `_Raycast` normalizes dir), `timeOfImpact`, `maxDistance`, `sequence`; misses get a fully-populated default object | `src/behavior.js` (result processing) |
| Worker `raycast()`: `boolParam(config.solid)`, global `raycastSequence` counter, `maxToI` echoed in result, full miss object (origin/dir/sequence/timeOfImpact:-1) | `src/rapierWorkerLogic.js` |
| 10 new expressions: `RaycastHasHit`, `RaycastHitUID`, `RaycastDistance`, `RaycastHitPointX/Y/Z`, `RaycastHitNormalX/Y/Z`, `RaycastSequence` (all take `tag`) + `_emptyRaycastResult()` helper + `_RaycastResultAsJSON` fallback | `src/instance.js` + `src/behaviorConfig.js` Exps + lang |

### B. Shape cast alignment with raycast
| Patch change | Maps to |
|---|---|
| `_CastShape`: zero-distance guard (stores empty result, returns), **normalizes direction**, `maxToI` reinterpreted as a *multiplier* of origin→to distance (`castMaxToI = distance * maxToI`), `excludeUID === -1 → this.uid`, `uid: this.uid` (was `this.instance.uid`) | `src/instance.js` |
| Result processing: witnesses now scaled by world scale, scalar mirrors for all vectors, `timeOfImpact`/`maxToI`/`sequence` fields, `distance = timeOfImpact * scale`, NaN-safe guards, miss objects fully populated, triggers wrapped in `if (!result.noTrigger)` | `src/behavior.js` |
| Worker `castShape()`: `Number(maxToI ?? 1)`, solid bool coercion, `filterGroups` NaN fallback to `0xffff`, `time_of_impact`/`timeOfImpact` key normalization, `castShapeSequence` counter, `noTrigger` passthrough, full miss object, **catch returns a miss result instead of rethrowing** | `src/rapierWorkerLogic.js` |
| **Quaternion handling fix**: `createQuaternionFromEuler` constructor arg order corrected to `(x, y, z, w)` (was `(w, x, y, z)`). Its only caller is `castShape()`'s shape rotation (`shape2Rot`, rapierWorkerLogic.js:982) — rotated shape casts produced garbage orientations before. (`SetNextKinematicRotation` is unaffected; it builds its quaternion on the main thread via glMatrix.) | `src/rapierWorkerLogic.js` |
| `_emptyCastShapeResult()` helper + `_CastShapeResultAsJSON` fallback | `src/instance.js` |

### C. Body action buffering / fixes
| Patch change | Maps to |
|---|---|
| Removed `if (!this.bodyDefined) return;` from ~20 methods so commands buffer in the worker via `bufferIfNoHandle`: `_SetEnabledRotations/Translations`, `_SetGravityScale`, `_ApplyAngularImpulse`, `_WakeUp`, `_Sleep`, `_TranslateCharacterController`, `_SetRestitutionCombineRule`, `_SetSleepThreshold`, `_SetAngularVelocity`, `_SetBodyType`, `_SetNextKinematicTranslation/Rotation`, `_ApplyImpulse`, `_ApplyImpulseAtPoint`, `_SetMass`, `_SetCollisionGroups`, `_SetLightOccluder`, `_ApplyForce`, `_ApplyTorque` | `src/instance.js` |
| `_SetLightOccluder` coerces `enable` (`true/1/"1"/"true"`) | `src/instance.js` |
| Worker `boolParam()` helper; applied in `setEnabledRotations/Translations` | `src/rapierWorkerLogic.js` |
| `applyToBodyColliders(body, cb)` helper — `setRestitution`, `setFriction`, `setRestitutionCombineRule` now apply to **all** colliders (required for compound bodies), replacing `collider(0)` | `src/rapierWorkerLogic.js` |
| `removeBody`: `if (!handle)` → `if (handle === undefined)` — **handle-0 bug fix** | `src/rapierWorkerLogic.js` |

### D. Joints
New `CommandType` entries **57–63** (both `instance.js` and `rapierWorkerLogic.js`):
`SetRevoluteContactsEnabled: 57`, `AttachSpring: 58`, `AddFixedJoint: 59`, `AddPrismaticJoint: 60`, `SetPrismaticLimits: 61`, `SetPrismaticMotor: 62`, `AddRopeJoint: 63`.

| Patch change | Maps to |
|---|---|
| `AttachSpring` un-deprecated and implemented (`RAPIER.JointData.spring`) — instance pushes command with physics-scaled restLength/anchors | `src/behaviorConfig.js` (`deprecated: false`) + `src/instance.js` + worker `attachSpring()` |
| New actions `AddFixedJoint` (contactsEnabled, preserveRelativeRotation, preserveRelativePosition), `AddPrismaticJoint` (axis, contactsEnabled), `AddRopeJoint` (length, contactsEnabled, preserveRelativePosition), `SetPrismaticLimits`, `SetPrismaticMotor`, `SetRevoluteContactsEnabled` — all in **`body` category** | all four src files |
| `AddSphericalJoint` gains `preserveRelativePosition` (default true): worker computes effective target anchor from current relative pose via `targetAnchorAtSourceAnchor()` | config + instance + worker |
| `AddRevoluteJoint` gains `contactsEnabled` + `compoundColliderTag` (+ collects compound colliders, see E) | config + instance + worker |
| Fixed joint preserve-relative-rotation: `frame2 = inv(targetRot) * bodyRot`; preserve-relative-position: same target-anchor recompute | worker |
| Rope preserve-relative-position: `effectiveLength = max(length, currentAnchorDistance)` | worker |
| Joint registry generalized: bidirectional `jointMap` registration (`uid→target` and `target→uid`), lookup checks both directions | worker |
| Pending-command queue: motor/limits/contacts commands issued before the joint exists are queued per **pair key** (`min:max` uid) and replayed when the joint is created; `removeBody` prunes pending entries for the removed uid | worker |
| Joint creation buffering: if *target* body doesn't exist yet, the command is re-buffered via `addPostDefineCommandsForUid(targetUID, …)` (new uid-parameterized variant of `addPostDefineCommands`) | worker |
| `JointExists(targetUID)` / `JointType(targetUID)` expressions backed by main-thread `_knownJointTypes` Map recorded at command-push time | instance + config + lang |
| Worker quat/vec math helpers: `quatInverse`, `quatMultiply`, `quatRotateVector`, `vecAdd/Sub/Length`, `worldPointFromLocalAnchor`, `localPointFromWorldPoint`, `targetAnchorAtSourceAnchor` | worker |
| Anchor label renames: spherical/rope/fixed use "Object Anchor Offset X/Y/Z" and "Target Anchor Offset X/Y/Z" (revolute uses "Anchor Offset x/y/z"); clarified descriptions ("Local X offset from this object's origin") | `src/behaviorConfig.js` param names/descs |

### E. Compound colliders
| Patch change | Maps to |
|---|---|
| New editor property `compound-collider-tag` (text, default `""`) → `this.compoundColliderTag = properties[11]` | `src/behaviorConfig.js` properties + `src/instance.js` constructor |
| When `AddRevoluteJoint` is given a compound tag, `_collectCompoundCollidersByTag()` scans all behavior instances, matches tag, builds collider descriptors (`uid`, physics position/rotation/size, mass, shapeType, shape), and attaches each helper as a **visual follower**: helper's own body is removed (`RemoveBody`), local offset/rotation vs parent stored, and each tick `_updateCompoundHelperVisual()` re-derives world transform from the parent's body in `Mikal_Rapier_Bodies` | `src/instance.js` |
| ~14 new instance helpers: `_quatToPhysicsObject`, `_getWorldQuaternion`, `_getBodyWorldPosition`, `_setBodyWorldTransform`, `_worldToLocalPoint`, `_worldToLocalRotation`, `_attachAsCompoundVisual`, `_updateCompoundHelperVisual`, `_getBodyWorldDimensions`, `_getCompoundColliderTagValues`, `_hasCompoundColliderTag`, `_disableOwnBodyForCompoundHelper`, `_compoundColliderDescriptor`, `_collectCompoundCollidersByTag` | `src/instance.js` |
| `_tick2()` early-return: compound helpers skip body creation/sync and only update their follower visual | `src/instance.js` (`_tick2`) |
| Worker `addCompoundCollidersToBody()`: converts each descriptor's world pose to the parent body's local frame, creates colliders on the parent (dedup by tag via `body._compoundColliderTags` Set), sets contact skin/mass, enables collision events, then `recomputeMassPropertiesFromColliders()` | `src/rapierWorkerLogic.js` |

### F. Misc
- `SetRevoluteLimits` enabled coercion changed from `enabledStr === "yes"` to `=== true || === "yes" || === 0 || === "0"`. This is a **real bug fix**, not just hardening: C3 passes combo params as the item *index* (number) — see `_SetBodyType` treating its combo as 0–3 — so the old `=== "yes"` string compare never matched from event sheets and revolute limits could never be enabled. Index 0 = "Enable".
- Version: patch is 2.35.39; propose **2.36.0** in `src/behaviorConfig.js` (new features).
- New expressions are placed in the **`general`** ACE category (alongside the existing raycast expressions); new actions in **`body`**.

### G. APIs verified available (no blockers)
- Bundled `src/rapierLib.js` has `JointData.spring/rope/prismatic/fixed` (lines 4987–5040), `RotationOps.identity`, `recomputeMassPropertiesFromColliders` — rope/spring joints need no lib upgrade.
- `src/instance.js` already has `_quaternionToEuler`, `this.mass` (properties[5]), `this.shapeProperty`, `mapShapeToNumber`; `src/behavior.js` has `behaviorInstancesByUid`.
- `src/rapierWorkerLogic.js` already has `createCollider`, `createDefaultCollider`, `defaultContactSkin`, and `excludeUID` filtering in both `raycast()` and `castShape()`.
- `src/behavior.js` already guards raycast triggers with `noTrigger` (line 316) — only the castShape trigger guard is new.

---

## 2. Review findings (issues in the patch to fix or decide on while mapping)

1. **Misleading names in worker joint helpers** — `setRevoluteJoint`, `getRevoluteJoint`, `queueRevoluteJointCommand`, `pendingRevoluteJointCommands`, `runPendingRevoluteJointCommands` now serve *all* joint types. Rename when mapping: `registerJoint`, `getJoint`, `queueJointCommand`, `pendingJointCommands`, `runPendingJointCommands`.
2. **Inconsistency:** `addSphericalJoint` registers the joint but does **not** call `runPendingRevoluteJointCommands()` (all other joint creators do). Fix in source.
3. **`_getCompoundColliderTagValues` is over-broad (KISS/YAGNI):** it probes `inst.tag`, `inst.tags`, `getTags()`, `getAllTags()`, `instVars.tag/tags/physicsTag/compoundTag/compoundColliderTag` — speculative APIs that mostly don't exist in C3. Recommend simplifying to the behavior property `this.compoundColliderTag` only (comma-separated values still supported). *Behavior change vs patch — confirm.*
4. **`_knownJointTypes` is never cleaned up** — optimistic, recorded at command push (joint may fail to create in worker), never cleared on body destroy. Acceptable for v1 if documented in expression descriptions ("known joint"), but at minimum clear it in the instance's destroy/release path.
5. **`attachSpring` leaves a `console.info` log** — remove.
6. **`maxToI` semantic change in `_CastShape` is breaking:** old = raw ToI with unnormalized dir; new = multiplier of origin→to distance with normalized dir. Existing projects using CastShape with maxToI ≠ 1 will behave differently. Accept (it matches raycast semantics) but call out in release notes.
7. **Probable bug in patch — `_SetPrismaticLimits` enabled coercion is inverted for numeric input:** it copies the revolute *combo* whitelist (`true`, `"yes"`, `0`, `"0"` = enabled), but its ACE param is a **boolean**, not a combo. If the runtime delivers `1` for checked (the patch's own `boolParam` helper exists precisely because booleans arrive as `1`/`"1"`/`"true"` in places), enabled comes out *false* — and `0`/unchecked comes out *true*. Map back using `boolParam`-style truthy coercion for the boolean param instead of the combo whitelist. Scripting users passing `1` hit the same inversion.
8. **`SetPrismaticLimits.enabled` param type:** patch aces uses `boolean` while `SetRevoluteLimits` uses a yes/no combo. Keep boolean (cleaner) with the corrected coercion from finding #7; keep the revolute combo coercion as patched (index 0 = enabled, see section F).
9. **Compound helper position conventions** (`_getBodyWorldPosition` / `_setBodyWorldTransform`) re-encode per-plugin origin rules (Sprite top-left, Shape3D +depth/2, Model3D offsets). These must match the existing conventions in `_create3DObjectShape`/Tick sync code in `src/instance.js` — verify against current source during implementation (current source dropped the Model3D depth/2 offset; patch helpers look consistent but double-check Shape3D).
10. **Good fixes worth keeping verbatim:** `removeBody` handle-0 fix, `createQuaternionFromEuler` arg-order fix (fixes rotated shape casts), `applyToBodyColliders`, castShape error-to-miss, command-queue flush fix, revolute-limits combo-index fix.

---

## 3. Implementation plan (mapping into `src/`)

Each task = one commit. Order chosen so the build stays green throughout.

### Task 1 — Core fixes (no new ACEs)
`src/behavior.js`: remove once-per-tick guard + `cmdTickCount`.
`src/rapierWorkerLogic.js`: `boolParam()`, `applyToBodyColliders()`, restitution/friction/combine-rule all-collider application, `removeBody` handle-0 fix, `createQuaternionFromEuler` arg-order fix, `addPostDefineCommandsForUid()` refactor.
`src/instance.js`: remove ~20 `bodyDefined` guards, `_SetLightOccluder` coercion, `_Raycast` `excludeUID: this.uid`.

### Task 2 — Raycast & shape-cast result enrichment + expressions
`src/rapierWorkerLogic.js`: sequence counters, enriched hit/miss objects for `raycast()` and `castShape()`, castShape robustness (maxToI, filterGroups fallback, error-to-miss).
`src/behavior.js`: result-processing scalar fields, distance-from-ToI, miss population, `noTrigger` guard on castShape triggers.
`src/instance.js`: `_emptyRaycastResult`/`_emptyCastShapeResult`, JSON fallbacks, `_CastShape` endpoint/normalize/excludeUID changes, 10 raycast expression methods.
`src/behaviorConfig.js`: 10 raycast expressions + lang.

### Task 3 — Joint infrastructure + new joints
Both files: `CommandType` 57–63 (next available was 57 — matches patch exactly).
`src/rapierWorkerLogic.js`: renamed generic joint registry (bidirectional map, pair-key pending queue, replay on create, removeBody pruning), target-body buffering, quat/vec helpers, `attachSpring`, `addFixedJoint`, `addPrismaticJoint`, `addRopeJoint`, `setPrismaticLimits`, `setPrismaticMotor`, `setRevoluteContactsEnabled`, spherical/fixed/rope preserve-relative handling, spherical pending-replay fix (finding #2), no console.info (finding #5).
`src/instance.js`: 7 new/updated joint methods, `_recordJointType`/`_JointExists`/`_JointType`, `_AddSphericalJoint`/`_AddRevoluteJoint` new params, `_AttachSpring` implementation.
`src/behaviorConfig.js`: 6 new actions in `body` category, new params on spherical/revolute, `AttachSpring` deprecated→false, `JointExists`/`JointType` expressions, anchor-offset label renames and descriptions.

### Task 4 — Compound collider support
`src/behaviorConfig.js`: `compound-collider-tag` text property (index 11) + lang.
`src/instance.js`: constructor reads property; compound helper methods (simplified tag matching per finding #3); `_tick2` compound-helper early return.
`src/rapierWorkerLogic.js`: `createCompoundColliderDesc`, `addCompoundCollidersToBody`, revolute-joint integration.

### Task 5 — Version bump, tests, docs
- Bump version to **2.36.0** in `src/behaviorConfig.js`; `npm run build` and spot-diff `export/` against `patched-addon-for-review/` (expect only intentional deviations: renames, tag-matching simplification, log removal, version).
- Tests (`tests/scripts/`, per `tests/TESTING.md`): `test_raycast_expressions.ts` (hit + miss + sequence + self-exclusion), `test_castshape_alignment.ts` (endpoint/multiplier + miss data + rotated-shape cast exercising the quaternion fix), `test_joints_fixed_prismatic_rope.ts` (creation, limits, motor, preserve-relative), `test_joint_buffering.ts` (commands before body/joint exist), `test_compound_colliders.ts` (helper attaches, visual follows, mass recompute).
- Update CLAUDE.md memory notes: CommandType next-available becomes 64; batch format unchanged.

---

## 4. Open questions

1. **Compound tag matching:** OK to simplify to the behavior property only (drop `instVars.*`/`inst.tags` probing)? (Finding #3 — recommended.)
2. **CastShape `maxToI` breaking change:** accept new multiplier semantics? (Recommended — consistent with raycast.)
3. **Version:** 2.36.0 OK, or do you want to track the patch's 2.35.39?
4. **`JointExists`/`JointType` cleanup:** acceptable as optimistic main-thread tracking with destroy-time cleanup, or do you want worker-confirmed joint state (more plumbing)?
