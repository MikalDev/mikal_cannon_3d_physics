// @ts-check
"use strict";

// Import RAPIER and Comlink
import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat";
import * as Comlink from "https://cdn.skypack.dev/comlink";

let rapierWorld = null;
let uidHandle = new Map();

console.log("rapierWorker.js loaded");

async function initWorld() {
    await RAPIER.init();
    const gravity = { x: 0.0, y: 0.0, z: -9.81 };
    rapierWorld = new RAPIER.World(gravity);
    console.log("worker init world");
    return true;
}

function addBody(config) {
    console.log("worker add body", config.uid);
    if (!rapierWorld) return;
    let rigidBodyDesc;
    let x = config.x || 0;
    let y = config.y || 0;
    let z = config.z || 0;
    // Also add quaternion support
    let q = config.q || { x: 0, y: 0, z: 0, w: 1 };

    if (config.immovable) {
        rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    } else {
        rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
    }

    // Set the rotation
    rigidBodyDesc.setRotation(q, true);

    const body = rapierWorld.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
        config.width / 2,
        config.height / 2,
        config.depth / 2
    );
    const collider = rapierWorld.createCollider(colliderDesc, body);
    console.log("worker add collider", config.uid, collider.mass());
    body.setEnabledRotations(
        config?.enableRot0 ? true : false,
        config?.enableRot1 ? true : false,
        config?.enableRot2 ? true : false,
        true
    );

    body.uid = config.uid;
    uidHandle.set(config.uid, body.handle);
}

function stepWorld() {
    if (!rapierWorld) return;
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

function applyTorque(uid, torque) {
    const body = rapierWorld.bodies.get(uid);
    if (body) {
        body.applyTorque(torque);
    }
}

function setMass(uid, mass) {
    const body = rapierWorld.bodies.get(uid);
    if (body) {
        body.setMass(mass);
    }
}

// Add function to apply impulse to a body
function applyImpulse(uid, impulse) {
    const handle = uidHandle.get(uid);
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        const iV = new RAPIER.Vector3(impulse.x, impulse.y, impulse.z);
        body.applyImpulse(iV, true);
    }
}

function applyImpulseAtPoint(uid, impulse, point) {
    const body = rapierWorld.bodies.get(uid);
    console.log("applyImpulseAtPoint", body, impulse, point);
    if (body) {
        body.applyImpulseAtPoint(impulse, point);
    }
}

// Add function apply force to a body
function applyForce(uid, force, point) {
    const body = rapierWorld.bodies.get(uid);
    if (body) {
        body.addForce(force, point, true);
    }
}

// Add function to do a raycast
function raycast(origin, dir, maxDistance) {
    const result = rapierWorld.raycast(origin, dir, maxDistance);
    return result;
}

// Function to set the gravity
function setGravity(gravity) {
    rapierWorld.setGravity(gravity);
}

// Set body linear damping
function setLinearDamping(uid, damping) {
    const body = rapierWorld.bodies.get(uid);
    if (body) {
        body.setLinearDamping(damping);
    }
}

// Add force at point
function addForceAtPoint(uid, force, point) {
    const body = rapierWorld.bodies.get(uid);
    if (body) {
        body.addForceAtPoint(force, point);
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
    setGravity,
    setLinearDamping,
    applyTorque,
    setMass,
});
