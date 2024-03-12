// @ts-check
"use strict";

// Import RAPIER and Comlink
console.log("rapierWorker.js rap loaded 3d-compat start");
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat";
// import RAPIER from "https://preview.construct.net/rapier3d-compat.js";
console.log("rapierWorker.js rap loaded 3d-compat");
// import * as Comlink from "https://kindeyegames.com/forumfiles/comlink.js";

console.log("rapierWorker.js com loaded comlink.js");

const Mikal_Rapier_Comlink = (function () {
    /**
     * @license
     * Copyright 2019 Google LLC
     * SPDX-License-Identifier: Apache-2.0
     */
    const proxyMarker = Symbol("Comlink.proxy");
    const createEndpoint = Symbol("Comlink.endpoint");
    const releaseProxy = Symbol("Comlink.releaseProxy");
    const finalizer = Symbol("Comlink.finalizer");
    const throwMarker = Symbol("Comlink.thrown");
    const isObject = (val) =>
        (typeof val === "object" && val !== null) || typeof val === "function";
    /**
     * Internal transfer handle to handle objects marked to proxy.
     */
    const proxyTransferHandler = {
        canHandle: (val) => isObject(val) && val[proxyMarker],
        serialize(obj) {
            const { port1, port2 } = new MessageChannel();
            expose(obj, port1);
            return [port2, [port2]];
        },
        deserialize(port) {
            port.start();
            return wrap(port);
        },
    };
    /**
     * Internal transfer handler to handle thrown exceptions.
     */
    const throwTransferHandler = {
        canHandle: (value) => isObject(value) && throwMarker in value,
        serialize({ value }) {
            let serialized;
            if (value instanceof Error) {
                serialized = {
                    isError: true,
                    value: {
                        message: value.message,
                        name: value.name,
                        stack: value.stack,
                    },
                };
            } else {
                serialized = { isError: false, value };
            }
            return [serialized, []];
        },
        deserialize(serialized) {
            if (serialized.isError) {
                throw Object.assign(
                    new Error(serialized.value.message),
                    serialized.value
                );
            }
            throw serialized.value;
        },
    };
    /**
     * Allows customizing the serialization of certain values.
     */
    const transferHandlers = new Map([
        ["proxy", proxyTransferHandler],
        ["throw", throwTransferHandler],
    ]);
    function isAllowedOrigin(allowedOrigins, origin) {
        for (const allowedOrigin of allowedOrigins) {
            if (origin === allowedOrigin || allowedOrigin === "*") {
                return true;
            }
            if (allowedOrigin instanceof RegExp && allowedOrigin.test(origin)) {
                return true;
            }
        }
        return false;
    }
    function expose(obj, ep = globalThis, allowedOrigins = ["*"]) {
        ep.addEventListener("message", function callback(ev) {
            if (!ev || !ev.data) {
                return;
            }
            if (!isAllowedOrigin(allowedOrigins, ev.origin)) {
                console.warn(`Invalid origin '${ev.origin}' for comlink proxy`);
                return;
            }
            const { id, type, path } = Object.assign({ path: [] }, ev.data);
            const argumentList = (ev.data.argumentList || []).map(
                fromWireValue
            );
            let returnValue;
            try {
                const parent = path
                    .slice(0, -1)
                    .reduce((obj, prop) => obj[prop], obj);
                const rawValue = path.reduce((obj, prop) => obj[prop], obj);
                switch (type) {
                    case "GET" /* MessageType.GET */:
                        {
                            returnValue = rawValue;
                        }
                        break;
                    case "SET" /* MessageType.SET */:
                        {
                            parent[path.slice(-1)[0]] = fromWireValue(
                                ev.data.value
                            );
                            returnValue = true;
                        }
                        break;
                    case "APPLY" /* MessageType.APPLY */:
                        {
                            returnValue = rawValue.apply(parent, argumentList);
                        }
                        break;
                    case "CONSTRUCT" /* MessageType.CONSTRUCT */:
                        {
                            const value = new rawValue(...argumentList);
                            returnValue = proxy(value);
                        }
                        break;
                    case "ENDPOINT" /* MessageType.ENDPOINT */:
                        {
                            const { port1, port2 } = new MessageChannel();
                            expose(obj, port2);
                            returnValue = transfer(port1, [port1]);
                        }
                        break;
                    case "RELEASE" /* MessageType.RELEASE */:
                        {
                            returnValue = undefined;
                        }
                        break;
                    default:
                        return;
                }
            } catch (value) {
                returnValue = { value, [throwMarker]: 0 };
            }
            Promise.resolve(returnValue)
                .catch((value) => {
                    return { value, [throwMarker]: 0 };
                })
                .then((returnValue) => {
                    const [wireValue, transferables] = toWireValue(returnValue);
                    ep.postMessage(
                        Object.assign(Object.assign({}, wireValue), { id }),
                        transferables
                    );
                    if (type === "RELEASE" /* MessageType.RELEASE */) {
                        // detach and deactive after sending release response above.
                        ep.removeEventListener("message", callback);
                        closeEndPoint(ep);
                        if (
                            finalizer in obj &&
                            typeof obj[finalizer] === "function"
                        ) {
                            obj[finalizer]();
                        }
                    }
                })
                .catch((error) => {
                    // Send Serialization Error To Caller
                    const [wireValue, transferables] = toWireValue({
                        value: new TypeError("Unserializable return value"),
                        [throwMarker]: 0,
                    });
                    ep.postMessage(
                        Object.assign(Object.assign({}, wireValue), { id }),
                        transferables
                    );
                });
        });
        if (ep.start) {
            ep.start();
        }
    }
    function isMessagePort(endpoint) {
        return endpoint.constructor.name === "MessagePort";
    }
    function closeEndPoint(endpoint) {
        if (isMessagePort(endpoint)) endpoint.close();
    }
    function wrap(ep, target) {
        const pendingListeners = new Map();
        ep.addEventListener("message", function handleMessage(ev) {
            const { data } = ev;
            if (!data || !data.id) {
                return;
            }
            const resolver = pendingListeners.get(data.id);
            if (!resolver) {
                return;
            }
            try {
                resolver(data);
            } finally {
                pendingListeners.delete(data.id);
            }
        });
        return createProxy(ep, pendingListeners, [], target);
    }
    function throwIfProxyReleased(isReleased) {
        if (isReleased) {
            throw new Error("Proxy has been released and is not useable");
        }
    }
    function releaseEndpoint(ep) {
        return requestResponseMessage(ep, new Map(), {
            type: "RELEASE" /* MessageType.RELEASE */,
        }).then(() => {
            closeEndPoint(ep);
        });
    }
    const proxyCounter = new WeakMap();
    const proxyFinalizers =
        "FinalizationRegistry" in globalThis &&
        new FinalizationRegistry((ep) => {
            const newCount = (proxyCounter.get(ep) || 0) - 1;
            proxyCounter.set(ep, newCount);
            if (newCount === 0) {
                releaseEndpoint(ep);
            }
        });
    function registerProxy(proxy, ep) {
        const newCount = (proxyCounter.get(ep) || 0) + 1;
        proxyCounter.set(ep, newCount);
        if (proxyFinalizers) {
            proxyFinalizers.register(proxy, ep, proxy);
        }
    }
    function unregisterProxy(proxy) {
        if (proxyFinalizers) {
            proxyFinalizers.unregister(proxy);
        }
    }
    function createProxy(
        ep,
        pendingListeners,
        path = [],
        target = function () {}
    ) {
        let isProxyReleased = false;
        const propProxyCache = new Map();
        const proxy = new Proxy(target, {
            get(_target, prop) {
                throwIfProxyReleased(isProxyReleased);
                if (prop === releaseProxy) {
                    return () => {
                        for (const subProxy of propProxyCache.values()) {
                            subProxy[releaseProxy]();
                        }
                        propProxyCache.clear();
                        unregisterProxy(proxy);
                        releaseEndpoint(ep);
                        pendingListeners.clear();
                        isProxyReleased = true;
                    };
                }
                if (prop === "then") {
                    if (path.length === 0) {
                        return { then: () => proxy };
                    }
                    const r = requestResponseMessage(ep, pendingListeners, {
                        type: "GET" /* MessageType.GET */,
                        path: path.map((p) => p.toString()),
                    }).then(fromWireValue);
                    return r.then.bind(r);
                }
                const cachedProxy = propProxyCache.get(prop);
                if (cachedProxy) {
                    return cachedProxy;
                }
                const propProxy = createProxy(ep, pendingListeners, [
                    ...path,
                    prop,
                ]);
                propProxyCache.set(prop, propProxy);
                return propProxy;
            },
            set(_target, prop, rawValue) {
                throwIfProxyReleased(isProxyReleased);
                // FIXME: ES6 Proxy Handler `set` methods are supposed to return a
                // boolean. To show good will, we return true asynchronously Â¯\_(ãƒ„)_/Â¯
                const [value, transferables] = toWireValue(rawValue);
                return requestResponseMessage(
                    ep,
                    pendingListeners,
                    {
                        type: "SET" /* MessageType.SET */,
                        path: [...path, prop].map((p) => p.toString()),
                        value,
                    },
                    transferables
                ).then(fromWireValue);
            },
            apply(_target, _thisArg, rawArgumentList) {
                throwIfProxyReleased(isProxyReleased);
                const last = path[path.length - 1];
                if (last === createEndpoint) {
                    return requestResponseMessage(ep, pendingListeners, {
                        type: "ENDPOINT" /* MessageType.ENDPOINT */,
                    }).then(fromWireValue);
                }
                // We just pretend that `bind()` didnâ€™t happen.
                if (last === "bind") {
                    return createProxy(ep, pendingListeners, path.slice(0, -1));
                }
                const [argumentList, transferables] =
                    processArguments(rawArgumentList);
                return requestResponseMessage(
                    ep,
                    pendingListeners,
                    {
                        type: "APPLY" /* MessageType.APPLY */,
                        path: path.map((p) => p.toString()),
                        argumentList,
                    },
                    transferables
                ).then(fromWireValue);
            },
            construct(_target, rawArgumentList) {
                throwIfProxyReleased(isProxyReleased);
                const [argumentList, transferables] =
                    processArguments(rawArgumentList);
                return requestResponseMessage(
                    ep,
                    pendingListeners,
                    {
                        type: "CONSTRUCT" /* MessageType.CONSTRUCT */,
                        path: path.map((p) => p.toString()),
                        argumentList,
                    },
                    transferables
                ).then(fromWireValue);
            },
        });
        registerProxy(proxy, ep);
        return proxy;
    }
    function myFlat(arr) {
        return Array.prototype.concat.apply([], arr);
    }
    function processArguments(argumentList) {
        const processed = argumentList.map(toWireValue);
        return [processed.map((v) => v[0]), myFlat(processed.map((v) => v[1]))];
    }
    const transferCache = new WeakMap();
    function transfer(obj, transfers) {
        transferCache.set(obj, transfers);
        return obj;
    }
    function proxy(obj) {
        return Object.assign(obj, { [proxyMarker]: true });
    }
    function windowEndpoint(w, context = globalThis, targetOrigin = "*") {
        return {
            postMessage: (msg, transferables) =>
                w.postMessage(msg, targetOrigin, transferables),
            addEventListener: context.addEventListener.bind(context),
            removeEventListener: context.removeEventListener.bind(context),
        };
    }
    function toWireValue(value) {
        for (const [name, handler] of transferHandlers) {
            if (handler.canHandle(value)) {
                const [serializedValue, transferables] =
                    handler.serialize(value);
                return [
                    {
                        type: "HANDLER" /* WireValueType.HANDLER */,
                        name,
                        value: serializedValue,
                    },
                    transferables,
                ];
            }
        }
        return [
            {
                type: "RAW" /* WireValueType.RAW */,
                value,
            },
            transferCache.get(value) || [],
        ];
    }
    function fromWireValue(value) {
        switch (value.type) {
            case "HANDLER" /* WireValueType.HANDLER */:
                return transferHandlers
                    .get(value.name)
                    .deserialize(value.value);
            case "RAW" /* WireValueType.RAW */:
                return value.value;
        }
    }
    function requestResponseMessage(ep, pendingListeners, msg, transfers) {
        return new Promise((resolve) => {
            const id = Math.trunc(
                Math.random() * Number.MAX_SAFE_INTEGER
            ).toString();
            pendingListeners.set(id, resolve);
            if (ep.start) {
                ep.start();
            }
            ep.postMessage(Object.assign({ id }, msg), transfers);
        });
    }

    // export { createEndpoint, expose, finalizer, proxy, proxyMarker, releaseProxy, transfer, transferHandlers, windowEndpoint, wrap };
    //# sourceMappingURL=comlink.js.map
    return { wrap: wrap, expose: expose, transfer: transfer, proxy: proxy };
})();

const Comlink = Mikal_Rapier_Comlink;

// import RAPIER from "./rapier3d-compat.js";
// import * as Comlink from "https://cdn.skypack.dev/comlink";
// import * as Comlink from "./comlink.js";

let rapierWorld = null;
let uidHandle = new Map();
let characterControllers = new Map();
let defaultLinearDamping = 0.0;
let timestepMode = 0;
let timestepValue = 1 / 60;

const CommandType = {
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
};

const BodyType = {
    Dynamic: 0,
    Fixed: 1,
    KinematicPosition: 2,
    LinematicVelocity: 3,
};

const Shape = {
    Box: 0,
    Prism: 1,
    Wedge: 2,
    Pyramid: 3,
    CornerOut: 4,
    CornerIn: 5,
};

const TimestepMode = {
    Default: 0,
    Fixed: 1,
    Adaptive: 2,
};

async function initWorld() {
    await RAPIER.init();
    const gravity = { x: 0.0, y: 0.0, z: -9.81 };
    rapierWorld = new RAPIER.World(gravity);
    console.log("worker init world");
    return true;
}

// Scale Float32Array points in place by width, height, and depth
function scalePoints(points, height, width, depth) {
    for (let i = 0; i < points.length; i += 3) {
        points[i] *= width;
        points[i + 1] *= height;
        points[i + 2] *= depth;
    }
    return points;
}

function setTimestep(config) {
    timestepMode = config.mode;
    switch (timestepMode) {
        case TimestepMode.Default:
            timestepValue = 1 / 60;
            if (rapierWorld) rapierWorld.timestep = timestepValue;
            break;
        case TimestepMode.Fixed:
            timestepValue = config.value;
            if (rapierWorld) rapierWorld.timestep = timestepValue;
            break;
    }
}

function debugRender() {
    if (!rapierWorld) return;
    return rapierWorld.debugRender();
}

function setDefaultLinearDamping(config) {
    defaultLinearDamping = config.damping;
}

function enablePhysics(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setEnabled(config.enable);
    }
}

function createCollider(config) {
    const shape = config.shape;
    let colliderDesc;
    switch (shape) {
        case Shape.Box:
        case Shape.Prism:
        case Shape.Pyramid:
        case Shape.CornerIn:
        case Shape.CornerOut:
            colliderDesc = RAPIER.ColliderDesc.cuboid(
                config.width / 2,
                config.height / 2,
                config.depth / 2
            );
            break;
        case Shape.Wedge:
            const points = [
                0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
                -0.5, -0.5, -0.5, -0.5, 0.5, -0.5,
            ];
            // Create Float32Array from points
            const pointsArray = new Float32Array(points);
            const pointsArrayScaled = scalePoints(
                pointsArray,
                config.height,
                config.width,
                config.depth
            );

            colliderDesc = RAPIER.ColliderDesc.convexHull(pointsArrayScaled);
            break;
        default:
            colliderDesc = RAPIER.ColliderDesc.cuboid(
                config.width / 2,
                config.height / 2,
                config.depth / 2
            );
            break;
    }
    return colliderDesc;
}

function updateBody(config) {
    if (!rapierWorld) return;
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    let body = rapierWorld.bodies.get(handle);
    // Remove the body if it exists
    if (body) {
        rapierWorld.removeRigidBody(body);
    }
    uidHandle.delete(uid);
    addBody(config);
}

function addBody(config) {
    if (!rapierWorld) return;
    let rigidBodyDesc;
    let x = config.x || 0;
    let y = config.y || 0;
    let z = config.z || 0;
    // Also add quaternion support
    let q = config.q || { x: 0, y: 0, z: 0, w: 1 };
    const bodyTypeConfig = config.immovable ? BodyType.Fixed : config.bodyType;

    switch (bodyTypeConfig) {
        case BodyType.Dynamic:
            rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
            break;
        case BodyType.Fixed:
            rigidBodyDesc = RAPIER.RigidBodyDesc.fixed();
            break;
        case BodyType.KinematicPosition:
            rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
            break;
        case BodyType.KinematicVelocity:
            rigidBodyDesc = RAPIER.RigidBodyDesc.kinematicVelocityBased();
            break;
        default:
            rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic();
            break;
    }

    rigidBodyDesc.setTranslation(x, y, z);

    // Set the rotation
    rigidBodyDesc.setRotation(q);

    const body = rapierWorld.createRigidBody(rigidBodyDesc);

    const colliderDesc = createCollider(config);

    const collider = rapierWorld.createCollider(colliderDesc, body);
    collider.setMass(config.mass);
    body.setEnabledRotations(
        config?.enableRot0 ? true : false,
        config?.enableRot1 ? true : false,
        config?.enableRot2 ? true : false,
        true
    );

    body.setLinearDamping(defaultLinearDamping);

    body.uid = config.uid;
    uidHandle.set(config.uid, body.handle);
}

function setCollisionGroups(config) {
    const membership = config.membership;
    const filter = config.filter;
    // Create 32-bit number combining membership and filter which are strings representing 16-bit hex numbers using the form 0x0000)
    const membershipNumber = parseInt(membership, 16);
    const filterNumber = parseInt(filter, 16);
    if (Number.isNaN(membershipNumber) || Number.isNaN(filterNumber)) {
        console.warn("Invalid membership or filter number", membership, filter);
        return;
    }
    const group = (membershipNumber << 16) | filterNumber;
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setCollisionGroups(group);
    }
}

function translate(config) {
    const uid = config.uid;
    const translation = config.translation;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setTranslation(translation);
    }
}

function rotate(config) {
    const uid = config.uid;
    const rotation = config.rotation;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setRotation(rotation);
    }
}

function stepWorld(dt) {
    if (!rapierWorld) return;
    if (timestepMode === TimestepMode.Adaptive) {
        rapierWorld.timestep = dt;
    }
    rapierWorld.step();
    // Collect and return bodies' data...
    const bodies = rapierWorld.bodies;
    const numBodies = bodies.len();
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
    return Comlink.transfer(bodiesData, [bodiesData.buffer]);
}

function applyTorque(config) {
    const uid = config.uid;
    const torque = config.torque;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.applyTorque(torque);
    }
}

function setMass(config) {
    const uid = config.uid;
    const mass = config.mass;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setMass(mass);
    }
}

// Add function to apply impulse to a body
function applyImpulse(config) {
    const uid = config.uid;
    const impulse = config.impulse;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        const iV = new RAPIER.Vector3(impulse.x, impulse.y, impulse.z);
        body.applyImpulse(iV, true);
    }
}

function applyImpulseAtPoint(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (!handle) return;
    const impulse = config.impulse;
    const point = config.point;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.applyImpulseAtPoint(impulse, point);
    }
}

// Add function apply force to a body
function applyForce(config) {
    const uid = config.uid;
    const force = config.force;
    const point = config.point;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.addForce(force, point, true);
    }
}

// Add function to do a raycast
function raycast(config) {
    const origin = config.origin;
    const dir = config.dir;
    const ray = new RAPIER.Ray(origin, dir);
    const maxToI = config.maxToI;
    let result = rapierWorld.castRayAndGetNormal(ray, maxToI);
    const parent = result?.collider?.parent();
    const hitUID = parent?.uid;
    if (result) {
        result.hitUID = hitUID;
        result.hasHit = true;
    } else {
        result = { hasHit: false, hitUID: -1 };
    }
    return result;
}

// Function to set the gravity
function setWorldGravity(config) {
    const gravity = config.gravity;
    rapierWorld.setGravity(gravity);
}

// Set body linear damping
function setLinearDamping(config) {
    const uid = config.uid;
    const damping = config.damping;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setLinearDamping(damping);
    }
}

function setAngularDamping(config) {
    const uid = config.uid;
    const damping = config.damping;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setAngularDamping(damping);
    }
}

function createCharacterController(config) {
    const {
        uid,
        tag,
        offset,
        up,
        maxSlopeClimbAngle,
        minSlopeSlideAngle,
        applyImpulsesToDynamicBodies,
        enableAutostep,
        autostepMinWidth,
        autostepMaxHeight,
        enableSnapToGround,
        snapToGroundMaxDistance,
    } = config;
    if (characterControllers.has(tag)) {
        console.warn("Character controller already exists");
        return;
    }
    /*
            if (this.bodyType !== RAPIER.RigidBodyType.KinematicPositionBased) {
                console.warn(
                    "Character controller only works with KinematicPositionBased"
                );
                return;
            }
    */
    const characterController = rapierWorld.createCharacterController(offset);
    characterController.setUp(up);
    characterController.setMaxSlopeClimbAngle(
        (maxSlopeClimbAngle * Math.PI) / 180
    );
    characterController.setMinSlopeSlideAngle(
        (minSlopeSlideAngle * Math.PI) / 180
    );
    // Also autostep over dynamic bodies
    if (enableAutostep) {
        characterController.enableAutostep(
            autostepMaxHeight,
            autostepMinWidth,
            true
        );
    }
    if (enableSnapToGround) {
        characterController.enableSnapToGround(snapToGroundMaxDistance);
    } else {
        characterController.disableSnapToGround();
    }
    if (applyImpulsesToDynamicBodies) {
        characterController.setApplyImpulsesToDynamicBodies(true);
    } else {
        characterController.setApplyImpulsesToDynamicBodies(false);
    }
    characterControllers.set(tag, characterController);
}

function translateCharacterController(config) {
    const { uid, tag, translation } = config;
    const handle = uidHandle.get(uid);
    if (!handle) return;
    const body = rapierWorld.bodies.get(handle);
    const characterController = characterControllers.get(tag);
    if (!characterController) {
        console.warn("Character controller not found", tag);
        return;
    }
    characterController.computeColliderMovement(body.collider(), translation);
    // (optional) Check collisions
    for (let i = 0; i < characterController.numComputedCollisions(); i++) {
        // Do something with the collision
        let collision = characterController.computedCollision(i);
    }

    const correctedMovement = characterController.computedMovement();
    const t = body.translation();
    correctedMovement.x = correctedMovement.x + t.x;
    correctedMovement.y = correctedMovement.y + t.y;
    correctedMovement.z = correctedMovement.z + t.z;
    body.setNextKinematicTranslation(correctedMovement);
}

function setVelocity(config) {
    const uid = config.uid;
    const velocity = config.velocity;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setLinvel(velocity);
    }
}

function runCommands(commands) {
    if (!commands || commands.length === 0) return;
    for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        switch (command.type) {
            case CommandType.AddBody:
                addBody(command);
                break;
            case CommandType.StepWorld:
                return stepWorld();
            case CommandType.ApplyImpulse:
                applyImpulse(command);
                break;
            case CommandType.ApplyImpulseAtPoint:
                applyImpulseAtPoint(command);
                break;
            case CommandType.ApplyForce:
                applyForce(command);
                break;
            // Can't batch raycast, need to return result
            //case CommandType.Raycast:
            //return raycast(command.config);
            //    );
            case CommandType.SetWorldGravity:
                setWorldGravity(command);
                break;
            case CommandType.SetLinearDamping:
                setLinearDamping(command);
                break;
            case CommandType.ApplyTorque:
                applyTorque(command);
                break;
            case CommandType.SetMass:
                setMass(command);
                break;
            case CommandType.CreateCharacterController:
                createCharacterController(command);
                break;
            case CommandType.TranslateCharacterController:
                translateCharacterController(command);
                break;
            case CommandType.Translate:
                translate(command);
                break;
            case CommandType.Rotate:
                rotate(command);
                break;
            case CommandType.UpdateBody:
                updateBody(command);
                break;
            case CommandType.SetVelocity:
                setVelocity(command);
                break;
            case CommandType.SetDefaultLinearDamping:
                setDefaultLinearDamping(command);
                break;
            case CommandType.SetAngularDamping:
                setAngularDamping(command);
                break;
            case CommandType.EnablePhysics:
                enablePhysics(command);
                break;
            case CommandType.SetCollisionGroups:
                setCollisionGroups(command);
                break;
            case CommandType.SetTimestep:
                setTimestep(command);
                break;
            case CommandType.RemoveBody:
                removeBody(command);
                break;
            default:
                // log error and continue
                console.error("Unknown command type", command.type);
                break;
        }
    }
    return true;
}

function removeBody(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        rapierWorld.removeRigidBody(body);
    }
}

// Expose the worker's API using Comlink
Comlink.expose({
    initWorld,
    addBody,
    stepWorld,
    applyImpulse,
    applyImpulseAtPoint,
    applyForce,
    raycast,
    setWorldGravity,
    setLinearDamping,
    applyTorque,
    setMass,
    runCommands,
    createCharacterController,
    translateCharacterController,
    debugRender,
    removeBody,
});
