# Dead Code Removal & KISS Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove unused code, fix three real bugs, and extract a command-building helper to eliminate ~120 lines of duplication — all without changing observable behavior.

**Architecture:** Surgical file-by-file edits in `src/instance.js`, `src/behavior.js`, and `src/behaviorConfig.js`. No new files. No API changes. Each task is independently verifiable by running `npm run build` and checking for no errors.

**Tech Stack:** Vanilla JS (ES2020), Construct 3 SDK v2, Rapier physics worker (untouched)

---

### Task 1: Remove dead code from instance.js

**Files:**
- Modify: `src/instance.js`

**Step 1: Delete `transformDrawVerts` function**

The entire function at the bottom of `src/instance.js` (after `getInstanceJs` closes) is unused. Remove it completely — from the `function transformDrawVerts(` line through the closing `}` ~53 lines later.

```
// DELETE lines ~1327–1380 — the entire transformDrawVerts function block
```

**Step 2: Delete unused locals in `_postCreate` GltfStatic branch**

In `_postCreate`, find the `else if (pluginId === "GltfStatic")` block. Remove these two lines:

```js
// DELETE these two lines (they are assigned but never read):
const hasQuaternion = inst.quaternion !== undefined;
const quat = inst.quaternion || { x: 0, y: 0, z: 0, w: 1 };
```

The comment `// GltfStatic detected` can stay or go — remove it too (YAGNI).

**Step 3: Delete `dimensionSource` assignments in `_create3DObjectShape`**

Find every line that assigns `dimensionSource` — there are four of them:

```js
// DELETE each of these lines:
let dimensionSource = "manual";
dimensionSource = "extracted bounding box";
dimensionSource = "bounding box";
dimensionSource = "instance dimensions";
```

Do NOT remove the surrounding logic — only the `dimensionSource` variable declaration and its four assignment lines.

**Step 4: Build and verify**

```bash
npm run build
```

Expected: build succeeds, `.c3addon` generated in `export/`, no errors.

**Step 5: Commit**

```bash
git add src/instance.js
git commit -m "refactor: remove dead code (transformDrawVerts, unused locals, dimensionSource)"
```

---

### Task 2: Fix three bugs

**Files:**
- Modify: `src/behavior.js`
- Modify: `src/instance.js`

**Step 1: Fix `cmdTickCount` initialisation in `behavior.js`**

Find this line in the `constructor()` of the behavior class:

```js
this.cmdTickCount, (this.tickCount = 0);
```

Replace with:

```js
this.cmdTickCount = 0;
this.tickCount = 0;
```

The comma operator was silently leaving `cmdTickCount` as `undefined`. This causes a falsy-but-not-zero initial state that could cause subtle tick-dedup failures on the first frame.

**Step 2: Remove no-op division in `_Raycast` in `instance.js`**

Find these two consecutive lines in `_Raycast`:

```js
vec3.normalize(to, to);
const dir = to;
maxToI = maxToI / vec3.length(dir);
```

Remove the last line — after normalising, `vec3.length(dir)` is always exactly `1.0`, so the division is a no-op:

```js
vec3.normalize(to, to);
const dir = to;
// maxToI / vec3.length(dir) removed — length of normalised vector is always 1
```

**Step 3: Fix wrong CommandType in `_SetSizeOverride` SpritePlugin branch in `instance.js`**

In `_SetSizeOverride`, find the SpritePlugin branch (the `else if (this.pluginType == "SpritePlugin")` block inside the `if (enable)` section). The command object has:

```js
type: this.CommandType.UpdateBody,
```

Change it to:

```js
type: this.CommandType.SetSizeOverride,
```

This makes it consistent with the Shape3DPlugin branch in the same function.

**Step 4: Build and verify**

```bash
npm run build
```

Expected: build succeeds, no errors.

**Step 5: Commit**

```bash
git add src/behavior.js src/instance.js
git commit -m "fix: init cmdTickCount, remove no-op vec3.length division, correct SetSizeOverride CommandType"
```

---

### Task 3: Extract `_buildBodyCommand` helper in `instance.js`

**Files:**
- Modify: `src/instance.js`

This task eliminates the near-identical command object construction duplicated across `DefineBody`, `_UpdateBody`, and `_SetSizeOverride`.

**Step 1: Add `_buildBodyCommand` method**

Add this method to the instance class, just before `DefineBody`:

```js
_buildBodyCommand(type, overrides = {}) {
    const inst = this.instance;
    const quat = globalThis.glMatrix.quat;
    const zHeight = inst.depth || 0;
    const initialQuat = quat.create();
    quat.fromEuler(initialQuat, 0, 0, (inst.angle * 180) / Math.PI);

    const isShape3D = this.pluginType === "Shape3DPlugin";
    const isSprite = this.pluginType === "SpritePlugin";

    const posX = isSprite ? inst.x - inst.width / 2 : inst.x;
    const posY = isSprite ? inst.y - inst.height / 2 : inst.y;
    const posZ = inst.z + (isShape3D ? zHeight / 2 : 0);

    const base = {
        type,
        uid: inst.uid,
        ...this._vecToPhysics(posX, posY, posZ),
        q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
        width: this._toPhysics(inst.width),
        height: this._toPhysics(inst.height),
        depth: this._toPhysics(zHeight),
        immovable: this.immovable,
        enableRot0: !isShape3D,
        enableRot1: !isShape3D,
        enableRot2: true,
        shapeType: this.shapeProperty,
        bodyType: this.bodyType,
        colliderType: this.colliderType,
        mass: this.mass,
    };

    return { ...base, ...overrides };
}
```

**Step 2: Refactor `DefineBody` to use the helper**

Replace the body of `DefineBody` with:

```js
async DefineBody(pluginType, shape, shapeType, bodyType, colliderType) {
    let command = null;

    if (pluginType === "Shape3DPlugin") {
        command = this._buildBodyCommand(this.CommandType.AddBody, {
            shapeType,
            bodyType,
            colliderType,
            shape,
        });
    } else if (this.pluginType === "SpritePlugin") {
        command = this._buildBodyCommand(this.CommandType.AddBody, {
            shapeType,
            bodyType,
            colliderType,
            shape: null,
            meshPoints: this._getMeshPoints(),
        });
    }

    this.PhysicsType.commands.push(command);
}
```

**Step 3: Refactor `_UpdateBody` to use the helper**

Replace the body of `_UpdateBody` with:

```js
_UpdateBody() {
    let command = null;

    if (this.pluginType === "Shape3DPlugin") {
        const shape = mapShapeToNumber(this.instance.shape);
        command = this._buildBodyCommand(this.CommandType.UpdateBody, { shape });
    } else if (this.pluginType === "SpritePlugin") {
        command = this._buildBodyCommand(this.CommandType.UpdateBody, {
            shape: null,
            meshPoints: this._getMeshPoints(),
        });
    } else {
        console.error("invalid pluginType", this.pluginType);
        return;
    }

    this.PhysicsType.commands.push(command);
}
```

**Step 4: Refactor `_SetSizeOverride` to use the helper**

Replace the `if (enable)` block in `_SetSizeOverride` (the block that builds commands for Shape3D and Sprite) with:

```js
if (!enable) {
    this._UpdateBody();
    return;
}

let command = null;

if (this.pluginType === "Shape3DPlugin") {
    const shape = mapShapeToNumber(this.instance.shape);
    command = this._buildBodyCommand(this.CommandType.SetSizeOverride, {
        shape,
        width: this._toPhysics(width),
        height: this._toPhysics(height),
        depth: this._toPhysics(depth),
    });
} else if (this.pluginType === "SpritePlugin") {
    command = this._buildBodyCommand(this.CommandType.SetSizeOverride, {
        shape: null,
        meshPoints: this._getMeshPoints(),
    });
} else {
    console.error("invalid pluginType", this.pluginType);
    return;
}

this.PhysicsType.commands.push(command);
```

Note: The GltfStatic/Model3D early-return at the top of `_SetSizeOverride` stays unchanged.

**Step 5: Build and verify**

```bash
npm run build
```

Expected: build succeeds, no errors.

**Step 6: Commit**

```bash
git add src/instance.js
git commit -m "refactor: extract _buildBodyCommand helper, collapse duplicated command construction"
```

---

### Task 4: Fix deprecated field names in `behaviorConfig.js`

**Files:**
- Modify: `src/behaviorConfig.js`

**Step 1: Fix `SetCollisionFilterGroup`**

Find the `SetCollisionFilterGroup` ACE entry. It has:

```js
isDeprecated: true,
```

Change to:

```js
deprecated: true,
```

**Step 2: Fix `SetCollisionFilterMask`**

Find the `SetCollisionFilterMask` ACE entry. It has:

```js
isDeprecated: true,
```

Change to:

```js
deprecated: true,
```

**Step 3: Build and verify**

```bash
npm run build
```

Expected: build succeeds. The two ACEs should now be hidden in the C3 editor UI.

**Step 4: Commit**

```bash
git add src/behaviorConfig.js
git commit -m "fix: correct deprecated field name for SetCollisionFilterGroup and SetCollisionFilterMask"
```
