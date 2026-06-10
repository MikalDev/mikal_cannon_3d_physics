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

//<-- BEHAVIOR_INFO -->

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
        this.tickCount = 0;
        this.worldReady = false;
        this.scale = 100;
        this.timestepMode = 0;
        this.isPaused = false;
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
        for (let i = 0; i < bodies.length; i += 17) {
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
            const sleeping = bodies[i + 14] === 1;
            const bodyType = bodies[i + 15];
            const mass = bodies[i + 16];
            globalThis.Mikal_Rapier_Bodies.set(uid, {
                translation: { x, y, z },
                rotation: { x: rx, y: ry, z: rz, w: rw },
                velocity: { x: vx, y: vy, z: vz },
                angularVelocity: { x: ax, y: ay, z: az },
                sleeping,
                bodyType,
                mass,
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
            const origin = result.origin ?? [0, 0, 0];
            const direction = result.direction ?? [0, 0, 0];
            // SDK v2: Use registered behavior instance map
            const behInst = this.getBehaviorInstanceByUid(uid);
            if (!behInst) continue;
            if (result.hasHit) {
                const timeOfImpact = Number(result.timeOfImpact ?? result.time_of_impact ?? 0);
                const hitPointWorld = vec3.create();
                vec3.add(
                    hitPointWorld,
                    origin,
                    vec3.mul(
                        direction,
                        direction,
                        vec3.fromValues(
                            timeOfImpact,
                            timeOfImpact,
                            timeOfImpact
                        )
                    )
                );
                const hitPointX = Number.isFinite(hitPointWorld[0]) ? hitPointWorld[0] * scale : 0;
                const hitPointY = Number.isFinite(hitPointWorld[1]) ? hitPointWorld[1] * scale : 0;
                const hitPointZ = Number.isFinite(hitPointWorld[2]) ? hitPointWorld[2] * scale : 0;
                const distance = Number.isFinite(timeOfImpact) ? timeOfImpact * scale : 0;
                behInst.castShapeResults.set(tag, {
                    hasHit: true,
                    hitPointWorld: [hitPointX, hitPointY, hitPointZ],
                    hitPointX,
                    hitPointY,
                    hitPointZ,
                    hitPointWorldX: hitPointX,
                    hitPointWorldY: hitPointY,
                    hitPointWorldZ: hitPointZ,
                    witness1: [
                        result.witness1.x * scale,
                        result.witness1.y * scale,
                        result.witness1.z * scale,
                    ],
                    witness1X: result.witness1.x * scale,
                    witness1Y: result.witness1.y * scale,
                    witness1Z: result.witness1.z * scale,
                    witness2: [
                        result.witness2.x * scale,
                        result.witness2.y * scale,
                        result.witness2.z * scale,
                    ],
                    witness2X: result.witness2.x * scale,
                    witness2Y: result.witness2.y * scale,
                    witness2Z: result.witness2.z * scale,
                    normal1: [
                        result.normal1.x,
                        result.normal1.y,
                        result.normal1.z,
                    ],
                    normal1X: result.normal1.x,
                    normal1Y: result.normal1.y,
                    normal1Z: result.normal1.z,
                    normal2: [
                        result.normal2.x,
                        result.normal2.y,
                        result.normal2.z,
                    ],
                    normal2X: result.normal2.x,
                    normal2Y: result.normal2.y,
                    normal2Z: result.normal2.z,
                    distance,
                    timeOfImpact,
                    maxToI: result.maxToI,
                    sequence: result.sequence,
                    hitUID: result.hitUID,
                    tag,
                });
            } else {
                behInst.castShapeResults.set(tag, {
                    hasHit: false,
                    hitPointWorld: [0, 0, 0],
                    hitPointX: 0,
                    hitPointY: 0,
                    hitPointZ: 0,
                    hitPointWorldX: 0,
                    hitPointWorldY: 0,
                    hitPointWorldZ: 0,
                    witness1: [0, 0, 0],
                    witness1X: 0,
                    witness1Y: 0,
                    witness1Z: 0,
                    witness2: [0, 0, 0],
                    witness2X: 0,
                    witness2Y: 0,
                    witness2Z: 0,
                    normal1: [0, 0, 0],
                    normal1X: 0,
                    normal1Y: 0,
                    normal1Z: 0,
                    normal2: [0, 0, 0],
                    normal2X: 0,
                    normal2Y: 0,
                    normal2Z: 0,
                    distance: 0,
                    timeOfImpact: -1,
                    maxToI: result.maxToI ?? 0,
                    sequence: result.sequence,
                    hitUID: -1,
                    tag,
                });
            }

            if (!result.noTrigger) {
                behInst._currentCastShapeTag = tag;
                behInst._trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyCastShapeResult
                );
                behInst._trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCastShapeResult
                );
            }
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
                const hitPointX = hitPointWorld[0] * scale;
                const hitPointY = hitPointWorld[1] * scale;
                const hitPointZ = hitPointWorld[2] * scale;
                behInst.raycastResults.set(tag, {
                    hasHit: true,
                    hitFaceIndex: 0,
                    hitPointWorld: [
                        hitPointX,
                        hitPointY,
                        hitPointZ,
                    ],
                    hitPointX,
                    hitPointY,
                    hitPointZ,
                    hitPointWorldX: hitPointX,
                    hitPointWorldY: hitPointY,
                    hitPointWorldZ: hitPointZ,
                    hitNormalWorld: [
                        result.normal.x,
                        result.normal.y,
                        result.normal.z,
                    ],
                    hitNormalX: result.normal.x,
                    hitNormalY: result.normal.y,
                    hitNormalZ: result.normal.z,
                    hitNormalWorldX: result.normal.x,
                    hitNormalWorldY: result.normal.y,
                    hitNormalWorldZ: result.normal.z,
                    // dir is normalized, so timeOfImpact is the physics-unit distance
                    distance: result.timeOfImpact * scale,
                    timeOfImpact: result.timeOfImpact,
                    maxDistance: result.maxToI * scale,
                    sequence: result.sequence,
                    hitUID: result.hitUID,
                    tag,
                });
            } else {
                behInst.raycastResults.set(tag, {
                    hasHit: false,
                    hitFaceIndex: -1,
                    hitPointWorld: [0, 0, 0],
                    hitPointX: 0,
                    hitPointY: 0,
                    hitPointZ: 0,
                    hitPointWorldX: 0,
                    hitPointWorldY: 0,
                    hitPointWorldZ: 0,
                    hitNormalWorld: [0, 0, 0],
                    hitNormalX: 0,
                    hitNormalY: 0,
                    hitNormalZ: 0,
                    hitNormalWorldX: 0,
                    hitNormalWorldY: 0,
                    hitNormalWorldZ: 0,
                    distance: 0,
                    timeOfImpact: -1,
                    maxDistance: (result.maxToI ?? 0) * scale,
                    sequence: result.sequence,
                    hitUID: -1,
                    tag,
                });
            }

            if (!result.noTrigger) {
                behInst._currentRaycastTag = tag;
                behInst._trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
                );
                behInst._trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult
                );
            }
        }
    }

    async sendCommandsToWorker() {
        if (!this.worldReady || !this.commands || this.commands.length === 0)
            return;

        const commands = this.commands;
        this.commands = [];
        WorkerRPC.send("runCommands", [commands]);
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
        if (worldData.ccResults) {
            this.handleCCResults(worldData.ccResults);
        }
        // UpdateRender removed - SDK v2 handles rendering automatically
    }

    handleCCResults(ccResults) {
        for (const uid in ccResults) {
            const behInst = this.getBehaviorInstanceByUid(Number(uid));
            if (behInst) {
                behInst._ccResults = ccResults[uid];
            }
        }
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

//<-- INSTANCE -->

B_C.Instance = getInstanceJs(
    globalThis.ISDKBehaviorInstanceBase,
    addonTriggers,
    C3
);
