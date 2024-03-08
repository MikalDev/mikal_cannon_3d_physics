// @ts-check
"use strict";

// Import RAPIER and Comlink
console.log("rapierWorker.js rap loaded 3d-compat start");
// import RAPIER from "https://cdn.skypack.dev/@dimforge/rapier3d-compat";
import RAPIER from "https://preview.construct.net/rapier3d-compat.js";
console.log("rapierWorker.js rap loaded 3d-compat");
// import * as Comlink from "https://kindeyegames.com/forumfiles/comlink.js";
import * as Comlink from "https://preview.construct.net/comlink.js";
console.log("rapierWorker.js com loaded comlink.js");

// import RAPIER from "./rapier3d-compat.js";
// import * as Comlink from "https://cdn.skypack.dev/comlink";
// import * as Comlink from "./comlink.js";

let rapierWorld = null;
let uidHandle = new Map();
let characterControllers = new Map();
let defaultLinearDamping = 0.0;

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
    console.log("updateBody", config);
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
    const result = rapierWorld.castRayAndGetNormal(ray, maxToI);
    const parent = result?.collider?.parent();
    const hitUID = parent?.uid;
    result.hitUID = hitUID;
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
            default:
                // log error and continue
                console.error("Unknown command type", command.type);
                break;
        }
    }
    return true;
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
});
