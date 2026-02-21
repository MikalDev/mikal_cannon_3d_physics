# Platformer ACE Toolkit Design

**Date:** 2026-02-20
**Scope:** Full platformer toolkit — velocity reading, axis locks, per-body gravity scale, angular impulse
**Approach:** Option A — extend frame batch for velocity; fire-and-forget commands for the rest

---

## Background

Several high-value Rapier capabilities are missing from the public ACE surface. The `VelocityX/Y/Z` expressions already exist but return hardcoded `0`. This design fixes them and adds three complementary feature groups needed for 3D action/platformer games.

---

## Feature 1 — Velocity Reading

**Worker change:** Extend the Float32Array body batch from 8 → 11 values per body by appending `vx, vy, vz` from `body.linvel()`. Also append `ax, ay, az` from `body.angvel()` — making it 14 values per body: `uid, x, y, z, rx, ry, rz, rw, vx, vy, vz, ax, ay, az`.

**`behavior.js` change:** Update `updateBodies` stride from `i += 8` to `i += 14`. Store velocity and angular velocity in `Mikal_Rapier_Bodies` map:
```js
globalThis.Mikal_Rapier_Bodies.set(uid, {
    translation: { x, y, z },
    rotation: { x: rx, y: ry, z: rz, w: rw },
    velocity: { x: vx * scale, y: vy * scale, z: vz * scale },
    angularVelocity: { x: ax, y: ay, z: az },  // rad/s, no scale conversion
});
```

**Fixed expressions (`instance.js`):**
- `_VelocityX()` → `Mikal_Rapier_Bodies.get(this.uid)?.velocity?.x ?? 0`
- `_VelocityY()` → `Mikal_Rapier_Bodies.get(this.uid)?.velocity?.y ?? 0`
- `_VelocityZ()` → `Mikal_Rapier_Bodies.get(this.uid)?.velocity?.z ?? 0`

**New expressions:**
- `AngularVelocityX` → `angularVelocity.x` (rad/s)
- `AngularVelocityY` → `angularVelocity.y` (rad/s)
- `AngularVelocityZ` → `angularVelocity.z` (rad/s)

**New command type constants:** None needed.

---

## Feature 2 — Axis Locks

Two new fire-and-forget actions, each with three boolean parameters (one per axis).

**`SetEnabledRotations(x, y, z)`**
- Instance method: `_SetEnabledRotations(x, y, z)`
- Command type: `SetEnabledRotations = 30`
- Worker: `rigidBody.setEnabledRotations(x, y, z, true)`
- Common use: `false, false, true` to keep capsule upright; `false, false, false` for no rotation

**`SetEnabledTranslations(x, y, z)`**
- Instance method: `_SetEnabledTranslations(x, y, z)`
- Command type: `SetEnabledTranslations = 31`
- Worker: `rigidBody.setEnabledTranslations(x, y, z, true)`
- Common use: `true, false, true` for 2.5D side-scroller (pin Y)

Both use `bodyDefined` guard. Category: `body`.

---

## Feature 3 — Per-Body Gravity Scale

**`SetGravityScale(scale)`**
- Instance method: `_SetGravityScale(scale)`
- Command type: `SetGravityScale = 32`
- Worker: `rigidBody.setGravityScale(value, true)`
- Default: `1.0` (normal). `0.0` = weightless, `2.0` = double gravity, `-1.0` = inverted
- `bodyDefined` guard. Category: `body`.

---

## Feature 4 — Angular Impulse

**`ApplyAngularImpulse(x, y, z)`**
- Instance method: `_ApplyAngularImpulse(x, y, z)`
- Command type: `ApplyAngularImpulse = 33`
- Worker: `rigidBody.applyTorqueImpulse({ x, y, z }, true)`
- One-shot rotational kick (vs `ApplyTorque` which is continuous per-step)
- `bodyDefined` guard. Category: `body`.

---

## Implementation Tasks

| Task ID | Subject | Blocked By |
|---------|---------|-----------|
| #18 | Implement velocity reading | — |
| #19 | Implement axis locks | #18 (stride change must land first) |
| #20 | Implement per-body gravity scale | — |
| #21 | Implement angular impulse | — |

Tasks #20 and #21 are independent of each other and of #18/#19.
