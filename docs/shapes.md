# Collider Shapes

This guide covers all collider shapes available in the Rapier 3D Physics behavior. Shapes define the collision geometry used by the physics engine — they do not affect the visual appearance of the object.

---

## Shape Property

Set in the **Properties** panel under **Shape**. The shape determines how the physics engine represents the object for collision detection.

| Shape | Description | Dimensions Used |
|-------|-------------|-----------------|
| Auto | Inferred from the object type (Box for most, Trimesh for Sprite mesh) | width, height, depth |
| Model Mesh | Uses the 3D model's mesh geometry (GltfStatic/Model3D only, falls back to Box) | width, height, depth |
| Box | Axis-aligned cuboid | width, height, depth |
| Sphere | Sphere using the largest dimension as diameter | max(width, height, depth) |
| Cylinder | Cylinder aligned to the Z axis | width (radius), depth (height) |
| Capsule | Capsule (cylinder with rounded ends) aligned to the Z axis | width (radius), depth (height) |
| Cone | Cone aligned to the Z axis | width (radius), depth (height) |
| Ramp | Wedge (bisected cube) — a slope from full height on one side to zero on the other | width, height, depth |
| Plane | Thin box with a fixed small Y thickness — useful for ground planes, walls, and platforms | width (X), depth (Z), Y is fixed |
| Convex Hulls | Convex hull from model vertices (GltfStatic/Model3D only, falls back to Box) | width, height, depth |

---

## Shape Details

### Box

Standard axis-aligned cuboid. The most common shape for walls, floors, crates, and platforms.

- Half-extents: `width/2`, `height/2`, `depth/2`
- Works with all object types

### Sphere

A sphere whose radius is half the largest dimension. Use for balls, projectiles, or any round object.

- Radius: `max(width, height, depth) / 2`
- Cheapest collision shape — prefer when possible

### Cylinder

A cylinder standing along the Z axis.

- Half-height: `depth / 2`
- Radius: `width / 2`
- Good for pillars, barrels, and wheels

### Capsule

A cylinder with hemispherical caps on both ends, aligned to Z.

- Half-height (cylinder segment): `depth / 2`
- Radius: `width / 2`
- Ideal for character bodies — smooth sliding against edges and stairs

### Cone

A cone standing along the Z axis with its base at the bottom.

- Half-height: `depth / 2`
- Radius: `width / 2`
- Useful for funnels, spikes, and pointed objects

### Ramp

A wedge shape formed by bisecting a cube diagonally. Creates a slope surface.

- Scaled by `width`, `height`, `depth`
- Built as a convex hull internally
- Useful for ramps, inclines, and angled surfaces

### Plane

A thin box preset for creating flat surfaces without worrying about depth. Uses the object's width and depth for the X and Z extents, with a fixed thin Y dimension.

- X half-extent: `width / 2`
- Y half-extent: fixed at `1` physics unit
- Z half-extent: `depth / 2`
- Best for ground planes, floors, walls, and large flat surfaces
- Set body type to **Fixed** for static surfaces

### Convex Hulls / Model Mesh

These use the actual 3D model geometry. Only available for **GltfStatic** and **Model3D** objects. If the model data is unavailable, falls back to Box.

- **Model Mesh**: Trimesh from the model — accurate but expensive, best for static/fixed bodies
- **Convex Hulls**: Convex hull wrapping the model vertices — faster than trimesh, works with dynamic bodies

---

## Setting the Shape

### ACE (Event Sheet)

The shape is set as a **property** in the Properties panel. It cannot be changed at runtime via an action. To change collider dimensions at runtime, use:

**Set size override** — Replaces the physics body with new dimensions.

| Parameter | Type | Description |
|-----------|------|-------------|
| Enable | boolean | Enable or disable the size override |
| Height | number | Override height (world units) |
| Width | number | Override width (world units) |
| Depth | number | Override depth (world units) |

### Script Interface

```js
// Set size override to change body dimensions at runtime
inst.behaviors.Rapier3DPhysics._SetSizeOverride(true, 100, 200, 50);

// Disable size override (reverts to original dimensions)
inst.behaviors.Rapier3DPhysics._SetSizeOverride(false, 0, 0, 0);
```

---

## Shape Casting

Shape casting sweeps a shape along a direction and reports the first hit. Available shapes for casting:

| Cast Shape | Description |
|------------|-------------|
| Box | Cuboid sweep |
| Sphere | Sphere sweep |
| Capsule | Capsule sweep |
| Cone | Cone sweep |

### ACE (Event Sheet)

Use the **Cast Shape** action to perform a shape cast.

| Parameter | Type | Description |
|-----------|------|-------------|
| Tag | string | Identifier for the result |
| Shape Type | combo | Box, Sphere, Capsule, or Cone |
| Height | number | Shape height |
| Width | number | Shape width |
| Depth | number | Shape depth |
| Rotation X, Y, Z | number | Shape rotation (degrees) |
| From X, Y, Z | number | Origin point |
| To X, Y, Z | number | Target point |
| Cast distance multiplier | number | Multiplies the cast distance from origin |
| Hit Margin | number | Hit margin threshold |
| Filter Groups | string | Collision filter groups (hex) |
| Exclude Body UID | number | UID to exclude from results (-1 for none) |
| Solid | boolean | If true, a cast starting inside a collider stops immediately (TOI=0). If false, the shape is treated as hollow. |

Results are read on the next tick via the **On cast shape result** condition or the `CastShapeResultAsJSON` expression.

### Script Interface

```js
// Cast a box shape from point A to point B
inst.behaviors.Rapier3DPhysics._CastShape(
    "myTag",      // tag
    0,            // shapeType: 0=box, 1=sphere, 2=capsule, 3=cone
    50, 50, 50,   // height, width, depth
    0, 0, 0,      // rotation x, y, z (degrees)
    0, 0, 100,    // from x, y, z
    0, 0, 0,      // to x, y, z
    1,            // cast distance multiplier
    1,            // hit margin
    "0xFFFF",     // filter groups
    -1,           // exclude UID (-1 = none)
    false         // solid
);
```

---

## Rotation Axes by Object Type

The available rotation axes depend on the **object type**, not the shape:

| Object Type | X Rotation | Y Rotation | Z Rotation |
|-------------|------------|------------|------------|
| 3DShape | Locked | Locked | Enabled |
| Sprite | Locked | Locked | Enabled |
| GltfStatic | Enabled | Enabled | Enabled |
| Model3D | Enabled | Enabled | Enabled |

To change rotation locks at runtime, use the **Set enabled rotations** action.

---

## Tips

- **Sphere** is the cheapest shape for collision detection. Use it when precision isn't critical.
- **Capsule** is ideal for characters — it slides smoothly over edges and steps.
- **Ramp** and **Plane** are convenience presets — they use Box and convex hull internally.
- **Model Mesh** (trimesh) should only be used with **Fixed** bodies. Dynamic trimesh bodies have unreliable inertia and no CCD support.
- Use **Set size override** to adjust physics dimensions independently of visual size.
- Shape casting results arrive one tick after the cast is fired (async worker pattern).
