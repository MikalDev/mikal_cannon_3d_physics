# Rapier Physics Integration Refactoring Plan

## Overview

This plan addresses technical debt from the cannon.js → Rapier → worker-based migration. Each phase is independently testable and delivers measurable improvements.

**Guiding Principles:**
- **KISS**: Simplest solution that works
- **YAGNI**: Remove speculation, implement only what's used
- **SOLID**: Single responsibility, clean interfaces

---

## Phase 1: Dead Code Removal (Low Risk, High Impact) ✅ COMPLETED

**Goal:** Remove unreachable code and migration artifacts without changing behavior.

**Test Plan:** Run existing test suite, verify all ACEs still function.

### 1.1 Remove `if (true)` Dead Paths and Comlink Remnants

**Files:** `src/instance.js`

**Background:** Comlink has been **fully removed** from the codebase. The comment at line 1 of `behavior.js` states: `// Minimal Worker RPC - replaces Comlink`. The `comRapier` property (which would have been the Comlink-wrapped worker) is **never initialized** anywhere in the codebase. All references to `this.comRapier` are inside unreachable `if (true) { return; }` blocks - pure dead code from the migration.

| Location | Lines | Action |
|----------|-------|--------|
| `_Raycast` | 915-977 | Remove `if (true)` wrapper and unreachable `comRapier.raycast()` block (~60 LOC) |
| `_CastShape` | 1494-1572 | Remove `if (true)` wrapper and unreachable `comRapier.castShape()` block (~80 LOC) |

**Before:**
```javascript
if (true) {
    this.PhysicsType.commands.push(command);
    return;
}
const result = await this.comRapier.raycast(command); // NEVER RUNS - comRapier is never initialized
// ... 60 lines of dead code using non-existent comRapier
```

**After:**
```javascript
this.PhysicsType.commands.push(command);
```

### 1.2 Remove Commented 3D Rotate Code

**Files:** `src/instance.js`

| Location | Lines | Action |
|----------|-------|--------|
| constructor | 218-227 | Remove commented rotate3D block |
| _postCreate | 251-252 | Remove TODO comment |
| DefineBody | 327-328 | Remove TODO comment |
| _UpdateBody | 393-394 | Remove TODO comment |
| _SetSizeOverride | 484-485 | Remove TODO comment |
| _Behavior3DRotate | 849-860 | Remove entire commented method |

### 1.3 Remove Unused `worldInfo` Parameter

**Files:** `src/instance.js`

- `_create3DObjectShape(shapeProperty, bodyType, colliderType, worldInfo, overrideSize)` → remove `worldInfo`
- Update all call sites (2 locations)

### 1.4 Clean Up Verbose Logging

**Action:** Create single logging helper, replace 4+ duplicate JSON.stringify calls:

```javascript
// Add to instance.js
_logCommand(methodName, command) {
    if (this.PhysicsType.debugMode) {
        console.log(`[Physics] ${methodName}:`, JSON.stringify(command, null, 2));
    }
}
```

**Estimated Reduction:** ~140 LOC removed

### Phase 1 Results

**Completed:** All items except 1.4 (verbose logging cleanup - deferred to Phase 2 as it requires command builder)

**Actual Reduction:** 188 LOC (1651 → 1463 lines in instance.js)

**Removed:**
- Dead `if (true)` blocks and unreachable `comRapier` code in `_Raycast` and `_CastShape`
- All commented 3D Rotate code (6 locations)
- Entire `_Behavior3DRotate` commented method
- Unused `worldInfo` parameter from `_create3DObjectShape` and 3 call sites

**Verified:** Build passes, JavaScript syntax valid

---

## Phase 2: Unify Command Sending Pattern ✅ COMPLETED

**Goal:** Fix inconsistent command dispatch - all commands should use the same pattern.

**Test Plan:** Torque action still works.

### ~~2.1 Create Command Factory~~ REMOVED (YAGNI)

The existing command methods are already clean and readable:
```javascript
_SetFriction(friction) {
    const command = {
        uid: this.uid,
        type: this.CommandType.SetFriction,
        friction,
    };
    this.PhysicsType.commands.push(command);
}
```

Adding a factory abstraction would:
- Add indirection without real benefit
- "LOC savings" would mostly come from collapsing readable whitespace
- Violate KISS principle

### ~~2.2 Refactor Simple Commands~~ REMOVED (No Real Benefit)

The claimed "12 LOC → 4 LOC" reduction was misleading - current methods are 7-9 lines and already well-structured.

### 2.3 Unify Command Sending Pattern

**Issue:** `_ApplyTorque` uses a different communication pattern:
```javascript
// _ApplyTorque uses RPC directly (inconsistent)
this.PhysicsType.workerRPC.send("applyTorque", [...])

// Everything else uses command queue (correct pattern)
this.PhysicsType.commands.push(command);
```

**Fix:** Convert `_ApplyTorque` to use `commands.push()` like all other methods.

### Phase 2 Results

**Changed:** 1 method (`_ApplyTorque`)
**LOC Change:** Minimal (consistency fix, not reduction)
**Benefit:** Unified command pattern - all physics commands now use the batched queue

---

## Phase 3: Coordinate Conversion Utilities ✅ COMPLETED

**Goal:** Encapsulate scale and vector math into reusable utilities.

**Test Plan:** Verify position/rotation sync works for all plugin types.

### 3.1 Create Scale Utilities

```javascript
// New instance methods
_toPhysics(worldValue) {
    return worldValue / this.PhysicsType.scale;
}

_toWorld(physicsValue) {
    return physicsValue * this.PhysicsType.scale;
}

_vecToPhysics(x, y, z) {
    const s = this.PhysicsType.scale;
    return { x: x / s, y: y / s, z: z / s };
}
```

### 3.2 Apply to All Methods

Replace 40+ occurrences of `value / this.PhysicsType.scale` with `this._toPhysics(value)`.

### 3.3 Normalize Bounding Box Format

**Current:** Complex conditional checking object vs array format

```javascript
// Before (lines 633-656)
const minX = min.x !== undefined ? min.x : min[0];
const minY = min.y !== undefined ? min.y : min[1];
// ... repeated 6 times
```

**After:**
```javascript
_normalizeBBox(min, max) {
    const getCoord = (v, i) => v[['x','y','z'][i]] ?? v[i] ?? 0;
    return {
        min: { x: getCoord(min, 0), y: getCoord(min, 1), z: getCoord(min, 2) },
        max: { x: getCoord(max, 0), y: getCoord(max, 1), z: getCoord(max, 2) }
    };
}
```

**Estimated Reduction:** ~30 LOC, cleaner math operations

### Phase 3 Results

**Actual Reduction:** 33 LOC (1463 → 1430 lines in instance.js)

**Added:**
- `_toPhysics(worldValue)` - convert world units to physics units
- `_toWorld(physicsValue)` - convert physics units to world units
- `_vecToPhysics(x, y, z)` - convert 3D vector to physics units
- `_normalizeBBox(min, max)` - normalize bounding box from {x,y,z} or [x,y,z] format

**Replaced:**
- 40+ manual `value / scale` divisions with `this._toPhysics(value)`
- Vector constructions like `{ x: x / s, y: y / s, z: z / s }` with `this._vecToPhysics(x, y, z)`
- Bounding box normalization code (12 LOC) with `this._normalizeBBox()` call

**Removed:**
- Unused `scale` and `PhysicsType` variable declarations from multiple methods

**Verified:** Build passes, JavaScript syntax valid

---

## Phase 4: Consolidate Body Creation Logic

**Goal:** Single source of truth for body/collider command construction.

**Test Plan:** Test DefineBody, UpdateBody, SetSizeOverride for all plugin types (Shape3D, Sprite, GltfStatic, Model3D).

### 4.1 Extract Plugin-Specific Builders

**Current Duplication:**
- `DefineBody` (68 LOC)
- `_UpdateBody` (68 LOC)
- `_SetSizeOverride` (90 LOC)
- `_create3DObjectShape` (234 LOC)

All contain nearly identical command construction per plugin type.

**New Structure:**

```javascript
// Single builder per plugin type
_buildBodyCommand(commandType, dimensions = null) {
    const inst = this.inst;
    const plugin = this.pluginType;

    // Common fields
    const base = {
        type: commandType,
        uid: inst.uid,
        bodyType: this.bodyType,
        colliderType: this.colliderType,
        shapeType: this.shapeProperty,
        friction: this.friction,
        restitution: this.restitution,
        mass: this.mass,
        enableRotation: this._getRotationFlags()
    };

    // Plugin-specific position/size
    return {
        ...base,
        ...this._getPluginGeometry(dimensions)
    };
}

_getPluginGeometry(overrideDims) {
    const inst = this.inst;
    switch (this.pluginType) {
        case "Shape3DPlugin":
            return this._getShape3DGeometry(overrideDims);
        case "SpritePlugin":
            return this._getSpriteGeometry(overrideDims);
        case "Model3DPlugin":
            return this._getModel3DGeometry(overrideDims);
        case "GltfStatic":
            return this._getGltfGeometry(overrideDims);
    }
}
```

### 4.2 Simplify Public Methods

```javascript
DefineBody() {
    if (this.bodyDefined) return;
    const command = this._buildBodyCommand(CommandType.AddBody);
    this._sendCommand(command.type, command);
    this.bodyDefined = true;
}

_UpdateBody() {
    if (!this.bodyDefined) return;
    const command = this._buildBodyCommand(CommandType.UpdateBody);
    this._sendCommand(command.type, command);
}

_SetSizeOverride(enable, h, w, d) {
    this.sizeOverride = enable;
    if (!enable) return;
    this.sizeOverrideHeight = h;
    this.sizeOverrideWidth = w;
    this.sizeOverrideDepth = d;

    if (!this.bodyDefined) {
        this.DefineBody();
    } else {
        this._UpdateBody();
    }
}
```

**Estimated Reduction:** ~200 LOC consolidated into ~80 LOC

---

## Phase 5: State Management Cleanup

**Goal:** Reduce per-tick computation and simplify Model3D auto-creation.

**Test Plan:** Model3D objects still auto-create bodies when loaded.

### 5.1 Replace Multi-Condition Tick Check

**Current (lines 145-180):** 5 conditions evaluated every tick.

**After:**
```javascript
// Set once when conditions met
_checkReadyForBodyCreation() {
    if (this._readyForBody) return true;

    const inst = this.inst;
    const worldReady = this.behavior?.worldReady;
    const hasGeometry = this._hasValidGeometry();

    if (worldReady && hasGeometry) {
        this._readyForBody = true;
    }
    return this._readyForBody;
}

// In _tick2
if (!this.bodyDefined && this._checkReadyForBodyCreation()) {
    this.DefineBody();
}
```

### 5.2 Implement Stub Expressions

**Current:** 7 expressions return hardcoded 0.

**Options:**
1. **Implement:** Read from cached worker results (velocities, gravity stored in `globalThis.Mikal_Rapier_Bodies`)
2. **Remove:** Delete from behaviorConfig.js if not needed

**Recommended:** Implement using existing body cache:

```javascript
_VelocityX() {
    const body = globalThis.Mikal_Rapier_Bodies?.get(this.uid);
    return body ? body.vx * this.PhysicsType.scale : 0;
}
```

---

## Phase 6: Remove Global Namespace

**Goal:** Eliminate `globalThis.Mikal_Rapier_Bodies` usage.

**Test Plan:** Body sync and expression getters still work.

### 6.1 Move Body Cache to Behavior

```javascript
// behavior.js
this.bodies = new Map();

// instance.js - replace globalThis access
_getBody() {
    return this.PhysicsType.bodies.get(this.uid);
}
```

### 6.2 Update All References

Replace 5 occurrences of `globalThis.Mikal_Rapier_Bodies` with `this.PhysicsType.bodies`.

---

## Phase 7: ~~Clean Up Comlink Usage~~ REMOVED

**Status:** Not needed. Comlink has already been fully removed from the codebase.

**Evidence:**
- `behavior.js` line 1: `// Minimal Worker RPC - replaces Comlink`
- Custom `WorkerRPC` object (30 LOC) handles all worker communication
- No Comlink import, IIFE, or initialization exists
- `comRapier` references only exist in dead code (removed in Phase 1)

---

## Phase 8: CommandType Consolidation

**Goal:** Move CommandType to shared module, eliminate duplication.

**Test Plan:** All commands still recognized by worker.

### 8.1 Create Shared Constants

```javascript
// src/commandTypes.js (new file)
export const CommandType = Object.freeze({
    AddBody: 0,
    StepWorld: 1,
    ApplyImpulse: 2,
    // ...
});
```

### 8.2 Import in Both Locations

- `instance.js`: Import instead of defining in constructor
- `rapierWorker.js`: Import same constants

---

## Summary

| Phase | Focus | LOC Removed | Risk | Testable Checkpoint |
|-------|-------|-------------|------|---------------------|
| 1 | Dead code removal | ~188 ✅ | Low | All ACEs work |
| 2 | Unify command pattern | ~0 ✅ | Low | Torque works |
| 3 | Coordinate utils | ~33 ✅ | Low | Position sync works |
| 4 | Body creation consolidation | ~200 | Medium | All plugin types work |
| 5 | State management | ~20 | Medium | Model3D auto-creation |
| 6 | Remove globals | ~10 | Low | Body cache works |
| 7 | ~~Comlink cleanup~~ | N/A | N/A | Already removed |
| 8 | Shared constants | ~30 | Low | Commands work |

**Total Estimated Reduction:** ~450 LOC (Phase 2 revised down, Phase 1 actual was higher)

---

## Execution Order

1. **Phases 1-3:** Safe refactoring, no behavior changes
2. **Phase 4:** Major consolidation, requires careful testing
3. **Phases 5-6:** State cleanup
4. **Phases 7-8:** Infrastructure cleanup (can be done anytime)

Each phase should be a separate PR with:
- Before/after LOC count
- Manual test verification
- Existing test suite passes
