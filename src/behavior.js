// import * as Comlink from "https://cdn.skypack.dev/comlink";
// Require version of comlink that has low message overhead
// import * as Comlink from "https://kindeyegames.com/forumfiles/comlink.js";

// import * as Comlink from "./comlink.js";
console.log("comlink-imported");

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
        console.log("rapier world ready", worldReady);
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
        this.runtime.UpdateRender();
    }

    handleCollisionEvents(collisionEvents) {
        if (!collisionEvents) return;
        for (const collisonEvent of collisionEvents) {
            const {
                body1UID,
                body2UID,
                started,
                contactCollider1,
                contactCollider2,
            } = collisonEvent;
            const inst1 = this.runtime.GetInstanceByUID(body1UID);
            const behInst1 = inst1.GetBehaviorSdkInstanceFromCtor(
                C3.Behaviors.mikal_cannon_3d_physics
            );
            const inst2 = this.runtime.GetInstanceByUID(body2UID);
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

//<-- SCRIPT_INTERFACE -->

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

//<-- INSTANCE -->

B_C.Instance = getInstanceJs(
    C3.SDKBehaviorInstanceBase,
    scriptInterface,
    addonTriggers,
    C3
);
