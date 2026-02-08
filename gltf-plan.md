# GltfStatic Plugin API for Physics Integration

This document specifies the API for position/rotation synchronization between `mikal_cannon_3d_physics` behavior and `GltfStatic` plugin.

## Overview

The physics behavior sets position and rotation directly on the GltfStatic instance each frame, consistent with how it handles Sprite instances.

## Data Flow

```
Rapier Worker (physics simulation)
    ↓ Float32Array via postMessage
Physics Behavior (instance.js _tick2)
    ↓ sets inst.x, inst.y, inst.zElevation, inst.quaternion
GltfStatic Instance (uses properties in render)
    ↓
Rendered GLTF Model
```

## Required GltfStatic Properties

GltfStatic must expose these properties that the physics behavior will set:

| Property | Type | Description |
|----------|------|-------------|
| `x` | `number` | World X position (standard SDK v2) |
| `y` | `number` | World Y position (standard SDK v2) |
| `zElevation` | `number` | World Z position (standard SDK v2) |
| `quaternion` | `{x, y, z, w}` | Rotation quaternion |

### Quaternion Property

GltfStatic needs to expose a `quaternion` property (or setter) that accepts:

```javascript
{
    x: number,  // Quaternion X component
    y: number,  // Quaternion Y component
    z: number,  // Quaternion Z component
    w: number   // Quaternion W component
}
```

**Implementation in GltfStatic:**

```javascript
// In GltfStatic instance class:
set quaternion(q) {
    this._quaternion = q;
    // Update model transform matrix using quaternion
    // e.g., mat4.fromQuat(this.rotationMatrix, [q.x, q.y, q.z, q.w]);
}

get quaternion() {
    return this._quaternion;
}
```

## Physics Behavior Changes

Location: `src/instance.js` in `_tick2()`

Current code:
```javascript
if (this.pluginType == "GltfStaticPlugin") {
    this.setBody.position = position;
    this.setBody.quaternion = quatRot;
    inst.zElevation = position.z;
}
```

**Updated code:**
```javascript
if (this.pluginType == "GltfStaticPlugin") {
    inst.x = position.x;
    inst.y = position.y;
    inst.zElevation = position.z;
    inst.quaternion = quatRot;  // {x, y, z, w}
}
```

This matches the pattern used for Sprite:
```javascript
} else {
    inst.x = position.x;
    inst.y = position.y;
    inst.zElevation = zElevation;
    // angle set via quaternion->euler conversion
}
```

## Summary Checklist

**GltfStatic plugin needs to:**

- [ ] Expose `quaternion` property (setter) accepting `{x, y, z, w}`
- [ ] Apply quaternion to model transform matrix in render
- [ ] Standard `x`, `y`, `zElevation` already available via SDK v2

**Physics behavior needs to:**

- [ ] Update `_tick2()` to set `inst.x`, `inst.y`, `inst.quaternion` directly
- [ ] Remove `this.setBody` usage for GltfStaticPlugin
