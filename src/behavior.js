// import * as Comlink from "https://cdn.skypack.dev/comlink";
import * as Comlink from "https://kindeyegames.com/forumfiles/comlink.js";

// import * as Comlink from "./comlink.js";
console.log("comlink-imported");

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
