# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Construct 3 behavior addon that integrates Rapier physics engine (WebAssembly) for 3D physics simulation. The addon enables rigid body dynamics, collision detection, raycasting, shape casting, and character controllers in C3 games.

## Commands

```bash
npm run build       # Stage addon into export/, then zip to dist/<id>-<version>.c3addon
npm run dev         # Development server with hot-reload (serves the addon for C3 dev)
npm run doc         # Generate documentation
npm run test:build  # Build the C3 test project into tests/output/c3-project/ (then open in C3)
```

**Versioning:** The addon version lives in `src/behaviorConfig.js` (not `package.json`). Bump it there when releasing.

**Testing:** Tests run inside Construct 3, not via a CLI. Write TypeScript test scripts in `tests/scripts/test_<feature>.ts`, run `npm run test:build`, then open `tests/output/c3-project/` in C3 to execute them. See `tests/TESTING.md` for the full workflow.

## Architecture

### Configuration-Driven Build System

`src/behaviorConfig.js` is the single source of truth defining:
- Addon metadata (name, version, author)
- Properties (enable, immovable, shape type, body type, etc.)
- Actions, Conditions, and Expressions (ACEs)

`build.js` reads this config and generates into the `export/` staging folder:
- `export/addon.json` - Addon manifest
- `export/aces.json` - ACE definitions
- `export/lang/en-US.json` - Localized strings
- `export/editor.js`, `export/c3runtime/behavior.js` - injected with plugin info from config

It then zips `export/` into the final `dist/<id>-<version>.c3addon`. `export/` is the
build staging directory; `dist/` holds the distributable.

**Worker assembly:** the physics worker `export/c3runtime/rapierWorker.js` is *generated* by
concatenating `src/rapierLib.js` + `src/rapierWorkerLogic.js` at build time. There is no
`src/rapierWorker.js`. See "Worker-Based Physics" below.

### Worker-Based Physics

Physics runs in a WebAssembly worker thread for non-blocking simulation:

```
Main Thread (instance.js, behavior.js)
    ↓ Batched commands via postMessage
Physics Worker (rapierLib.js [WASM bundle] + rapierWorkerLogic.js [custom logic])
    ↓ Results batch (Float32Array transfer)
Main Thread (updates instance positions)
```

**Editing the worker:** `src/rapierLib.js` is the generated Rapier WASM bundle (~8000 lines) —
do NOT edit it. All custom worker logic lives in `src/rapierWorkerLogic.js`. The two are
concatenated into `rapierWorker.js` only at build time.

**Body batch format:** the worker returns one row per body each frame as a `Float32Array`:
`uid, x, y, z, rx, ry, rz, rw, vx, vy, vz, ax, ay, az, sleeping, bodyType, mass` (17 floats).
`bodyType`: 0=Dynamic, 1=Fixed, 2=KinematicPosition, 3=KinematicVelocity. The map of body
state is `globalThis.Mikal_Rapier_Bodies`, keyed by uid. Note: this map is empty on tick 0
(the first async `stepWorld` hasn't returned), so expressions reading it return defaults until
tick 1.

**Adding a worker command:** add the constant to `CommandType` in BOTH `src/rapierWorkerLogic.js`
and the `instance.js` constructor, add a handler function, and register it in the
`commandFunctions` map in the worker.

**Command Pattern:** Instance methods queue physics commands as objects, sent to worker in batches via `postMessage`. Worker processes simulation and returns results on next frame.

**WorkerRPC:** Minimal RPC helper (30 LOC) in `behavior.js` handles worker communication. Used for `initWorld()` call and `stepWorld()` results. All other commands use fire-and-forget `postMessage`.

### Key Files

| File | Purpose |
|------|---------|
| `src/behaviorConfig.js` | ACE definitions, properties, metadata, **addon version** - edit this to add features |
| `src/instance.js` | Instance class - per-object physics body management; also IS the C3 JS scripting interface |
| `src/behavior.js` | Behavior class - physics world, command queue, worker communication |
| `src/rapierWorkerLogic.js` | Custom worker logic - command handlers, simulation step (edit this) |
| `src/rapierLib.js` | Generated Rapier WASM bundle (~8000 lines) - **do not edit** |
| `src/editor.js` | Editor-time behavior definition for the C3 IDE |
| `build.js` | Build system generating addon from config |

### Naming Conventions

- Private instance methods: `_PrefixedCamelCase` (e.g., `_SetWorldGravity`)
- Config IDs: `camelCase` (e.g., `setGravity`)
- Config class names: `PascalCase` (e.g., `SetGravity`)
- Command types: `CommandType.AddBody`, `CommandType.RemoveBody`, etc.

### ACE Structure in behaviorConfig.js

```javascript
Acts: {
  categoryName: {
    actionId: {
      c3: ["param1", "param2"],        // C3 runtime params
      forward: "_MethodName",           // Instance method to call
      highlight: true,                  // Optional UI highlight
      autoScriptInterface: true,        // Auto-generate script API
      params: [{ id, name, desc, type }]
    }
  }
}
```

Same pattern for `Cnds` (conditions) and `Exps` (expressions).

### C3 JS Scripting Interface

The `instance.js` class **is** the script interface — no separate registration. All its methods
(including `_PrefixedCamelCase` ones; C3 does not filter underscores) are callable from C3 JS
scripting via `inst.behaviors.Rapier3DPhysics.<method>(...)` (the behavior's editor name is
`Rapier3DPhysics`). The `autoScriptInterface: true` flag only affects trigger registration, not
method exposure.

## Supported Plugins

The physics behavior supports the following Construct 3 object types:

### 3D Objects
- **3D Shape** (Shape3D plugin) - Limited to Z-axis rotation only
- **GltfStatic** - Full 3D rotation with quaternions, auto-detects bounding box
- **Model3D** - Full 3D rotation with quaternions via `getQuaternion()`/`setQuaternion()`, requires manual size override or bounding box extraction

### 2D Objects
- **Sprite** - 2D physics with mesh collision support

### Model3D Integration Details

**Rotation Format:**
- Model3D uses quaternions via `getQuaternion()` and `setQuaternion()` methods
- Same pattern as GltfStatic for consistent handling

**Position Properties:**
- Model3D: `x`, `y`, `z` (world position)
- GltfStatic: `x`, `y`, `z`

**Scale Handling:**
- Model3D scale (`scaleX`, `scaleY`, `scaleZ`) is automatically applied to physics body dimensions
- Visual size matches physics size for intuitive behavior

**Body Creation:**
- Use "Set size override" action to manually specify dimensions
- Auto-creation triggers when model loads AND (bounding box extracted OR size override enabled)
- Bounding box extraction attempts to access internal `AnimatedModel` object (may not always succeed)

## Physics Features

- Body types: Dynamic, Fixed, Kinematic (position/velocity based)
- Shapes: Auto, ModelMesh, Box, Sphere, Cylinder, Capsule, ConvexHulls
- Collider types: Solid, Sensor
- Raycasting and shape casting (batched async)
- Character controller for player movement
- Joints (spherical, revolute)
- Collision filtering groups
- CCD (Continuous Collision Detection)
