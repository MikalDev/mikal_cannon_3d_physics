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
    registerJoint, getJoint, jointPairKey, jointKey, queueJointCommand,
    runPendingJointCommands, pendingJointCommands, jointMap,
    pruneJointEntriesForUid, removeBody, uidHandle,
    __setWorld: (w) => { rapierWorld = w; },
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
console.log("\n--- joint registry: per (pair, type) identity ---");
{
    const { t } = loadWorkerLogic();
    const revolute = { name: "revolute", motorCalls: [] };
    revolute.configureMotorVelocity = (v, f) => revolute.motorCalls.push([v, f]);
    const spring = { name: "spring" }; // springs have NO motor methods

    t.registerJoint(1, 2, "revolute", revolute);
    t.registerJoint(2, 1, "spring", spring); // reversed uid order on purpose

    check(t.getJoint(1, 2, "revolute") === revolute, "typed lookup returns the revolute joint");
    check(t.getJoint(1, 2, "spring") === spring, "spring coexists on the same pair (order-independent)");
    check(t.getJoint(2, 1, "revolute") === revolute, "lookup works from either body");
    check(t.getJoint(1, 2, "rope") === null, "absent type is null, not a wrong joint");

    // The 2.36.0 bug: SetRevoluteMotor resolved to whichever joint was
    // registered last and called configureMotorVelocity on the spring (throws)
    const cfg = { type: t.CommandType.SetRevoluteMotor, uid: 2, targetUID: 1, targetVelocity: 5, maxForce: 50 };
    let threw = false;
    try {
        t.commandFunctions[t.CommandType.SetRevoluteMotor](cfg);
    } catch (e) {
        threw = true;
    }
    check(!threw, "motor command does not throw with a spring on the same pair");
    check(revolute.motorCalls.length === 1 && revolute.motorCalls[0][0] === 5, "motor command configures the REVOLUTE joint");
}

console.log("\n--- joint registry: typed pending queues ---");
{
    const { t } = loadWorkerLogic();
    const revolute = { motorCalls: [] };
    revolute.configureMotorVelocity = (v, f) => revolute.motorCalls.push([v, f]);
    const spring = {}; // no motor methods — replaying on it would throw

    // Motor command arrives before ANY joint exists
    t.commandFunctions[t.CommandType.SetRevoluteMotor]({
        type: t.CommandType.SetRevoluteMotor,
        uid: 1, targetUID: 2, targetVelocity: 7, maxForce: 20,
    });
    check(t.pendingJointCommands.size === 1, "motor command queued while no joint exists");

    // Spring created first: must NOT replay the revolute motor command
    t.registerJoint(1, 2, "spring", spring);
    t.runPendingJointCommands(1, 2, "spring");
    check(revolute.motorCalls.length === 0 && t.pendingJointCommands.size === 1, "spring creation does not consume the revolute queue");

    // Revolute created: NOW the motor command replays onto it
    t.registerJoint(1, 2, "revolute", revolute);
    t.runPendingJointCommands(1, 2, "revolute");
    check(revolute.motorCalls.length === 1 && revolute.motorCalls[0][0] === 7, "revolute creation replays the queued motor command onto the revolute");
    check(t.pendingJointCommands.size === 0, "queue drained after replay");
}

console.log("\n--- joint registry: removeBody pruning ---");
{
    const { t } = loadWorkerLogic();
    t.__setWorld({
        bodies: { get: () => ({}) },
        removeRigidBody: () => {},
    });
    t.uidHandle.set(5, 0); // handle 0 on purpose: the falsy-handle regression
    t.registerJoint(5, 9, "revolute", {});
    t.registerJoint(5, 9, "spring", {});
    t.registerJoint(7, 8, "rope", {});
    t.queueJointCommand({ uid: 9, targetUID: 5 }, "prismatic");
    t.queueJointCommand({ uid: 7, targetUID: 8 }, "rope");

    t.removeBody({ uid: 5 });

    check(t.getJoint(5, 9, "revolute") === null && t.getJoint(5, 9, "spring") === null, "all joint types for the removed uid pruned");
    check(t.getJoint(7, 8, "rope") !== null, "unrelated joints survive the prune");
    check(!t.pendingJointCommands.has(t.jointKey(9, 5, "prismatic")), "pending commands for the removed uid pruned");
    check(t.pendingJointCommands.has(t.jointKey(7, 8, "rope")), "unrelated pending commands survive");
    check(t.uidHandle.get(5) === undefined, "uid handle removed (handle 0 not treated as missing)");
}

// ---------------------------------------------------------------------------
console.log(`\n=== node worker-logic tests: ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);
