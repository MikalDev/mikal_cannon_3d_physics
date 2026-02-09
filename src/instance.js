// SDK v2: Map string shape types to numeric values for worker
const ShapeStringToNumber = {
    "box": 0,
    "prism": 1,
    "wedge": 2,
    "pyramid": 3,
    "corner-out": 4,
    "corner-in": 5,
};

function mapShapeToNumber(shape) {
    if (typeof shape === "number") return shape;
    const num = ShapeStringToNumber[shape];
    return num !== undefined ? num : 0; // default to box
}

function getInstanceJs(parentClass, addonTriggers, C3) {
    return class extends parentClass {
        constructor() {
            super();

            const properties = this._getInitProperties();
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
            // In SDK v2, this.instance and this.behavior are not available in constructor
            // They will be initialized in _postCreate()
            this.uid = null;
            this.PhysicsType = null;
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
                SetRestitution: 28,
                SetFriction: 29,
            };
            this._setTicking(true);
            this._setTicking2(true);
        }

        _release() {
            super._release();
            // SDK v2: Unregister from behavior instance map
            if (this.PhysicsType) {
                this.PhysicsType.unregisterBehaviorInstance(this.uid);
            }
            if (this.bodyDefined) {
                const PhysicsType = this.PhysicsType;
                const command = {
                    type: this.CommandType.RemoveBody,
                    uid: this.uid,
                };
                PhysicsType.commands.push(command);
            }
        }

        _saveToJson() {
            return {
                // data to be saved for savegames
            };
        }

        _loadFromJson(o) {
            // load state for savegames
        }

        _tick() {
            const PhysicsType = this.PhysicsType;
            PhysicsType.sendCommandsToWorker();
            PhysicsType.Tick();
        }

        _tick2() {
            // SDK v2: Use public IWorldInstance interface
            const inst = this.instance;
            const zHeight = inst.depth || 0;
            const bodyDefined = this.bodyDefined;

            // GltfStatic - auto-create body after model loads
            if (this.pluginType === "GltfStaticPlugin" && !bodyDefined) {
                const worldReady = this.behavior && this.behavior.worldReady;
                const hasLoaded = inst.loaded !== undefined ? inst.loaded : false;
                const hasBBox = inst.xMinBB !== undefined && inst.xMaxBB !== undefined;

                if (worldReady && hasLoaded && hasBBox) {
                    const result = this._create3DObjectShape(
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType,
                        null,
                        this.sizeOverride
                    );
                    if (!result && !this._gltfCreateWarned) {
                        console.warn(`[Physics] GltfStatic body creation failed - UID: ${this.uid}`);
                        this._gltfCreateWarned = true;
                    }
                    if (result) return;
                }
                return;
            }

            // Model3D - auto-create body after model loads
            if (this.pluginType === "Model3DPlugin" && !bodyDefined) {
                const worldReady = this.behavior && this.behavior.worldReady;

                // Check if model is loaded via getAllMeshes() method
                let hasLoaded = false;
                if (typeof inst.getAllMeshes === 'function') {
                    try {
                        const meshes = inst.getAllMeshes();
                        hasLoaded = meshes && meshes.length > 0;
                    } catch (e) {
                        if (!this._model3dMethodWarned) {
                            console.warn(`[Physics] Model3D getAllMeshes() failed - UID: ${this.uid}`, e);
                            this._model3dMethodWarned = true;
                        }
                    }
                }

                const hasDimensions = inst.width > 0 && inst.height > 0 && inst.depth > 0;

                if (worldReady && hasLoaded && (hasDimensions || this.sizeOverride)) {
                    const result = this._create3DObjectShape(
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType,
                        null,
                        this.sizeOverride
                    );
                    if (!result && !this._model3dCreateWarned) {
                        console.warn(`[Physics] Model3D body creation failed - UID: ${this.uid}`);
                        this._model3dCreateWarned = true;
                    }
                    if (result) return;
                }
                return;
            }

            if (!bodyDefined) return;
            if (!this.enable) return;

            if (!globalThis.Mikal_Rapier_Bodies) return;
            const wBody = globalThis.Mikal_Rapier_Bodies.get(this.uid);
            if (!wBody) return;
            const position = wBody.translation;
            const quatRot = wBody.rotation;

            if (this.pluginType == "GltfStaticPlugin") {
                inst.x = position.x;
                inst.y = position.y;
                inst.zElevation = position.z;
                inst.quaternion = quatRot;

            } else if (this.pluginType === "Model3DPlugin") {
                // Convert physics position to Model3D offsets
                inst.offsetX = position.x;
                inst.offsetY = position.y;
                inst.offsetZ = position.z;

                // Convert quaternion to Euler angles (radians)
                const quat = globalThis.glMatrix.quat;
                const quatArray = quat.fromValues(quatRot.x, quatRot.y, quatRot.z, quatRot.w);
                const eulerAngles = this._quaternionToEuler(quatArray);
                // eulerAngles = [pitch, yaw, roll] = [X, Y, Z] in radians

                inst.rotationX = eulerAngles[0]; // X-axis rotation (pitch)
                inst.rotationY = eulerAngles[1]; // Y-axis rotation (yaw)
                inst.rotationZ = eulerAngles[2]; // Z-axis rotation (roll)
            } else {
                const zElevation = position.z - zHeight / 2;
                inst.zElevation = zElevation;
                inst.x = position.x;
                inst.y = position.y;
                // angle
                // TODO: Re-enable 3D Rotate support
                // if (this.rotate3D) {
                //     this.rotate3D._useQuaternion = true;
                //     this.rotate3D._quaternion = [
                //         quatRot.x,
                //         quatRot.y,
                //         quatRot.z,
                //         quatRot.w,
                //     ];
                // } else {
                    const quat = globalThis.glMatrix.quat;
                    const zRot = quat.fromValues(
                        quatRot.x,
                        quatRot.y,
                        quatRot.z,
                        quatRot.w
                    );
                    const angles = this._quaternionToEuler(zRot);
                    const angle = angles[2];
                    inst.angle = angle;
                // }
            }
        }

        _postCreate() {
            // Initialize properties that require this.instance and this.behavior
            // (not available in constructor in SDK v2)
            this.uid = this.instance.uid;
            this.PhysicsType = this.behavior;

            // SDK v2: Register this behavior instance for collision/raycast lookups
            this.PhysicsType.registerBehaviorInstance(this.uid, this);

            // TODO: Re-enable 3D Rotate support
            // this.rotate3D = this._Behavior3DRotate();
            // SDK v2: Use plugin.id to detect plugin type
            const plugin = this.instance.objectType.plugin;
            const pluginId = plugin.id;

            // Object created - detect plugin type and setup

            if (pluginId === "Shape3D") {
                this.pluginType = "Shape3DPlugin";
                // Removed verbose debug log
                if (!this.bodyDefined) {
                    // SDK v2: Use public I3DShapeInstance.shape property
                    // Map string shape type to numeric value for worker
                    const shape = mapShapeToNumber(this.instance.shape);
                    this.DefineBody(
                        this.pluginType,
                        shape,
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType
                    );
                    this.bodyDefined = true;
                    // Removed verbose debug log
                    this._trigger(
                        C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                    );
                }
            } else if (pluginId === "Sprite") {
                this.pluginType = "SpritePlugin";
                // Removed verbose debug log
                this.DefineBody(
                    this.pluginType,
                    null,
                    null,
                    this.bodyType,
                    this.colliderType
                );
                // Removed verbose debug log
                this._trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                );
            } else if (pluginId === "GltfStatic") {
                this.pluginType = "GltfStaticPlugin";
                const inst = this.instance;
                const hasQuaternion = inst.quaternion !== undefined;
                const quat = inst.quaternion || { x: 0, y: 0, z: 0, w: 1 };
                // GltfStatic detected
            } else if (pluginId === "Model3D") {
                this.pluginType = "Model3DPlugin";
                const inst = this.instance;

                // Model3D detected
            } else {
                this.pluginType = "invalid";
                console.error("[Physics Debug] Invalid pluginType - plugin id:", pluginId);
            }
        }

        async DefineBody(pluginType, shape, shapeType, bodyType, colliderType) {
            // SDK v2: Use public IWorldInstance interface
            const inst = this.instance;
            const PhysicsType = this.behavior;
            const quat = globalThis.glMatrix.quat;
            const zHeight = inst.depth || 0;
            const enableRot = [true, true, true];
            const scale = PhysicsType.scale;
            const initialQuat = quat.create();
            // inst.angle is in radians, fromEuler expects degrees
            quat.fromEuler(initialQuat, 0, 0, (inst.angle * 180) / Math.PI);
            let command = null;

            // Removed verbose debug log

            if (pluginType === "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                // TODO: Re-enable 3D Rotate support
                // if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                // }
                command = {
                    type: this.CommandType.AddBody,
                    uid: inst.uid,
                    x: inst.x / scale,
                    y: inst.y / scale,
                    z: (inst.zElevation + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: inst.width / scale,
                    height: inst.height / scale,
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
                const meshPoints = this._getMeshPoints();
                command = {
                    type: this.CommandType.AddBody,
                    uid: inst.uid,
                    x: (inst.x - inst.width / 2) / scale,
                    y: (inst.y - inst.height / 2) / scale,
                    z: (inst.zElevation + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: inst.width / scale,
                    height: inst.height / scale,
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
            // Removed verbose debug log
            this.PhysicsType.commands.push(command);
        }

        _UpdateBody() {
            // SDK v2: Use public IWorldInstance interface
            const inst = this.instance;
            const PhysicsType = this.behavior;
            const quat = globalThis.glMatrix.quat;
            const zHeight = inst.depth || 0;
            const enableRot = [true, true, true];
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (inst.angle * 180) / Math.PI);
            const scale = PhysicsType.scale;
            let command = null;
            if (this.pluginType == "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                // TODO: Re-enable 3D Rotate support
                // if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                // }
                const shape = mapShapeToNumber(inst.shape);
                command = {
                    type: this.CommandType.UpdateBody,
                    uid: inst.uid,
                    x: inst.x / scale,
                    y: inst.y / scale,
                    z: (inst.zElevation + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: inst.width / scale,
                    height: inst.height / scale,
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
                const meshPoints = this._getMeshPoints();
                command = {
                    type: this.CommandType.UpdateBody,
                    uid: inst.uid,
                    x: (inst.x - inst.width / 2) / scale,
                    y: (inst.y - inst.height / 2) / scale,
                    z: inst.zElevation / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: inst.width / scale,
                    height: inst.height / scale,
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
                console.error("invalid pluginType", this.pluginType);
                return;
            }
            this.PhysicsType.commands.push(command);
        }

        _SetSizeOverride(enable, height, width, depth) {
            // SDK v2: Use public IWorldInstance interface
            const inst = this.instance;
            this.sizeOverride = enable;
            this.bodySizeHeight = height;
            this.bodySizeWidth = width;
            this.bodySizeDepth = depth;
            if (this.pluginType === "GltfStaticPlugin" || this.pluginType === "Model3DPlugin") {
                const pluginName = this.pluginType === "GltfStaticPlugin" ? "GltfStatic" : "Model3D";
                // Size override set
                this._create3DObjectShape(
                    this.shapeProperty,
                    this.bodyType,
                    this.colliderType,
                    null, // worldInfo not needed with public API
                    enable
                );
                return;
            }
            // Only works for 3DShape and Sprite
            if (!enable) {
                this._UpdateBody();
                return;
            }
            const PhysicsType = this.behavior;
            const quat = globalThis.glMatrix.quat;
            const zHeight = inst.depth || 0;
            const enableRot = [true, true, true];
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (inst.angle * 180) / Math.PI);
            const scale = PhysicsType.scale;
            let command = null;
            if (this.pluginType == "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                // TODO: Re-enable 3D Rotate support
                // if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                // }
                const shape = mapShapeToNumber(inst.shape);
                command = {
                    type: this.CommandType.SetSizeOverride,
                    uid: inst.uid,
                    x: inst.x / scale,
                    y: inst.y / scale,
                    z: (inst.zElevation + zHeight / 2) / scale,
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
                const meshPoints = this._getMeshPoints();
                command = {
                    type: this.CommandType.UpdateBody,
                    uid: inst.uid,
                    x: (inst.x - inst.width / 2) / scale,
                    y: (inst.y - inst.height / 2) / scale,
                    z: inst.zElevation / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: inst.width / scale,
                    height: inst.height / scale,
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
                console.error("invalid pluginType", this.pluginType);
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

        _eulerToQuaternion(eulerX, eulerY, eulerZ) {
            // Input: Euler angles in radians (XYZ order - pitch, yaw, roll)
            // Output: Quaternion {x, y, z, w}
            const quat = globalThis.glMatrix.quat;
            const result = quat.create();

            // glMatrix.quat.fromEuler expects degrees, convert from radians
            const degX = eulerX * (180 / Math.PI);
            const degY = eulerY * (180 / Math.PI);
            const degZ = eulerZ * (180 / Math.PI);

            quat.fromEuler(result, degX, degY, degZ);

            return {
                x: result[0],
                y: result[1],
                z: result[2],
                w: result[3]
            };
        }

        // GltfStatic and Model3D use primitive shape colliders (box, capsule, sphere, etc.)
        // Can auto-create from bounding box or use manual dimensions via SetSizeOverride
        _create3DObjectShape(
            shapeProperty,
            bodyType,
            colliderType,
            worldInfo,
            overrideSize
        ) {
            const inst = this.instance;
            const PhysicsType = this.behavior;
            const scale = PhysicsType.scale;
            const enableRot = [true, true, true]; // Both plugins can rotate on all axes

            // Get initial position and rotation based on plugin type
            let posX, posY, posZ;
            let initialQuat;

            if (this.pluginType === "GltfStaticPlugin") {
                posX = inst.x;
                posY = inst.y;
                posZ = inst.zElevation;
                initialQuat = inst.quaternion || { x: 0, y: 0, z: 0, w: 1 };

            } else if (this.pluginType === "Model3DPlugin") {
                posX = inst.offsetX;
                posY = inst.offsetY;
                posZ = inst.offsetZ;

                // Convert Euler (radians) to quaternion
                initialQuat = this._eulerToQuaternion(
                    inst.rotationX || 0,
                    inst.rotationY || 0,
                    inst.rotationZ || 0
                );

                // Model3D rotation configured
            }

            // Determine dimensions: from extracted bounding box, bounding box, or manual override
            let width, height, depth;
            let dimensionSource = "manual";

            // Try extracted bounding box first (Model3D only)
            if (this.pluginType === "Model3DPlugin" && !overrideSize && this._extractedBBoxMin && this._extractedBBoxMax) {
                const min = this._extractedBBoxMin;
                const max = this._extractedBBoxMax;

                // Convert {x,y,z} or [x,y,z] to consistent format
                const minX = min.x !== undefined ? min.x : min[0];
                const minY = min.y !== undefined ? min.y : min[1];
                const minZ = min.z !== undefined ? min.z : min[2];
                const maxX = max.x !== undefined ? max.x : max[0];
                const maxY = max.y !== undefined ? max.y : max[1];
                const maxZ = max.z !== undefined ? max.z : max[2];

                const bboxWidth = Math.abs(maxX - minX);
                const bboxHeight = Math.abs(maxY - minY);
                const bboxDepth = Math.abs(maxZ - minZ);

                if (bboxWidth > 0 || bboxHeight > 0 || bboxDepth > 0) {
                    width = bboxWidth;
                    height = bboxHeight;
                    depth = bboxDepth;
                    dimensionSource = "extracted bounding box";
                    
                }
            }

            // Try to get dimensions from bounding box if available
            if (!overrideSize && inst.xMinBB && inst.xMaxBB) {
                const xMinBB = inst.xMinBB;
                const xMaxBB = inst.xMaxBB;

                // Check if bounding box is valid (not 0,0,0)
                const bboxWidth = Math.abs(xMaxBB[0] - xMinBB[0]);
                const bboxHeight = Math.abs(xMaxBB[1] - xMinBB[1]);
                const bboxDepth = Math.abs(xMaxBB[2] - xMinBB[2]);

                if (bboxWidth > 0 || bboxHeight > 0 || bboxDepth > 0) {
                    width = bboxWidth;
                    height = bboxHeight;
                    depth = bboxDepth;
                    dimensionSource = "bounding box";
                    
                } else {
                    console.warn(`[Physics Debug] Bounding box is zero-sized - UID: ${this.uid}`);
                    return false;
                }
            } else if (overrideSize) {
                // Use manual override dimensions
                width = this.bodySizeWidth;
                height = this.bodySizeHeight;
                depth = this.bodySizeDepth;
                dimensionSource = "size override";
            } else if (inst.width > 0 && inst.height > 0 && inst.depth > 0) {
                // Use instance dimensions (Model3D, etc.)
                width = inst.width;
                height = inst.height;
                depth = inst.depth;
                dimensionSource = "instance dimensions";
                
            } else {
                const pluginName = this.pluginType === "GltfStaticPlugin" ? "GltfStatic" : this.pluginType === "Model3DPlugin" ? "Model3D" : "Unknown";
                console.warn(`[Physics Debug] _create3DObjectShape for ${pluginName} - UID: ${this.uid}
  ⚠ No dimensions available - model not loaded or size override disabled

  Options:
  → Wait for model to load (${pluginName === "GltfStatic" ? "inst.loaded = true" : "model loads via loadModel()"})
  → ${pluginName} should expose: ${pluginName === "GltfStatic" ? "inst.xMinBB = [x,y,z] and inst.xMaxBB = [x,y,z]" : "bounding box via AnimatedModel"}
  → OR use "Set size override" action with manual dimensions`);
                return false;
            }

            // Apply Model3D scale if applicable
            if (this.pluginType === "Model3DPlugin" && (width !== undefined && height !== undefined && depth !== undefined)) {
                const scaleX = inst.scaleX || 1;
                const scaleY = inst.scaleY || 1;
                const scaleZ = inst.scaleZ || 1;

                

                width *= scaleX;
                height *= scaleY;
                depth *= scaleZ;

                console.log(`  Scaled dimensions: W:${width.toFixed(2)} x H:${height.toFixed(2)} x D:${depth.toFixed(2)}`);
            }

            // Shape type mapping (from combo property order)
            // 0: Auto, 1: ModelMesh, 2: Box, 3: Sphere, 4: Cylinder, 5: Capsule, 6: ConvexHulls
            const shapeNames = {
                0: "Auto",
                1: "ModelMesh",
                2: "Box",
                3: "Sphere",
                4: "Cylinder",
                5: "Capsule",
                6: "ConvexHulls"
            };

            const originalShapeName = shapeNames[shapeProperty] || `Unknown(${shapeProperty})`;
            const pluginName = this.pluginType === "GltfStaticPlugin" ? "GltfStatic" : "Model3D";

            

            // Convert mesh-based shapes to Box for GltfStatic/Model3D
            let actualShapeType = shapeProperty;
            if (shapeProperty === 1 || shapeProperty === 6) { // ModelMesh or ConvexHulls
                actualShapeType = 2; // Box
                
            }

            const shapeName = shapeNames[actualShapeType] || `Unknown(${actualShapeType})`;

            // Log dimension interpretation for different shape types
            let dimensionInfo = "";
            switch (actualShapeType) {
                case 2: // Box
                    dimensionInfo = `Box uses all three dimensions as extents`;
                    break;
                case 3: // Sphere
                    dimensionInfo = `Sphere uses width as radius (height/depth ignored)`;
                    break;
                case 4: // Cylinder
                    dimensionInfo = `Cylinder uses height as length, width as radius`;
                    break;
                case 5: // Capsule
                    dimensionInfo = `Capsule uses height as length, width as radius`;
                    break;
                case 0: // Auto
                    dimensionInfo = `Auto shape - worker will determine best fit`;
                    break;
                default:
                    dimensionInfo = `Unknown shape type - may not work correctly`;
            }

            

            const scaledWidth = width / scale;
            const scaledHeight = height / scale;
            const scaledDepth = depth / scale;

            

            // Check for very small dimensions that could cause physics instability
            const minDim = Math.min(scaledWidth, scaledHeight, scaledDepth);
            if (minDim < 0.1) {
                console.warn(`[Physics Debug] ⚠ Very small physics dimensions detected - UID: ${this.uid}
  Smallest dimension: ${minDim.toFixed(4)} physics units
  This may cause unstable physics behavior or wild spinning
  Consider: Increase model size OR decrease physics scale factor (currently ${scale})`);
            }

            

            const command = {
                type: this.CommandType.AddBody,
                uid: inst.uid,
                x: posX / scale,
                y: posY / scale,
                z: posZ / scale,
                q: {
                    x: initialQuat.x,
                    y: initialQuat.y,
                    z: initialQuat.z,
                    w: initialQuat.w
                },
                width: scaledWidth,
                height: scaledHeight,
                depth: scaledDepth,
                immovable: this.immovable,
                enableRot0: enableRot[0],
                enableRot1: enableRot[1],
                enableRot2: enableRot[2],
                shapeType: actualShapeType, // Use converted shape type
                bodyType,
                colliderType,
                shape: null, // GltfStatic uses primitive shapes, not Shape3D geometry
                mass: this.mass,
            };

            

            

            this.PhysicsType.commands.push(command);

            // Mark body as defined and trigger ready event
            this.bodyDefined = true;
            this._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
            );

            // Body created
            return true;
        }

        // Get mesh points from object using public IWorldInstance API
        _getMeshPoints() {
            const scale = this.PhysicsType.scale;
            const inst = this.instance;
            const meshSize = inst.getMeshSize();
            if (!meshSize || meshSize[0] === 0 || meshSize[1] === 0) return [];
            const [cols, rows] = meshSize;
            const width = inst.width;
            const height = inst.height;
            const meshPoints = [];
            for (let row = 0; row < rows; row++) {
                const meshRow = [];
                for (let col = 0; col < cols; col++) {
                    const point = inst.getMeshPoint(col, row);
                    const x = (point.x * width) / scale;
                    const y = (point.y * height) / scale;
                    const z = point.z / scale;
                    meshRow.push({ x, y, z });
                }
                meshPoints.push(meshRow);
            }
            return meshPoints;
        }

        // TODO: Re-enable 3D Rotate support
        // _Behavior3DRotate() {
        //     // In SDK v2, this.instance is the SDK wrapper (IInstance), not the internal C3 instance
        //     // Use runtime.getInstanceByUid() to get the internal C3 instance which has GetBehaviorSdkInstanceFromCtor
        //     const inst = this.runtime.getInstanceByUid(this.uid);
        //     if (!inst) return null;
        //     const rotate3D = inst.GetBehaviorSdkInstanceFromCtor(
        //         C3.Behaviors.mikal_rotate_shape
        //     );
        //     if (!rotate3D) return null;
        //     return rotate3D;
        // }

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
            // Always send batched command instead of raycasting with comlink
            if (true) {
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

            this._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
            );
            this._trigger(
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

        _SetRestitution(restitution) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetRestitution,
                restitution,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetFriction(friction) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetFriction,
                friction,
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
            const PhysicsType = this.behavior;
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
            this.PhysicsType.workerRPC.send("applyTorque", [
                { uid: this.uid, torque: { x, y, z } },
            ]);
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
            const meshPoints = this._getMeshPoints();
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
            const behavior = this.behavior;
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
                uid: this.instance.uid,
            };

            // Always send batched command instead of raycasting with comlink
            if (true) {
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

            this._trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyCastShapeResult
            );
            this._trigger(
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
