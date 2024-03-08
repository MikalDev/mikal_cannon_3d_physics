// import * as Comlink from "https://cdn.skypack.dev/comlink";
import * as Comlink from "https://kindeyegames.com/forumfiles/comlink.js";

// import * as Comlink from "./comlink.js";
console.log("comlink-imported");

const BEHAVIOR_INFO = {
    id: "mikal_cannon_3d_physics",
    Acts: {
      "SetWorldGravity": {
            "forward": (inst) => inst._SetWorldGravity,
            
            "autoScriptInterface": true,
            },
"Raycast": {
            "forward": (inst) => inst._Raycast,
            
            "autoScriptInterface": true,
            },
"SetImmovable": {
            "forward": (inst) => inst._SetImmovable,
            
            "autoScriptInterface": true,
            },
"SetDefaultLinearDamping": {
            "forward": (inst) => inst._SetDefaultLinearDamping,
            
            "autoScriptInterface": true,
            },
"SetLinearDamping": {
            "forward": (inst) => inst._SetLinearDamping,
            
            "autoScriptInterface": true,
            },
"SetAngularDamping": {
            "forward": (inst) => inst._SetAngularDamping,
            
            "autoScriptInterface": true,
            },
"SetVelocity": {
            "forward": (inst) => inst._SetVelocity,
            
            "autoScriptInterface": true,
            },
"EnablePhysics": {
            "forward": (inst) => inst._EnablePhysics,
            
            "autoScriptInterface": true,
            },
"ApplyImpulse": {
            "forward": (inst) => inst._ApplyImpulseAtPoint,
            
            "autoScriptInterface": true,
            },
"SetMass": {
            "forward": (inst) => inst._SetMass,
            
            "autoScriptInterface": true,
            },
"UpdateHeightfield": {
            "forward": (inst) => inst._UpdateHeightfield,
            
            "autoScriptInterface": true,
            },
"SetCollisionFilterGroup": {
            "forward": (inst) => inst._SetCollisionFilterGroup,
            
            "autoScriptInterface": true,
            },
"SetCollisionGroups": {
            "forward": (inst) => inst._SetCollisionGroups,
            
            "autoScriptInterface": true,
            },
"SetCollisionFilterMask": {
            "forward": (inst) => inst._SetCollisionFilterMask,
            
            "autoScriptInterface": true,
            },
"ApplyForce": {
            "forward": (inst) => inst._ApplyForce,
            
            "autoScriptInterface": true,
            },
"ApplyTorque": {
            "forward": (inst) => inst._ApplyTorque,
            
            "autoScriptInterface": true,
            },
"AttachSpring": {
            "forward": (inst) => inst._AttachSpring,
            
            "autoScriptInterface": true,
            },
"EnableDebugRender": {
            "forward": (inst) => inst._EnableDebugRender,
            
            "autoScriptInterface": true,
            },
"UpdateBody": {
            "forward": (inst) => inst._UpdateBody,
            
            "autoScriptInterface": true,
            },
"CreateCharacterController": {
            "forward": (inst) => inst._CreateCharacterController,
            
            "autoScriptInterface": true,
            },
"TranslateCharacterController": {
            "forward": (inst) => inst._TranslateCharacterController,
            
            "autoScriptInterface": true,
            },
"SetWorldScale": {
            "forward": (inst) => inst._SetWorldScale,
            
            "autoScriptInterface": true,
            }
    },
    Cnds: {
      "IsEnabled": {
            "forward": (inst) => inst._IsEnabled,
            
            "autoScriptInterface": true,
          },
"IsImmovable": {
            "forward": (inst) => inst._IsImmovable,
            
            "autoScriptInterface": true,
          },
"OnCollision": {
            "forward": (inst) => inst._OnCollision,
            
            "autoScriptInterface": true,
          },
"OnAnyRaycastResult": {
            "forward": (inst) => inst._OnAnyRaycastResult,
            
            "autoScriptInterface": true,
          },
"OnRaycastResult": {
            "forward": (inst) => inst._OnRaycastResult,
            
            "autoScriptInterface": true,
          }
    },
    Exps: {
      "RaycastResultAsJSON": {
            "forward": (inst) => inst._RaycastResultAsJSON,
            
            "autoScriptInterface": true,
          },
"Enable": {
            "forward": (inst) => inst._Enable,
            
            "autoScriptInterface": true,
          },
"WorldGravityX": {
            "forward": (inst) => inst._WorldGravityX,
            
            "autoScriptInterface": true,
          },
"WorldGravityY": {
            "forward": (inst) => inst._WorldGravityY,
            
            "autoScriptInterface": true,
          },
"WorldGravityZ": {
            "forward": (inst) => inst._WorldGravityZ,
            
            "autoScriptInterface": true,
          },
"CollisionData": {
            "forward": (inst) => inst._CollisionData,
            
            "autoScriptInterface": true,
          },
"VelocityX": {
            "forward": (inst) => inst._VelocityX,
            
            "autoScriptInterface": true,
          },
"VelocityY": {
            "forward": (inst) => inst._VelocityY,
            
            "autoScriptInterface": true,
          },
"VelocityZ": {
            "forward": (inst) => inst._VelocityZ,
            
            "autoScriptInterface": true,
          }
    },
  };

const camelCasedMap = new Map();

function camelCasify(str) {
    // If the string is already camelCased, return it
    if (camelCasedMap.has(str)) {
        return camelCasedMap.get(str);
    }
    // Replace any non-valid JavaScript identifier characters with spaces
    let cleanedStr = str.replace(/[^a-zA-Z0-9$_]/g, " ");

    // Split the string on spaces
    let words = cleanedStr.split(" ").filter(Boolean);

    // Capitalize the first letter of each word except for the first one
    for (let i = 1; i < words.length; i++) {
        words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
    }

    // Join the words back together
    let result = words.join("");

    // If the first character is a number, prepend an underscore
    if (!isNaN(parseInt(result.charAt(0)))) {
        result = "_" + result;
    }

    camelCasedMap.set(str, result);

    return result;
}

C3.Behaviors[BEHAVIOR_INFO.id] = class extends C3.SDKBehaviorBase {
    constructor(opts) {
        super(opts);
        this.runtime = opts.runtime;
        this.debugRenderWidth = 1;
        this.debugRender = false;
        this.rapierWorker = null;
        console.log("rapierBehavior created");
        this.initWorker(this.runtime);
        this.commands = [];
        this.cmdTickCount, (this.tickCount = 0);
        this.worldReady = false;
        this.scale = 100;
    }

    Release() {
        super.Release();
        this.msgPort.postMessage({ type: "release" });
    }

    async initWorker(runtime) {
        let path = await runtime
            .GetAssetManager()
            .GetProjectFileUrl("rapierWorker.js");
        console.log("rapierWorker path, init", path);
        this.rapierWorker = new Worker(path, { type: "module" });
        console.log("after new Worker", this.rapierWorker);
        this.comRapier = Comlink.wrap(this.rapierWorker);
        console.log("after Comlink.wrap", this.comRapier);
        this.worldReady = await this.comRapier.initWorld();
    }

    updateBodies(bodies) {
        if (!bodies) return;
        globalThis.Mikal_Rapier_Bodies = new Map();
        const scale = this.scale;
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
    }

    async sendCommandsToWorker() {
        // Run only once per tick
        if (!this.worldReady || !this.commands || this.commands.length === 0)
            return;

        const tickCount = this.runtime.GetTickCount();
        if (tickCount === this.cmdTickCount) return;
        this.cmdTickCount = tickCount;
        const result = this.comRapier.runCommands(this.commands);
        this.commands = [];
    }

    async Tick() {
        // Run only once per tick
        const tickCount = this.runtime.GetTickCount();
        if (tickCount === this.tickCount) return;
        this.tickCount = tickCount;
        if (!this.comRapier) return;
        if (!this.worldReady) {
            console.log("rapier world not ready", this.worldReady);
            this.worldReady = await this.comRapier.isWorldReady();
            console.log("rapier world ready", this.worldReady);
            return;
        }
        const bodies = await this.comRapier.stepWorld();
        if (this.debugRender) {
            globalThis.Mikal_Rapier_debug_buffers =
                await this.comRapier.debugRender();
            globalThis.Mikal_Rapier_debug_buffers.width = 4;
            globalThis.Mikal_Rapier_debug_buffers.scale = this.scale;
        }
        if (!bodies) return;
        this.updateBodies(bodies);
        this.runtime.UpdateRender();
    }
};
const B_C = C3.Behaviors[BEHAVIOR_INFO.id];
B_C.Type = class extends C3.SDKBehaviorTypeBase {
    constructor(objectClass) {
        super(objectClass);
    }

    Release() {
        super.Release();
    }
};

//====== SCRIPT INTERFACE ======
const map = new WeakMap();

function getScriptInterface(parentClass, map) {
  return class extends parentClass {
    constructor() {
      super();
      map.set(this, parentClass._GetInitInst().GetSdkInstance());
    }
  };
}


const scriptInterface = getScriptInterface(self.IBehaviorInstance, map);

// extend script interface with plugin actions
Object.keys(BEHAVIOR_INFO.Acts).forEach((key) => {
    const ace = BEHAVIOR_INFO.Acts[key];
    if (!ace.autoScriptInterface) return;
    scriptInterface.prototype[camelCasify(key)] = function (...args) {
        const sdkInst = map.get(this);
        B_C.Acts[camelCasify(key)].call(sdkInst, ...args);
    };
});

const addonTriggers = [];

// extend script interface with plugin conditions
Object.keys(BEHAVIOR_INFO.Cnds).forEach((key) => {
    const ace = BEHAVIOR_INFO.Cnds[key];
    if (!ace.autoScriptInterface || ace.isStatic || ace.isLooping) return;
    if (ace.isTrigger) {
        scriptInterface.prototype[camelCasify(key)] = function (
            callback,
            ...args
        ) {
            const callbackWrapper = () => {
                const sdkInst = map.get(this);
                if (B_C.Cnds[camelCasify(key)].call(sdkInst, ...args)) {
                    callback();
                }
            };
            this.addEventListener(key, callbackWrapper, false);
            return () => this.removeEventListener(key, callbackWrapper, false);
        };
    } else {
        scriptInterface.prototype[camelCasify(key)] = function (...args) {
            const sdkInst = map.get(this);
            return B_C.Cnds[camelCasify(key)].call(sdkInst, ...args);
        };
    }
});

// extend script interface with plugin expressions
Object.keys(BEHAVIOR_INFO.Exps).forEach((key) => {
    const ace = BEHAVIOR_INFO.Exps[key];
    if (!ace.autoScriptInterface) return;
    scriptInterface.prototype[camelCasify(key)] = function (...args) {
        const sdkInst = map.get(this);
        return B_C.Exps[camelCasify(key)].call(sdkInst, ...args);
    };
});
//====== SCRIPT INTERFACE ======

//============ ACES ============
B_C.Acts = {};
B_C.Cnds = {};
B_C.Exps = {};
Object.keys(BEHAVIOR_INFO.Acts).forEach((key) => {
    const ace = BEHAVIOR_INFO.Acts[key];
    B_C.Acts[camelCasify(key)] = function (...args) {
        if (ace.forward) ace.forward(this).call(this, ...args);
        else if (ace.handler) ace.handler.call(this, ...args);
    };
});
Object.keys(BEHAVIOR_INFO.Cnds).forEach((key) => {
    const ace = BEHAVIOR_INFO.Cnds[key];
    B_C.Cnds[camelCasify(key)] = function (...args) {
        if (ace.forward) return ace.forward(this).call(this, ...args);
        if (ace.handler) return ace.handler.call(this, ...args);
    };
    if (ace.isTrigger && ace.autoScriptInterface) {
        addonTriggers.push({
            method: B_C.Cnds[camelCasify(key)],
            id: key,
        });
    }
});
Object.keys(BEHAVIOR_INFO.Exps).forEach((key) => {
    const ace = BEHAVIOR_INFO.Exps[key];
    B_C.Exps[camelCasify(key)] = function (...args) {
        if (ace.forward) return ace.forward(this).call(this, ...args);
        if (ace.handler) return ace.handler.call(this, ...args);
    };
});
//============ ACES ============

function getInstanceJs(parentClass, scriptInterface, addonTriggers, C3) {
    return class extends parentClass {
        constructor(inst, properties) {
            super(inst);

            if (properties) {
                this.enable = properties[0];
                this.immovable = properties[1];
                this.shapeProperty = properties[2];
                this.bodyType = properties[3];
            }
            this.defaultMass = 1;
            this.body = null;
            this.shapePositionOffset = null;
            this.offsetPosition = null;
            this.shapeAngleOffset = null;
            this.uid = this._inst.GetUID();
            this.PhysicsType = this._behaviorType._behavior;
            this.comRapier = this.PhysicsType.comRapier;
            this.CommandType = {
                AddBody: 0,
                StepWorld: 1,
                ApplyImpulse: 2,
                ApplyImpulseAtPoint: 3,
                ApplyForce: 4,
                Raycast: 5,
                SetWorldGravity: 6,
                SetLinearDamping: 7,
                ApplyTorque: 8,
                SetMass: 9,
                EnablePhysics: 10,
                SetDefaultLinearDamping: 11,
                CreateCharacterController: 12,
                TranslateCharacterController: 13,
                Translate: 14,
                Rotate: 15,
                SetVelocity: 16,
                UpdateBody: 17,
                SetAngularDamping: 18,
                SetCollisionGroups: 19,
            };
            this._StartTicking();
            this._StartTicking2();
        }

        Release() {
            super.Release();
            if (this.body) {
                // world.removeBody(this.body);
            }
        }

        SaveToJson() {
            return {
                // data to be saved for savegames
            };
        }

        LoadFromJson(o) {
            // load state for savegames
        }

        Tick() {
            const PhysicsType = this.PhysicsType;
            PhysicsType.sendCommandsToWorker();
            PhysicsType.Tick();
        }

        Tick2() {
            const wi = this._inst.GetWorldInfo();
            const shapeInst = this._inst.GetSdkInstance();
            let zHeight = shapeInst._zHeight || 0;
            const body = this.body;
            const PhysicsType = this._behaviorType._behavior;

            if (
                this.pluginType === "3DObjectPlugin" &&
                !body &&
                this._inst.GetSdkInstance().loaded
            ) {
                const loaded = this._inst.GetSdkInstance().loaded;
                if (!loaded) return;
                this.body = this.DefineBody(
                    this.pluginType,
                    this.shapeProperty,
                    this.bodyType
                );
                this._inst.GetSdkInstance()._setCannonBody(this.body, true);
            }

            if (!body) return;
            if (!this.enable) return;

            if (!globalThis.Mikal_Rapier_Bodies) return;
            const wBody = globalThis.Mikal_Rapier_Bodies.get(this.uid);
            if (!wBody) return;
            const position = wBody.translation;
            const quatRot = wBody.rotation;

            wi.SetX(position.x);
            wi.SetY(position.y);
            if (this.pluginType == "3DObjectPlugin") {
                wi.SetZElevation(position.z);
            } else {
                const zElevation = position.z - zHeight / 2;
                wi.SetZElevation(zElevation);
            }
            // angle
            if (this.rotate3D) {
                this.rotate3D._useQuaternion = true;
                this.rotate3D._quaternion = [
                    quatRot.x,
                    quatRot.y,
                    quatRot.z,
                    quatRot.w,
                ];
            } else {
                const quat = globalThis.glMatrix.quat;
                const zRot = quat.fromValues(
                    quatRot.x,
                    quatRot.y,
                    quatRot.z,
                    quatRot.w
                );
                const angles = this._quaternionToEuler(zRot);
                const angle = angles[2];
                wi.SetAngle(angle);
            }

            wi.SetBboxChanged();
        }

        PostCreate() {
            this.rotate3D = this._Behavior3DRotate();
            const pluginType = this._inst.GetPlugin();
            if (
                C3?.Plugins?.Shape3D &&
                pluginType instanceof C3?.Plugins?.Shape3D
            ) {
                this.pluginType = "Shape3DPlugin";
                if (!this.body) {
                    const shape = this._inst.GetSdkInstance()._shape;
                    this.body = this.DefineBody(
                        this.pluginType,
                        shape,
                        this.bodyType
                    );
                }
            } else if (
                C3?.Plugins?.Sprite &&
                pluginType instanceof C3?.Plugins?.Sprite
            ) {
                this.pluginType = "SpritePlugin";
                this.body = this.DefineBody(
                    this.pluginType,
                    null,
                    this.bodyType
                );
            } else if (
                C3?.Plugins?.Mikal_3DObject &&
                pluginType instanceof C3?.Plugins?.Mikal_3DObject
            ) {
                this.pluginType = "3DObjectPlugin";
            } else {
                this.pluginType = "invalid";
                console.error("invalid pluginType", pluginType);
            }
        }

        async DefineBody(pluginType, shapeType, bodyType) {
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const quat = globalThis.glMatrix.quat;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            let shape = null;
            const enableRot = [true, true, true];
            if (pluginType === "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }

                const initialQuat = quat.create();
                quat.fromEuler(
                    initialQuat,
                    0,
                    0,
                    (wi.GetAngle() * 180) / Math.PI
                );
                const shape = this._inst.GetSdkInstance()._shape;
                const scale = PhysicsType.scale;
                const command = {
                    type: this.CommandType.AddBody,
                    uid: this._inst.GetUID(),
                    x: wi.GetX() / scale,
                    y: wi.GetY() / scale,
                    z: (wi.GetZElevation() + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: wi.GetWidth() / scale,
                    height: wi.GetHeight() / scale,
                    depth: zHeight / scale,
                    immovable: this.immovable,
                    enableRot0: enableRot[0],
                    enableRot1: enableRot[1],
                    enableRot2: enableRot[2],
                    shapeType: shapeType,
                    bodyType,
                    shape,
                };
                this.PhysicsType.commands.push(command);
            }
        }

        _UpdateBody() {
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const quat = globalThis.glMatrix.quat;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            const enableRot = [true, true, true];
            const pluginType = this._inst.GetPlugin();
            if (pluginType instanceof C3?.Plugins?.Shape3D) {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }

                const initialQuat = quat.create();
                quat.fromEuler(
                    initialQuat,
                    0,
                    0,
                    (wi.GetAngle() * 180) / Math.PI
                );
                const shape = this._inst.GetSdkInstance()._shape;
                const scale = PhysicsType.scale;
                const command = {
                    type: this.CommandType.UpdateBody,
                    uid: this._inst.GetUID(),
                    x: wi.GetX() / scale,
                    y: wi.GetY() / scale,
                    z: (wi.GetZElevation() + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: wi.GetWidth() / scale,
                    height: wi.GetHeight() / scale,
                    depth: zHeight / scale,
                    immovable: this.immovable,
                    enableRot0: enableRot[0],
                    enableRot1: enableRot[1],
                    enableRot2: enableRot[2],
                    shapeType: this.shapeProperty,
                    bodyType: this.bodyType,
                    shape,
                };
                console.log("update body", command);
                this.PhysicsType.commands.push(command);
            }
        }

        _quaternionToEuler(quat) {
            // XYZ
            // Quaternion components
            const q0 = quat[3];
            const q1 = quat[0];
            const q2 = quat[1];
            const q3 = quat[2];
            // Roll (z-axis rotation)
            const sinr_cosp = 2 * (q0 * q3 + q1 * q2);
            const cosr_cosp = 1 - 2 * (q2 * q2 + q3 * q3);
            const roll = Math.atan2(sinr_cosp, cosr_cosp);
            // Pitch (x-axis rotation)
            const sinp = 2 * (q0 * q1 - q2 * q3);
            let pitch;
            if (Math.abs(sinp) >= 1) {
                pitch = Math.copySign(Math.PI / 2, sinp); // Use 90 degrees if out of range
            } else {
                pitch = Math.asin(sinp);
            }
            // Yaw (y-axis rotation)
            const siny_cosp = 2 * (q0 * q2 + q3 * q1);
            const cosy_cosp = 1 - 2 * (q1 * q1 + q2 * q2);
            const yaw = Math.atan2(siny_cosp, cosy_cosp);
            return [pitch, yaw, roll]; // Returns Euler angles in radians
        }
        _create3DObjectShape(shapeProperty) {
            // Get bbox of 3DObject
            const cannon = globalThis.Mikal_Cannon;
            const inst = this._inst.GetSdkInstance();
            const xMinBB = inst.xMinBB;
            const xMaxBB = inst.xMaxBB;
            const x = xMaxBB[0] - xMinBB[0];
            const y = xMaxBB[1] - xMinBB[1];
            const z = xMaxBB[2] - xMinBB[2];
            let shape = null;
            // define shape
            switch (shapeProperty) {
                case 0:
                case 1:
                    shape = new cannon.Box(
                        new cannon.Vec3(x / 2, y / 2, z / 2)
                    );
                    break;
                case 2:
                    shape = new cannon.Sphere(x / 2);
                    break;
                case 3:
                    // 12 segments
                    shape = new cannon.Cylinder(x / 2, x / 2, z, 12);
                    break;
                default:
                    console.error("invalid shape", this.shape);
                    return;
            }
            return shape;
        }

        _createWedgeShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(0.5, 0.5, 0.5),
                new cannon.Vec3(0.5, -0.5, 0.5),
                new cannon.Vec3(0.5, -0.5, -0.5),
                new cannon.Vec3(0.5, 0.5, -0.5),
                new cannon.Vec3(-0.5, -0.5, -0.5),
                new cannon.Vec3(-0.5, 0.5, -0.5),
            ];

            const faces = [
                [1, 4, 2],
                [0, 5, 4, 1],
                [0, 3, 5],
                [5, 3, 2, 4],
                [0, 1, 2, 3],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const wedgeShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });

            return wedgeShape;
        }

        _createCornerOutShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                // new cannon.Vec3(-0.5,-0.5,0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                // new cannon.Vec3(-0.5,0.5,0.5),  // 3 - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 4 + - -
                new cannon.Vec3(0.5, -0.5, 0.5), // 5 + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 6 + + -
                // new cannon.Vec3(0.5,0.5,0.5),   // 7 + + +
            ];

            // right hand rule CCW
            const faces = [
                [3, 0, 2],
                [3, 1, 0],
                [4, 1, 3],
                [4, 3, 2],
                [4, 2, 0],
                [4, 0, 1],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const cornerInShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });

            return cornerInShape;
        }

        _createCornerInShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                new cannon.Vec3(-0.5, -0.5, 0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                // new cannon.Vec3(-0.5,0.5,0.5),  // 3 - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 4 + - -
                new cannon.Vec3(0.5, -0.5, 0.5), // 5 + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 6 + + -
                new cannon.Vec3(0.5, 0.5, 0.5), // 7 + + +
            ];

            const faces = [
                [4, 6, 1],
                [4, 1, 0],
                [4, 0, 3],
                [4, 3, 5],
                [4, 5, 6],
                [2, 6, 5],
                [2, 5, 3],
                [2, 3, 0],
                [2, 0, 1],
                [2, 1, 6],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const cornerInShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });

            return cornerInShape;
        }

        _createPrismShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                new cannon.Vec3(-0.5, 0.0, 0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                //			new cannon.Vec3(-0.5,0.5,0.5),  // X - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 3 + - -
                //			new cannon.Vec3(0.5,-0.5,0.5),  // X + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 4 + + -
                new cannon.Vec3(0.5, 0.0, 0.5), // 5 + + +
            ];

            const faces = [
                [2, 0, 1],
                [5, 1, 0, 3],
                [4, 2, 1, 5],
                [4, 5, 3],
                [4, 3, 0, 2],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const prismShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });
            return prismShape;
        }

        _createPyramidShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                new cannon.Vec3(-0.5, 0.0, 0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                //			new cannon.Vec3(-0.5,0.5,0.5),  // X - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 3 + - -
                //			new cannon.Vec3(0.5,-0.5,0.5),  // X + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 4 + + -
                new cannon.Vec3(0.0, 0.0, 0.5), // 5 + + +
            ];

            const faces = [
                [2, 0, 5],
                [5, 0, 3],
                [4, 2, 5],
                [4, 5, 3],
                [4, 3, 0, 2],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const prismShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });
            return prismShape;
        }

        _createMeshPointsForSprite(worldInfo) {
            const wi = worldInfo;
            // create 2x2 grid of points for sprite
            // 2d array of points
            // use worldinfo width and height and zElevation
            // All should have same zElevation
            // 0,0,0 is top left of sprite mesh
            const width = wi.GetWidth();
            const height = wi.GetHeight();
            const zElevation = wi.GetZElevation();
            const xMin = 0;
            const xMax = width;
            const yMin = 0;
            const yMax = height;
            const xStep = width;
            const yStep = height;
            const meshPoints = [];
            for (let y = yMin; y <= yMax; y += yStep) {
                const row = [];
                for (let x = xMin; x <= xMax; x += xStep) {
                    const point = new globalThis.Mikal_Cannon.Vec3(x, y, 0);
                    row.push(point);
                }
                meshPoints.push(row);
            }
            return meshPoints;
        }

        // create cannon-es mesh shape
        _createMeshShape(worldInfo) {
            const cannon = globalThis.Mikal_Cannon;
            // Get instance
            const shapeInst = this._inst.GetSdkInstance();
            // Get world info
            const wi = worldInfo;
            // Get mesh points
            const meshPoints = this._getMeshPoints(wi);
            this._createMeshPointsForSprite(wi);
            const vertices = [];
            // Create vertices list [x,y,z,x,y,z,...]
            for (const row of meshPoints) {
                for (const point of row) {
                    vertices.push(point);
                }
            }

            const gridWidth = meshPoints[0].length;
            const gridHeight = meshPoints.length;

            // Check if square grid, if not console.warn and return null
            if (gridWidth !== gridHeight) {
                console.warn("Mesh must be a square grid");
                return null;
            }

            // Get delta X and Y from first two vertices
            const deltaX = Math.abs(vertices[1].x - vertices[0].x);
            const deltaY = Math.abs(vertices[1].y - vertices[0].y);

            // Create two dimensional heightfield array using only z values from vertices
            const heightfield = new Array(meshPoints.length)
                .fill(0)
                .map(() => new Array(meshPoints[0].length).fill(0));
            let index = meshPoints.length - 1;
            for (const row of meshPoints) {
                let index2 = 0;
                for (const point of row) {
                    heightfield[index][index2] = point.z;
                    index2++;
                }
                index--;
            }

            // Create heightfield shape
            const shape = new cannon.Heightfield(heightfield, {
                elementSize: deltaX,
            });

            return shape;
        }

        _getMeshPoints(worldInfo) {
            const cannon = globalThis.Mikal_Cannon;
            const wi = worldInfo;
            const points = wi?._meshInfo?.sourceMesh?._pts;
            if (!points) return this._createMeshPointsForSprite(wi);
            const width = wi.GetWidth();
            const height = wi.GetHeight();
            const meshPoints = [];
            for (const rows of points) {
                const meshRow = [];
                for (const point of rows) {
                    const x = point._x * width;
                    const y = point._y * height;
                    const z = point._zElevation;
                    meshRow.push(new cannon.Vec3(x, y, z));
                }
                meshPoints.push(meshRow);
            }

            return meshPoints;
        }

        _Behavior3DRotate() {
            const inst = this._inst;
            const rotate3D = inst.GetBehaviorSdkInstanceFromCtor(
                C3.Behaviors.mikal_rotate_shape
            );
            if (!rotate3D) return null;
            return rotate3D;
        }

        _SetWorldGravity(x, y, z) {
            const gravity = { x, y, z };
            const command = {
                type: this.CommandType.SetWorldGravity,
                gravity,
            };
            this.PhysicsType.commands.push(command);
        }

        async _Raycast(
            tag,
            fromX,
            fromY,
            fromZ,
            x,
            y,
            z,
            group,
            mask,
            skipBackfaces,
            mode
        ) {
            const scale = this.PhysicsType.scale;
            const vec3 = globalThis.glMatrix.vec3;
            const origin = vec3.fromValues(
                fromX / scale,
                fromY / scale,
                fromZ / scale
            );
            const to = vec3.fromValues(x / scale, y / scale, z / scale);
            let maxToI = vec3.distance(origin, to);
            vec3.sub(to, to, origin);
            // Normalize to, making dir vector
            vec3.normalize(to, to);
            const dir = to;
            maxToI = maxToI / vec3.length(dir);
            const command = {
                type: this.CommandType.Raycast,
                origin: { x: fromX, y: fromY, z: fromZ },
                dir: { x: dir[0], y: dir[1], z: dir[2] },
                maxToI,
            };
            const result = await this.comRapier.raycast(command);
            const hitPointWorld = vec3.create();
            vec3.add(
                hitPointWorld,
                origin,
                vec3.mul(
                    dir,
                    dir,
                    vec3.fromValues(result.toi, result.toi, result.toi)
                )
            );
            this.raycastResult = {
                hasHit: true,
                hitFaceIndex: 0,
                // origin + dir * toi
                hitPointWorld: [
                    hitPointWorld[0] * scale,
                    hitPointWorld[1] * scale,
                    hitPointWorld[2] * scale,
                ],
                hitNormalWorld: [
                    result.normal.x,
                    result.normal.y,
                    result.normal.z,
                ],
                distance:
                    vec3.distance(origin, [
                        hitPointWorld[0],
                        hitPointWorld[1],
                        hitPointWorld[2],
                    ]) * scale,
                hitUID: result.hitUID,
                tag,
            };
            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
            );
            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult
            );
            return true;
        }

        _RaycastResultAsJSON() {
            return JSON.stringify(this.raycastResult);
        }

        _OnAnyRaycastResult() {
            return true;
        }

        _OnRaycastResult(tag) {
            return this.raycastResult.tag === tag;
        }

        _EnablePhysics(enable) {
            this.enable = enable;
            const command = {
                uid: this.uid,
                type: this.CommandType.EnablePhysics,
                enable,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetDefaultLinearDamping(damping) {
            const command = {
                type: this.CommandType.SetDefaultLinearDamping,
                damping,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetLinearDamping(damping) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetLinearDamping,
                damping,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetAngularDamping(damping) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetAngularDamping,
                damping,
            };
            this.PhysicsType.commands.push(command);
        }

        _CreateCharacterController(
            tag,
            offset,
            upX,
            upY,
            upZ,
            maxSlopeClimbAngle,
            minSlopeSlideAngle,
            applyImpulsesToDynamicBodies,
            enableAutostep,
            autostepMinWidth,
            autostepMaxHeight,
            enableSnapToGround,
            snapToGroundMaxDistance
        ) {
            const scale = this.PhysicsType.scale;
            const command = {
                type: this.CommandType.CreateCharacterController,
                uid: this.uid,
                tag,
                offset: offset / scale,
                up: { x: upX, y: upY, z: upZ },
                maxSlopeClimbAngle,
                minSlopeSlideAngle,
                applyImpulsesToDynamicBodies,
                enableAutostep,
                autostepMinWidth: autostepMinWidth / scale,
                autostepMaxHeight: autostepMaxHeight / scale,
                enableSnapToGround,
                snapToGroundMaxDistance: snapToGroundMaxDistance / scale,
            };
            this.PhysicsType.commands.push(command);
        }

        _TranslateCharacterController(tag, x, y, z) {
            const scale = this.PhysicsType.scale;
            const command = {
                type: this.CommandType.TranslateCharacterController,
                uid: this.uid,
                tag,
                translation: { x: x / scale, y: y / scale, z: z / scale },
            };
            this.PhysicsType.commands.push(command);
        }

        _Enable() {
            return this.enable ? 1 : 0;
        }

        _WorldGravityX() {
            return 0;
        }

        _WorldGravityY() {
            return 0;
        }

        _WorldGravityZ() {
            return 0;
        }

        _IsEnabled() {
            return this.enable;
        }

        _IsImmovable() {
            return this.immovable;
        }

        _SetVelocity(x, y, z) {
            const scale = this.PhysicsType.scale;
            const command = {
                type: this.CommandType.SetVelocity,
                uid: this.uid,
                velocity: { x: x / scale, y: y / scale, z: z / scale },
            };
            this.PhysicsType.commands.push(command);
        }

        _SetImmovable(immovable) {
            this.immovable = immovable;
            if (!this.body) return;
            if (immovable) {
                this.body.mass = 0;
                this.body.sleep();
            } else {
                this.body.mass = this.defaultMass;
                this.body.wakeUp();
            }
            this.body.updateMassProperties();
        }

        _OnCollision() {
            return true;
        }

        _CollisionData() {
            const collisionData = this.collisionData;
            const target = collisionData?.target;
            const contact = collisionData?.contact;
            const result = {
                target: {
                    uid: target?.uid,
                    id: target?.id,
                },
                contact: {
                    ni: contact?.ni?.toArray(),
                    ri: contact?.ri?.toArray(),
                    rj: contact?.rj?.toArray(),
                },
            };
            return JSON.stringify(result);
        }

        _ApplyImpulse(x, y, z) {
            if (!this.body) return;
            const impulse = { x: x, y: y, z: z };
            const command = {
                type: this.CommandType.ApplyImpulse,
                uid: this.uid,
                impulse,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyImpulseAtPoint(x, y, z, pointX, pointY, pointZ) {
            if (!this.body) return;
            const impulse = { x: x, y: y, z: z };
            const point = { x: pointX, y: pointY, z: pointZ };
            const command = {
                type: this.CommandType.ApplyImpulseAtPoint,
                uid: this.uid,
                impulse,
                point,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetMass(mass) {
            if (!this.body) return;
            const command = {
                type: this.CommandType.SetMass,
                uid: this.uid,
                mass,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetCollisionFilterGroup(group) {
            console.warn(
                "SetCollisionFilterGroup is deprecated, not implemented"
            );
        }

        _SetCollisionFilterMask(mask) {
            console.warn(
                "SetCollisionFilterMask is deprecated, not implemented"
            );
        }

        _SetCollisionGroups(membership, filter) {
            if (!this.body) return;
            const command = {
                type: this.CommandType.SetCollisionGroups,
                uid: this.uid,
                membership,
                filter,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyForce(x, y, z, pointX, pointY, pointZ) {
            if (!this.body) return;
            const force = { x: x, y: y, z: z };
            const point = { x: pointX, y: pointY, z: pointZ };
            const command = {
                type: this.CommandType.ApplyForce,
                uid: this.uid,
                force,
                point,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyTorque(x, y, z) {
            if (!this.body) return;
            this.comRapier.applyTorque(this.uid, { x: x, y: y, z: z });
        }

        _SetWorldScale(scale) {
            this.PhysicsType.scale = scale;
        }

        _AttachSpring(
            tag,
            otherUID,
            restLength,
            stiffness,
            damping,
            x,
            y,
            z,
            otherX,
            otherY,
            otherZ
        ) {
            console.warn("AttachSpring is deprecated, not implemented");
        }

        _VelocityX() {
            return 0;
        }

        _VelocityY() {
            return 0;
        }

        _VelocityZ() {
            return 0;
        }

        _UpdateHeightfield() {
            if (!this.body) return;
            const shape = this.body.shapes[0];
            const meshPoints = this._getMeshPoints(this._inst.GetWorldInfo());
            // Create two dimensional heightfield array using only z values from vertices
            const heightfield = new Array(meshPoints.length)
                .fill(0)
                .map(() => new Array(meshPoints[0].length).fill(0));
            let index = meshPoints.length - 1;
            for (const row of meshPoints) {
                let index2 = 0;
                for (const point of row) {
                    heightfield[index][index2] = point.z;
                    index2++;
                }
                index--;
            }
            shape.data = heightfield;
            shape.update();
        }

        _EnableDebugRender(enable, width) {
            const behavior = this._behaviorType._behavior;
            behavior.debugRender = enable;
            behavior.debugRenderWidth = width;
        }

        GetScriptInterfaceClass() {
            return scriptInterface;
        }
    };
}


B_C.Instance = getInstanceJs(
    C3.SDKBehaviorInstanceBase,
    scriptInterface,
    addonTriggers,
    C3
);
