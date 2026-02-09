<img src="./src/icon.svg" width="100" /><br>
# Cannon 3D Physics <br>
Description <br>
<br>
Author: Mikal <br>
<sub>Made using [c3ide2-framework](https://github.com/ConstructFund/c3ide2-framework) </sub><br>

## Table of Contents
- [Usage](#usage)
- [Examples Files](#examples-files)
- [Properties](#properties)
- [Actions](#actions)
- [Conditions](#conditions)
- [Expressions](#expressions)
- [Changelog](#changelog)

---
## Changelog

### v2.25.0 (2026-02-08)

**GltfStatic 3D Rotation Fix**
- ✅ Fixed critical bug where GltfStatic physics bodies had rotation locked by default
- ✅ Rotation locks now set on `RigidBodyDesc` before body creation (previously set after, which didn't work)
- ✅ GltfStatic objects now support full 3D rotation on all axes (X, Y, Z)

**Angular Damping**
- ✅ Added `defaultAngularDamping = 0.5` to prevent wild spinning
- ✅ Physics bodies now gradually slow down rotation over time (like air resistance)
- ✅ Configurable via "Set angular damping" action

**Debug Improvements**
- 🔍 Added rotation configuration logging (`enableRot0/1/2` flags)
- 🔍 Added angular velocity tracking in runtime (shows spinning rate on each axis)
- 🔍 Added dimension warnings for very small colliders (< 0.1 physics units)
- 🔍 Added quaternion magnitude and identity checks
- 🔍 Added world vs physics position verification logging
- 🔍 Warns when colliders are too small and may cause physics instability

**Impact:** GltfStatic objects with Dynamic body type now rotate properly in 3D space with realistic damping.

---
## Usage
To build the addon, run the following commands:

```
npm i
node ./build.js
```

To run the dev server, run

```
npm i
node ./dev.js
```

The build uses the pluginConfig file to generate everything else.
The main files you may want to look at would be instance.js and scriptInterface.js

## Examples Files
- [raycastExample](./examples/raycastExample.c3p)
</br>

---
## Properties
| Property Name | Description | Type |
| --- | --- | --- |
| Enable | Enable physics | check |
| Immovable | Immovable body. | check |
| Shape | Immovable body. | combo |


---
## Actions
| Action | Description | Params
| --- | --- | --- |
| Set world gravity | Set world gravity in x,y,z axis. | Gravity X             *(number)* <br>Gravity Y             *(number)* <br>Gravity Z             *(number)* <br> |
| Raycast from to | Raycast from x0,y0,z0 to x1,y1,z1. | Tag             *(string)* <br>From x             *(number)* <br>From y             *(number)* <br>From z             *(number)* <br>To x             *(number)* <br>To y             *(number)* <br>To z             *(number)* <br> |
| Apply impulse | Apply impulse to body. | Impulse x             *(number)* <br>Impulse y             *(number)* <br>Impulse z             *(number)* <br> |
| Set immovable | Set body immovable. | Immovable             *(boolean)* <br> |
| Set default linear damping | Set default linear damping | Default linear damping             *(number)* <br> |
| Set linear damping | Set linear damping | Linear damping             *(number)* <br> |
| Set angular damping | Set angular damping | Angular damping             *(number)* <br> |
| Set velocity | Set velocity to body. | Velocity x             *(number)* <br>Velocity y             *(number)* <br>Velocity z             *(number)* <br> |
| Enable physics | Enable body physics. | Enable             *(boolean)* <br> |


---
## Conditions
| Condition | Description | Params
| --- | --- | --- |
| Is enabled | is physics enabled. |  |
| Is immovable | is immovable. |  |


---
## Expressions
| Expression | Description | Return Type | Params
| --- | --- | --- | --- |
| RaycastResultAsJSON | Raycast result as JSON string. | string |  | 
| Enable | Physics enabled. | number |  | 
| WorldGravityX | World gravity x vector. | number |  | 
| WorldGravityY | World gravity y vector. | number |  | 
| WorldGravityZ | World gravity z vector. | number |  | 
