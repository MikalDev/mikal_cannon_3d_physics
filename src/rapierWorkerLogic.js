// Custom Rapier worker logic — edit this file.
// rapierLib.js is concatenated before this by the build.
const RAPIER = Og;
console.info("rapierWorker.js rapier loaded 3d-compat, version 0.14:");

let rapierWorld = null;
let uidHandle = new Map();
let characterControllers = new Map();
let defaultLinearDamping = 0.0;
let defaultAngularDamping = 0.5; // Damping for rotation to prevent wild spinning (0.5 = moderate damping)
let timestepMode = 0;
let timestepValue = 1 / 60;
let collisionEvents = [];
let characterControllerCollisionEvents = [];
let postDefineCommands = new Map();
let castRayResults = [];
let castShapeResults = [];
let isPaused = false;
const jointMap = new Map(); // key: `${uid}_${targetUID}` → revolute joint handle

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
    AddSphericalJoint: 22,
    SetPositionOffset: 23,
    AddRevoluteJoint: 24,
    CastShape: 25, // Add this line for CastShape
    SetCCD: 26,
    SetSizeOverride: 27,
    SetRestitution: 28,
    SetFriction: 29,
    SetEnabledRotations: 30,
    SetEnabledTranslations: 31,
    SetGravityScale: 32,
    ApplyAngularImpulse: 33,
    WakeUp: 34,
    Sleep: 35,
    PauseWorld: 36,
    ResumeWorld: 37,
    SetRevoluteMotor: 38,
    SetRevoluteLimits: 39,
};

const BodyType = {
    Dynamic: 0,
    Fixed: 1,
    KinematicPosition: 2,
    KinematicVelocity: 3,
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
    console.info("[rapierWorker] worker init world");
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

function setRestitution(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        const collider = body.collider(0);  // Get the first collider of the body
        if (collider) {
            collider.setRestitution(config.restitution);
        }
    }
}

function setFriction(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        const collider = body.collider(0);  // Get the first collider of the body
        if (collider) {
            collider.setFriction(config.friction);
        }
    }
}

function setEnabledRotations(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setEnabledRotations(config.enableX, config.enableY, config.enableZ, true);
    }
}

function setEnabledTranslations(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setEnabledTranslations(config.enableX, config.enableY, config.enableZ, true);
    }
}

function setGravityScale(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setGravityScale(config.scale, true);
    }
}

function applyAngularImpulse(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.applyTorqueImpulse({ x: config.x, y: config.y, z: config.z }, true);
    }
}

function wakeUp(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.wakeUp();
    }
}

function sleep(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.sleep();
    }
}

function pauseWorld() {
    isPaused = true;
}

function resumeWorld() {
    isPaused = false;
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
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setEnabled(config.enable);
    }
}

const ShapeTypeProperty = {
    Auto: 0,
    ModelMesh: 1,
    Box: 2,
    Sphere: 3,
    Cylinder: 4,
    Capsule: 5,
    ConvexHulls: 6,
};

const ColliderType = {
    Solid: 0,
    Sensor: 1,
};

// THE BELOW IS USED FOR 3DOBJECT EXCLUDING MODEL MESH
function createDefaultCollider(config) {
    const shapeType = config.shapeType;
    let colliderDesc;
    switch (shapeType) {
        case ShapeTypeProperty.Box:
            colliderDesc = RAPIER.ColliderDesc.cuboid(
                config.width / 2,
                config.height / 2,
                config.depth / 2
            );
            break;
        case ShapeTypeProperty.Sphere:
            colliderDesc = RAPIER.ColliderDesc.ball(
                Math.max(config.width, config.height, config.depth) / 2
            );
            break;
        case ShapeTypeProperty.Cylinder:
            colliderDesc = RAPIER.ColliderDesc.cylinder(
                config.depth / 2,
                config.width / 2
            );
            break;
        case ShapeTypeProperty.Capsule:
            colliderDesc = RAPIER.ColliderDesc.capsule(
                config.depth / 2,
                config.width / 2
            );
            break;
        default:
            console.warn("Unrecognized default collider", shapeType);
            colliderDesc = RAPIER.ColliderDesc.ball(
                Math.max(config.width, config.height, config.depth) / 2
            );
    }
    return colliderDesc;
}

//THE BELOW IS USED FOR 3D SHAPE
function createCollider(config) {
    const shape = config.shape;
    let colliderDesc;
    switch (shape) {
        case Shape.Box:
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
        case Shape.Pyramid:
            const pyramidPoints = [
                -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
                -0.5, 0, 0, 0.5,
            ];
            const pyramidPointsArray = new Float32Array(pyramidPoints);
            const pyramidPointsArrayScaled = scalePoints(
                pyramidPointsArray,
                config.height,
                config.width,
                config.depth
            );
            colliderDesc = RAPIER.ColliderDesc.convexHull(
                pyramidPointsArrayScaled
            );
            break;
        case Shape.Prism:
            const prismPoints = [
                // Bottom face vertices
                -0.5,
                -0.5,
                -0.5, // Vertex 1
                0.5,
                -0.5,
                -0.5, // Vertex 2
                0.5,
                0.5,
                -0.5, // Vertex 3
                -0.5,
                0.5,
                -0.5, // Vertex 4
                // Top face vertices
                -0.5,
                0.0,
                0.5, // Vertex 5
                0.5,
                0.0,
                0.5, // Vertex 6
            ];
            const prismPointsScaled = scalePoints(
                prismPoints,
                config.height,
                config.width,
                config.depth
            );
            colliderDesc = RAPIER.ColliderDesc.convexHull(prismPointsScaled);
            break;
        case Shape.CornerIn:
            const cornerInPoints = [
                // Bottom face vertices
                -0.5,
                -0.5,
                -0.5, // Vertex 1
                0.5,
                -0.5,
                -0.5, // Vertex 2
                0.5,
                0.5,
                -0.5, // Vertex 3
                -0.5,
                0.5,
                -0.5, // Vertex 4
                // Top face vertices
                // Bottom face vertices
                -0.5,
                -0.5,
                0.5, // Vertex 1
                0.5,
                -0.5,
                0.5, // Vertex 2
                0.5,
                0.5,
                0.5, // Vertex 3
            ];
            const cornerInPointsScaled = scalePoints(
                cornerInPoints,
                config.height,
                config.width,
                config.depth
            );
            colliderDesc = RAPIER.ColliderDesc.convexHull(cornerInPointsScaled);
            break;
        case Shape.CornerOut:
            const cornerOutPoints = [
                // Bottom face vertices
                -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
                -0.5,
                // Top face vertices
                0.5, -0.5, 0.5,
            ];
            const cornerOutPointsScaled = scalePoints(
                cornerOutPoints,
                config.height,
                config.width,
                config.depth
            );
            colliderDesc = RAPIER.ColliderDesc.convexHull(
                cornerOutPointsScaled
            );
            break;
        default:
            console.warn("Unknown shape", shape);
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
    if (bufferIfNoHandle(handle, config)) return;
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
    rigidBodyDesc.setRotation(q);

    // CRITICAL: Set rotation locks on descriptor BEFORE creating body
    // This ensures Rapier initializes the body with correct rotation settings
    const rotX = config?.enableRot0 ? true : false;
    const rotY = config?.enableRot1 ? true : false;
    const rotZ = config?.enableRot2 ? true : false;

    rigidBodyDesc.enabledRotations(rotX, rotY, rotZ);

    const body = rapierWorld.createRigidBody(rigidBodyDesc);

    if (
        (config.shapeType === ShapeTypeProperty.ModelMesh ||
            config.shapeType == ShapeTypeProperty.ConvexHulls) &&
        config.modelMesh
    ) {
        // Model Mesh
        config.modelMesh.meshes.forEach((mesh) => {
            let colliderDesc;
            if (config.shapeType === ShapeTypeProperty.ModelMesh) {
                colliderDesc = RAPIER.ColliderDesc.trimesh(
                    mesh.vertices,
                    mesh.indices
                );
            } else {
                colliderDesc = RAPIER.ColliderDesc.convexHull(mesh.vertices);
            }
            // Set sensor property during creation if specified
            if (config.colliderType === ColliderType.Sensor) {
                colliderDesc.setSensor(true);
            }
            const collider = rapierWorld.createCollider(colliderDesc, body);
            collider.setMass(config.mass);
            collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
        });
    } else if (config.meshPoints && config.meshPoints.length > 0) {
        // Mesh Points
        const colliderDesc = createTrimeshCollider(config.meshPoints);
        // Set sensor property during creation if specified
        if (config.colliderType === ColliderType.Sensor) {
            colliderDesc.setSensor(true);
        }
        const collider = rapierWorld.createCollider(colliderDesc, body);
        collider.setMass(config.mass);
        collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    } else if (config.shape !== null) {
        // 3DShape
        const colliderDesc = createCollider(config);
        // Set sensor property during creation if specified
        if (config.colliderType === ColliderType.Sensor) {
            colliderDesc.setSensor(true);
        }
        const collider = rapierWorld.createCollider(colliderDesc, body);
        collider.setMass(config.mass);
        collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    } else {
        // 3DObject w/ default shape: box, ball, cylinder
        const colliderDesc = createDefaultCollider(config);
        // Set sensor property during creation if specified
        if (config.colliderType === ColliderType.Sensor) {
            colliderDesc.setSensor(true);
        }
        const collider = rapierWorld.createCollider(colliderDesc, body);
        collider.setMass(config.mass);
        collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    }

    // Note: Rotation locks are now set on rigidBodyDesc BEFORE body creation
    // (see rigidBodyDesc.enabledRotations above) - no need to set again here

    body.setLinearDamping(defaultLinearDamping);
    body.setAngularDamping(defaultAngularDamping);

    const uid = config.uid;
    body.uid = uid;
    uidHandle.set(uid, body.handle);

    // Check for and run any commands sent before body defined
    const commands = postDefineCommands.get(uid);
    if (commands) {
        runCommands(commands);
        postDefineCommands.delete(uid);
    }
}

function createTrimeshIndices(vertexCount) {
    const indices = [];
    for (let i = 0; i < vertexCount - 2; i += 3) {
        indices.push(i, i + 1, i + 2);
    }
    return indices;
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
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        const collider = body.collider(0);
        if (collider) {
            collider.setCollisionGroups(group);
        } else {
            console.warn("No collider found for body with UID:", uid);
        }
    } else {
        console.warn("setCollisonGroup: body not found", uid);
    }
}

function translate(config) {
    const uid = config.uid;
    const translation = config.translation;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setTranslation(translation);
    }
}

function rotate(config) {
    const uid = config.uid;
    const rotation = config.rotation;
    const handle = uidHandle.get(uid);

    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setRotation(rotation);
    }
}

function addPostDefineCommands(config) {
    const uid = config.uid;
    if (!postDefineCommands.has(uid)) {
        postDefineCommands.set(uid, []);
    }
    const commands = postDefineCommands.get(uid);
    commands.push(config);
}

function setPositionOffset(config) {
    const uid = config.uid;
    const positionOffset = config.positionOffset;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    const collider = body.collider(0);
    collider.setTranslationWrtParent(positionOffset);
}

function stepWorld(dt, frame) {
    if (!rapierWorld) return;
    if (timestepMode === TimestepMode.Adaptive) {
        rapierWorld.timestep = dt;
    }

    collisionEvents = [...characterControllerCollisionEvents];
    characterControllerCollisionEvents = [];
    let eventQueue = new RAPIER.EventQueue(true);
    if (!isPaused) {
        rapierWorld.step(eventQueue);
        handleCollisionEvents(eventQueue);
    }
    eventQueue.free();

    // Collect and return bodies' data...
    const bodies = rapierWorld.bodies;
    const numBodies = bodies.len();
    const bodiesData = new Float32Array(numBodies * 15);
    let i = 0;
    bodies.forEach((body) => {
        const translation = body.translation();
        const rotation = body.rotation();
        const linvel = body.linvel();
        const angvel = body.angvel();
        bodiesData[i++] = body.uid;
        bodiesData[i++] = translation.x;
        bodiesData[i++] = translation.y;
        bodiesData[i++] = translation.z;
        bodiesData[i++] = rotation.x;
        bodiesData[i++] = rotation.y;
        bodiesData[i++] = rotation.z;
        bodiesData[i++] = rotation.w;
        bodiesData[i++] = linvel.x;
        bodiesData[i++] = linvel.y;
        bodiesData[i++] = linvel.z;
        bodiesData[i++] = angvel.x;
        bodiesData[i++] = angvel.y;
        bodiesData[i++] = angvel.z;
        bodiesData[i++] = body.isSleeping() ? 1 : 0;
    });
    const castRayResultsCopy = castRayResults.slice();
    const castShapeResultsCopy = castShapeResults.slice();
    castRayResults = [];
    castShapeResults = [];
    const worldData = {
        bodiesData,
        collisionEvents,
        frame,
        castRayResults: castRayResultsCopy,
        castShapeResults: castShapeResultsCopy,
    };
    return { data: worldData, transfer: [worldData.bodiesData.buffer] };
}

const CollisionMsgType = {
    BODY: "body",
    CHARACTER_CONTROLLER: "characterController",
};

function handleCollisionEvents(eventQueue) {
    eventQueue.drainCollisionEvents((handle1, handle2, started) => {
        const collider1 = rapierWorld.getCollider(handle1);
        const collider2 = rapierWorld.getCollider(handle2);
        const body1 = collider1.parent();
        const body2 = collider2.parent();

        // Extract contact data (outward normal for body1 = pointing from body2 toward body1)
        let contactNormalX = 0, contactNormalY = 0, contactNormalZ = 0;
        let contactPointX = 0, contactPointY = 0, contactPointZ = 0;
        let contactImpulse = 0;

        if (started) {
            let extracted = false;
            rapierWorld.contactPair(collider1, collider2, (manifold, flipped) => {
                if (extracted) return;
                const normal = manifold.normal();
                // Rapier's manifold normal points from shape1 to shape2 (canonical order).
                // flipped=false → shape1=collider1=body1, normal points body1→body2 → negate for body1 outward.
                // flipped=true  → shape1=collider2=body2, normal points body2→body1 → keep for body1 outward.
                const sign = flipped ? 1 : -1;
                contactNormalX = normal.x * sign;
                contactNormalY = normal.y * sign;
                contactNormalZ = normal.z * sign;
                if (manifold.numSolverContacts() > 0) {
                    const pt = manifold.solverContactPoint(0);
                    contactPointX = pt.x;
                    contactPointY = pt.y;
                    contactPointZ = pt.z;
                }
                if (manifold.numContacts() > 0) {
                    contactImpulse = manifold.contactImpulse(0);
                }
                extracted = true;
            });
        }

        const msg = {
            type: CollisionMsgType.BODY,
            started,
            body1UID: body1.uid,
            body2UID: body2.uid,
            contactNormalX, contactNormalY, contactNormalZ,
            contactPointX, contactPointY, contactPointZ,
            contactImpulse,
        };
        collisionEvents.push(msg);
    });
}

function applyTorque(config) {
    const uid = config.uid;
    const torque = config.torque;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.applyTorque(torque);
    }
}

function setMass(config) {
    const uid = config.uid;
    const mass = config.mass;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        // Get collider
        const collider = body.collider(0);
        if (collider) collider.setMass(mass);
    }
}

// Add function to apply impulse to a body
function applyImpulse(config) {
    const uid = config.uid;
    const impulse = config.impulse;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        const iV = new RAPIER.Vector3(impulse.x, impulse.y, impulse.z);
        body.applyImpulse(iV, true);
    }
}

function applyImpulseAtPoint(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
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
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.addForce(force, point, true);
    }
}

function setSizeOverride(config) {
    if (!rapierWorld) return;
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    let body = rapierWorld.bodies.get(handle);
    // Remove the body if it exists
    if (body) {
        rapierWorld.removeRigidBody(body);
    }
    uidHandle.delete(uid);
    addBody(config);
}

// Add function to do a raycast
function raycast(config) {
    const origin = config.origin;
    const dir = config.dir;
    const ray = new RAPIER.Ray(origin, dir);
    const maxToI = config.maxToI;
    const solid = !config.skipBackFaces;
    const uid = config.uid;
    let filterGroups = parseInt(config.filterGroups, 16);
    filterGroups = 0xffff0000 | filterGroups;
    let resultRaw = rapierWorld.castRayAndGetNormal(
        ray,
        maxToI,
        solid,
        null,
        filterGroups
    );
    let result = {};
    const parent = resultRaw?.collider?.parent();
    const hitUID = parent?.uid;
    if (resultRaw) {
        result.hitUID = hitUID;
        result.hasHit = true;
        result.uid = uid;
        result.dir = { x: dir.x, y: dir.y, z: dir.z };
        result.origin = { x: origin.x, y: origin.y, z: origin.z };
        result.tag = config.tag;
        result.timeOfImpact = resultRaw.timeOfImpact;
        result.normal = {
            x: resultRaw.normal.x,
            y: resultRaw.normal.y,
            z: resultRaw.normal.z,
        };
    } else {
        // @ts-ignore
        result = { hasHit: false, hitUID: -1, uid, tag: config.tag };
    }
    castRayResults.push(result);
    return result;
}

// Function to create a rotation quaternion from Euler angles (degrees)
function createQuaternionFromEuler(roll, pitch, yaw) {
    const cy = Math.cos(yaw * 0.5);
    const sy = Math.sin(yaw * 0.5);
    const cr = Math.cos(roll * 0.5);
    const sr = Math.sin(roll * 0.5);
    const cp = Math.cos(pitch * 0.5);
    const sp = Math.sin(pitch * 0.5);

    const w = cy * cr * cp + sy * sr * sp;
    const x = cy * sr * cp - sy * cr * sp;
    const y = cy * cr * sp + sy * sr * cp;
    const z = sy * cr * cp - cy * sr * sp;

    return new RAPIER.Quaternion(w, x, y, z);
}

// Add function to do a shape cast
function castShape(config) {
    try {
        const shape2Pos = new RAPIER.Vector3(
            config.origin.x,
            config.origin.y,
            config.origin.z
        );
        const shape2Rot = createQuaternionFromEuler(
            // Create rotation object from the input rotation angles
            (config.rotation.x * Math.PI) / 180,
            (config.rotation.y * Math.PI) / 180,
            (config.rotation.z * Math.PI) / 180
        );
        const shape2Vel = new RAPIER.Vector3(
            config.dir.x,
            config.dir.y,
            config.dir.z
        );
        let shape2 = getShapeFromConfig(config.shape); // A function to get the shape based on config
        const maxToI = config.maxToI;
        const targetDistance = config.targetDistance || 1; // Use the targetDistance from the config, default to 1 if not provided
        const stopAtPenetration = !config.skipBackfaces;
        let filterGroups = parseInt(config.filterGroups, 16);
        filterGroups = 0xffff0000 | filterGroups;

        // Find the body with the given UID
        let excludeRigidBody = null;
        if (config.excludeUID !== -1) {
            const handle = uidHandle.get(config.excludeUID);
            if (handle) {
                excludeRigidBody = rapierWorld.bodies.get(handle);
            }
        }

        let result = rapierWorld.castShape(
            shape2Pos, // RAPIER.Vector3: Position of the shape being cast
            shape2Rot, // RAPIER.Quaternion: Use the new rotation object
            shape2Vel, // RAPIER.Vector3: Velocity of the shape being cast
            shape2, // RAPIER.Ball etc.
            targetDistance, // Number
            maxToI, // Number
            stopAtPenetration, //Boolean, Stop at Penetration
            null, // filterFlags
            filterGroups, // filterGroups
            null, // filterExcludeCollider: Collider
            excludeRigidBody, // filterExcludeRigidBody: RigidBody
            null // filterPredicate
        );

        const parent = result?.collider?.parent();
        const hitUID = parent?.uid;
        let returnResult = {};
        if (result !== null) {
            returnResult.uid = config.uid;
            returnResult.hitUID = hitUID;
            returnResult.hasHit = true;
            returnResult.time_of_impact = result.time_of_impact;
            returnResult.direction = [config.dir.x, config.dir.y, config.dir.z];
            returnResult.origin = [
                config.origin.x,
                config.origin.y,
                config.origin.z,
            ];
            returnResult.witness1 = {
                x: result.witness1.x,
                y: result.witness1.y,
                z: result.witness1.z,
            };
            returnResult.witness2 = {
                x: result.witness2.x,
                y: result.witness2.y,
                z: result.witness2.z,
            };
            returnResult.normal1 = {
                x: result.normal1.x,
                y: result.normal1.y,
                z: result.normal1.z,
            };
            returnResult.normal2 = {
                x: result.normal2.x,
                y: result.normal2.y,
                z: result.normal2.z,
            };
            returnResult.tag = config.tag;
        } else {
            returnResult = { hasHit: false, hitUID: -1, tag:config.tag, uid:config.uid };
        }
        castShapeResults.push(returnResult);
        return returnResult;
    } catch (error) {
        console.error("Error in castShape:", error);
        throw error;
    }
}

// Helper function to create shape from config
function getShapeFromConfig(shapeConfig) {
    const { height, width, depth } = shapeConfig;

    switch (shapeConfig.type) {
        case "sphere":
            return new RAPIER.Ball(height / 2); // Assuming height is diameter for sphere
        case "box":
            return new RAPIER.Cuboid(width / 2, height / 2, depth / 2); // Dividing by 2 for half extents
        case "capsule":
            return new RAPIER.Capsule(height / 2, width / 2); // Assuming height is the total height, width is the radius
        // Add more shapes as needed
        default:
            throw new Error("Unknown shape type: " + shapeConfig.type);
    }
}

// Function to set the gravity
function setWorldGravity(config) {
    const gravity = config.gravity;
    rapierWorld.gravity = gravity;
}

// Set body linear damping
function setLinearDamping(config) {
    const uid = config.uid;
    const damping = config.damping;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setLinearDamping(damping);
    }
}

function setCCD(config) {
    const uid = config.uid;
    const enable = config.enable;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.enableCcd(enable);
    }
}

function setAngularDamping(config) {
    const uid = config.uid;
    const damping = config.damping;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
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
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (!body) {
        console.warn(
            "[rapierWorker] translateCharacterController, body not found for uid:",
            uid
        );
        return;
    }
    const characterController = characterControllers.get(tag);
    if (!characterController) {
        console.warn("Character controller not found", tag);
        return;
    }
    characterController.computeColliderMovement(
        body.collider(),
        translation,
        RAPIER.QueryFilterFlags["EXCLUDE_SENSORS"]
    );
    // (optional) Check collisions
    for (let i = 0; i < characterController.numComputedCollisions(); i++) {
        // Do something with the collision
        let collision = characterController.computedCollision(i);
        processCharacterControllerCollision(uid, collision);
    }

    // Pass 1: Compute movement excluding sensors
    characterController.computeColliderMovement(
        body.collider(),
        translation,
        RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
    );

    // Store the computed movement from the first pass
    const correctedMovement = characterController.computedMovement();

    // Pass 2: Gather collision data only (without affecting movement)
    characterController.computeColliderMovement(body.collider(), translation);

    // Check and process collisions
    for (let i = 0; i < characterController.numComputedCollisions(); i++) {
        let collision = characterController.computedCollision(i);
        processCharacterControllerCollision(uid, collision);
    }

    // Apply the computed movement from Pass 1
    const t = body.translation();
    correctedMovement.x = correctedMovement.x + t.x;
    correctedMovement.y = correctedMovement.y + t.y;
    correctedMovement.z = correctedMovement.z + t.z;
    body.setNextKinematicTranslation(correctedMovement);
}

function processCharacterControllerCollision(uid, collision) {
    const collider = collision.collider;
    const body = collider.parent();
    const normal1 = collision.normal1;
    const normal2 = collision.normal2;
    const toi = collision.toi;
    const translationDeltaApplied = collision.translationDeltaApplied;
    const translationDeltaRemaining = collision.translationDeltaRemaining;
    const witness1 = collision.witness1;
    const witness2 = collision.witness2;
    // Create message to send to main thread
    const msg = {
        type: CollisionMsgType.CHARACTER_CONTROLLER,
        body1UID: uid,
        body2UID: body.uid,
        normal1,
        normal2,
        toi,
        translationDeltaApplied,
        translationDeltaRemaining,
        witness1,
        witness2,
    };
    characterControllerCollisionEvents.push(msg);
}

function setVelocity(config) {
    const uid = config.uid;
    const velocity = config.velocity;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        body.setLinvel(velocity);
    }
}

function addSphericalJoint(config) {
    const { uid, targetUID, anchor, targetAnchor } = config;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const targetHandle = uidHandle.get(targetUID);
    if (!handle || !targetHandle) return;
    const body = rapierWorld.bodies.get(handle);
    const targetBody = rapierWorld.bodies.get(targetHandle);
    if (!body || !targetBody) return;
    const params = RAPIER.JointData.spherical(anchor, targetAnchor);
    const joint = rapierWorld.createImpulseJoint(
        params,
        body,
        targetBody,
        true
    );
}

function addRevoluteJoint(config) {
    const { uid, targetUID, anchor, targetAnchor, axis } = config;
    const handle = uidHandle.get(uid);
    if (bufferIfNoHandle(handle, config)) return;
    const targetHandle = uidHandle.get(targetUID);
    if (!handle || !targetHandle) return;
    const body = rapierWorld.bodies.get(handle);
    const targetBody = rapierWorld.bodies.get(targetHandle);
    if (!body || !targetBody) return;
    const params = RAPIER.JointData.revolute(anchor, targetAnchor, axis);
    const joint = rapierWorld.createImpulseJoint(
        params,
        body,
        targetBody,
        true
    );
    jointMap.set(`${uid}_${targetUID}`, joint);
}

function setRevoluteMotor(config) {
    const { uid, targetUID, targetVelocity, maxForce } = config;
    const joint = jointMap.get(`${uid}_${targetUID}`);
    if (!joint) return;
    // configureMotorVelocity(targetVel, dampingCoeff) — dampingCoeff=0 disables motor force
    joint.configureMotorVelocity(targetVelocity, maxForce);
}

function setRevoluteLimits(config) {
    const { uid, targetUID, minAngle, maxAngle, enabled } = config;
    const joint = jointMap.get(`${uid}_${targetUID}`);
    if (!joint) return;
    if (enabled) {
        joint.setLimits(minAngle, maxAngle);
    } else {
        // Rapier has no setLimitsEnabled toggle; use full range to effectively free the joint
        joint.setLimits(-Math.PI * 10000, Math.PI * 10000);
    }
}

function createTrimeshCollider(meshPoints) {
    const vertices = [];
    const indices = [];

    // Flatten meshPoints array and fill vertices
    for (let i = 0; i < meshPoints.length; i++) {
        for (let j = 0; j < meshPoints[i].length; j++) {
            vertices.push(
                meshPoints[i][j].x,
                meshPoints[i][j].y,
                meshPoints[i][j].z
            );
        }
    }

    // Generate indices
    for (let i = 0; i < meshPoints.length - 1; i++) {
        for (let j = 0; j < meshPoints[i].length - 1; j++) {
            indices.push(i * meshPoints[i].length + j);
            indices.push(i * meshPoints[i].length + j + 1);
            indices.push((i + 1) * meshPoints[i].length + j + 1);

            indices.push(i * meshPoints[i].length + j);
            indices.push((i + 1) * meshPoints[i].length + j + 1);
            indices.push((i + 1) * meshPoints[i].length + j);
        }
    }

    // Create trimesh collider description
    const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

    return colliderDesc;
}

const commandFunctions = {
    [CommandType.AddBody]: addBody,
    [CommandType.StepWorld]: stepWorld,
    [CommandType.ApplyImpulse]: applyImpulse,
    [CommandType.ApplyImpulseAtPoint]: applyImpulseAtPoint,
    [CommandType.ApplyForce]: applyForce,
    // Can't batch raycast, need to return result
    [CommandType.Raycast]: raycast,
    [CommandType.SetWorldGravity]: setWorldGravity,
    [CommandType.SetLinearDamping]: setLinearDamping,
    [CommandType.ApplyTorque]: applyTorque,
    [CommandType.SetMass]: setMass,
    [CommandType.CreateCharacterController]: createCharacterController,
    [CommandType.TranslateCharacterController]: translateCharacterController,
    [CommandType.Translate]: translate,
    [CommandType.Rotate]: rotate,
    [CommandType.UpdateBody]: updateBody,
    [CommandType.SetVelocity]: setVelocity,
    [CommandType.SetDefaultLinearDamping]: setDefaultLinearDamping,
    [CommandType.SetAngularDamping]: setAngularDamping,
    [CommandType.EnablePhysics]: enablePhysics,
    [CommandType.SetCollisionGroups]: setCollisionGroups,
    [CommandType.SetTimestep]: setTimestep,
    [CommandType.RemoveBody]: removeBody,
    [CommandType.AddSphericalJoint]: addSphericalJoint,
    [CommandType.SetPositionOffset]: setPositionOffset,
    [CommandType.AddRevoluteJoint]: addRevoluteJoint,
    [CommandType.SetCCD]: setCCD,
    [CommandType.CastShape]: castShape,
    [CommandType.SetSizeOverride]: setSizeOverride,
    [CommandType.SetRestitution]: setRestitution,
    [CommandType.SetFriction]: setFriction,
    [CommandType.SetEnabledRotations]: setEnabledRotations,
    [CommandType.SetEnabledTranslations]: setEnabledTranslations,
    [CommandType.SetGravityScale]: setGravityScale,
    [CommandType.ApplyAngularImpulse]: applyAngularImpulse,
    [CommandType.WakeUp]: wakeUp,
    [CommandType.Sleep]: sleep,
    [CommandType.PauseWorld]: pauseWorld,
    [CommandType.ResumeWorld]: resumeWorld,
    [CommandType.SetRevoluteMotor]: setRevoluteMotor,
    [CommandType.SetRevoluteLimits]: setRevoluteLimits,
};

function runCommands(commands) {
    if (!commands || commands.length === 0) return;
    for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        const commandFunction = commandFunctions[command.type];
        if (commandFunction) {
            commandFunction(command);
        } else {
            console.error("Unknown command type", command.type);
        }
    }
    return true;
}

function removeBody(config) {
    const uid = config.uid;
    const handle = uidHandle.get(uid);
    uidHandle.delete(uid);
    if (!handle) return;
    const body = rapierWorld.bodies.get(handle);
    if (body) {
        rapierWorld.removeRigidBody(body);
    }
    // Prune stale revolute joint entries for this uid
    const uidStr = String(uid);
    for (const key of jointMap.keys()) {
        const parts = key.split("_");
        if (parts[0] === uidStr || parts[1] === uidStr) {
            jointMap.delete(key);
        }
    }
}

function bufferIfNoHandle(handle, config) {
    if (handle === undefined) {
        const configCopy = JSON.parse(JSON.stringify(config));
        addPostDefineCommands(configCopy);
        return true;
    }
    return false;
}

// Expose the worker's API via message handler
const rpcMethods = {
    initWorld,
    addBody,
    stepWorld,
    applyImpulse,
    applyImpulseAtPoint,
    applyForce,
    raycast,
    castShape,
    setWorldGravity,
    setLinearDamping,
    applyTorque,
    setMass,
    runCommands,
    createCharacterController,
    translateCharacterController,
    debugRender,
    removeBody,
};

self.addEventListener("message", async (ev) => {
    const { id, method, args = [] } = ev.data;

    const fn = rpcMethods[method];
    if (!fn) {
        console.error("Unknown RPC method:", method);
        return;
    }

    try {
        let result = await fn(...args);

        // Handle transferables
        let transfer = [];
        if (result && result.transfer) {
            transfer = result.transfer;
            result = result.data;
        }

        // Only send response if id was provided (RPC call vs fire-and-forget)
        if (id !== undefined) {
            self.postMessage({ id, result }, transfer);
        }
    } catch (error) {
        if (id !== undefined) {
            self.postMessage({ id, error: error.message });
        }
    }
});
