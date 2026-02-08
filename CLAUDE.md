# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Construct 3 behavior addon that integrates Rapier physics engine (WebAssembly) for 3D physics simulation. The addon enables rigid body dynamics, collision detection, raycasting, shape casting, and character controllers in C3 games.

## Commands

```bash
npm run build   # Generate production .c3addon file in export/
npm run dev     # Development server on port 3000 with hot-reload
npm run doc     # Generate documentation
```

## Architecture

### Configuration-Driven Build System

`src/behaviorConfig.js` is the single source of truth defining:
- Addon metadata (name, version, author)
- Properties (enable, immovable, shape type, body type, etc.)
- Actions, Conditions, and Expressions (ACEs)

`build.js` reads this config and generates:
- `export/addon.json` - Addon manifest
- `export/aces.json` - ACE definitions
- `export/lang/en-US.json` - Localized strings
- Final `.c3addon` zip file

### Worker-Based Physics

Physics runs in a WebAssembly worker thread for non-blocking simulation:

```
Main Thread (instance.js, behavior.js)
    ↓ Batched commands via postMessage
Physics Worker (rapierWorker.js + rapier3d-compat.js)
    ↓ Results batch (Float32Array transfer)
Main Thread (updates instance positions)
```

**Command Pattern:** Instance methods queue physics commands as objects, sent to worker in batches via `postMessage`. Worker processes simulation and returns results on next frame.

**Comlink:** Embedded inline (not imported) in both `behavior.js` and `rapierWorker.js` as `Mikal_Rapier_Comlink` IIFE. Only used for initial `Comlink.wrap/expose` setup and `initWorld()` call. All runtime physics commands use direct `postMessage` for lower overhead. The standalone `src/comlink.js` file is unused.

### Key Files

| File | Purpose |
|------|---------|
| `src/behaviorConfig.js` | ACE definitions, properties, metadata - edit this to add features |
| `src/instance.js` | Instance class - per-object physics body management |
| `src/behavior.js` | Behavior class - physics world, command queue, worker communication |
| `src/rapierWorker.js` | WebAssembly worker - actual physics simulation |
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

## Physics Features

- Body types: Dynamic, Fixed, Kinematic (position/velocity based)
- Shapes: Auto, ModelMesh, Box, Sphere, Cylinder, Capsule, ConvexHulls
- Collider types: Solid, Sensor
- Raycasting and shape casting (batched async)
- Character controller for player movement
- Joints (spherical, revolute)
- Collision filtering groups
- CCD (Continuous Collision Detection)
