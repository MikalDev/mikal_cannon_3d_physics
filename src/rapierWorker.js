// @ts-check
'use strict';

// @ts-ignore
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
// The MessagePort for communicating with the runtime
let msgPort = null;
let id = Math.random()
let buff = null;
let index = 0;
let rapierWorld = null;

function OnReady()
{
    console.log('w ready', id) 
}

self.onmessage = onMessage


function onMessage(e)
{
    switch(e.data.type) {
        case 'init':
            self.postMessage({type: 'init', id: id});
            initWorld();
            console.log('worker init', id)
            console.log('rapier', RAPIER)
            break;
        case 'release':
            release();
            console.info('w release', id)
            self.close();
            break;
        case 'tick': {
            rapierWorld.step();
            // post message with all the bodies
            const bodies = rapierWorld.bodies;
            const numBodies = bodies.len();
            const bodiesData = new Float32Array(numBodies * 8);
            let i = 0;
            bodies.forEach(body => {
                const translation = body.translation();
                const rotation = body.rotation()
                bodiesData[i++] = body.uid
                bodiesData[i++] = translation.x;
                bodiesData[i++] = translation.y;
                bodiesData[i++] = translation.z;
                bodiesData[i++] = rotation.x;
                bodiesData[i++] = rotation.y;
                bodiesData[i++] = rotation.z;
                bodiesData[i++] = rotation.w;
            })
            const message = {type: 'tick', bodies: bodiesData};
            self.postMessage(message, [message.bodies.buffer]);            
            break;
        }
        case 'addBody': {
            const uid = addBody(e.data.config);
            // const message = {type: 'addBody', uid: uid};
            // self.postMessage(message);            
            break;
        }
        default:
            console.warn('unknown message type:', e.data.type)
    }
}

function initWorld()
{
    RAPIER.init().then(() => {
        const gravity = { x: 0.0, y: 0.0, z: -9.81 };
        rapierWorld = new RAPIER.World(gravity)
    });
}

function addBody(config) {
    let rigidBodyDesc
    let x = config.x || 0;
    let y = config.y || 0;
    let z = config.z || 0;
    let qx = config.qx || 0;
    let qy = config.qy || 0;
    let qz = config.qz || 0;
    let qw = config.qw || 0;
    if (config.immovable) {
        rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    } else {
        rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
    }
    const body = rapierWorld.createRigidBody(rigidBodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(config.width/2, config.height/2, config.depth/2);
    const collider = rapierWorld.createCollider(colliderDesc, body)
    // const collider = rapierWorld.createCollider(colliderDesc, rigidBody.handle);
    body.uid = config.uid;
    return config.uid
}

function release() {
    self.removeEventListener("message", initEventListeners);
    if (msgPort) {
        msgPort.close();
        msgPort = null;
    }
}
