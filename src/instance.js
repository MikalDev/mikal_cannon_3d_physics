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

// Convert quaternion (array or object) to {x,y,z,w} object format
function quatToObject(q) {
    if (!q) return { x: 0, y: 0, z: 0, w: 1 };
    if (q.length === 4) return { x: q[0], y: q[1], z: q[2], w: q[3] };
    return q;
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
                this.lightOccluder = properties[10] ?? false;
            }
            // In SDK v2, this.instance and this.behavior are not available in constructor
            // They will be initialized in _postCreate()
            this.uid = null;
            this.PhysicsType = null;
            this.bodyDefined = false;
            this.raycastResults = new Map();
            this.castShapeResults = new Map();
            this._currentRaycastTag = null;
            this._currentCastShapeTag = null;
            // Collision group tracking (16-bit each, mirrors worker state).
            // Bit 15 (0x8000) is reserved as the light occluder group.
            // Default membership clears bit 15 so bodies are invisible to light raycasts
            // unless explicitly marked as light occluders.
            this._collisionMembership = this.lightOccluder ? 0xFFFF : 0x7FFF;
            this._collisionFilter = 0xFFFF;
            this._prevPhysicsQuat = null; // Track previous physics quaternion for delta rotation (Model3D)
            this._ccResults = null; // {grounded, movementX, movementY, movementZ} from worker
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
                SetAngularVelocity: 40,
                SetBodyType: 41,
                SetNextKinematicTranslation: 42,
                SetNextKinematicRotation: 43,
                SetCCSlope: 44,
                SetCCAutostep: 45,
                SetCCSnapToGround: 46,
                SetCCSlide: 47,
                SetCCMass: 48,
                SetCCPushDynamicBodies: 49,
                SetCCOffset: 50,
                SetCCUp: 51,
                RemoveCharacterController: 52,
                SetCCNormalNudgeFactor: 53,
                SetSolverIterations: 54,
                SetRestitutionCombineRule: 55,
                SetSleepThreshold: 56,
            };
            this._setTicking(true);
            this._setTicking2(true);
        }

        _release() {
            super._release();
            this.raycastResults.clear();
            this.castShapeResults.clear();
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

        // Returns { membership, filter } as hex strings for inclusion in body commands
        _collisionGroupsForCommand() {
            const toHex = (n) => "0x" + (n & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
            return { membership: toHex(this._collisionMembership), filter: toHex(this._collisionFilter) };
        }

        // === Coordinate Conversion Utilities ===
        // Convert world coordinates to physics units
        _toPhysics(worldValue) {
            return worldValue / this.PhysicsType.scale;
        }

        // Convert physics units to world coordinates
        _toWorld(physicsValue) {
            return physicsValue * this.PhysicsType.scale;
        }

        // Convert world vector to physics units
        _vecToPhysics(x, y, z) {
            const s = this.PhysicsType.scale;
            return { x: x / s, y: y / s, z: z / s };
        }

        // Normalize bounding box from {x,y,z} or [x,y,z] format
        _normalizeBBox(min, max) {
            const getCoord = (v, i) => v[['x', 'y', 'z'][i]] ?? v[i] ?? 0;
            return {
                min: { x: getCoord(min, 0), y: getCoord(min, 1), z: getCoord(min, 2) },
                max: { x: getCoord(max, 0), y: getCoord(max, 1), z: getCoord(max, 2) }
            };
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
                inst.z = position.z;
                inst.quaternion = quatRot;

            } else if (this.pluginType === "Model3DPlugin") {
                // Set Model3D world position (base position, keep offsets at 0)
                // Model3D Z position is at the bottom, so subtract depth/2 from physics center
                const zDepth = inst.depth || 0;
                inst.x = position.x;
                inst.y = position.y;
                inst.z = position.z - zDepth / 2;

                const quat = globalThis.glMatrix.quat;
                const currentQuat = quat.fromValues(quatRot.x, quatRot.y, quatRot.z, quatRot.w);

                if (!this._prevPhysicsQuat) {
                    // First frame: set absolute rotation directly
                    const eulerAngles = this._quaternionToEuler(currentQuat);
                    inst.rotationX = eulerAngles[0];
                    inst.rotationY = eulerAngles[1];
                    inst.rotationZ = eulerAngles[2];
                    this._prevPhysicsQuat = quat.clone(currentQuat);
                } else {
                    // Subsequent frames: compute delta rotation to avoid gimbal lock
                    // Delta = inverse(previous) * current (local frame delta)
                    const prevInverse = quat.create();
                    quat.invert(prevInverse, this._prevPhysicsQuat);

                    const deltaQuat = quat.create();
                    quat.multiply(deltaQuat, prevInverse, currentQuat);
                    quat.normalize(deltaQuat, deltaQuat);

                    // Convert delta quaternion to Euler angles
                    const deltaEuler = this._quaternionToEuler(deltaQuat);

                    // Apply delta rotation using addTransform (adds to current rotation)
                    inst.addTransform(deltaEuler[0], deltaEuler[1], deltaEuler[2], "rotation");

                    // Update previous quaternion for next frame
                    quat.copy(this._prevPhysicsQuat, currentQuat);
                }
            } else {
                const zElevation = position.z - zHeight / 2;
                inst.z = zElevation;
                inst.x = position.x;
                inst.y = position.y;
                // Extract Z-axis rotation from quaternion
                const quat = globalThis.glMatrix.quat;
                const zRot = quat.fromValues(
                    quatRot.x,
                    quatRot.y,
                    quatRot.z,
                    quatRot.w
                );
                const angles = this._quaternionToEuler(zRot);
                inst.angle = angles[2];
            }
        }

        _postCreate() {
            // Initialize properties that require this.instance and this.behavior
            // (not available in constructor in SDK v2)
            this.uid = this.instance.uid;
            this.PhysicsType = this.behavior;

            // SDK v2: Register this behavior instance for collision/raycast lookups
            this.PhysicsType.registerBehaviorInstance(this.uid, this);

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
            } else if (pluginId === "Model3D") {
                this.pluginType = "Model3DPlugin";
                const inst = this.instance;

                // Model3D detected
            } else {
                this.pluginType = "invalid";
                console.error("[Physics Debug] Invalid pluginType - plugin id:", pluginId);
            }
        }

        _buildBodyCommand(type, overrides = {}) {
            const inst = this.instance;
            const quat = globalThis.glMatrix.quat;
            const zHeight = inst.depth || 0;
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (inst.angle * 180) / Math.PI);

            const isShape3D = this.pluginType === "Shape3DPlugin";
            const isSprite = this.pluginType === "SpritePlugin";

            const posX = isSprite ? inst.x - inst.width / 2 : inst.x;
            const posY = isSprite ? inst.y - inst.height / 2 : inst.y;
            const posZ = inst.z + (isShape3D ? zHeight / 2 : 0);

            const base = {
                type,
                uid: inst.uid,
                ...this._vecToPhysics(posX, posY, posZ),
                q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                width: this._toPhysics(inst.width),
                height: this._toPhysics(inst.height),
                depth: this._toPhysics(zHeight),
                immovable: this.immovable,
                enableRot0: !isShape3D && !isSprite,
                enableRot1: !isShape3D && !isSprite,
                enableRot2: true,
                shapeType: this.shapeProperty,
                bodyType: this.bodyType,
                colliderType: this.colliderType,
                mass: this.mass,
                ...this._collisionGroupsForCommand(),
            };

            return { ...base, ...overrides };
        }

        async DefineBody(pluginType, shape, shapeType, bodyType, colliderType) {
            let command = null;

            if (pluginType === "Shape3DPlugin") {
                command = this._buildBodyCommand(this.CommandType.AddBody, {
                    shapeType,
                    bodyType,
                    colliderType,
                    shape,
                });
            } else if (pluginType === "SpritePlugin") {
                command = this._buildBodyCommand(this.CommandType.AddBody, {
                    shapeType,
                    bodyType,
                    colliderType,
                    shape: null,
                    meshPoints: this._getMeshPoints(),
                });
            }

            this.PhysicsType.commands.push(command);
        }

        _UpdateBody() {
            let command = null;

            if (this.pluginType === "Shape3DPlugin") {
                const shape = mapShapeToNumber(this.instance.shape);
                command = this._buildBodyCommand(this.CommandType.UpdateBody, { shape });
            } else if (this.pluginType === "SpritePlugin") {
                command = this._buildBodyCommand(this.CommandType.UpdateBody, {
                    shape: null,
                    meshPoints: this._getMeshPoints(),
                });
            } else {
                console.error("invalid pluginType", this.pluginType);
                return;
            }

            this.PhysicsType.commands.push(command);
        }

        _SetSizeOverride(enable, height, width, depth) {
            // SDK v2: Use public IWorldInstance interface
            this.sizeOverride = enable;
            this.bodySizeHeight = height;
            this.bodySizeWidth = width;
            this.bodySizeDepth = depth;
            if (this.pluginType === "GltfStaticPlugin" || this.pluginType === "Model3DPlugin") {
                this._create3DObjectShape(
                    this.shapeProperty,
                    this.bodyType,
                    this.colliderType,
                    enable
                );
                return;
            }
            // Only works for 3DShape and Sprite
            if (!enable) {
                this._UpdateBody();
                return;
            }

            let command = null;

            if (this.pluginType === "Shape3DPlugin") {
                const shape = mapShapeToNumber(this.instance.shape);
                command = this._buildBodyCommand(this.CommandType.SetSizeOverride, {
                    shape,
                    width: this._toPhysics(width),
                    height: this._toPhysics(height),
                    depth: this._toPhysics(depth),
                });
            } else if (this.pluginType === "SpritePlugin") {
                command = this._buildBodyCommand(this.CommandType.SetSizeOverride, {
                    shape: null,
                    meshPoints: this._getMeshPoints(),
                });
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
        _create3DObjectShape(shapeProperty, bodyType, colliderType, overrideSize) {
            const inst = this.instance;
            const enableRot = [true, true, true]; // Both plugins can rotate on all axes

            // Get initial position and rotation based on plugin type
            let posX, posY, posZ;
            let initialQuat;

            if (this.pluginType === "GltfStaticPlugin") {
                posX = inst.x;
                posY = inst.y;
                posZ = inst.z;
                initialQuat = quatToObject(inst.quaternion);

            } else if (this.pluginType === "Model3DPlugin") {
                // Model3D has base position (x, y, z) plus offsets
                // Note: Model3D Z position is at the bottom of the model, so add depth/2 for physics center
                posX = inst.x + (inst.offsetX || 0);
                posY = inst.y + (inst.offsetY || 0);
                // depth will be determined later, so we'll adjust posZ after getting dimensions
                posZ = inst.z + (inst.offsetZ || 0);

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

            // Try extracted bounding box first (Model3D only)
            if (this.pluginType === "Model3DPlugin" && !overrideSize && this._extractedBBoxMin && this._extractedBBoxMax) {
                const bbox = this._normalizeBBox(this._extractedBBoxMin, this._extractedBBoxMax);
                const bboxWidth = Math.abs(bbox.max.x - bbox.min.x);
                const bboxHeight = Math.abs(bbox.max.y - bbox.min.y);
                const bboxDepth = Math.abs(bbox.max.z - bbox.min.z);

                if (bboxWidth > 0 || bboxHeight > 0 || bboxDepth > 0) {
                    width = bboxWidth;
                    height = bboxHeight;
                    depth = bboxDepth;
                }
            }

            // Try to get dimensions from bounding box if available
            if (!overrideSize && inst.xMinBB && inst.xMaxBB) {
                const bbox = this._normalizeBBox(inst.xMinBB, inst.xMaxBB);
                const bboxWidth = Math.abs(bbox.max.x - bbox.min.x);
                const bboxHeight = Math.abs(bbox.max.y - bbox.min.y);
                const bboxDepth = Math.abs(bbox.max.z - bbox.min.z);

                if (bboxWidth > 0 || bboxHeight > 0 || bboxDepth > 0) {
                    width = bboxWidth;
                    height = bboxHeight;
                    depth = bboxDepth;
                } else {
                    console.warn(`[Physics Debug] Bounding box is zero-sized - UID: ${this.uid}`);
                    return false;
                }
            } else if (overrideSize) {
                // Use manual override dimensions
                width = this.bodySizeWidth;
                height = this.bodySizeHeight;
                depth = this.bodySizeDepth;
            } else if (inst.width > 0 && inst.height > 0 && inst.depth > 0) {
                // Use instance dimensions (Model3D, etc.)
                width = inst.width;
                height = inst.height;
                depth = inst.depth;
                
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
            }

            // Model3D Z position is at the bottom of the model, adjust to physics center
            if (this.pluginType === "Model3DPlugin") {
                posZ += depth / 2;
            }

            // Convert mesh-based shapes to Box for GltfStatic/Model3D
            // Shape types: 0=Auto, 1=ModelMesh, 2=Box, 3=Sphere, 4=Cylinder, 5=Capsule, 6=Cone, 7=Ramp, 8=ConvexHulls
            let actualShapeType = shapeProperty;
            if (shapeProperty === 1 || shapeProperty === 8) { // ModelMesh or ConvexHulls
                actualShapeType = 2; // Box
            }

            const scaledWidth = this._toPhysics(width);
            const scaledHeight = this._toPhysics(height);
            const scaledDepth = this._toPhysics(depth);


            // Check for very small dimensions that could cause physics instability
            const minDim = Math.min(scaledWidth, scaledHeight, scaledDepth);
            if (minDim < 0.1) {
                console.warn(`[Physics Debug] ⚠ Very small physics dimensions detected - UID: ${this.uid}
  Smallest dimension: ${minDim.toFixed(4)} physics units
  This may cause unstable physics behavior or wild spinning
  Consider: Increase model size OR decrease physics scale factor (currently ${this.PhysicsType.scale})`);
            }

            const command = {
                type: this.CommandType.AddBody,
                uid: inst.uid,
                ...this._vecToPhysics(posX, posY, posZ),
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
                ...this._collisionGroupsForCommand(),
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
            const inst = this.instance;
            const meshSize = inst.getMeshSize();
            if (!meshSize || meshSize[0] < 2 || meshSize[1] < 2) return [];
            const [cols, rows] = meshSize;
            const width = inst.width;
            const height = inst.height;
            const meshPoints = [];
            for (let row = 0; row < rows; row++) {
                const meshRow = [];
                for (let col = 0; col < cols; col++) {
                    const point = inst.getMeshPoint(col, row);
                    meshRow.push(this._vecToPhysics(point.x * width, point.y * height, point.z));
                }
                meshPoints.push(meshRow);
            }
            return meshPoints;
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
            solid,
            mode
        ) {
            if (!this.PhysicsType.worldReady) {
                this.raycastResults.set(tag, { hasHit: false, tag });
                return;
            }
            const vec3 = globalThis.glMatrix.vec3;
            const origin = vec3.fromValues(
                this._toPhysics(fromX),
                this._toPhysics(fromY),
                this._toPhysics(fromZ)
            );
            const to = vec3.fromValues(this._toPhysics(x), this._toPhysics(y), this._toPhysics(z));
            let maxToI = vec3.distance(origin, to);
            vec3.sub(to, to, origin);
            // Normalize to, making dir vector
            vec3.normalize(to, to);
            const dir = to;
            const command = {
                type: this.CommandType.Raycast,
                origin: { x: origin[0], y: origin[1], z: origin[2] },
                dir: { x: dir[0], y: dir[1], z: dir[2] },
                maxToI,
                filterGroups,
                solid,
                uid: this.uid,
                tag,
            };
            this.PhysicsType.commands.push(command);
        }

        _RaycastCurrentTag() {
            return this._currentRaycastTag ?? "";
        }

        _RaycastResultAsJSON(tag) {
            const result = this.raycastResults.get(tag);
            return JSON.stringify(result ?? { hasHit: false, hitUID: -1 });
        }

        // Scripting-only: raycast from this instance's center to toX,toY,toZ.
        // Tag is auto-suffixed with this uid. No trigger fired.
        // Read result next tick: _RaycastResultAsJSON(`${tag}_${uid}`)
        _RaycastFromSelf(tag, toX, toY, toZ, filterGroups = "0x8000", solid = false) {
            const fullTag = `${tag}_${this.uid}`;
            if (!this.PhysicsType.worldReady) {
                this.raycastResults.set(fullTag, { hasHit: false, tag: fullTag });
                return;
            }
            const bodyData = globalThis.Mikal_Rapier_Bodies?.get(this.uid);
            let fromX, fromY, fromZ;
            if (bodyData) {
                fromX = bodyData.translation.x;
                fromY = bodyData.translation.y;
                fromZ = bodyData.translation.z;
            } else {
                const inst = this.instance;
                fromX = inst.x;
                fromY = inst.y;
                fromZ = inst.z ?? inst.zElevation ?? 0;
            }
            const vec3 = globalThis.glMatrix.vec3;
            const origin = vec3.fromValues(
                this._toPhysics(fromX),
                this._toPhysics(fromY),
                this._toPhysics(fromZ)
            );
            const to = vec3.fromValues(
                this._toPhysics(toX),
                this._toPhysics(toY),
                this._toPhysics(toZ)
            );
            const maxToI = vec3.distance(origin, to);
            vec3.sub(to, to, origin);
            vec3.normalize(to, to);
            this.PhysicsType.commands.push({
                type: this.CommandType.Raycast,
                origin: { x: origin[0], y: origin[1], z: origin[2] },
                dir: { x: to[0], y: to[1], z: to[2] },
                maxToI,
                filterGroups,
                solid,
                uid: this.uid,
                tag: fullTag,
                noTrigger: true,
                excludeUID: this.uid,
            });
        }

        _OnAnyRaycastResult() {
            return true;
        }

        _OnRaycastResult(tag) {
            return this._currentRaycastTag === tag;
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

        _SetEnabledRotations(x, y, z) {
            if (!this.bodyDefined) return;
            const command = {
                uid: this.uid,
                type: this.CommandType.SetEnabledRotations,
                enableX: x,
                enableY: y,
                enableZ: z,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetEnabledTranslations(x, y, z) {
            if (!this.bodyDefined) return;
            const command = {
                uid: this.uid,
                type: this.CommandType.SetEnabledTranslations,
                enableX: x,
                enableY: y,
                enableZ: z,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetGravityScale(scale) {
            if (!this.bodyDefined) return;
            const command = {
                uid: this.uid,
                type: this.CommandType.SetGravityScale,
                scale,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyAngularImpulse(x, y, z) {
            if (!this.bodyDefined) return;
            const command = {
                uid: this.uid,
                type: this.CommandType.ApplyAngularImpulse,
                x,
                y,
                z,
            };
            this.PhysicsType.commands.push(command);
        }

        _WakeUp() {
            if (!this.bodyDefined) return;
            this.PhysicsType.commands.push({ uid: this.uid, type: this.CommandType.WakeUp });
        }

        _Sleep() {
            if (!this.bodyDefined) return;
            this.PhysicsType.commands.push({ uid: this.uid, type: this.CommandType.Sleep });
        }

        _IsSleeping() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.sleeping ? 1 : 0;
        }

        _BodyType() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.bodyType ?? -1;
        }

        _Mass() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.mass ?? 0;
        }

        _PausePhysics() {
            this.PhysicsType.commands.push({ type: this.CommandType.PauseWorld });
            this.PhysicsType.isPaused = true;
            this._trigger(C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsPaused);
        }

        _ResumePhysics() {
            this.PhysicsType.commands.push({ type: this.CommandType.ResumeWorld });
            this.PhysicsType.isPaused = false;
        }

        _IsPhysicsPaused() {
            return this.PhysicsType.isPaused ? 1 : 0;
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
            snapToGroundMaxDistance,
            autostepIncludeDynamicBodies
        ) {
            const command = {
                type: this.CommandType.CreateCharacterController,
                uid: this.uid,
                tag,
                offset: this._toPhysics(offset),
                up: { x: upX, y: upY, z: upZ },
                maxSlopeClimbAngle,
                minSlopeSlideAngle,
                applyImpulsesToDynamicBodies,
                enableAutostep,
                autostepMinWidth: this._toPhysics(autostepMinWidth),
                autostepMaxHeight: this._toPhysics(autostepMaxHeight),
                enableSnapToGround,
                snapToGroundMaxDistance: this._toPhysics(snapToGroundMaxDistance),
                autostepIncludeDynamicBodies,
            };
            this.PhysicsType.commands.push(command);
        }

        _TranslateCharacterController(tag, x, y, z) {
            if (!this.bodyDefined) return;
            const command = {
                type: this.CommandType.TranslateCharacterController,
                uid: this.uid,
                tag,
                translation: this._vecToPhysics(x, y, z),
                filterGroups: this._collisionGroupsForCommand().filter,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetCCSlope(tag, maxSlopeClimbAngle, minSlopeSlideAngle) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCSlope,
                tag,
                maxSlopeClimbAngle,
                minSlopeSlideAngle,
            });
        }

        _SetCCAutostep(tag, enabled, maxHeight, minWidth, includeDynamicBodies) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCAutostep,
                tag,
                enabled,
                maxHeight: this._toPhysics(maxHeight),
                minWidth: this._toPhysics(minWidth),
                includeDynamicBodies,
            });
        }

        _SetCCSnapToGround(tag, enabled, distance) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCSnapToGround,
                tag,
                enabled,
                distance: this._toPhysics(distance),
            });
        }

        _SetCCSlide(tag, enabled) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCSlide,
                tag,
                enabled,
            });
        }

        _SetCCMass(tag, mass) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCMass,
                tag,
                mass,
            });
        }

        _SetCCPushDynamicBodies(tag, enabled) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCPushDynamicBodies,
                tag,
                enabled,
            });
        }

        _SetCCOffset(tag, offset) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCOffset,
                tag,
                offset: this._toPhysics(offset),
            });
        }

        _SetCCUp(tag, x, y, z) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCUp,
                tag,
                up: { x, y, z },
            });
        }

        _SetCCNormalNudgeFactor(tag, value) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCCNormalNudgeFactor,
                tag,
                value,
            });
        }

        _RemoveCharacterController(tag) {
            this._ccResults = null;
            this.PhysicsType.commands.push({
                type: this.CommandType.RemoveCharacterController,
                tag,
            });
        }

        _SetSolverIterations(iterations) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetSolverIterations,
                iterations,
            });
        }

        _SetRestitutionCombineRule(rule) {
            if (!this.bodyDefined) return;
            this.PhysicsType.commands.push({
                type: this.CommandType.SetRestitutionCombineRule,
                uid: this.uid,
                rule,
            });
        }

        _SetSleepThreshold(threshold) {
            if (!this.bodyDefined) return;
            this.PhysicsType.commands.push({
                type: this.CommandType.SetSleepThreshold,
                uid: this.uid,
                threshold,
            });
        }

        _Translate(x, y, z) {
            const command = {
                type: this.CommandType.Translate,
                uid: this.uid,
                translation: this._vecToPhysics(x, y, z),
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
            const command = {
                type: this.CommandType.SetVelocity,
                uid: this.uid,
                velocity: this._vecToPhysics(x, y, z),
            };
            this.PhysicsType.commands.push(command);
        }

        _SetAngularVelocity(x, y, z) {
            if (!this.bodyDefined) return;
            this.PhysicsType.commands.push({
                type: this.CommandType.SetAngularVelocity,
                uid: this.uid,
                x, y, z,
            });
        }

        _SetBodyType(bodyType) {
            if (!this.bodyDefined) return;
            this.PhysicsType.commands.push({
                type: this.CommandType.SetBodyType,
                uid: this.uid,
                bodyType,
            });
        }

        _SetNextKinematicTranslation(x, y, z) {
            if (!this.bodyDefined) return;
            this.PhysicsType.commands.push({
                type: this.CommandType.SetNextKinematicTranslation,
                uid: this.uid,
                translation: this._vecToPhysics(x, y, z),
            });
        }

        _SetNextKinematicRotation(x, y, z) {
            if (!this.bodyDefined) return;
            const quat = globalThis.glMatrix.quat;
            const rotation = quat.create();
            quat.fromEuler(rotation, x, y, z);
            this.PhysicsType.commands.push({
                type: this.CommandType.SetNextKinematicRotation,
                uid: this.uid,
                rotation: { x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] },
            });
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

        _CollisionTargetUID() {
            return this.collisionData?.targetUID ?? -1;
        }

        _CollisionStarted() {
            return this.collisionData?.started ? 1 : 0;
        }

        _CollisionNormalX() {
            return this.collisionData?.normalX ?? 0;
        }

        _CollisionNormalY() {
            return this.collisionData?.normalY ?? 0;
        }

        _CollisionNormalZ() {
            return this.collisionData?.normalZ ?? 0;
        }

        _CollisionContactX() {
            return this.collisionData?.pointX ?? 0;
        }

        _CollisionContactY() {
            return this.collisionData?.pointY ?? 0;
        }

        _CollisionContactZ() {
            return this.collisionData?.pointZ ?? 0;
        }

        _CollisionImpulse() {
            return this.collisionData?.impulse ?? 0;
        }

        _CharacterCollisionData() {
            const collisionData = this.characterCollisionData;
            if (!collisionData) return "{}";
            return JSON.stringify(collisionData);
        }

        _CCGrounded() {
            const cc = this._ccResults;
            return cc?.grounded ? 1 : 0;
        }

        _CCComputedMovementX() {
            const cc = this._ccResults;
            if (!cc) return 0;
            return cc.movementX * (this.PhysicsType?.scale ?? 1);
        }

        _CCComputedMovementY() {
            const cc = this._ccResults;
            if (!cc) return 0;
            return cc.movementY * (this.PhysicsType?.scale ?? 1);
        }

        _CCComputedMovementZ() {
            const cc = this._ccResults;
            if (!cc) return 0;
            return cc.movementZ * (this.PhysicsType?.scale ?? 1);
        }

        _CCCollisionNormalX() {
            return this.characterCollisionData?.event?.normal1?.x ?? 0;
        }

        _CCCollisionNormalY() {
            return this.characterCollisionData?.event?.normal1?.y ?? 0;
        }

        _CCCollisionNormalZ() {
            return this.characterCollisionData?.event?.normal1?.z ?? 0;
        }

        _CCCollisionTargetUID() {
            return this.characterCollisionData?.target?.uid ?? -1;
        }

        _CCCollisionTOI() {
            return this.characterCollisionData?.event?.toi ?? 0;
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
            this._collisionMembership = parseInt(membership, 16);
            this._collisionFilter = parseInt(filter, 16);
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCollisionGroups,
                uid: this.uid,
                membership,
                filter,
            });
        }

        _SetLightOccluder(enable) {
            if (!this.bodyDefined) return;
            const LIGHT_OCCLUDER_BIT = 0x8000; // bit 15, reserved for light occlusion
            if (enable) {
                this._collisionMembership |= LIGHT_OCCLUDER_BIT;
            } else {
                this._collisionMembership &= ~LIGHT_OCCLUDER_BIT;
            }
            const { membership, filter } = this._collisionGroupsForCommand();
            this.PhysicsType.commands.push({
                type: this.CommandType.SetCollisionGroups,
                uid: this.uid,
                membership,
                filter,
            });
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
            const command = {
                type: this.CommandType.ApplyTorque,
                uid: this.uid,
                torque: { x, y, z },
            };
            this.PhysicsType.commands.push(command);
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
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.x ?? 0;
        }

        _VelocityY() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.y ?? 0;
        }

        _VelocityZ() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.velocity?.z ?? 0;
        }

        _AngularVelocityX() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.x ?? 0;
        }

        _AngularVelocityY() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.y ?? 0;
        }

        _AngularVelocityZ() {
            return globalThis.Mikal_Rapier_Bodies?.get(this.uid)?.angularVelocity?.z ?? 0;
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
            const command = {
                type: this.CommandType.AddSphericalJoint,
                uid: this.uid,
                anchor: this._vecToPhysics(anchorX, anchorY, anchorZ),
                targetAnchor: this._vecToPhysics(targetAnchorX, targetAnchorY, targetAnchorZ),
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
            const command = {
                type: this.CommandType.AddRevoluteJoint,
                uid: this.uid,
                anchor: this._vecToPhysics(anchorX, anchorY, anchorZ),
                targetAnchor: this._vecToPhysics(targetAnchorX, targetAnchorY, targetAnchorZ),
                targetUID,
                axis: { x: axisX, y: axisY, z: axisZ },
            };
            this.PhysicsType.commands.push(command);
        }

        _SetRevoluteMotor(targetUID, targetVelocity, maxForce) {
            this.PhysicsType.commands.push({
                type: this.CommandType.SetRevoluteMotor,
                uid: this.uid,
                targetUID,
                targetVelocity,
                maxForce,
            });
        }

        _SetRevoluteLimits(targetUID, minAngle, maxAngle, enabledStr) {
            const enabled = enabledStr === "yes";
            this.PhysicsType.commands.push({
                type: this.CommandType.SetRevoluteLimits,
                uid: this.uid,
                targetUID,
                minAngle: minAngle * Math.PI / 180,
                maxAngle: maxAngle * Math.PI / 180,
                enabled,
            });
        }

        _SetPositionOffset(x, y, z) {
            const command = {
                type: this.CommandType.SetPositionOffset,
                uid: this.uid,
                positionOffset: this._vecToPhysics(x, y, z),
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
            solid
        ) {
            if (!this.PhysicsType.worldReady) {
                this.castShapeResults.set(tag, { hasHit: false, tag });
                return;
            }
            const vec3 = globalThis.glMatrix.vec3;

            const origin = vec3.fromValues(
                this._toPhysics(fromX),
                this._toPhysics(fromY),
                this._toPhysics(fromZ)
            );
            const to = vec3.fromValues(this._toPhysics(toX), this._toPhysics(toY), this._toPhysics(toZ));

            // Calculate direction
            let direction = vec3.create();
            vec3.sub(direction, to, origin);
            // vec3.normalize(direction, direction); // Normalize the direction vector (Foozle: I don't believe it should be normalized.)

            // Map shapeType to string if necessary
            const shapeTypeMap = {
                0: "box",
                1: "sphere",
                2: "capsule",
                3: "cone",
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
                    width: this._toPhysics(width),
                    height: this._toPhysics(height),
                    depth: this._toPhysics(depth),
                },
                origin: { x: origin[0], y: origin[1], z: origin[2] },
                dir: { x: direction[0], y: direction[1], z: direction[2] },
                rotation: {
                    x: rotX,
                    y: rotY,
                    z: rotZ,
                },
                maxToI,
                targetDistance: this._toPhysics(targetDistance),
                filterGroups,
                excludeUID,
                solid,
                tag,
                uid: this.instance.uid,
            };

            this.PhysicsType.commands.push(command);
        }

        _CastShapeCurrentTag() {
            return this._currentCastShapeTag ?? "";
        }

        _CastShapeResultAsJSON(tag) {
            const result = this.castShapeResults.get(tag);
            return JSON.stringify(result ?? { hasHit: false, hitUID: -1 });
        }

        _OnAnyCastShapeResult() {
            return true;
        }

        _OnCastShapeResult(tag) {
            return this._currentCastShapeTag === tag;
        }

        _OnPhysicsReady() {
            return true;
        }

        _OnPhysicsPaused() {
            return true;
        }
    };
}
