// import * as Comlink from "https://cdn.skypack.dev/comlink";
// Require version of comlink that has low message overhead
// import * as Comlink from "https://kindeyegames.com/forumfiles/comlink.js";

// import * as Comlink from "./comlink.js";

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
    return { wrap: wrap };
})();

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
        this.initWorker(this.runtime);
        this.commands = [];
        this.cmdTickCount, (this.tickCount = 0);
        this.worldReady = false;
        this.scale = 100;
        this.timestepMode = 0;
        this.timestepValue = 1 / 60;
        this.currentPhysicsFrameResponse = 0;
        this.currentPhysicsFrameRequest = 0;
        this.totalDt = 0;
    }

    Release() {
        super.Release();
        this.msgPort.postMessage({ type: "release" });
    }

    async initWorker(runtime) {
        const Comlink = Mikal_Rapier_Comlink;
        let path = await runtime
            .GetAssetManager()
            .GetProjectFileUrl("rapierWorker.js");
        if (typeof Worker !== "undefined") {
            //great, your browser supports web workers
            console.info("web workers supported");
        } else {
            alert("No support for web workers");
            console.info("No support for web workers");
        }
        this.rapierWorker = new Worker(path, { type: "module" });
        this.comRapier = Comlink.wrap(this.rapierWorker);
        const worldReady = await this.comRapier.initWorld();
        console.info("[rapier] world ready", worldReady);
        this.worldReady = worldReady;
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

    handleCastShapeResults(castShapeResults) {
        const vec3 = globalThis.glMatrix.vec3;
        const scale = this.scale;
        if (!castShapeResults) return;
        for (const result of castShapeResults) {
            const uid = result.uid;
            const tag = result.tag;
            const inst = this.runtime.GetInstanceByUID(uid);
            const origin = result.origin;
            const direction = result.direction;
            if (!inst) continue;
            const behInst = inst.GetBehaviorSdkInstanceFromCtor(
                C3.Behaviors.mikal_cannon_3d_physics
            );
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

            behInst.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyCastShapeResult
            );
            behInst.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCastShapeResult
            );
            return true;
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
            const inst = this.runtime.GetInstanceByUID(uid);
            if (!inst) continue;
            const behInst = inst.GetBehaviorSdkInstanceFromCtor(
                C3.Behaviors.mikal_cannon_3d_physics
            );
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

            behInst.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
            );
            behInst.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult
            );
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
            return;
        }
        const dt = this.runtime.GetDt();
        this.totalDt += dt;
        if (
            this.currentPhysicsFrameResponse < this.currentPhysicsFrameRequest
        ) {
            return;
        }
        this.currentPhysicsFrameRequest++;
        const stepDt = this.totalDt;
        this.totalDt = 0;
        const worldData = await this.comRapier.stepWorld(
            stepDt,
            this.currentPhysicsFrameRequest
        );
        this.currentPhysicsFrameResponse = worldData.frame;
        const bodies = worldData.bodiesData;
        const collisionEvents = worldData.collisionEvents;
        if (collisionEvents?.length > 0) {
            this.handleCollisionEvents(collisionEvents);
        }
        if (this.debugRender) {
            globalThis.Mikal_Rapier_debug_buffers =
                await this.comRapier.debugRender();
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

        this.runtime.UpdateRender();
    }

    handleCharacterControllerCollisionEvent(collisionEvent) {
        const { body1UID, body2UID } = collisionEvent;
        const inst1 = this.runtime.GetInstanceByUID(body1UID);
        if (!inst1) return;
        const behInst1 = inst1.GetBehaviorSdkInstanceFromCtor(
            C3.Behaviors.mikal_cannon_3d_physics
        );
        if (!behInst1) return;
        behInst1.characterCollisionData = {
            target: { uid: body2UID },
            event: collisionEvent,
        };
        behInst1.Trigger(
            C3.Behaviors.mikal_cannon_3d_physics.Cnds
                .OnCharacterControllerCollision
        );
    }

    handleBodyCollisionEvent(collisionEvent) {
        const {
            body1UID,
            body2UID,
            started,
            contactCollider1,
            contactCollider2,
        } = collisionEvent;
        const inst1 = this.runtime.GetInstanceByUID(body1UID);
        if (!inst1) return;
        const behInst1 = inst1.GetBehaviorSdkInstanceFromCtor(
            C3.Behaviors.mikal_cannon_3d_physics
        );
        const inst2 = this.runtime.GetInstanceByUID(body2UID);
        if (!inst2) return;
        const behInst2 = inst2.GetBehaviorSdkInstanceFromCtor(
            C3.Behaviors.mikal_cannon_3d_physics
        );
        if (behInst1) {
            behInst1.collisionData = {
                target: { uid: body2UID },
                started,
                contactCollider: contactCollider1,
            };
            behInst1.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCollision
            );
        }
        if (behInst2) {
            behInst2.collisionData = {
                target: { uid: body1UID },
                started,
                contactCollider: contactCollider2,
            };
            behInst2.Trigger(
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
                this.colliderType = properties[4];
                this.mass = properties[5];
                this.sizeOverride = properties[6];
                this.bodySizeHeight = properties[7];
                this.bodySizeWidth = properties[8];
                this.bodySizeDepth = properties[9];
            }
            this.defaultMass = 1;
            this.body = null;
            this.shapePositionOffset = null;
            this.shapeAngleOffset = null;
            this.uid = this._inst.GetUID();
            this.PhysicsType = this._behaviorType._behavior;
            this.comRapier = this.PhysicsType.comRapier;
            this.bodyDefined = false;
            this.setBody = {
                position: { x: 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 0 },
            };
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
            };
            this._StartTicking();
            this._StartTicking2();
        }

        Release() {
            super.Release();
            if (this.bodyDefined) {
                const PhysicsType = this.PhysicsType;
                const command = {
                    type: this.CommandType.RemoveBody,
                    uid: this.uid,
                };
                PhysicsType.commands.push(command);
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
            const bodyDefined = this.bodyDefined;
            const PhysicsType = this._behaviorType._behavior;

            if (
                this.pluginType === "3DObjectPlugin" &&
                !bodyDefined &&
                this._inst.GetSdkInstance().loaded
            ) {
                const loaded = this._inst.GetSdkInstance().loaded;
                if (!loaded) return;
                const result = this._create3DObjectShape(
                    this.shapeProperty,
                    this.bodyType,
                    this.colliderType,
                    wi,
                    false
                );
                // Not ready
                if (!result) return;
                this.bodyDefined = true;
                this.Trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                );
                this._inst.GetSdkInstance()._setCannonBody(this.setBody, true);
            }

            if (!bodyDefined) return;
            if (!this.enable) return;

            if (!globalThis.Mikal_Rapier_Bodies) return;
            const wBody = globalThis.Mikal_Rapier_Bodies.get(this.uid);
            if (!wBody) return;
            const position = wBody.translation;
            const quatRot = wBody.rotation;

            if (this.pluginType == "3DObjectPlugin") {
                this.setBody.position = position;
                this.setBody.quaternion = quatRot;
                wi.SetZElevation(position.z);
            } else {
                const zElevation = position.z - zHeight / 2;
                wi.SetZElevation(zElevation);
                wi.SetX(position.x);
                wi.SetY(position.y);
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
                if (!this.bodyDefined) {
                    const shape = this._inst.GetSdkInstance()._shape;
                    this.DefineBody(
                        this.pluginType,
                        shape,
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType
                    );
                    this.bodyDefined = true;
                    this.Trigger(
                        C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                    );
                }
            } else if (
                C3?.Plugins?.Sprite &&
                pluginType instanceof C3?.Plugins?.Sprite
            ) {
                this.pluginType = "SpritePlugin";
                this.DefineBody(
                    this.pluginType,
                    null,
                    null,
                    this.bodyType,
                    this.colliderType
                );
                this.Trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                );
            } else if (
                C3?.Plugins?.Mikal_3DObject &&
                pluginType instanceof C3?.Plugins?.Mikal_3DObject
            ) {
                this.pluginType = "3DObjectPlugin";
                // define body after loaded
            } else {
                this.pluginType = "invalid";
                console.error("invalid pluginType", pluginType);
            }
        }

        async DefineBody(pluginType, shape, shapeType, bodyType, colliderType) {
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const quat = globalThis.glMatrix.quat;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            // let shape = null;
            const enableRot = [true, true, true];
            const scale = PhysicsType.scale;
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (wi.GetAngle() * 180) / Math.PI);
            let command = null;

            if (pluginType === "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }
                // const shape = this._inst.GetSdkInstance()._shape;
                command = {
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
                    colliderType,
                    shape,
                    mass: this.mass,
                };
            } else if (this.pluginType == "SpritePlugin") {
                const meshPoints = this._getMeshPoints(wi);
                command = {
                    type: this.CommandType.AddBody,
                    uid: this._inst.GetUID(),
                    x: (wi.GetX() - wi.GetWidth() / 2) / scale,
                    y: (wi.GetY() - wi.GetHeight() / 2) / scale,
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
                    colliderType,
                    shape: null,
                    mass: this.mass,
                    meshPoints: meshPoints,
                };
            }
            this.PhysicsType.commands.push(command);
        }

        _UpdateBody() {
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const quat = globalThis.glMatrix.quat;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            const enableRot = [true, true, true];
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (wi.GetAngle() * 180) / Math.PI);
            const scale = PhysicsType.scale;
            let command = null;
            const pluginType = this._inst.GetPlugin();
            if (this.pluginType == "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }
                const shape = this._inst.GetSdkInstance()._shape;
                command = {
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
                    colliderType: this.colliderType,
                    shape,
                    mass: this.mass,
                };
            } else if (this.pluginType == "SpritePlugin") {
                const scale = PhysicsType.scale;
                const meshPoints = this._getMeshPoints(wi);
                command = {
                    type: this.CommandType.UpdateBody,
                    uid: this._inst.GetUID(),
                    x: (wi.GetX() - wi.GetWidth() / 2) / scale,
                    y: (wi.GetY() - wi.GetHeight() / 2) / scale,
                    z: wi.GetZElevation() / scale,
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
                    colliderType: this.colliderType,
                    shape: null,
                    mass: this.mass,
                    meshPoints: meshPoints,
                };
            } else {
                console.error("invalid pluginType", pluginType);
                return;
            }
            this.PhysicsType.commands.push(command);
        }

        _SetSizeOverride(enable, height, width, depth) {
            this.sizeOverride = enable;
            this.bodySizeHeight = height;
            this.bodySizeWidth = width;
            this.bodySizeDepth = depth;
            if (this.pluginType == "3DObjectPlugin") {
                this._create3DObjectShape(
                    this.shapeProperty,
                    this.bodyType,
                    this.colliderType,
                    wi,
                    enable
                );
                return;
            }
            // Only works for 3DShape and Sprite
            if (!enable) {
                this._UpdateBody();
                return;
            }
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const quat = globalThis.glMatrix.quat;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            const enableRot = [true, true, true];
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (wi.GetAngle() * 180) / Math.PI);
            const scale = PhysicsType.scale;
            let command = null;
            const pluginType = this._inst.GetPlugin();
            if (this.pluginType == "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }
                const shape = this._inst.GetSdkInstance()._shape;
                command = {
                    type: this.CommandType.SetSizeOverride,
                    uid: this._inst.GetUID(),
                    x: wi.GetX() / scale,
                    y: wi.GetY() / scale,
                    z: (wi.GetZElevation() + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: width / scale,
                    height: height / scale,
                    depth: depth / scale,
                    immovable: this.immovable,
                    enableRot0: enableRot[0],
                    enableRot1: enableRot[1],
                    enableRot2: enableRot[2],
                    shapeType: this.shapeProperty,
                    bodyType: this.bodyType,
                    colliderType: this.colliderType,
                    shape,
                    mass: this.mass,
                };
            } else if (this.pluginType == "SpritePlugin") {
                const scale = PhysicsType.scale;
                const meshPoints = this._getMeshPoints(wi);
                command = {
                    type: this.CommandType.UpdateBody,
                    uid: this._inst.GetUID(),
                    x: (wi.GetX() - wi.GetWidth() / 2) / scale,
                    y: (wi.GetY() - wi.GetHeight() / 2) / scale,
                    z: wi.GetZElevation() / scale,
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
                    colliderType: this.colliderType,
                    shape: null,
                    mass: this.mass,
                    meshPoints: meshPoints,
                };
            } else {
                console.error("invalid pluginType", pluginType);
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

        _create3DObjectShape(
            shapeProperty,
            bodyType,
            colliderType,
            worldInfo,
            overrideSize
        ) {
            // Get bbox of 3DObject
            const inst = this._inst.GetSdkInstance();
            const xMinBB = inst.xMinBB;
            const xMaxBB = inst.xMaxBB;
            // Check if rendered (larger than 0,0,0)
            if (
                xMinBB[0] - xMaxBB[0] === 0 &&
                (xMinBB[0] - xMaxBB[0] === 0) & (xMinBB[0] - xMaxBB[0] === 0)
            )
                return false;
            const h = !this.sizeOverride
                ? xMaxBB[0] - xMinBB[0]
                : this.bodySizeWidth;
            const w = !this.sizeOverride
                ? xMaxBB[1] - xMinBB[1]
                : this.bodySizeHeight;
            const d = !this.sizeOverride
                ? xMaxBB[2] - xMinBB[2]
                : this.bodySizeDepth;
            const PhysicsType = this._behaviorType._behavior;
            const scale = PhysicsType.scale;
            const wi = worldInfo;

            const scale3DObject = inst.scale;

            const xAngle = inst.xAngle;
            const yAngle = inst.yAngle;
            const zAngle = inst.zAngle;

            const rotQuat = globalThis.glMatrix.quat.create();
            globalThis.glMatrix.quat.fromEuler(rotQuat, xAngle, yAngle, zAngle);

            const ShapeTypeProperty = {
                Auto: 0,
                ModelMesh: 1,
                Box: 2,
                Sphere: 3,
                Cylinder: 4,
                Capsule: 5,
                ConvexHulls: 6,
            };

            // Model Mesh data
            let modelMesh = null;

            if (
                shapeProperty === ShapeTypeProperty.ModelMesh ||
                shapeProperty === ShapeTypeProperty.ConvexHulls
            ) {
                const drawMeshes = inst.gltf.drawMeshes;

                const meshes = drawMeshes.map((mesh) => {
                    const drawVerts = Array.from(mesh.drawVerts[0]);

                    const transformedVertices = transformDrawVerts(
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        inst.xScale,
                        inst.yScale,
                        inst.zScale,
                        drawVerts,
                        scale,
                        scale3DObject
                    );

                    const indices = Array.from(mesh.drawIndices[0]);

                    return {
                        vertices: transformedVertices,
                        indices: indices,
                    };
                });

                modelMesh = {
                    meshes: meshes,
                };
            }

            const commandType = overrideSize
                ? this.CommandType.SetSizeOverride
                : this.CommandType.AddBody;
            const command = {
                type: commandType,
                uid: this._inst.GetUID(),
                x: wi.GetX() / scale,
                y: wi.GetY() / scale,
                z: wi.GetZElevation() / scale,
                q: {
                    x: rotQuat[0],
                    y: rotQuat[1],
                    z: rotQuat[2],
                    w: rotQuat[3],
                },
                width: h / scale,
                height: w / scale,
                depth: d / scale,
                immovable: this.immovable,
                enableRot0: true,
                enableRot1: true,
                enableRot2: true,
                shapeType: shapeProperty,
                bodyType: bodyType,
                colliderType: colliderType,
                shape: null,
                mass: this.mass,
                modelMesh,
            };
            this.PhysicsType.commands.push(command);
            return true;
        }

        // Get mesh points from object
        _getMeshPoints(worldInfo) {
            const scale = this.PhysicsType.scale;
            const wi = worldInfo;
            const points = wi?._meshInfo?.sourceMesh?._pts;
            const width = wi.GetWidth();
            const height = wi.GetHeight();
            const meshPoints = [];
            for (const rows of points) {
                const meshRow = [];
                for (const point of rows) {
                    const x = (point._x * width) / scale;
                    const y = (point._y * height) / scale;
                    const z = point._zElevation / scale;
                    meshRow.push({ x, y, z });
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
                origin: { x: origin[0], y: origin[1], z: origin[2] },
                dir: { x: dir[0], y: dir[1], z: dir[2] },
                maxToI,
                filterGroups,
                skipBackfaces,
                uid: this.uid,
                tag,
            };
            if (tag.includes("-batch")) {
                // Send batched command instead of raycasting with comlink
                this.PhysicsType.commands.push(command);
                return;
            }
            const result = await this.comRapier.raycast(command);
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
                this.raycastResult = {
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
                this.raycastResult = {
                    hasHit: false,
                    hitFaceIndex: -1,
                    hitPointWorld: [0, 0, 0],
                    hitNormalWorld: [0, 0, 0],
                    distance: 0,
                    hitUID: -1,
                    tag,
                };
            }

            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
            );
            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult
            );
            return true;
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

        _SetCCD(enable) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetCCD,
                enable,
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

        _Translate(x, y, z) {
            const scale = this.PhysicsType.scale;
            const command = {
                type: this.CommandType.Translate,
                uid: this.uid,
                translation: { x: x / scale, y: y / scale, z: z / scale },
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
            const PhysicsType = this._behaviorType._behavior;
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
            if (!this.bodyDefined) return;
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

        _AddSphericalJoint(
            anchorX,
            anchorY,
            anchorZ,
            targetAnchorX,
            targetAnchorY,
            targetAnchorZ,
            targetUID
        ) {
            const scale = this.PhysicsType.scale;
            const command = {
                type: this.CommandType.AddSphericalJoint,
                uid: this.uid,
                anchor: {
                    x: anchorX / scale,
                    y: anchorY / scale,
                    z: anchorZ / scale,
                },
                targetAnchor: {
                    x: targetAnchorX / scale,
                    y: targetAnchorY / scale,
                    z: targetAnchorZ / scale,
                },
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
            const scale = this.PhysicsType.scale;
            const command = {
                type: this.CommandType.AddRevoluteJoint,
                uid: this.uid,
                anchor: {
                    x: anchorX / scale,
                    y: anchorY / scale,
                    z: anchorZ / scale,
                },
                targetAnchor: {
                    x: targetAnchorX / scale,
                    y: targetAnchorY / scale,
                    z: targetAnchorZ / scale,
                },
                targetUID,
                axis: { x: axisX, y: axisY, z: axisZ },
            };
            this.PhysicsType.commands.push(command);
        }

        _SetPositionOffset(x, y, z) {
            const scale = this.PhysicsType.scale;
            const command = {
                type: this.CommandType.SetPositionOffset,
                uid: this.uid,
                positionOffset: { x: x / scale, y: y / scale, z: z / scale },
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
            const scale = this.PhysicsType.scale;
            const vec3 = globalThis.glMatrix.vec3;

            const origin = vec3.fromValues(
                fromX / scale,
                fromY / scale,
                fromZ / scale
            );
            const to = vec3.fromValues(toX / scale, toY / scale, toZ / scale);

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
                    width: width / scale, // Width of the shape for "box"
                    height: height / scale, // Height of the shape for "box" or "capsule"
                    depth: depth / scale, // Depth of the shape for "box"
                    // Add radius if needed for "sphere" or "capsule"
                },
                origin: { x: origin[0], y: origin[1], z: origin[2] },
                dir: { x: direction[0], y: direction[1], z: direction[2] },
                rotation: {
                    x: rotX,
                    y: rotY,
                    z: rotZ,
                },
                maxToI,
                targetDistance: targetDistance / scale, // Include targetDistance in the command
                filterGroups,
                excludeUID,
                skipBackfaces,
                tag,
                uid: this._inst.GetUID(),
            };

            if (tag.includes("-batch")) {
                this.PhysicsType.commands.push(command);
                return;
            }

            const result = await this.comRapier.castShape(command);
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
                this.castShapeResult = {
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
                this.castShapeResult = {
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

            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyCastShapeResult
            );
            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCastShapeResult
            );
            return true;
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

        GetScriptInterfaceClass() {
            return scriptInterface;
        }
    };
}

function transformDrawVerts(
    xAngle,
    yAngle,
    zAngle,
    x,
    y,
    z,
    xScale,
    yScale,
    zScale,
    drawVerts,
    scale,
    scale3DObject
) {
    const vec3 = globalThis.glMatrix.vec3;
    const mat4 = globalThis.glMatrix.mat4;
    const quat = globalThis.glMatrix.quat;

    const xformVerts = [];
    const vOut = vec3.create();

    const modelScaleRotate = mat4.create();
    const rotate = globalThis.glMatrix.quat.create();

    // Create rotation quaternion from Euler angles
    quat.fromEuler(rotate, xAngle, yAngle, zAngle);

    // Create transformation matrix from rotation, translation, and scale
    mat4.fromRotationTranslationScale(
        modelScaleRotate,
        rotate,
        [x, y, z],
        [
            scale3DObject / xScale,
            -scale3DObject / yScale,
            scale3DObject / zScale,
        ]
    );

    // Transform each vertex and log intermediate results
    for (let i = 0; i < drawVerts.length; i += 3) {
        vec3.set(
            vOut,
            drawVerts[i] / scale,
            drawVerts[i + 1] / scale,
            drawVerts[i + 2] / scale
        );

        vec3.transformMat4(vOut, vOut, modelScaleRotate);

        xformVerts.push(vOut[0], vOut[1], vOut[2]);
    }
    return xformVerts;
}


B_C.Instance = getInstanceJs(
    C3.SDKBehaviorInstanceBase,
    scriptInterface,
    addonTriggers,
    C3
);
