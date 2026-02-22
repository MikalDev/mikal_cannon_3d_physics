// Minimal Worker RPC - replaces Comlink
const WorkerRPC = {
    _nextId: 1,
    _pending: new Map(),
    _worker: null,

    init(worker) {
        this._worker = worker;
        worker.addEventListener("message", (ev) => {
            const { id, result, error } = ev.data;
            if (id === undefined) return;
            const resolver = this._pending.get(id);
            if (resolver) {
                this._pending.delete(id);
                if (error) resolver.reject(new Error(error));
                else resolver.resolve(result);
            }
        });
    },

    call(method, args = [], transfer = []) {
        return new Promise((resolve, reject) => {
            const id = this._nextId++;
            this._pending.set(id, { resolve, reject });
            this._worker.postMessage({ id, method, args }, transfer);
        });
    },

    send(method, args = [], transfer = []) {
        this._worker.postMessage({ method, args }, transfer);
    },
};

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
"CastShape": {
            "forward": (inst) => inst._CastShape,
            
            "autoScriptInterface": true,
            },
"SetImmovable": {
            "forward": (inst) => inst._SetImmovable,
            
            "autoScriptInterface": true,
            },
"SetTimestep": {
            "forward": (inst) => inst._SetTimestep,
            
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
"SetRestitution": {
            "forward": (inst) => inst._SetRestitution,
            
            "autoScriptInterface": true,
            },
"SetFriction": {
            "forward": (inst) => inst._SetFriction,
            
            "autoScriptInterface": true,
            },
"SetPositionOffset": {
            "forward": (inst) => inst._SetPositionOffset,
            
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
"SetCCD": {
            "forward": (inst) => inst._SetCCD,
            
            "autoScriptInterface": true,
            },
"SetEnabledRotations": {
            "forward": (inst) => inst._SetEnabledRotations,
            
            "autoScriptInterface": true,
            },
"SetEnabledTranslations": {
            "forward": (inst) => inst._SetEnabledTranslations,
            
            "autoScriptInterface": true,
            },
"SetGravityScale": {
            "forward": (inst) => inst._SetGravityScale,
            
            "autoScriptInterface": true,
            },
"ApplyAngularImpulse": {
            "forward": (inst) => inst._ApplyAngularImpulse,
            
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
"Translate": {
            "forward": (inst) => inst._Translate,
            
            "autoScriptInterface": true,
            },
"Rotate": {
            "forward": (inst) => inst._Rotate,
            
            "autoScriptInterface": true,
            },
"TranslateCharacterController": {
            "forward": (inst) => inst._TranslateCharacterController,
            
            "autoScriptInterface": true,
            },
"SetWorldScale": {
            "forward": (inst) => inst._SetWorldScale,
            
            "autoScriptInterface": true,
            },
"AddSphericalJoint": {
            "forward": (inst) => inst._AddSphericalJoint,
            
            "autoScriptInterface": true,
            },
"AddRevoluteJoint": {
            "forward": (inst) => inst._AddRevoluteJoint,
            
            "autoScriptInterface": true,
            },
"SetSizeOverride": {
            "forward": (inst) => inst._SetSizeOverride,
            
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
"OnCharacterControllerCollision": {
            "forward": (inst) => inst._OnCharacterControllerCollision,
            
            "autoScriptInterface": true,
          },
"OnAnyRaycastResult": {
            "forward": (inst) => inst._OnAnyRaycastResult,
            
            "autoScriptInterface": true,
          },
"OnRaycastResult": {
            "forward": (inst) => inst._OnRaycastResult,
            
            "autoScriptInterface": true,
          },
"OnAnyCastShapeResult": {
            "forward": (inst) => inst._OnAnyCastShapeResult,
            
            "autoScriptInterface": true,
          },
"OnCastShapeResult": {
            "forward": (inst) => inst._OnCastShapeResult,
            
            "autoScriptInterface": true,
          },
"OnPhysicsReady": {
            "forward": (inst) => inst._OnPhysicsReady,
            
            "autoScriptInterface": true,
          }
    },
    Exps: {
      "RaycastResultAsJSON": {
            "forward": (inst) => inst._RaycastResultAsJSON,
            
            "autoScriptInterface": true,
          },
"CastShapeResultAsJSON": {
            "forward": (inst) => inst._CastShapeResultAsJSON,
            
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
"CollisionTargetUID": {
            "forward": (inst) => inst._CollisionTargetUID,
            
            "autoScriptInterface": true,
          },
"CollisionStarted": {
            "forward": (inst) => inst._CollisionStarted,
            
            "autoScriptInterface": true,
          },
"CollisionNormalX": {
            "forward": (inst) => inst._CollisionNormalX,
            
            "autoScriptInterface": true,
          },
"CollisionNormalY": {
            "forward": (inst) => inst._CollisionNormalY,
            
            "autoScriptInterface": true,
          },
"CollisionNormalZ": {
            "forward": (inst) => inst._CollisionNormalZ,
            
            "autoScriptInterface": true,
          },
"CollisionContactX": {
            "forward": (inst) => inst._CollisionContactX,
            
            "autoScriptInterface": true,
          },
"CollisionContactY": {
            "forward": (inst) => inst._CollisionContactY,
            
            "autoScriptInterface": true,
          },
"CollisionContactZ": {
            "forward": (inst) => inst._CollisionContactZ,
            
            "autoScriptInterface": true,
          },
"CollisionImpulse": {
            "forward": (inst) => inst._CollisionImpulse,
            
            "autoScriptInterface": true,
          },
"CharacterCollisionData": {
            "forward": (inst) => inst._CharacterCollisionData,
            
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
          },
"AngularVelocityX": {
            "forward": (inst) => inst._AngularVelocityX,
            
            "autoScriptInterface": true,
          },
"AngularVelocityY": {
            "forward": (inst) => inst._AngularVelocityY,
            
            "autoScriptInterface": true,
          },
"AngularVelocityZ": {
            "forward": (inst) => inst._AngularVelocityZ,
            
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

C3.Behaviors[BEHAVIOR_INFO.id] = class extends globalThis.ISDKBehaviorBase {
    constructor() {
        super();
        // this.runtime is inherited from ISDKBehaviorBase
        this.debugRenderWidth = 1;
        this.debugRender = false;
        this.rapierWorker = null;
        this.initWorker(this.runtime);
        this.commands = [];
        this.cmdTickCount = 0;
        this.tickCount = 0;
        this.worldReady = false;
        this.scale = 100;
        this.timestepMode = 0;
        this.timestepValue = 1 / 60;
        this.currentPhysicsFrameResponse = 0;
        this.currentPhysicsFrameRequest = 0;
        this.totalDt = 0;
        // SDK v2: Map to store behavior instances by UID for collision handling
        this.behaviorInstancesByUid = new Map();
    }

    // SDK v2: Register/unregister behavior instances for lookup
    registerBehaviorInstance(uid, behInst) {
        this.behaviorInstancesByUid.set(uid, behInst);
    }

    unregisterBehaviorInstance(uid) {
        this.behaviorInstancesByUid.delete(uid);
    }

    getBehaviorInstanceByUid(uid) {
        return this.behaviorInstancesByUid.get(uid) || null;
    }

    _release() {
        super._release();
        this.msgPort.postMessage({ type: "release" });
    }

    async initWorker(runtime) {
        let path = await runtime.assets.getProjectFileUrl("rapierWorker.js");
        if (typeof Worker !== "undefined") {
            console.info("web workers supported");
        } else {
            alert("No support for web workers");
            console.info("No support for web workers");
        }
        this.rapierWorker = new Worker(path, { type: "module" });
        WorkerRPC.init(this.rapierWorker);
        this.workerRPC = WorkerRPC;
        const worldReady = await WorkerRPC.call("initWorld");
        console.info("[rapier] world ready", worldReady);
        this.worldReady = worldReady;
    }

    updateBodies(bodies) {
        if (!bodies) return;
        globalThis.Mikal_Rapier_Bodies = new Map();
        const scale = this.scale;
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
    }

    handleCastShapeResults(castShapeResults) {
        const vec3 = globalThis.glMatrix.vec3;
        const scale = this.scale;
        if (!castShapeResults) return;
        for (const result of castShapeResults) {
            const uid = result.uid;
            const tag = result.tag;
            const origin = result.origin;
            const direction = result.direction;
            // SDK v2: Use registered behavior instance map
            const behInst = this.getBehaviorInstanceByUid(uid);
            if (!behInst) continue;
            if (result.hasHit) {
                const hitPointWorld = vec3.create();
                vec3.add(
                    hitPointWorld,
                    origin,
                    vec3.mul(
                        direction,
                        direction,
                        vec3.fromValues(
                            result.time_of_impact,
                            result.time_of_impact,
                            result.time_of_impact
                        )
                    )
                );
                behInst.castShapeResult = {
                    hasHit: true,
                    hitPointWorld: [
                        hitPointWorld[0] * scale,
                        hitPointWorld[1] * scale,
                        hitPointWorld[2] * scale,
                    ],
                    witness1: [
                        result.witness1.x,
                        result.witness1.y,
                        result.witness1.z,
                    ],
                    witness2: [
                        result.witness2.x,
                        result.witness2.y,
                        result.witness2.z,
                    ],
                    normal1: [
                        result.normal1.x,
                        result.normal1.y,
                        result.normal1.z,
                    ],
                    normal2: [
                        result.normal2.x,
                        result.normal2.y,
                        result.normal2.z,
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
            } else {
                behInst.castShapeResult = {
                    hasHit: false,
                    hitPointWorld: [0, 0, 0],
                    witness1: [0, 0, 0],
                    witness2: [0, 0, 0],
                    normal1: [0, 0, 0],
                    normal2: [0, 0, 0],
                    distance: 0,
                    hitUID: -1,
                    tag,
                };
            }

            behInst._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyCastShapeResult
            );
            behInst._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCastShapeResult
            );
        }
    }

    handleCastRayResults(castRayResults) {
        const vec3 = globalThis.glMatrix.vec3;
        const scale = this.scale;
        if (!castRayResults) return;
        for (const result of castRayResults) {
            const uid = result.uid;
            const tag = result.tag;
            const dir = vec3.create();
            const origin = vec3.create();
            const hasHit = result.hasHit;
            if (hasHit) {
                vec3.set(dir, result.dir.x, result.dir.y, result.dir.z);
                vec3.set(
                    origin,
                    result.origin.x,
                    result.origin.y,
                    result.origin.z
                );
            }
            // SDK v2: Use registered behavior instance map
            const behInst = this.getBehaviorInstanceByUid(uid);
            if (!behInst) continue;
            if (result.hasHit) {
                const hitPointWorld = vec3.create();
                vec3.add(
                    hitPointWorld,
                    origin,
                    vec3.mul(
                        dir,
                        dir,
                        vec3.fromValues(
                            result.timeOfImpact,
                            result.timeOfImpact,
                            result.timeOfImpact
                        )
                    )
                );
                behInst.raycastResult = {
                    hasHit: true,
                    hitFaceIndex: 0,
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
            } else {
                behInst.raycastResult = {
                    hasHit: false,
                    hitFaceIndex: -1,
                    hitPointWorld: [0, 0, 0],
                    hitNormalWorld: [0, 0, 0],
                    distance: 0,
                    hitUID: -1,
                    tag,
                };
            }

            behInst._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
            );
            behInst._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult
            );
        }
    }

    async sendCommandsToWorker() {
        // Run only once per tick
        if (!this.worldReady || !this.commands || this.commands.length === 0)
            return;

        const tickCount = this.runtime.tickCount;
        if (tickCount === this.cmdTickCount) return;
        this.cmdTickCount = tickCount;
        WorkerRPC.send("runCommands", [this.commands]);
        this.commands = [];
    }

    async Tick() {
        // Run only once per tick
        const tickCount = this.runtime.tickCount;
        if (tickCount === this.tickCount) return;
        this.tickCount = tickCount;
        if (!this.worldReady) {
            return;
        }
        const dt = this.runtime.dt;
        this.totalDt += dt;
        if (
            this.currentPhysicsFrameResponse < this.currentPhysicsFrameRequest
        ) {
            return;
        }
        this.currentPhysicsFrameRequest++;
        const stepDt = this.totalDt;
        this.totalDt = 0;
        const worldData = await WorkerRPC.call("stepWorld", [
            stepDt,
            this.currentPhysicsFrameRequest,
        ]);
        this.currentPhysicsFrameResponse = worldData.frame;
        const bodies = worldData.bodiesData;
        const collisionEvents = worldData.collisionEvents;
        if (collisionEvents?.length > 0) {
            this.handleCollisionEvents(collisionEvents);
        }
        if (this.debugRender) {
            globalThis.Mikal_Rapier_debug_buffers =
                await WorkerRPC.call("debugRender");
            globalThis.Mikal_Rapier_debug_buffers.width = 4;
            globalThis.Mikal_Rapier_debug_buffers.scale = this.scale;
        }
        if (!bodies) return;
        this.updateBodies(bodies);

        if (worldData.castRayResults?.length > 0) {
            this.handleCastRayResults(worldData.castRayResults);
        }
        if (worldData.castShapeResults?.length > 0) {
            this.handleCastShapeResults(worldData.castShapeResults);
        }
        // UpdateRender removed - SDK v2 handles rendering automatically
    }

    handleCharacterControllerCollisionEvent(collisionEvent) {
        const { body1UID, body2UID } = collisionEvent;
        // SDK v2: Use registered behavior instance map
        const behInst1 = this.getBehaviorInstanceByUid(body1UID);
        if (!behInst1) return;
        behInst1.characterCollisionData = {
            target: { uid: body2UID },
            event: collisionEvent,
        };
        behInst1._trigger(
            C3.Behaviors.mikal_cannon_3d_physics.Cnds
                .OnCharacterControllerCollision
        );
    }

    handleBodyCollisionEvent(collisionEvent) {
        const {
            body1UID,
            body2UID,
            started,
            contactNormalX, contactNormalY, contactNormalZ,
            contactPointX, contactPointY, contactPointZ,
            contactImpulse,
        } = collisionEvent;
        const scale = this.scale;
        // SDK v2: Use registered behavior instance map
        const behInst1 = this.getBehaviorInstanceByUid(body1UID);
        const behInst2 = this.getBehaviorInstanceByUid(body2UID);
        if (behInst1) {
            behInst1.collisionData = {
                target: { uid: body2UID },
                targetUID: body2UID,
                started,
                normalX: contactNormalX,
                normalY: contactNormalY,
                normalZ: contactNormalZ,
                pointX: contactPointX * scale,
                pointY: contactPointY * scale,
                pointZ: contactPointZ * scale,
                impulse: contactImpulse,
            };
            behInst1._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCollision
            );
        }
        if (behInst2) {
            behInst2.collisionData = {
                target: { uid: body1UID },
                targetUID: body1UID,
                started,
                // Normal is flipped for body2 (outward normal points away from body1)
                normalX: -contactNormalX,
                normalY: -contactNormalY,
                normalZ: -contactNormalZ,
                pointX: contactPointX * scale,
                pointY: contactPointY * scale,
                pointZ: contactPointZ * scale,
                impulse: contactImpulse,
            };
            behInst2._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCollision
            );
        }
    }

    CollisionMsgType = {
        BODY: "body",
        CHARACTER_CONTROLLER: "characterController",
    };

    handleCollisionEvents(collisionEvents) {
        if (!collisionEvents) return;
        for (const collisionEvent of collisionEvents) {
            switch (collisionEvent.type) {
                case this.CollisionMsgType.BODY:
                    this.handleBodyCollisionEvent(collisionEvent);
                    break;
                case this.CollisionMsgType.CHARACTER_CONTROLLER:
                    this.handleCharacterControllerCollisionEvent(
                        collisionEvent
                    );
                    break;
                default:
                    console.warn(
                        "Unknown collision event type",
                        collisionEvent
                    );
            }
        }
    }
};

const B_C = C3.Behaviors[BEHAVIOR_INFO.id];
B_C.Type = class extends globalThis.ISDKBehaviorTypeBase {
    constructor() {
        super();
    }

    _release() {
        super._release();
    }
};

const addonTriggers = [];

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

// SDK v2: Map string shape types to numeric values for worker
const ShapeStringToNumber = {
    "box": 0,
    "prism": 1,
    "wedge": 2,
    "pyramid": 3,
    "corner-out": 4,
    "corner-in": 5,
};

function mapShapeToNumber(shape) {
    if (typeof shape === "number") return shape;
    const num = ShapeStringToNumber[shape];
    return num !== undefined ? num : 0; // default to box
}

// Convert quaternion (array or object) to {x,y,z,w} object format
function quatToObject(q) {
    if (!q) return { x: 0, y: 0, z: 0, w: 1 };
    if (q.length === 4) return { x: q[0], y: q[1], z: q[2], w: q[3] };
    return q;
}

function getInstanceJs(parentClass, addonTriggers, C3) {
    return class extends parentClass {
        constructor() {
            super();

            const properties = this._getInitProperties();
            if (properties) {
                this.enable = properties[0];
                this.immovable = properties[1];
                this.shapeProperty = properties[2];
                this.bodyType = properties[3];
                this.colliderType = properties[4];
                this.mass = properties[5];
                this.sizeOverride = properties[6];
                this.bodySizeHeight = properties[7];
                this.bodySizeWidth = properties[8];
                this.bodySizeDepth = properties[9];
            }
            // In SDK v2, this.instance and this.behavior are not available in constructor
            // They will be initialized in _postCreate()
            this.uid = null;
            this.PhysicsType = null;
            this.bodyDefined = false;
            this._prevPhysicsQuat = null; // Track previous physics quaternion for delta rotation (Model3D)
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
                SetTimestep: 20,
                RemoveBody: 21,
                AddSphericalJoint: 22,
                SetPositionOffset: 23,
                AddRevoluteJoint: 24,
                CastShape: 25, // Added command type for castShape
                SetCCD: 26,
                SetSizeOverride: 27,
                SetRestitution: 28,
                SetFriction: 29,
                SetEnabledRotations: 30,
                SetEnabledTranslations: 31,
                SetGravityScale: 32,
                ApplyAngularImpulse: 33,
            };
            this._setTicking(true);
            this._setTicking2(true);
        }

        _release() {
            super._release();
            // SDK v2: Unregister from behavior instance map
            if (this.PhysicsType) {
                this.PhysicsType.unregisterBehaviorInstance(this.uid);
            }
            if (this.bodyDefined) {
                const PhysicsType = this.PhysicsType;
                const command = {
                    type: this.CommandType.RemoveBody,
                    uid: this.uid,
                };
                PhysicsType.commands.push(command);
            }
        }

        _saveToJson() {
            return {
                // data to be saved for savegames
            };
        }

        _loadFromJson(o) {
            // load state for savegames
        }

        // === Coordinate Conversion Utilities ===
        // Convert world coordinates to physics units
        _toPhysics(worldValue) {
            return worldValue / this.PhysicsType.scale;
        }

        // Convert physics units to world coordinates
        _toWorld(physicsValue) {
            return physicsValue * this.PhysicsType.scale;
        }

        // Convert world vector to physics units
        _vecToPhysics(x, y, z) {
            const s = this.PhysicsType.scale;
            return { x: x / s, y: y / s, z: z / s };
        }

        // Normalize bounding box from {x,y,z} or [x,y,z] format
        _normalizeBBox(min, max) {
            const getCoord = (v, i) => v[['x', 'y', 'z'][i]] ?? v[i] ?? 0;
            return {
                min: { x: getCoord(min, 0), y: getCoord(min, 1), z: getCoord(min, 2) },
                max: { x: getCoord(max, 0), y: getCoord(max, 1), z: getCoord(max, 2) }
            };
        }

        _tick() {
            const PhysicsType = this.PhysicsType;
            PhysicsType.sendCommandsToWorker();
            PhysicsType.Tick();
        }

        _tick2() {
            // SDK v2: Use public IWorldInstance interface
            const inst = this.instance;
            const zHeight = inst.depth || 0;
            const bodyDefined = this.bodyDefined;

            // GltfStatic - auto-create body after model loads
            if (this.pluginType === "GltfStaticPlugin" && !bodyDefined) {
                const worldReady = this.behavior && this.behavior.worldReady;
                const hasLoaded = inst.loaded !== undefined ? inst.loaded : false;
                const hasBBox = inst.xMinBB !== undefined && inst.xMaxBB !== undefined;

                if (worldReady && hasLoaded && hasBBox) {
                    const result = this._create3DObjectShape(
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType,
                        this.sizeOverride
                    );
                    if (!result && !this._gltfCreateWarned) {
                        console.warn(`[Physics] GltfStatic body creation failed - UID: ${this.uid}`);
                        this._gltfCreateWarned = true;
                    }
                    if (result) return;
                }
                return;
            }

            // Model3D - auto-create body after model loads
            if (this.pluginType === "Model3DPlugin" && !bodyDefined) {
                const worldReady = this.behavior && this.behavior.worldReady;

                // Check if model is loaded via getAllMeshes() method
                let hasLoaded = false;
                if (typeof inst.getAllMeshes === 'function') {
                    try {
                        const meshes = inst.getAllMeshes();
                        hasLoaded = meshes && meshes.length > 0;
                    } catch (e) {
                        if (!this._model3dMethodWarned) {
                            console.warn(`[Physics] Model3D getAllMeshes() failed - UID: ${this.uid}`, e);
                            this._model3dMethodWarned = true;
                        }
                    }
                }

                const hasDimensions = inst.width > 0 && inst.height > 0 && inst.depth > 0;

                if (worldReady && hasLoaded && (hasDimensions || this.sizeOverride)) {
                    const result = this._create3DObjectShape(
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType,
                        this.sizeOverride
                    );
                    if (!result && !this._model3dCreateWarned) {
                        console.warn(`[Physics] Model3D body creation failed - UID: ${this.uid}`);
                        this._model3dCreateWarned = true;
                    }
                    if (result) return;
                }
                return;
            }

            if (!bodyDefined) return;
            if (!this.enable) return;

            if (!globalThis.Mikal_Rapier_Bodies) return;
            const wBody = globalThis.Mikal_Rapier_Bodies.get(this.uid);
            if (!wBody) return;
            const position = wBody.translation;
            const quatRot = wBody.rotation;

            if (this.pluginType == "GltfStaticPlugin") {
                inst.x = position.x;
                inst.y = position.y;
                inst.z = position.z;
                inst.quaternion = quatRot;

            } else if (this.pluginType === "Model3DPlugin") {
                // Set Model3D world position (base position, keep offsets at 0)
                // Model3D Z position is at the bottom, so subtract depth/2 from physics center
                const zDepth = inst.depth || 0;
                inst.x = position.x;
                inst.y = position.y;
                inst.z = position.z - zDepth / 2;

                const quat = globalThis.glMatrix.quat;
                const currentQuat = quat.fromValues(quatRot.x, quatRot.y, quatRot.z, quatRot.w);

                if (!this._prevPhysicsQuat) {
                    // First frame: set absolute rotation directly
                    const eulerAngles = this._quaternionToEuler(currentQuat);
                    inst.rotationX = eulerAngles[0];
                    inst.rotationY = eulerAngles[1];
                    inst.rotationZ = eulerAngles[2];
                    this._prevPhysicsQuat = quat.clone(currentQuat);
                } else {
                    // Subsequent frames: compute delta rotation to avoid gimbal lock
                    // Delta = inverse(previous) * current (local frame delta)
                    const prevInverse = quat.create();
                    quat.invert(prevInverse, this._prevPhysicsQuat);

                    const deltaQuat = quat.create();
                    quat.multiply(deltaQuat, prevInverse, currentQuat);
                    quat.normalize(deltaQuat, deltaQuat);

                    // Convert delta quaternion to Euler angles
                    const deltaEuler = this._quaternionToEuler(deltaQuat);

                    // Apply delta rotation using addTransform (adds to current rotation)
                    inst.addTransform(deltaEuler[0], deltaEuler[1], deltaEuler[2], "rotation");

                    // Update previous quaternion for next frame
                    quat.copy(this._prevPhysicsQuat, currentQuat);
                }
            } else {
                const zElevation = position.z - zHeight / 2;
                inst.z = zElevation;
                inst.x = position.x;
                inst.y = position.y;
                // Extract Z-axis rotation from quaternion
                const quat = globalThis.glMatrix.quat;
                const zRot = quat.fromValues(
                    quatRot.x,
                    quatRot.y,
                    quatRot.z,
                    quatRot.w
                );
                const angles = this._quaternionToEuler(zRot);
                inst.angle = angles[2];
            }
        }

        _postCreate() {
            // Initialize properties that require this.instance and this.behavior
            // (not available in constructor in SDK v2)
            this.uid = this.instance.uid;
            this.PhysicsType = this.behavior;

            // SDK v2: Register this behavior instance for collision/raycast lookups
            this.PhysicsType.registerBehaviorInstance(this.uid, this);

            // SDK v2: Use plugin.id to detect plugin type
            const plugin = this.instance.objectType.plugin;
            const pluginId = plugin.id;

            // Object created - detect plugin type and setup

            if (pluginId === "Shape3D") {
                this.pluginType = "Shape3DPlugin";
                // Removed verbose debug log
                if (!this.bodyDefined) {
                    // SDK v2: Use public I3DShapeInstance.shape property
                    // Map string shape type to numeric value for worker
                    const shape = mapShapeToNumber(this.instance.shape);
                    this.DefineBody(
                        this.pluginType,
                        shape,
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType
                    );
                    this.bodyDefined = true;
                    // Removed verbose debug log
                    this._trigger(
                        C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                    );
                }
            } else if (pluginId === "Sprite") {
                this.pluginType = "SpritePlugin";
                // Removed verbose debug log
                this.DefineBody(
                    this.pluginType,
                    null,
                    null,
                    this.bodyType,
                    this.colliderType
                );
                // Removed verbose debug log
                this._trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                );
            } else if (pluginId === "GltfStatic") {
                this.pluginType = "GltfStaticPlugin";
            } else if (pluginId === "Model3D") {
                this.pluginType = "Model3DPlugin";
                const inst = this.instance;

                // Model3D detected
            } else {
                this.pluginType = "invalid";
                console.error("[Physics Debug] Invalid pluginType - plugin id:", pluginId);
            }
        }

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

        _SetSizeOverride(enable, height, width, depth) {
            // SDK v2: Use public IWorldInstance interface
            this.sizeOverride = enable;
            this.bodySizeHeight = height;
            this.bodySizeWidth = width;
            this.bodySizeDepth = depth;
            if (this.pluginType === "GltfStaticPlugin" || this.pluginType === "Model3DPlugin") {
                this._create3DObjectShape(
                    this.shapeProperty,
                    this.bodyType,
                    this.colliderType,
                    enable
                );
                return;
            }
            // Only works for 3DShape and Sprite
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

        _eulerToQuaternion(eulerX, eulerY, eulerZ) {
            // Input: Euler angles in radians (XYZ order - pitch, yaw, roll)
            // Output: Quaternion {x, y, z, w}
            const quat = globalThis.glMatrix.quat;
            const result = quat.create();

            // glMatrix.quat.fromEuler expects degrees, convert from radians
            const degX = eulerX * (180 / Math.PI);
            const degY = eulerY * (180 / Math.PI);
            const degZ = eulerZ * (180 / Math.PI);

            quat.fromEuler(result, degX, degY, degZ);

            return {
                x: result[0],
                y: result[1],
                z: result[2],
                w: result[3]
            };
        }

        // GltfStatic and Model3D use primitive shape colliders (box, capsule, sphere, etc.)
        // Can auto-create from bounding box or use manual dimensions via SetSizeOverride
        _create3DObjectShape(shapeProperty, bodyType, colliderType, overrideSize) {
            const inst = this.instance;
            const enableRot = [true, true, true]; // Both plugins can rotate on all axes

            // Get initial position and rotation based on plugin type
            let posX, posY, posZ;
            let initialQuat;

            if (this.pluginType === "GltfStaticPlugin") {
                posX = inst.x;
                posY = inst.y;
                posZ = inst.z;
                initialQuat = quatToObject(inst.quaternion);

            } else if (this.pluginType === "Model3DPlugin") {
                // Model3D has base position (x, y, z) plus offsets
                // Note: Model3D Z position is at the bottom of the model, so add depth/2 for physics center
                posX = inst.x + (inst.offsetX || 0);
                posY = inst.y + (inst.offsetY || 0);
                // depth will be determined later, so we'll adjust posZ after getting dimensions
                posZ = inst.z + (inst.offsetZ || 0);

                // Convert Euler (radians) to quaternion
                initialQuat = this._eulerToQuaternion(
                    inst.rotationX || 0,
                    inst.rotationY || 0,
                    inst.rotationZ || 0
                );

                // Model3D rotation configured
            }

            // Determine dimensions: from extracted bounding box, bounding box, or manual override
            let width, height, depth;

            // Try extracted bounding box first (Model3D only)
            if (this.pluginType === "Model3DPlugin" && !overrideSize && this._extractedBBoxMin && this._extractedBBoxMax) {
                const bbox = this._normalizeBBox(this._extractedBBoxMin, this._extractedBBoxMax);
                const bboxWidth = Math.abs(bbox.max.x - bbox.min.x);
                const bboxHeight = Math.abs(bbox.max.y - bbox.min.y);
                const bboxDepth = Math.abs(bbox.max.z - bbox.min.z);

                if (bboxWidth > 0 || bboxHeight > 0 || bboxDepth > 0) {
                    width = bboxWidth;
                    height = bboxHeight;
                    depth = bboxDepth;
                }
            }

            // Try to get dimensions from bounding box if available
            if (!overrideSize && inst.xMinBB && inst.xMaxBB) {
                const bbox = this._normalizeBBox(inst.xMinBB, inst.xMaxBB);
                const bboxWidth = Math.abs(bbox.max.x - bbox.min.x);
                const bboxHeight = Math.abs(bbox.max.y - bbox.min.y);
                const bboxDepth = Math.abs(bbox.max.z - bbox.min.z);

                if (bboxWidth > 0 || bboxHeight > 0 || bboxDepth > 0) {
                    width = bboxWidth;
                    height = bboxHeight;
                    depth = bboxDepth;
                } else {
                    console.warn(`[Physics Debug] Bounding box is zero-sized - UID: ${this.uid}`);
                    return false;
                }
            } else if (overrideSize) {
                // Use manual override dimensions
                width = this.bodySizeWidth;
                height = this.bodySizeHeight;
                depth = this.bodySizeDepth;
            } else if (inst.width > 0 && inst.height > 0 && inst.depth > 0) {
                // Use instance dimensions (Model3D, etc.)
                width = inst.width;
                height = inst.height;
                depth = inst.depth;
                
            } else {
                const pluginName = this.pluginType === "GltfStaticPlugin" ? "GltfStatic" : this.pluginType === "Model3DPlugin" ? "Model3D" : "Unknown";
                console.warn(`[Physics Debug] _create3DObjectShape for ${pluginName} - UID: ${this.uid}
  ⚠ No dimensions available - model not loaded or size override disabled

  Options:
  → Wait for model to load (${pluginName === "GltfStatic" ? "inst.loaded = true" : "model loads via loadModel()"})
  → ${pluginName} should expose: ${pluginName === "GltfStatic" ? "inst.xMinBB = [x,y,z] and inst.xMaxBB = [x,y,z]" : "bounding box via AnimatedModel"}
  → OR use "Set size override" action with manual dimensions`);
                return false;
            }

            // Apply Model3D scale if applicable
            if (this.pluginType === "Model3DPlugin" && (width !== undefined && height !== undefined && depth !== undefined)) {
                const scaleX = inst.scaleX || 1;
                const scaleY = inst.scaleY || 1;
                const scaleZ = inst.scaleZ || 1;

                

                width *= scaleX;
                height *= scaleY;
                depth *= scaleZ;
            }

            // Model3D Z position is at the bottom of the model, adjust to physics center
            if (this.pluginType === "Model3DPlugin") {
                posZ += depth / 2;
            }

            // Convert mesh-based shapes to Box for GltfStatic/Model3D
            // Shape types: 0=Auto, 1=ModelMesh, 2=Box, 3=Sphere, 4=Cylinder, 5=Capsule, 6=ConvexHulls
            let actualShapeType = shapeProperty;
            if (shapeProperty === 1 || shapeProperty === 6) { // ModelMesh or ConvexHulls
                actualShapeType = 2; // Box
            }

            const scaledWidth = this._toPhysics(width);
            const scaledHeight = this._toPhysics(height);
            const scaledDepth = this._toPhysics(depth);


            // Check for very small dimensions that could cause physics instability
            const minDim = Math.min(scaledWidth, scaledHeight, scaledDepth);
            if (minDim < 0.1) {
                console.warn(`[Physics Debug] ⚠ Very small physics dimensions detected - UID: ${this.uid}
  Smallest dimension: ${minDim.toFixed(4)} physics units
  This may cause unstable physics behavior or wild spinning
  Consider: Increase model size OR decrease physics scale factor (currently ${this.PhysicsType.scale})`);
            }

            const command = {
                type: this.CommandType.AddBody,
                uid: inst.uid,
                ...this._vecToPhysics(posX, posY, posZ),
                q: {
                    x: initialQuat.x,
                    y: initialQuat.y,
                    z: initialQuat.z,
                    w: initialQuat.w
                },
                width: scaledWidth,
                height: scaledHeight,
                depth: scaledDepth,
                immovable: this.immovable,
                enableRot0: enableRot[0],
                enableRot1: enableRot[1],
                enableRot2: enableRot[2],
                shapeType: actualShapeType, // Use converted shape type
                bodyType,
                colliderType,
                shape: null, // GltfStatic uses primitive shapes, not Shape3D geometry
                mass: this.mass,
            };

            this.PhysicsType.commands.push(command);

            // Mark body as defined and trigger ready event
            this.bodyDefined = true;
            this._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
            );

            // Body created
            return true;
        }

        // Get mesh points from object using public IWorldInstance API
        _getMeshPoints() {
            const inst = this.instance;
            const meshSize = inst.getMeshSize();
            if (!meshSize || meshSize[0] === 0 || meshSize[1] === 0) return [];
            const [cols, rows] = meshSize;
            const width = inst.width;
            const height = inst.height;
            const meshPoints = [];
            for (let row = 0; row < rows; row++) {
                const meshRow = [];
                for (let col = 0; col < cols; col++) {
                    const point = inst.getMeshPoint(col, row);
                    meshRow.push(this._vecToPhysics(point.x * width, point.y * height, point.z));
                }
                meshPoints.push(meshRow);
            }
            return meshPoints;
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
            filterGroups,
            mask,
            skipBackfaces,
            mode
        ) {
            if (!this.PhysicsType.worldReady) {
                this.raycastResult = {
                    hasHit: false,
                    tag,
                };
                return;
            }
            const vec3 = globalThis.glMatrix.vec3;
            const origin = vec3.fromValues(
                this._toPhysics(fromX),
                this._toPhysics(fromY),
                this._toPhysics(fromZ)
            );
            const to = vec3.fromValues(this._toPhysics(x), this._toPhysics(y), this._toPhysics(z));
            let maxToI = vec3.distance(origin, to);
            vec3.sub(to, to, origin);
            // Normalize to, making dir vector
            vec3.normalize(to, to);
            const dir = to;
            const command = {
                type: this.CommandType.Raycast,
                origin: { x: origin[0], y: origin[1], z: origin[2] },
                dir: { x: dir[0], y: dir[1], z: dir[2] },
                maxToI,
                filterGroups,
                skipBackfaces,
                uid: this.uid,
                tag,
            };
            this.PhysicsType.commands.push(command);
        }

        _RaycastResultAsJSON() {
            if (!this.raycastResult) {
                const resut = { hasHit: false, hitUID: -1 };
                return JSON.stringify(resut);
            }
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

        _SetRestitution(restitution) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetRestitution,
                restitution,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetFriction(friction) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetFriction,
                friction,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetCCD(enable) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetCCD,
                enable,
            };
            this.PhysicsType.commands.push(command);
        }

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

        _SetGravityScale(scale) {
            if (!this.bodyDefined) return;
            const command = {
                uid: this.uid,
                type: this.CommandType.SetGravityScale,
                scale,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyAngularImpulse(x, y, z) {
            if (!this.bodyDefined) return;
            const command = {
                uid: this.uid,
                type: this.CommandType.ApplyAngularImpulse,
                x,
                y,
                z,
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
            const command = {
                type: this.CommandType.CreateCharacterController,
                uid: this.uid,
                tag,
                offset: this._toPhysics(offset),
                up: { x: upX, y: upY, z: upZ },
                maxSlopeClimbAngle,
                minSlopeSlideAngle,
                applyImpulsesToDynamicBodies,
                enableAutostep,
                autostepMinWidth: this._toPhysics(autostepMinWidth),
                autostepMaxHeight: this._toPhysics(autostepMaxHeight),
                enableSnapToGround,
                snapToGroundMaxDistance: this._toPhysics(snapToGroundMaxDistance),
            };
            this.PhysicsType.commands.push(command);
        }

        _TranslateCharacterController(tag, x, y, z) {
            const command = {
                type: this.CommandType.TranslateCharacterController,
                uid: this.uid,
                tag,
                translation: this._vecToPhysics(x, y, z),
            };
            this.PhysicsType.commands.push(command);
        }

        _Translate(x, y, z) {
            const command = {
                type: this.CommandType.Translate,
                uid: this.uid,
                translation: this._vecToPhysics(x, y, z),
            };
            this.PhysicsType.commands.push(command);
        }

        _Rotate(x, y, z) {
            // x, y, z in degrees, convert to quaternion
            const quat = globalThis.glMatrix.quat;
            const rotation = quat.create();
            quat.fromEuler(rotation, x, y, z);
            const command = {
                type: this.CommandType.Rotate,
                uid: this.uid,
                rotation: {
                    x: rotation[0],
                    y: rotation[1],
                    z: rotation[2],
                    w: rotation[3],
                },
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

        _SetTimestep(mode, value) {
            const PhysicsType = this.behavior;
            PhysicsType.timestepMode = mode;
            PhysicsType.timestepValue = value;
            const command = {
                type: this.CommandType.SetTimestep,
                mode,
                value,
            };
            this.PhysicsType.commands.push(command);
        }

        _IsEnabled() {
            return this.enable;
        }

        _IsImmovable() {
            return this.immovable;
        }

        _SetVelocity(x, y, z) {
            const command = {
                type: this.CommandType.SetVelocity,
                uid: this.uid,
                velocity: this._vecToPhysics(x, y, z),
            };
            this.PhysicsType.commands.push(command);
        }

        _SetImmovable(immovable) {
            this.immovable = immovable;
            if (!this.bodyDefined) return;
            // XXX send to rapierWorker
        }

        _OnCollision() {
            return true;
        }

        _OnCharacterControllerCollision() {
            return true;
        }

        _CollisionData() {
            const collisionData = this.collisionData;
            if (!collisionData) return "{}";
            return JSON.stringify(collisionData);
        }

        _CollisionTargetUID() {
            return this.collisionData?.targetUID ?? -1;
        }

        _CollisionStarted() {
            return this.collisionData?.started ? 1 : 0;
        }

        _CollisionNormalX() {
            return this.collisionData?.normalX ?? 0;
        }

        _CollisionNormalY() {
            return this.collisionData?.normalY ?? 0;
        }

        _CollisionNormalZ() {
            return this.collisionData?.normalZ ?? 0;
        }

        _CollisionContactX() {
            return this.collisionData?.pointX ?? 0;
        }

        _CollisionContactY() {
            return this.collisionData?.pointY ?? 0;
        }

        _CollisionContactZ() {
            return this.collisionData?.pointZ ?? 0;
        }

        _CollisionImpulse() {
            return this.collisionData?.impulse ?? 0;
        }

        _CharacterCollisionData() {
            const collisionData = this.characterCollisionData;
            if (!collisionData) return "{}";
            return JSON.stringify(collisionData);
        }

        _ApplyImpulse(x, y, z) {
            if (!this.bodyDefined) return;
            const impulse = { x: x, y: y, z: z };
            const command = {
                type: this.CommandType.ApplyImpulse,
                uid: this.uid,
                impulse,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyImpulseAtPoint(x, y, z, pointX, pointY, pointZ) {
            if (!this.bodyDefined) return;
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
            if (!this.bodyDefined) return;
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
            if (!this.bodyDefined) return;
            const command = {
                type: this.CommandType.SetCollisionGroups,
                uid: this.uid,
                membership,
                filter,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyForce(x, y, z, pointX, pointY, pointZ) {
            if (!this.bodyDefined) return;
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
            if (!this.bodyDefined) return;
            const command = {
                type: this.CommandType.ApplyTorque,
                uid: this.uid,
                torque: { x, y, z },
            };
            this.PhysicsType.commands.push(command);
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
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.x ?? 0;
        }

        _VelocityY() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.y ?? 0;
        }

        _VelocityZ() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.z ?? 0;
        }

        _AngularVelocityX() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.x ?? 0;
        }

        _AngularVelocityY() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.y ?? 0;
        }

        _AngularVelocityZ() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.z ?? 0;
        }

        _EnableDebugRender(enable, width) {
            const behavior = this.behavior;
            behavior.debugRender = enable;
            behavior.debugRenderWidth = width;
        }

        _AddSphericalJoint(
            anchorX,
            anchorY,
            anchorZ,
            targetAnchorX,
            targetAnchorY,
            targetAnchorZ,
            targetUID
        ) {
            const command = {
                type: this.CommandType.AddSphericalJoint,
                uid: this.uid,
                anchor: this._vecToPhysics(anchorX, anchorY, anchorZ),
                targetAnchor: this._vecToPhysics(targetAnchorX, targetAnchorY, targetAnchorZ),
                targetUID,
            };
            this.PhysicsType.commands.push(command);
        }

        _AddRevoluteJoint(
            anchorX,
            anchorY,
            anchorZ,
            targetAnchorX,
            targetAnchorY,
            targetAnchorZ,
            axisX,
            axisY,
            axisZ,
            targetUID
        ) {
            const command = {
                type: this.CommandType.AddRevoluteJoint,
                uid: this.uid,
                anchor: this._vecToPhysics(anchorX, anchorY, anchorZ),
                targetAnchor: this._vecToPhysics(targetAnchorX, targetAnchorY, targetAnchorZ),
                targetUID,
                axis: { x: axisX, y: axisY, z: axisZ },
            };
            this.PhysicsType.commands.push(command);
        }

        _SetPositionOffset(x, y, z) {
            const command = {
                type: this.CommandType.SetPositionOffset,
                uid: this.uid,
                positionOffset: this._vecToPhysics(x, y, z),
            };
            this.PhysicsType.commands.push(command);
        }

        async _CastShape(
            tag,
            shapeType,
            height,
            width,
            depth,
            rotX,
            rotY,
            rotZ,
            fromX,
            fromY,
            fromZ,
            toX,
            toY,
            toZ,
            maxToI,
            targetDistance,
            filterGroups,
            excludeUID,
            skipBackfaces
        ) {
            if (!this.PhysicsType.worldReady) {
                this.castShapeResult = {
                    hasHit: false,
                };
                return;
            }
            const vec3 = globalThis.glMatrix.vec3;

            const origin = vec3.fromValues(
                this._toPhysics(fromX),
                this._toPhysics(fromY),
                this._toPhysics(fromZ)
            );
            const to = vec3.fromValues(this._toPhysics(toX), this._toPhysics(toY), this._toPhysics(toZ));

            // Calculate direction
            let direction = vec3.create();
            vec3.sub(direction, to, origin);
            // vec3.normalize(direction, direction); // Normalize the direction vector (Foozle: I don't believe it should be normalized.)

            // Map shapeType to string if necessary
            const shapeTypeMap = {
                0: "box",
                1: "sphere",
                2: "capsule",
                // Add more mappings if there are more shape types
            };

            const shapeTypeString =
                typeof shapeType === "string"
                    ? shapeType
                    : shapeTypeMap[shapeType];

            if (!shapeTypeString) {
                throw new Error("Unknown shape type: " + shapeTypeString);
            }

            const command = {
                type: this.CommandType.CastShape,
                shape: {
                    type: shapeTypeString, // e.g., "box", "sphere", "capsule"
                    width: this._toPhysics(width),
                    height: this._toPhysics(height),
                    depth: this._toPhysics(depth),
                },
                origin: { x: origin[0], y: origin[1], z: origin[2] },
                dir: { x: direction[0], y: direction[1], z: direction[2] },
                rotation: {
                    x: rotX,
                    y: rotY,
                    z: rotZ,
                },
                maxToI,
                targetDistance: this._toPhysics(targetDistance),
                filterGroups,
                excludeUID,
                skipBackfaces,
                tag,
                uid: this.instance.uid,
            };

            this.PhysicsType.commands.push(command);
        }

        _CastShapeResultAsJSON() {
            if (!this.castShapeResult) {
                const result = { hasHit: false, hitUID: -1 };
                return JSON.stringify(result);
            }
            return JSON.stringify(this.castShapeResult);
        }

        _OnAnyCastShapeResult() {
            return true;
        }

        _OnCastShapeResult(tag) {
            return this.castShapeResult.tag === tag;
        }

        _OnPhysicsReady() {
            return true;
        }
    };
}


B_C.Instance = getInstanceJs(
    globalThis.ISDKBehaviorInstanceBase,
    addonTriggers,
    C3
);
