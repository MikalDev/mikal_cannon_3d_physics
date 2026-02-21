# Platformer ACE Toolkit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add velocity reading (fix stubs + angular velocity), axis locks, per-body gravity scale, and angular impulse to the Rapier 3D Physics addon.

**Architecture:** Four files touched: `rapierWorker.js` (body batch format + new command handlers), `behavior.js` (stride + storage), `instance.js` (expressions + command methods), `behaviorConfig.js` (ACE declarations). No new files. No API breakage.

**Tech Stack:** Vanilla JS (ES2020), Rapier physics WASM worker, Construct 3 SDK v2

---

### Task 1: Velocity Reading

**Files:**
- Modify: `src/rapierWorker.js` (~line 8587)
- Modify: `src/behavior.js` (~line 127)
- Modify: `src/instance.js` (~lines 1151–1161 and after `_VelocityZ`)
- Modify: `src/behaviorConfig.js` (Exps section, after VelocityZ)

**Context:** The worker packs body state into a Float32Array with 8 values per body: `uid, x, y, z, rx, ry, rz, rw`. This needs to extend to 14 values by appending `vx, vy, vz` (linear velocity) and `ax, ay, az` (angular velocity). `behavior.js` reads this array in a stride-8 loop and populates `Mikal_Rapier_Bodies`. `instance.js` has `_VelocityX/Y/Z` that hardcode `return 0` — fix them to read the map.

---

**Step 1: Extend body packing in rapierWorker.js**

Find this block (around line 8584):

```js
const bodiesData = new Float32Array(numBodies * 8);
let i = 0;
bodies.forEach((body) => {
    const translation = body.translation();
    const rotation = body.rotation();
    bodiesData[i++] = body.uid;
    bodiesData[i++] = translation.x;
    bodiesData[i++] = translation.y;
    bodiesData[i++] = translation.z;
    bodiesData[i++] = rotation.x;
    bodiesData[i++] = rotation.y;
    bodiesData[i++] = rotation.z;
    bodiesData[i++] = rotation.w;
});
```

Replace with:

```js
const bodiesData = new Float32Array(numBodies * 14);
let i = 0;
bodies.forEach((body) => {
    const translation = body.translation();
    const rotation = body.rotation();
    const linvel = body.linvel();
    const angvel = body.angvel();
    bodiesData[i++] = body.uid;
    bodiesData[i++] = translation.x;
    bodiesData[i++] = translation.y;
    bodiesData[i++] = translation.z;
    bodiesData[i++] = rotation.x;
    bodiesData[i++] = rotation.y;
    bodiesData[i++] = rotation.z;
    bodiesData[i++] = rotation.w;
    bodiesData[i++] = linvel.x;
    bodiesData[i++] = linvel.y;
    bodiesData[i++] = linvel.z;
    bodiesData[i++] = angvel.x;
    bodiesData[i++] = angvel.y;
    bodiesData[i++] = angvel.z;
});
```

**Step 2: Update updateBodies in behavior.js**

Find the `updateBodies` method (around line 123):

```js
for (let i = 0; i < bodies.length; i += 8) {
    const uid = bodies[i];
    const x = bodies[i + 1] * scale;
    const y = bodies[i + 2] * scale;
    const z = bodies[i + 3] * scale;
    const rx = bodies[i + 4];
    const ry = bodies[i + 5];
    const rz = bodies[i + 6];
    const rw = bodies[i + 7];
    globalThis.Mikal_Rapier_Bodies.set(uid, {
        translation: { x, y, z },
        rotation: { x: rx, y: ry, z: rz, w: rw },
    });
}
```

Replace with:

```js
for (let i = 0; i < bodies.length; i += 14) {
    const uid = bodies[i];
    const x = bodies[i + 1] * scale;
    const y = bodies[i + 2] * scale;
    const z = bodies[i + 3] * scale;
    const rx = bodies[i + 4];
    const ry = bodies[i + 5];
    const rz = bodies[i + 6];
    const rw = bodies[i + 7];
    const vx = bodies[i + 8] * scale;
    const vy = bodies[i + 9] * scale;
    const vz = bodies[i + 10] * scale;
    const ax = bodies[i + 11];
    const ay = bodies[i + 12];
    const az = bodies[i + 13];
    globalThis.Mikal_Rapier_Bodies.set(uid, {
        translation: { x, y, z },
        rotation: { x: rx, y: ry, z: rz, w: rw },
        velocity: { x: vx, y: vy, z: vz },
        angularVelocity: { x: ax, y: ay, z: az },
    });
}
```

**Step 3: Fix VelocityX/Y/Z in instance.js**

Find these three methods (around line 1151):

```js
_VelocityX() {
    return 0;
}

_VelocityY() {
    return 0;
}

_VelocityZ() {
    return 0;
}
```

Replace with:

```js
_VelocityX() {
    return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.x ?? 0;
}

_VelocityY() {
    return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.y ?? 0;
}

_VelocityZ() {
    return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.z ?? 0;
}
```

**Step 4: Add AngularVelocityX/Y/Z methods in instance.js**

Add immediately after `_VelocityZ()`:

```js
_AngularVelocityX() {
    return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.x ?? 0;
}

_AngularVelocityY() {
    return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.y ?? 0;
}

_AngularVelocityZ() {
    return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.z ?? 0;
}
```

**Step 5: Add AngularVelocityX/Y/Z to behaviorConfig.js**

Find the `VelocityZ` expression entry in the `Exps` section and add immediately after it:

```js
AngularVelocityX: {
    category: "body",
    forward: "_AngularVelocityX",
    autoScriptInterface: true,
    highlight: false,
    deprecated: false,
    returnType: "number",
    isVariadicParameters: false,
    params: [],
    description: "Angular velocity x (rad/s).",
},
AngularVelocityY: {
    category: "body",
    forward: "_AngularVelocityY",
    autoScriptInterface: true,
    highlight: false,
    deprecated: false,
    returnType: "number",
    isVariadicParameters: false,
    params: [],
    description: "Angular velocity y (rad/s).",
},
AngularVelocityZ: {
    category: "body",
    forward: "_AngularVelocityZ",
    autoScriptInterface: true,
    highlight: false,
    deprecated: false,
    returnType: "number",
    isVariadicParameters: false,
    params: [],
    description: "Angular velocity z (rad/s).",
},
```

**Step 6: Build and verify**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && npm run build
```

Expected: succeeds, `.c3addon` in `dist/`.

**Step 7: Commit**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && git add src/rapierWorker.js src/behavior.js src/instance.js src/behaviorConfig.js && git commit -m "$(cat <<'EOF'
feat: add velocity reading (fix VelocityX/Y/Z stubs, add AngularVelocityX/Y/Z)

Extends worker body batch from 8 to 14 floats per body to include linvel and angvel.
VelocityX/Y/Z expressions now return actual body velocity in world units.
AngularVelocityX/Y/Z expressions added (rad/s).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Axis Locks

**Files:**
- Modify: `src/rapierWorker.js` (CommandType object ~line 8063, new functions before commandFunctions, commandFunctions map ~line 9184)
- Modify: `src/instance.js` (CommandType object in constructor ~line 48, two new methods)
- Modify: `src/behaviorConfig.js` (Acts section)

**Context:** Rapier exposes `body.setEnabledRotations(x, y, z, wakeUp)` and `body.setEnabledTranslations(x, y, z, wakeUp)`. Both take three booleans — `false` locks that axis. All new worker functions follow the same pattern: get uid → get handle → get body → call Rapier API.

**Note:** Task 2 depends on Task 1 being committed first (the stride change in step 1 must be in place).

---

**Step 1: Add CommandType entries in rapierWorker.js**

Find the `CommandType` object (around line 8063). It ends with:

```js
SetRestitution: 28,
SetFriction: 29,
```

Add after `SetFriction: 29,`:

```js
SetEnabledRotations: 30,
SetEnabledTranslations: 31,
```

**Step 2: Add handler functions in rapierWorker.js**

Add these two functions immediately before the `commandFunctions` object (around line 9152):

```js
function setEnabledRotations(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setEnabledRotations(config.enableX, config.enableY, config.enableZ, true);
    }
}

function setEnabledTranslations(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setEnabledTranslations(config.enableX, config.enableY, config.enableZ, true);
    }
}
```

**Step 3: Register in commandFunctions in rapierWorker.js**

Find the closing of `commandFunctions` (line 9184):

```js
    [CommandType.SetRestitution]: setRestitution,
    [CommandType.SetFriction]: setFriction,
};
```

Change to:

```js
    [CommandType.SetRestitution]: setRestitution,
    [CommandType.SetFriction]: setFriction,
    [CommandType.SetEnabledRotations]: setEnabledRotations,
    [CommandType.SetEnabledTranslations]: setEnabledTranslations,
};
```

**Step 4: Add CommandType entries in instance.js**

In the constructor's `this.CommandType` object, find:

```js
SetFriction: 29,
```

Add after:

```js
SetEnabledRotations: 30,
SetEnabledTranslations: 31,
```

**Step 5: Add instance methods in instance.js**

Add these two methods alongside the other fire-and-forget body methods (e.g., after `_SetCCD`):

```js
_SetEnabledRotations(x, y, z) {
    if (!this.bodyDefined) return;
    const command = {
        uid: this.uid,
        type: this.CommandType.SetEnabledRotations,
        enableX: x,
        enableY: y,
        enableZ: z,
    };
    this.PhysicsType.commands.push(command);
}

_SetEnabledTranslations(x, y, z) {
    if (!this.bodyDefined) return;
    const command = {
        uid: this.uid,
        type: this.CommandType.SetEnabledTranslations,
        enableX: x,
        enableY: y,
        enableZ: z,
    };
    this.PhysicsType.commands.push(command);
}
```

**Step 6: Add ACE entries in behaviorConfig.js**

Add in the `Acts` section (after `SetCCD` is a good spot):

```js
SetEnabledRotations: {
    category: "body",
    forward: "_SetEnabledRotations",
    autoScriptInterface: true,
    highlight: false,
    deprecated: false,
    isAsync: false,
    params: [
        {
            id: "enableX",
            name: "Enable X rotation",
            desc: "Allow rotation around X axis.",
            type: "boolean",
            initialValue: "true",
        },
        {
            id: "enableY",
            name: "Enable Y rotation",
            desc: "Allow rotation around Y axis.",
            type: "boolean",
            initialValue: "true",
        },
        {
            id: "enableZ",
            name: "Enable Z rotation",
            desc: "Allow rotation around Z axis.",
            type: "boolean",
            initialValue: "true",
        },
    ],
    listName: "Set enabled rotations",
    displayText: "Set {my} enabled rotations X:{0} Y:{1} Z:{2}",
    description: "Lock or unlock rotation axes. Set false to prevent rotation on that axis.",
},
SetEnabledTranslations: {
    category: "body",
    forward: "_SetEnabledTranslations",
    autoScriptInterface: true,
    highlight: false,
    deprecated: false,
    isAsync: false,
    params: [
        {
            id: "enableX",
            name: "Enable X translation",
            desc: "Allow movement along X axis.",
            type: "boolean",
            initialValue: "true",
        },
        {
            id: "enableY",
            name: "Enable Y translation",
            desc: "Allow movement along Y axis.",
            type: "boolean",
            initialValue: "true",
        },
        {
            id: "enableZ",
            name: "Enable Z translation",
            desc: "Allow movement along Z axis.",
            type: "boolean",
            initialValue: "true",
        },
    ],
    listName: "Set enabled translations",
    displayText: "Set {my} enabled translations X:{0} Y:{1} Z:{2}",
    description: "Lock or unlock translation axes. Set false to pin the body on that axis.",
},
```

**Step 7: Build and verify**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && npm run build
```

Expected: succeeds.

**Step 8: Commit**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && git add src/rapierWorker.js src/instance.js src/behaviorConfig.js && git commit -m "$(cat <<'EOF'
feat: add axis lock actions (SetEnabledRotations, SetEnabledTranslations)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Per-Body Gravity Scale

**Files:**
- Modify: `src/rapierWorker.js` (CommandType, new function, commandFunctions)
- Modify: `src/instance.js` (CommandType, new method)
- Modify: `src/behaviorConfig.js` (Acts section)

**Context:** Rapier exposes `body.setGravityScale(value, wakeUp)`. `1.0` = normal, `0.0` = weightless, `-1.0` = inverted. Independent of Task 1 and 2.

---

**Step 1: Add CommandType in rapierWorker.js**

After `SetEnabledTranslations: 31,` (or after `SetFriction: 29,` if Task 2 not yet done) add:

```js
SetGravityScale: 32,
```

**Step 2: Add handler function in rapierWorker.js**

Add before `commandFunctions`:

```js
function setGravityScale(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setGravityScale(config.scale, true);
    }
}
```

**Step 3: Register in commandFunctions in rapierWorker.js**

Add to the `commandFunctions` map:

```js
[CommandType.SetGravityScale]: setGravityScale,
```

**Step 4: Add CommandType in instance.js**

Add to `this.CommandType`:

```js
SetGravityScale: 32,
```

**Step 5: Add instance method in instance.js**

```js
_SetGravityScale(scale) {
    if (!this.bodyDefined) return;
    const command = {
        uid: this.uid,
        type: this.CommandType.SetGravityScale,
        scale,
    };
    this.PhysicsType.commands.push(command);
}
```

**Step 6: Add ACE entry in behaviorConfig.js**

```js
SetGravityScale: {
    category: "body",
    forward: "_SetGravityScale",
    autoScriptInterface: true,
    highlight: false,
    deprecated: false,
    isAsync: false,
    params: [
        {
            id: "scale",
            name: "Gravity scale",
            desc: "Gravity multiplier. 1.0 = normal, 0.0 = weightless, -1.0 = inverted.",
            type: "number",
            initialValue: "1.0",
        },
    ],
    listName: "Set gravity scale",
    displayText: "Set {my} gravity scale to {0}",
    description: "Set per-body gravity scale. 1.0 = normal, 0.0 = weightless, 2.0 = double gravity.",
},
```

**Step 7: Build and verify**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && npm run build
```

**Step 8: Commit**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && git add src/rapierWorker.js src/instance.js src/behaviorConfig.js && git commit -m "$(cat <<'EOF'
feat: add per-body gravity scale (SetGravityScale)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Angular Impulse

**Files:**
- Modify: `src/rapierWorker.js` (CommandType, new function, commandFunctions)
- Modify: `src/instance.js` (CommandType, new method)
- Modify: `src/behaviorConfig.js` (Acts section)

**Context:** Rapier exposes `body.applyTorqueImpulse(vec, wakeUp)`. This is an instantaneous rotational kick — unlike `applyTorque` which must be called every frame to sustain spin. Independent of all other tasks.

---

**Step 1: Add CommandType in rapierWorker.js**

Add (after existing highest value):

```js
ApplyAngularImpulse: 33,
```

**Step 2: Add handler function in rapierWorker.js**

Add before `commandFunctions`:

```js
function applyAngularImpulse(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.applyTorqueImpulse({ x: config.x, y: config.y, z: config.z }, true);
    }
}
```

**Step 3: Register in commandFunctions in rapierWorker.js**

```js
[CommandType.ApplyAngularImpulse]: applyAngularImpulse,
```

**Step 4: Add CommandType in instance.js**

```js
ApplyAngularImpulse: 33,
```

**Step 5: Add instance method in instance.js**

```js
_ApplyAngularImpulse(x, y, z) {
    if (!this.bodyDefined) return;
    const command = {
        type: this.CommandType.ApplyAngularImpulse,
        uid: this.uid,
        x,
        y,
        z,
    };
    this.PhysicsType.commands.push(command);
}
```

**Step 6: Add ACE entry in behaviorConfig.js**

```js
ApplyAngularImpulse: {
    category: "body",
    forward: "_ApplyAngularImpulse",
    autoScriptInterface: true,
    highlight: false,
    deprecated: false,
    isAsync: false,
    params: [
        {
            id: "x",
            name: "X",
            desc: "Angular impulse X.",
            type: "number",
            initialValue: "0",
        },
        {
            id: "y",
            name: "Y",
            desc: "Angular impulse Y.",
            type: "number",
            initialValue: "0",
        },
        {
            id: "z",
            name: "Z",
            desc: "Angular impulse Z.",
            type: "number",
            initialValue: "0",
        },
    ],
    listName: "Apply angular impulse",
    displayText: "Apply {my} angular impulse {0}, {1}, {2}",
    description: "Apply an instantaneous rotational impulse to a body (one-shot, unlike ApplyTorque which is per-step).",
},
```

**Step 7: Build and verify**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && npm run build
```

**Step 8: Commit**

```bash
cd /c/Users/danps/Projects/mikal_cannon_3d_physics-v2 && git add src/rapierWorker.js src/instance.js src/behaviorConfig.js && git commit -m "$(cat <<'EOF'
feat: add angular impulse action (ApplyAngularImpulse)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
