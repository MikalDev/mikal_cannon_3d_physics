/**
 * Node-side unit tests for pure logic in src/rapierWorkerLogic.js.
 * Loads the worker source in a vm sandbox with RAPIER/self stubbed, then
 * exercises command dispatch and the joint registry without Construct 3.
 *
 * Run: node tests/node/workerLogic.test.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const src = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "rapierWorkerLogic.js"),
    "utf8"
);

function loadWorkerLogic() {
    const sandbox = {
        console,
        setTimeout,
        performance: { now: () => 0 },
        postMessage: () => {},
        self: { addEventListener: () => {}, postMessage: () => {} },
        // rapierLib.js exports the RAPIER namespace as `Og`; the logic file
        // does `const RAPIER = Og;` after build-time concatenation
        Og: {},
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    const exports = `
;this.__test = {
    runCommands, commandFunctions, CommandType,
    registerJoint, getJoint, jointPairKey, queueJointCommand,
    runPendingJointCommands, pendingJointCommands, jointMap,
    removeBody, uidHandle,
};`;
    vm.runInContext(src + exports, sandbox, { filename: "rapierWorkerLogic.js" });
    return { t: sandbox.__test, sandbox };
}

let passed = 0;
let failed = 0;
function check(cond, name) {
    if (cond) {
        passed++;
        console.log(`  PASS: ${name}`);
    } else {
        failed++;
        console.error(`  FAIL: ${name}`);
    }
}

// ---------------------------------------------------------------------------
console.log("--- runCommands resilience ---");
{
    const { t } = loadWorkerLogic();
    const ran = [];
    // Inject synthetic command handlers well clear of real type numbers
    t.commandFunctions[9001] = () => {
        throw new Error("boom");
    };
    t.commandFunctions[9002] = (cfg) => ran.push(cfg.marker);

    let threw = false;
    try {
        t.runCommands([
            { type: 9001, uid: 1 },
            { type: 9002, uid: 2, marker: "after-throw" },
            { type: 424242, uid: 3 }, // unknown type
            { type: 9002, uid: 4, marker: "after-unknown" },
        ]);
    } catch (e) {
        threw = true;
    }
    check(!threw, "runCommands does not propagate a handler throw");
    check(ran.includes("after-throw"), "command after a throwing command still runs");
    check(ran.includes("after-unknown"), "command after an unknown type still runs");
}

// ---------------------------------------------------------------------------
console.log(`\n=== node worker-logic tests: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
