# Rapier 3D Physics — Construct 3 Behavior Reference

Integrates the Rapier physics engine (WebAssembly) into Construct 3 for 3D rigid body dynamics, collision detection, raycasting, shape casting, joints, and character controllers.

**Behavior ID:** `mikal_cannon_3d_physics`
**Script name:** `Rapier3DPhysics`

**Underlying engine:** [Rapier 3D](https://rapier.rs) — see the [JavaScript API Reference](https://rapier.rs/docs/api/javascript/JavaScript3D) and [Getting Started Guide](https://rapier.rs/docs/user_guides/javascript/getting_started_js) for engine-level details.

---

## Table of Contents

- [Supported Object Types](#supported-object-types)
- [Properties](#properties)
- [Architecture Notes](#architecture-notes)
- [Actions](#actions)
  - [World](#world-actions)
  - [Body](#body-actions)
  - [Raycasting & Shape Casting](#raycasting--shape-casting-actions)
  - [Joints](#joint-actions)
  - [Character Controller](#character-controller-actions)
- [Conditions](#conditions)
- [Expressions](#expressions)
- [Script Interface](#script-interface)

---

## Supported Object Types

| Object Type | Rotation | Position Properties | Notes |
|-------------|----------|---------------------|-------|
| 3DShape (Shape3D) | Z-axis only | x, y, z | Limited rotation |
| GltfStatic | All axes (quaternion) | x, y, z | Full 3D rotation |
| Model3D | All axes (Euler radians) | offsetX, offsetY, offsetZ | Scale applied automatically |
| Sprite | Z-axis only | x, y | 2D physics, supports mesh collision |

---

## Properties

Set in the Properties panel when the behavior is selected.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| Enable | check | true | Enable physics for this instance |
| Immovable | check | false | Body cannot be moved by forces (overrides body type to Fixed) |
| Shape | combo | Auto | Collider shape (see [Shapes documentation](shapes.md)) |
| Body type | combo | Dynamic | Dynamic, Fixed, Kinematic position, Kinematic velocity |
| Collider type | combo | Solid | Solid (physical) or Sensor (detect-only, no physical response) |
| Mass | float | 1 | Body mass |
| Size override | check | false | Use custom dimensions instead of object size |
| Height override | float | -1 | Custom height (-1 = use object size) |
| Width override | float | -1 | Custom width |
| Depth override | float | -1 | Custom depth |
| Light Occluder | check | false | Marks body in collision group bit 15 (0x8000) for light occlusion raycasts |

### Body Types

| Type | Description |
|------|-------------|
| Dynamic | Affected by forces, gravity, and collisions |
| Fixed | Immovable — acts as a static obstacle |
| Kinematic position | Moved by setting target position; Rapier computes velocity for correct collision response |
| Kinematic velocity | Moved by setting velocity directly |

---

## Architecture Notes

Physics runs in a **WebAssembly worker thread**. All commands are fire-and-forget via `postMessage`. Results (positions, rotations, velocities) return as a `Float32Array` batch each frame.

**Timing:** The physics world is initialized asynchronously. Use the **On physics ready** condition before sending commands. Expression values (velocity, mass, body type) return defaults (0 or -1) on tick 0 — read them on tick 1 or later.

**World scale:** C3 world units are converted to physics units by dividing by the scale factor (default 100). Set via the **Set world scale** action. A 100x100x100 C3 object becomes a 1x1x1 physics body.

---

## Actions

### World Actions

#### Set world gravity
Set the gravity vector for the entire physics world.

| Parameter | Type | Default |
|-----------|------|---------|
| Gravity X | number | 0 |
| Gravity Y | number | 0 |
| Gravity Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._SetWorldGravity(0, 0, -9.81);
```

#### Set world scale
Set the conversion factor between C3 world units and physics units.

| Parameter | Type | Default |
|-----------|------|---------|
| Scale | number | 100 |

```js
inst.behaviors.Rapier3DPhysics._SetWorldScale(100);
```

#### Set solver iterations
Higher values = more accurate stacking/constraints but slower.

| Parameter | Type | Default |
|-----------|------|---------|
| Iterations | number | 4 |

```js
inst.behaviors.Rapier3DPhysics._SetSolverIterations(8);
```

#### Set timestep
Control how the physics timestep is calculated.

| Parameter | Type | Default |
|-----------|------|---------|
| Mode | combo | Default (1/60) per C3 tick |
| Fixed value | number | 0.0166 |

Modes: **Default** (1/60s fixed), **Fixed** (custom fixed value), **Adaptive** (uses C3's dt).

```js
// 0 = Default, 1 = Fixed, 2 = Adaptive
inst.behaviors.Rapier3DPhysics._SetTimestep(1, 0.008); // Fixed at 125Hz
```

#### Set default linear damping
Sets linear damping applied to all newly created bodies.

| Parameter | Type | Default |
|-----------|------|---------|
| Default linear damping | number | 0.1 |

```js
inst.behaviors.Rapier3DPhysics._SetDefaultLinearDamping(0.5);
```

#### Enable debug render
Renders physics collider wireframes for debugging.

| Parameter | Type | Default |
|-----------|------|---------|
| Enable | boolean | false |
| Width | number | 1 |

```js
inst.behaviors.Rapier3DPhysics._EnableDebugRender(true, 2);
```

#### Pause physics / Resume physics
Pause or resume the simulation. Bodies keep their positions while paused.

```js
inst.behaviors.Rapier3DPhysics._PausePhysics();
inst.behaviors.Rapier3DPhysics._ResumePhysics();
```

---

### Body Actions

#### Enable physics
Enable or disable physics simulation for this body.

| Parameter | Type | Default |
|-----------|------|---------|
| Enable | boolean | false |

```js
inst.behaviors.Rapier3DPhysics._EnablePhysics(true);
```

#### Set immovable
Make a body immovable (switches to Fixed) or release it.

| Parameter | Type | Default |
|-----------|------|---------|
| Immovable | boolean | false |

```js
inst.behaviors.Rapier3DPhysics._SetImmovable(true);
```

#### Set body type
Switch body type at runtime.

| Parameter | Type | Default |
|-----------|------|---------|
| Body type | combo | Dynamic |

Options: Dynamic, Fixed, Kinematic Position, Kinematic Velocity.

```js
// 0 = Dynamic, 1 = Fixed, 2 = KinematicPosition, 3 = KinematicVelocity
inst.behaviors.Rapier3DPhysics._SetBodyType(0);
```

#### Set mass

| Parameter | Type | Default |
|-----------|------|---------|
| Mass | number | 1 |

```js
inst.behaviors.Rapier3DPhysics._SetMass(5);
```

#### Set velocity
Set the linear velocity of a body.

| Parameter | Type | Default |
|-----------|------|---------|
| Velocity X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._SetVelocity(100, 0, 50);
```

#### Set angular velocity
Set rotational velocity (rad/s).

| Parameter | Type | Default |
|-----------|------|---------|
| Angular velocity X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._SetAngularVelocity(0, 0, 3.14);
```

#### Apply impulse
Apply an instantaneous impulse at a point relative to the body center.

| Parameter | Type | Default |
|-----------|------|---------|
| Impulse X, Y, Z | number | 0 |
| Relative X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._ApplyImpulseAtPoint(0, 0, 500, 0, 0, 0);
```

#### Apply force
Apply a continuous force at a relative point (applied each step).

| Parameter | Type | Default |
|-----------|------|---------|
| Force X, Y, Z | number | 0 |
| Relative X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._ApplyForce(0, 0, 100, 0, 0, 0);
```

#### Apply torque
Apply a continuous rotational torque.

| Parameter | Type | Default |
|-----------|------|---------|
| Torque X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._ApplyTorque(0, 0, 10);
```

#### Apply angular impulse
Apply an instantaneous rotational impulse (one-shot, unlike torque).

| Parameter | Type | Default |
|-----------|------|---------|
| X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._ApplyAngularImpulse(0, 0, 5);
```

#### Translate
Teleport a body to a position.

| Parameter | Type | Default |
|-----------|------|---------|
| X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._Translate(100, 200, 50);
```

#### Rotate
Set a body's rotation (degrees).

| Parameter | Type | Default |
|-----------|------|---------|
| X, Y, Z (degrees) | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._Rotate(0, 0, 45);
```

#### Set next kinematic translation
Move a kinematic body to a target position. Rapier computes the velocity needed for correct collision response with dynamic bodies.

| Parameter | Type | Default |
|-----------|------|---------|
| X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._SetNextKinematicTranslation(200, 100, 0);
```

#### Set next kinematic rotation
Rotate a kinematic body to a target rotation (degrees). Rapier computes angular velocity for correct collision response.

| Parameter | Type | Default |
|-----------|------|---------|
| X, Y, Z (degrees) | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._SetNextKinematicRotation(0, 0, 90);
```

#### Set linear damping
Set linear damping for a specific body. Higher values = more resistance to movement.

| Parameter | Type | Default |
|-----------|------|---------|
| Linear damping | number | 0.1 |

```js
inst.behaviors.Rapier3DPhysics._SetLinearDamping(0.5);
```

#### Set angular damping
Set angular damping (rotation resistance).

| Parameter | Type | Default |
|-----------|------|---------|
| Angular damping | number | 0.1 |

```js
inst.behaviors.Rapier3DPhysics._SetAngularDamping(2.0);
```

#### Set restitution
Set bounciness. 0 = no bounce, 1 = perfectly elastic.

| Parameter | Type | Default |
|-----------|------|---------|
| Restitution | number | 0.0 |

```js
inst.behaviors.Rapier3DPhysics._SetRestitution(0.8);
```

#### Set restitution combine rule
How restitution is combined between two colliding bodies.

| Parameter | Type | Default |
|-----------|------|---------|
| Combine rule | combo | Average |

Options: Average, Min, Multiply, Max.

```js
// 0 = Average, 1 = Min, 2 = Multiply, 3 = Max
inst.behaviors.Rapier3DPhysics._SetRestitutionCombineRule(3); // Max
```

#### Set friction

| Parameter | Type | Default |
|-----------|------|---------|
| Friction | number | 0.1 |

```js
inst.behaviors.Rapier3DPhysics._SetFriction(0.5);
```

#### Set gravity scale
Per-body gravity multiplier.

| Parameter | Type | Default |
|-----------|------|---------|
| Gravity scale | number | 1.0 |

```js
inst.behaviors.Rapier3DPhysics._SetGravityScale(0); // Weightless
```

#### Set CCD
Enable continuous collision detection for fast-moving bodies to prevent tunneling.

| Parameter | Type | Default |
|-----------|------|---------|
| Enable CCD | boolean | true |

```js
inst.behaviors.Rapier3DPhysics._SetCCD(true);
```

#### Set enabled rotations
Lock or unlock rotation on each axis.

| Parameter | Type | Default |
|-----------|------|---------|
| Enable X | boolean | true |
| Enable Y | boolean | true |
| Enable Z | boolean | true |

```js
inst.behaviors.Rapier3DPhysics._SetEnabledRotations(false, false, true); // Z only
```

#### Set enabled translations
Lock or unlock movement on each axis.

| Parameter | Type | Default |
|-----------|------|---------|
| Enable X | boolean | true |
| Enable Y | boolean | true |
| Enable Z | boolean | true |

```js
inst.behaviors.Rapier3DPhysics._SetEnabledTranslations(true, true, false); // Lock Z
```

#### Set sleep threshold
Velocity threshold below which a body can fall asleep.

| Parameter | Type | Default |
|-----------|------|---------|
| Threshold | number | 0.01 |

```js
inst.behaviors.Rapier3DPhysics._SetSleepThreshold(0.05);
```

#### Wake up / Sleep
Manually control body sleep state.

```js
inst.behaviors.Rapier3DPhysics._WakeUp();
inst.behaviors.Rapier3DPhysics._Sleep();
```

#### Set position offset
Offset the collider position relative to the object origin.

| Parameter | Type | Default |
|-----------|------|---------|
| X, Y, Z offset | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._SetPositionOffset(0, 0, 25);
```

#### Set size override
Replace the physics body with custom dimensions at runtime.

| Parameter | Type | Default |
|-----------|------|---------|
| Enable | boolean | false |
| Height | number | 1 |
| Width | number | 1 |
| Depth | number | 1 |

```js
inst.behaviors.Rapier3DPhysics._SetSizeOverride(true, 100, 200, 50);
```

#### Update body
Re-sync the physics body from the current render position. Use after manually moving an object.

```js
inst.behaviors.Rapier3DPhysics._UpdateBody();
```

#### Set collision groups
Set collision filtering using hex membership and filter bitmasks. A collision occurs only if each body's membership intersects the other's filter.

| Parameter | Type | Default |
|-----------|------|---------|
| Membership | string | "0xFFFF" |
| Filter | string | "0xFFFF" |

```js
inst.behaviors.Rapier3DPhysics._SetCollisionGroups("0x0001", "0x0003");
```

#### Set light occluder
Mark a body for light occlusion (collision group bit 15). Raycast with filter `0x8000` to test only against occluders.

| Parameter | Type | Default |
|-----------|------|---------|
| Enable | boolean | true |

```js
inst.behaviors.Rapier3DPhysics._SetLightOccluder(true);
```

---

### Raycasting & Shape Casting Actions

#### Cast ray from to
Fire a ray from one point to another. Results arrive on the next tick.

| Parameter | Type | Default |
|-----------|------|---------|
| Tag | string | "" |
| From X, Y, Z | number | 0 |
| To X, Y, Z | number | 0 |
| Collision filter groups | string | "0xFFFF" |
| Unused | string | "" |
| Solid | boolean | false |
| Mode | combo | Closest |

Modes: **Closest** (nearest hit), **Any** (first hit found), **All** (all hits).

Solid: If true, a ray starting inside a collider immediately hits it (TOI=0). If false, the ray exits through the far side.

```js
inst.behaviors.Rapier3DPhysics._Raycast(
    "ground-check",   // tag
    0, 0, 100,        // from
    0, 0, 0,          // to
    "0xFFFF",         // filter groups
    "",               // unused
    false,            // solid
    0                 // mode: 0=closest, 1=any, 2=all
);
```

#### Cast shape
Sweep a shape from one point toward another and report the first hit.

| Parameter | Type | Default |
|-----------|------|---------|
| Tag | string | "" |
| Shape Type | combo | Box |
| Height, Width, Depth | number | 1 |
| Rotation X, Y, Z | number | 0 (degrees) |
| From X, Y, Z | number | 0 |
| To X, Y, Z | number | 0 |
| Cast distance multiplier | number | 1 |
| Hit Margin | number | 1 |
| Filter Groups | string | "0xFFFF" |
| Exclude Body UID | number | -1 |
| Solid | boolean | false |

Shape types: Box, Sphere, Capsule, Cone.

```js
inst.behaviors.Rapier3DPhysics._CastShape(
    "myTag",          // tag
    0,                // shapeType: 0=box, 1=sphere, 2=capsule, 3=cone
    50, 50, 50,       // height, width, depth
    0, 0, 0,          // rotation (degrees)
    0, 0, 100,        // from
    0, 0, 0,          // to
    1,                // cast distance multiplier
    1,                // hit margin
    "0xFFFF",         // filter groups
    -1,               // exclude UID (-1 = none)
    false             // solid
);
```

---

### Joint Actions

#### Add spherical joint
Ball-and-socket joint between two bodies. Allows rotation on all axes.

| Parameter | Type | Default |
|-----------|------|---------|
| Anchor X, Y, Z | number | 0 |
| Target anchor X, Y, Z | number | 0 |
| Target UID | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._AddSphericalJoint(0, 0, 0, 0, 0, 0, targetUID);
```

#### Add revolute joint
Hinge joint. Allows rotation around a single axis.

| Parameter | Type | Default |
|-----------|------|---------|
| Anchor X, Y, Z | number | 0 |
| Target anchor X, Y, Z | number | 0 |
| Axis X, Y, Z | number | 1, 0, 0 |
| Target UID | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._AddRevoluteJoint(
    0, 0, 0,        // local anchor
    0, 0, 0,        // target anchor
    0, 0, 1,        // axis (Z)
    targetUID
);
```

#### Set revolute motor
Drive a revolute joint at a target angular velocity.

| Parameter | Type | Default |
|-----------|------|---------|
| Target UID | number | 0 |
| Target velocity (rad/s) | number | 1 |
| Max force (N*m) | number | 100 |

Set max force to 0 to disable the motor.

```js
inst.behaviors.Rapier3DPhysics._SetRevoluteMotor(targetUID, 3.14, 100);
```

#### Set revolute limits
Set angular limits on a revolute joint.

| Parameter | Type | Default |
|-----------|------|---------|
| Target UID | number | 0 |
| Min angle (degrees) | number | -90 |
| Max angle (degrees) | number | 90 |
| Enable | combo | Enable |

```js
// 0 = Enable, 1 = Disable
inst.behaviors.Rapier3DPhysics._SetRevoluteLimits(targetUID, -45, 45, 0);
```

---

### Character Controller Actions

Character controllers provide kinematic character movement with slope handling, autostep, ground snapping, and collision response. The body must have **Kinematic position** body type.

#### Create character controller

| Parameter | Type | Default |
|-----------|------|---------|
| Tag | string | "" |
| Offset | number | 0.01 |
| Up X, Y, Z | number | 0, 0, 1 |
| Max slope climb angle (degrees) | number | 60 |
| Min slope slide angle (degrees) | number | 60 |
| Apply impulses to dynamic bodies | boolean | false |
| Enable autostep | boolean | true |
| Autostep min width | number | 20 |
| Autostep max height | number | 20 |
| Enable snap to ground | boolean | true |
| Snap to ground max distance | number | 1 |
| Autostep include dynamic bodies | boolean | true |

```js
inst.behaviors.Rapier3DPhysics._CreateCharacterController(
    "player",     // tag
    0.01,         // offset (skin width)
    0, 0, 1,      // up vector
    60,           // max slope climb angle
    60,           // min slope slide angle
    true,         // apply impulses to dynamic bodies
    true,         // enable autostep
    20, 20,       // autostep min width, max height
    true,         // enable snap to ground
    1,            // snap to ground max distance
    true          // autostep include dynamic bodies
);
```

#### Translate character controller
Move the character controller. The controller handles collisions, slopes, and stepping.

| Parameter | Type | Default |
|-----------|------|---------|
| Tag | string | "" |
| X, Y, Z | number | 0 |

```js
inst.behaviors.Rapier3DPhysics._TranslateCharacterController("player", dx, dy, dz);
```

#### Remove character controller

| Parameter | Type | Default |
|-----------|------|---------|
| Tag | string | "" |

```js
inst.behaviors.Rapier3DPhysics._RemoveCharacterController("player");
```

#### Runtime CC Adjustments

All CC adjustment actions take a **Tag** parameter first.

| Action | Parameters | Description |
|--------|-----------|-------------|
| Set CC slope angles | Max climb (deg), Min slide (deg) | Adjust slope limits |
| Set CC autostep | Enabled, Max height, Min width, Include dynamic | Adjust stepping |
| Set CC snap to ground | Enabled, Distance | Adjust ground snapping |
| Set CC slide enabled | Enabled | Toggle sliding against obstacles |
| Set CC mass | Mass | Mass for impulse resolution against dynamic bodies |
| Set CC push dynamic bodies | Enabled | Toggle pushing dynamic bodies |
| Set CC offset | Offset | Adjust skin width |
| Set CC up direction | X, Y, Z | Change the "up" direction |
| Set CC normal nudge factor | Value | Penetration recovery aggressiveness |

```js
const phys = inst.behaviors.Rapier3DPhysics;
phys._SetCCSlope("player", 45, 50);
phys._SetCCAutostep("player", true, 30, 15, true);
phys._SetCCSnapToGround("player", true, 2);
phys._SetCCSlide("player", true);
phys._SetCCMass("player", 80);
phys._SetCCPushDynamicBodies("player", true);
phys._SetCCOffset("player", 0.02);
phys._SetCCUp("player", 0, 0, 1);
phys._SetCCNormalNudgeFactor("player", 1e-4);
```

---

## Conditions

### Body

| Condition | Type | Description |
|-----------|------|-------------|
| Is enabled | Boolean | True if physics is enabled for this body |
| Is immovable | Boolean | True if body is immovable |
| On collision | Trigger | Fires when a collision starts or ends |
| On physics ready | Trigger | Fires when the physics body is initialized |

### World

| Condition | Type | Description |
|-----------|------|-------------|
| On physics paused | Trigger | Fires when physics simulation is paused |
| Is physics paused | Boolean | True when simulation is paused |

### Raycasting & Shape Casting

| Condition | Type | Description |
|-----------|------|-------------|
| On any raycast result | Trigger | Fires for any raycast result |
| On raycast result | Trigger | Fires for a specific tag |
| On any cast shape result | Trigger | Fires for any shape cast result |
| On cast shape result | Trigger | Fires for a specific tag |

### Character Controller

| Condition | Type | Description |
|-----------|------|-------------|
| Is grounded | Boolean | True if CC is touching the ground |
| On character controller collision | Trigger | Fires on CC collision |

---

## Expressions

### Body

| Expression | Return | Description |
|------------|--------|-------------|
| Enable | number | 1 if physics enabled, 0 otherwise |
| VelocityX | number | Linear velocity X (world units/s) |
| VelocityY | number | Linear velocity Y |
| VelocityZ | number | Linear velocity Z |
| AngularVelocityX | number | Angular velocity X (rad/s) |
| AngularVelocityY | number | Angular velocity Y (rad/s) |
| AngularVelocityZ | number | Angular velocity Z (rad/s) |
| IsSleeping | number | 1 if sleeping, 0 if awake |
| BodyType | number | 0=Dynamic, 1=Fixed, 2=KinematicPosition, 3=KinematicVelocity, -1=not ready |
| Mass | number | Total body mass |

### Collision

| Expression | Return | Description |
|------------|--------|-------------|
| CollisionData | string | Full collision data as JSON |
| CollisionTargetUID | number | UID of the other colliding body |
| CollisionStarted | number | 1 if started, 0 if ended |
| CollisionNormalX/Y/Z | number | Outward contact normal components |
| CollisionContactX/Y/Z | number | Contact point position (world units) |
| CollisionImpulse | number | Normal impulse magnitude (scales with mass and speed) |

### World

| Expression | Return | Description |
|------------|--------|-------------|
| WorldGravityX | number | Current gravity X |
| WorldGravityY | number | Current gravity Y |
| WorldGravityZ | number | Current gravity Z |

### Raycasting & Shape Casting

| Expression | Return | Description |
|------------|--------|-------------|
| RaycastCurrentTag | string | Tag of the result being processed (use inside On any raycast result) |
| RaycastResultAsJSON | string | Raycast result JSON for a given tag |
| CastShapeCurrentTag | string | Tag of the shape cast result being processed |
| CastShapeResultAsJSON | string | Shape cast result JSON for a given tag |

### Character Controller

| Expression | Return | Description |
|------------|--------|-------------|
| CCGrounded | number | 1 if grounded, 0 otherwise |
| CCComputedMovementX/Y/Z | number | Corrected movement from last CC move |
| CCCollisionNormalX/Y/Z | number | Collision normal from last CC collision |
| CCCollisionTargetUID | number | UID of object hit in last CC collision |
| CCCollisionTOI | number | Time of impact from last CC collision |
| CharacterCollisionData | string | Full CC collision data as JSON |

---

## Script Interface

Access the behavior on any instance via:

```js
const phys = inst.behaviors.Rapier3DPhysics;
```

All methods listed in the Actions and Expressions sections above are available directly. Method names use `_PrefixedCamelCase` format matching the `forward` field in the config.

### Reading Body State

```js
const vx = phys._VelocityX();
const vy = phys._VelocityY();
const vz = phys._VelocityZ();
const sleeping = phys._IsSleeping();
const bodyType = phys._BodyType();
const mass = phys._Mass();
```

### Collision Handling

```js
// Inside On collision trigger
const targetUID = phys._CollisionTargetUID();
const started = phys._CollisionStarted(); // 1 = start, 0 = end
const impulse = phys._CollisionImpulse();
const nx = phys._CollisionNormalX();
const ny = phys._CollisionNormalY();
const nz = phys._CollisionNormalZ();
```

### Raycast Results

```js
// Inside On raycast result trigger, or read by tag after the result tick
const json = phys._RaycastResultAsJSON("myTag");
const result = JSON.parse(json);
// result.hasHit, result.toi, result.normal, result.point, result.colliderUID
```
