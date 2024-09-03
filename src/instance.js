function getInstanceJs(parentClass, scriptInterface, addonTriggers, C3) {
    return class extends parentClass {
        constructor(inst, properties) {
            super(inst);

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
            this.uid = this._inst.GetUID();
            this.PhysicsType = this._behaviorType._behavior;
            this.comRapier = this.PhysicsType.comRapier;
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
            };
            this._StartTicking();
            this._StartTicking2();
        }

        Release() {
            super.Release();
            if (this.bodyDefined) {
                const PhysicsType = this.PhysicsType;
                const command = {
                    type: this.CommandType.RemoveBody,
                    uid: this.uid,
                };
                PhysicsType.commands.push(command);
            }
        }

        SaveToJson() {
            return {
                // data to be saved for savegames
            };
        }

        LoadFromJson(o) {
            // load state for savegames
        }

        Tick() {
            const PhysicsType = this.PhysicsType;
            PhysicsType.sendCommandsToWorker();
            PhysicsType.Tick();
        }

        Tick2() {
            const wi = this._inst.GetWorldInfo();
            const shapeInst = this._inst.GetSdkInstance();
            let zHeight = shapeInst._zHeight || 0;
            const bodyDefined = this.bodyDefined;
            const PhysicsType = this._behaviorType._behavior;

            if (
                this.pluginType === "3DObjectPlugin" &&
                !bodyDefined &&
                this._inst.GetSdkInstance().loaded
            ) {
                const loaded = this._inst.GetSdkInstance().loaded;
                if (!loaded) return;
                const result = this._create3DObjectShape(
                    this.shapeProperty,
                    this.bodyType,
                    this.colliderType,
                    wi
                );
                // Not ready
                if (!result) return;
                this.bodyDefined = true;
                this.Trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                );
                this._inst.GetSdkInstance()._setCannonBody(this.setBody, true);
            }

            if (!bodyDefined) return;
            if (!this.enable) return;

            if (!globalThis.Mikal_Rapier_Bodies) return;
            const wBody = globalThis.Mikal_Rapier_Bodies.get(this.uid);
            if (!wBody) return;
            const position = wBody.translation;
            const quatRot = wBody.rotation;

            if (this.pluginType == "3DObjectPlugin") {
                this.setBody.position = position;
                this.setBody.quaternion = quatRot;
                wi.SetZElevation(position.z);
            } else {
                const zElevation = position.z - zHeight / 2;
                wi.SetZElevation(zElevation);
                wi.SetX(position.x);
                wi.SetY(position.y);
                // angle
                if (this.rotate3D) {
                    this.rotate3D._useQuaternion = true;
                    this.rotate3D._quaternion = [
                        quatRot.x,
                        quatRot.y,
                        quatRot.z,
                        quatRot.w,
                    ];
                } else {
                    const quat = globalThis.glMatrix.quat;
                    const zRot = quat.fromValues(
                        quatRot.x,
                        quatRot.y,
                        quatRot.z,
                        quatRot.w
                    );
                    const angles = this._quaternionToEuler(zRot);
                    const angle = angles[2];
                    wi.SetAngle(angle);
                }
            }

            wi.SetBboxChanged();
        }

        PostCreate() {
            this.rotate3D = this._Behavior3DRotate();
            const pluginType = this._inst.GetPlugin();
            if (
                C3?.Plugins?.Shape3D &&
                pluginType instanceof C3?.Plugins?.Shape3D
            ) {
                this.pluginType = "Shape3DPlugin";
                if (!this.bodyDefined) {
                    const shape = this._inst.GetSdkInstance()._shape;
                    this.DefineBody(
                        this.pluginType,
                        shape,
                        this.shapeProperty,
                        this.bodyType,
                        this.colliderType
                    );
                    this.bodyDefined = true;
                    this.Trigger(
                        C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                    );
                }
            } else if (
                C3?.Plugins?.Sprite &&
                pluginType instanceof C3?.Plugins?.Sprite
            ) {
                this.pluginType = "SpritePlugin";
                this.DefineBody(
                    this.pluginType,
                    null,
                    null,
                    this.bodyType,
                    this.colliderType
                );
                this.Trigger(
                    C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnPhysicsReady
                );
            } else if (
                C3?.Plugins?.Mikal_3DObject &&
                pluginType instanceof C3?.Plugins?.Mikal_3DObject
            ) {
                this.pluginType = "3DObjectPlugin";
                // define body after loaded
            } else {
                this.pluginType = "invalid";
                console.error("invalid pluginType", pluginType);
            }
        }

        async DefineBody(pluginType, shape, shapeType, bodyType, colliderType) {
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const quat = globalThis.glMatrix.quat;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            // let shape = null;
            const enableRot = [true, true, true];
            const scale = PhysicsType.scale;
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (wi.GetAngle() * 180) / Math.PI);
            let command = null;

            if (pluginType === "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }
                // const shape = this._inst.GetSdkInstance()._shape;
                command = {
                    type: this.CommandType.AddBody,
                    uid: this._inst.GetUID(),
                    x: wi.GetX() / scale,
                    y: wi.GetY() / scale,
                    z: (wi.GetZElevation() + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: wi.GetWidth() / scale,
                    height: wi.GetHeight() / scale,
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
                const meshPoints = this._getMeshPoints(wi);
                command = {
                    type: this.CommandType.AddBody,
                    uid: this._inst.GetUID(),
                    x: (wi.GetX() - wi.GetWidth() / 2) / scale,
                    y: (wi.GetY() - wi.GetHeight() / 2) / scale,
                    z: (wi.GetZElevation() + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: wi.GetWidth() / scale,
                    height: wi.GetHeight() / scale,
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
            this.PhysicsType.commands.push(command);
        }

        _UpdateBody() {
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const quat = globalThis.glMatrix.quat;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            const enableRot = [true, true, true];
            const initialQuat = quat.create();
            quat.fromEuler(initialQuat, 0, 0, (wi.GetAngle() * 180) / Math.PI);
            const scale = PhysicsType.scale;
            let command = null;
            const pluginType = this._inst.GetPlugin();
            if (this.pluginType == "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }
                const shape = this._inst.GetSdkInstance()._shape;
                command = {
                    type: this.CommandType.UpdateBody,
                    uid: this._inst.GetUID(),
                    x: wi.GetX() / scale,
                    y: wi.GetY() / scale,
                    z: (wi.GetZElevation() + zHeight / 2) / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: wi.GetWidth() / scale,
                    height: wi.GetHeight() / scale,
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
                const scale = PhysicsType.scale;
                const meshPoints = this._getMeshPoints(wi);
                command = {
                    type: this.CommandType.UpdateBody,
                    uid: this._inst.GetUID(),
                    x: (wi.GetX() - wi.GetWidth() / 2) / scale,
                    y: (wi.GetY() - wi.GetHeight() / 2) / scale,
                    z: wi.GetZElevation() / scale,
                    q: { x: 0, y: 0, z: initialQuat[2], w: initialQuat[3] },
                    width: wi.GetWidth() / scale,
                    height: wi.GetHeight() / scale,
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
                console.error("invalid pluginType", pluginType);
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

        _create3DObjectShape(shapeProperty, bodyType, colliderType, worldInfo) {
            // Get bbox of 3DObject
            const inst = this._inst.GetSdkInstance();
            const xMinBB = inst.xMinBB;
            const xMaxBB = inst.xMaxBB;
            // Check if rendered (larger than 0,0,0)
            if (
                xMinBB[0] - xMaxBB[0] === 0 &&
                (xMinBB[0] - xMaxBB[0] === 0) & (xMinBB[0] - xMaxBB[0] === 0)
            )
                return false;
            const h = !this.sizeOverride
                ? xMaxBB[0] - xMinBB[0]
                : this.bodySizeWidth;
            const w = !this.sizeOverride
                ? xMaxBB[1] - xMinBB[1]
                : this.bodySizeHeight;
            const d = !this.sizeOverride
                ? xMaxBB[2] - xMinBB[2]
                : this.bodySizeDepth;
            const PhysicsType = this._behaviorType._behavior;
            const scale = PhysicsType.scale;
            const wi = worldInfo;

            const scale3DObject = inst.scale;

            const xAngle = inst.xAngle;
            const yAngle = inst.yAngle;
            const zAngle = inst.zAngle;

            const rotQuat = globalThis.glMatrix.quat.create();
            globalThis.glMatrix.quat.fromEuler(rotQuat, xAngle, yAngle, zAngle);

            // const shapeTypeMap = {
            //     0: "auto",
            //     1: "modelMesh",
            //     2: "box",
            //     3: "sphere",
            //     4: "cylinder",
            //     5: "capsule"
            // };

            // const shapePropertyMap = shapeTypeMap[shapeTypeMap]; // Map the numerical value to a shape type string
            // Model Mesh data
            let modelMesh = null;

            if (shapeProperty === 1) {
                const drawMeshes = inst.gltf.drawMeshes;

                const meshes = drawMeshes.map((mesh) => {
                    const drawVerts = Array.from(mesh.drawVerts[0]);

                    const transformedVertices = transformDrawVerts(
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        inst.xScale,
                        inst.yScale,
                        inst.zScale,
                        drawVerts,
                        scale,
                        scale3DObject
                    );

                    const indices = Array.from(mesh.drawIndices[0]);

                    return {
                        vertices: transformedVertices,
                        indices: indices,
                    };
                });

                modelMesh = {
                    meshes: meshes,
                };
            }

            const command = {
                type: this.CommandType.AddBody,
                uid: this._inst.GetUID(),
                x: wi.GetX() / scale,
                y: wi.GetY() / scale,
                z: wi.GetZElevation() / scale,
                q: {
                    x: rotQuat[0],
                    y: rotQuat[1],
                    z: rotQuat[2],
                    w: rotQuat[3],
                },
                width: h / scale,
                height: w / scale,
                depth: d / scale,
                immovable: this.immovable,
                enableRot0: true,
                enableRot1: true,
                enableRot2: true,
                shapeType: shapeProperty,
                bodyType: bodyType,
                colliderType: colliderType,
                shape: null,
                mass: this.mass,
                modelMesh,
            };
            this.PhysicsType.commands.push(command);
            return true;
        }

        // Get mesh points from object
        _getMeshPoints(worldInfo) {
            const scale = this.PhysicsType.scale;
            const wi = worldInfo;
            const points = wi?._meshInfo?.sourceMesh?._pts;
            const width = wi.GetWidth();
            const height = wi.GetHeight();
            const meshPoints = [];
            for (const rows of points) {
                const meshRow = [];
                for (const point of rows) {
                    const x = (point._x * width) / scale;
                    const y = (point._y * height) / scale;
                    const z = point._zElevation / scale;
                    meshRow.push({ x, y, z });
                }
                meshPoints.push(meshRow);
            }
            return meshPoints;
        }

        _Behavior3DRotate() {
            const inst = this._inst;
            const rotate3D = inst.GetBehaviorSdkInstanceFromCtor(
                C3.Behaviors.mikal_rotate_shape
            );
            if (!rotate3D) return null;
            return rotate3D;
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
            if (tag.includes("-batch")) {
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

            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
            );
            this.Trigger(
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
            const PhysicsType = this._behaviorType._behavior;
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
            this.comRapier.applyTorque(this.uid, { x: x, y: y, z: z });
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
            const meshPoints = this._getMeshPoints(this._inst.GetWorldInfo());
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
            const behavior = this._behaviorType._behavior;
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
            };

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

            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyCastShapeResult
            );
            this.Trigger(
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

        GetScriptInterfaceClass() {
            return scriptInterface;
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
