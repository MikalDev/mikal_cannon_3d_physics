function getInstanceJs(parentClass, scriptInterface, addonTriggers, C3) {
    return class extends parentClass {
        constructor(inst, properties) {
            super(inst);

            if (properties) {
                this.enable = properties[0];
                this.immovable = properties[1];
                this.shapeProperty = properties[2];
                this.bodyType = properties[3];
            }
            this.defaultMass = 1;
            this.body = null;
            this.shapePositionOffset = null;
            this.offsetPosition = null;
            this.shapeAngleOffset = null;
            this.uid = this._inst.GetUID();
            this.PhysicsType = this._behaviorType._behavior;
            this.comRapier = this.PhysicsType.comRapier;
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
            };
            this._StartTicking();
            this._StartTicking2();
        }

        Release() {
            super.Release();
            if (this.body) {
                // world.removeBody(this.body);
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
            // console.log("tick");
            this.PhysicsType.sendCommandsToWorker();
        }

        Tick2() {
            const wi = this._inst.GetWorldInfo();
            const shapeInst = this._inst.GetSdkInstance();
            let zHeight = shapeInst._zHeight || 0;
            const body = this.body;

            if (
                this.pluginType === "3DObjectPlugin" &&
                !body &&
                this._inst.GetSdkInstance().loaded
            ) {
                const loaded = this._inst.GetSdkInstance().loaded;
                if (!loaded) return;
                this.body = this.DefineBody(
                    this.pluginType,
                    this.shapeProperty,
                    this.bodyType
                );
                this._inst.GetSdkInstance()._setCannonBody(this.body, true);
            }

            if (!body) return;
            if (!this.enable) return;

            const PhysicsType = this._behaviorType._behavior;

            /*
            const shapeInst = this._inst.GetSdkInstance();
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;

            const wi = this._inst.GetWorldInfo();
            if (this.lastZ !== wi.GetZElevation()) {
                // body.position.z = wi.GetZElevation()+body.shapes[0].halfExtents.z
                const position = body.translation();
                body.setTranslation(
                    {
                        x: position.x,
                        y: position.y,
                        z: wi.GetZElevation() + zHeight / 2,
                    },
                    true
                );
            }

            if (this.lastZAngle !== wi.GetAngle()) {
                const angle = wi.GetAngle();
                const angles = new globalThis.Mikal_Cannon.Vec3();
                const quat = gloalThis.glMatrix.quat;
                const rotate = quatFromEuler(quat.create(), 0, 0, angle);
                body.setRotation(
                    { x: rotate[0], y: rotate[1], z: rotate[2], w: rotate[3] },
                    true
                );
                if (this.rotate3D)
                    this.rotate3D._zAngle = (angle * 180) / Math.PI;
            }
			*/

            PhysicsType.Tick();

            if (!globalThis.Mikal_Rapier_Bodies) return;
            const wBody = globalThis.Mikal_Rapier_Bodies.get(this.uid);
            if (!wBody) return;
            const position = wBody.translation;
            const quatRot = wBody.rotation;

            wi.SetX(position.x);
            wi.SetY(position.y);
            if (this.pluginType == "3DObjectPlugin") {
                wi.SetZElevation(position.z);
            } else {
                const zElevation = position.z - zHeight / 2;
                wi.SetZElevation(zElevation);
            }
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

            this.lastX = wi.GetX();
            this.lastY = wi.GetY();
            this.lastZ = wi.GetZElevation();
            this.lastZAngle = wi.GetAngle();

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
                if (!this.body) {
                    const shape = this._inst.GetSdkInstance()._shape;
                    this.body = this.DefineBody(
                        this.pluginType,
                        shape,
                        this.bodyType
                    );
                }
            } else if (
                C3?.Plugins?.Sprite &&
                pluginType instanceof C3?.Plugins?.Sprite
            ) {
                this.pluginType = "SpritePlugin";
                this.body = this.DefineBody(
                    this.pluginType,
                    null,
                    this.bodyType
                );
            } else if (
                C3?.Plugins?.Mikal_3DObject &&
                pluginType instanceof C3?.Plugins?.Mikal_3DObject
            ) {
                this.pluginType = "3DObjectPlugin";
            } else {
                this.pluginType = "invalid";
                console.error("invalid pluginType", pluginType);
            }
        }

        async DefineBody(pluginType, shapeType, bodyType) {
            const cannon = globalThis.Mikal_Cannon;
            const PhysicsType = this._behaviorType._behavior;
            const shapeInst = this._inst.GetSdkInstance();
            const wi = this._inst.GetWorldInfo();
            const world = globalThis.Mikal_Cannon_world;
            let zHeight = shapeInst._zHeight;
            if (!zHeight) zHeight = 0;
            let shape = null;
            const enableRot = [true, true, true];
            if (pluginType === "Shape3DPlugin") {
                // 3DShape can only rotate around z axis
                if (!this.rotate3D) {
                    enableRot[0] = false;
                    enableRot[1] = false;
                }

                const shape = this._inst.GetSdkInstance()._shape;
                const command = {
                    type: this.CommandType.AddBody,
                    uid: this._inst.GetUID(),
                    x: wi.GetX(),
                    y: wi.GetY(),
                    z: wi.GetZElevation(),
                    qx: 0,
                    qy: 0,
                    qz: 0,
                    qw: 0,
                    width: wi.GetWidth(),
                    height: wi.GetHeight(),
                    depth: zHeight,
                    immovable: this.immovable,
                    enableRot0: enableRot[0],
                    enableRot1: enableRot[1],
                    enableRot2: enableRot[2],
                    shapeType: shapeType,
                    bodyType,
                    shape,
                };
                this.PhysicsType.commands.push(command);
            }
            const x = wi.GetX();
            const y = wi.GetY();
            const z = wi.GetZElevation() + zHeight / 2;
            let angleX = 0;
            let angleY = 0;
            let angleZ = wi.GetAngle();

            this.lastX = x;
            this.lastY = y;
            this.lastZ = z;
            this.lastZAngle = angleZ;
            this.lastYAngle = angleY;
            this.lastXAngle = angleX;
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
        _create3DObjectShape(shapeProperty) {
            // Get bbox of 3DObject
            const cannon = globalThis.Mikal_Cannon;
            const inst = this._inst.GetSdkInstance();
            const xMinBB = inst.xMinBB;
            const xMaxBB = inst.xMaxBB;
            const x = xMaxBB[0] - xMinBB[0];
            const y = xMaxBB[1] - xMinBB[1];
            const z = xMaxBB[2] - xMinBB[2];
            let shape = null;
            // define shape
            switch (shapeProperty) {
                case 0:
                case 1:
                    shape = new cannon.Box(
                        new cannon.Vec3(x / 2, y / 2, z / 2)
                    );
                    break;
                case 2:
                    shape = new cannon.Sphere(x / 2);
                    break;
                case 3:
                    // 12 segments
                    shape = new cannon.Cylinder(x / 2, x / 2, z, 12);
                    break;
                default:
                    console.error("invalid shape", this.shape);
                    return;
            }
            return shape;
        }

        _createWedgeShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(0.5, 0.5, 0.5),
                new cannon.Vec3(0.5, -0.5, 0.5),
                new cannon.Vec3(0.5, -0.5, -0.5),
                new cannon.Vec3(0.5, 0.5, -0.5),
                new cannon.Vec3(-0.5, -0.5, -0.5),
                new cannon.Vec3(-0.5, 0.5, -0.5),
            ];

            const faces = [
                [1, 4, 2],
                [0, 5, 4, 1],
                [0, 3, 5],
                [5, 3, 2, 4],
                [0, 1, 2, 3],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const wedgeShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });

            return wedgeShape;
        }

        _createCornerOutShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                // new cannon.Vec3(-0.5,-0.5,0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                // new cannon.Vec3(-0.5,0.5,0.5),  // 3 - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 4 + - -
                new cannon.Vec3(0.5, -0.5, 0.5), // 5 + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 6 + + -
                // new cannon.Vec3(0.5,0.5,0.5),   // 7 + + +
            ];

            // right hand rule CCW
            const faces = [
                [3, 0, 2],
                [3, 1, 0],
                [4, 1, 3],
                [4, 3, 2],
                [4, 2, 0],
                [4, 0, 1],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const cornerInShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });

            return cornerInShape;
        }

        _createCornerInShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                new cannon.Vec3(-0.5, -0.5, 0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                // new cannon.Vec3(-0.5,0.5,0.5),  // 3 - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 4 + - -
                new cannon.Vec3(0.5, -0.5, 0.5), // 5 + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 6 + + -
                new cannon.Vec3(0.5, 0.5, 0.5), // 7 + + +
            ];

            const faces = [
                [4, 6, 1],
                [4, 1, 0],
                [4, 0, 3],
                [4, 3, 5],
                [4, 5, 6],
                [2, 6, 5],
                [2, 5, 3],
                [2, 3, 0],
                [2, 0, 1],
                [2, 1, 6],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const cornerInShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });

            return cornerInShape;
        }

        _createPrismShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                new cannon.Vec3(-0.5, 0.0, 0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                //			new cannon.Vec3(-0.5,0.5,0.5),  // X - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 3 + - -
                //			new cannon.Vec3(0.5,-0.5,0.5),  // X + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 4 + + -
                new cannon.Vec3(0.5, 0.0, 0.5), // 5 + + +
            ];

            const faces = [
                [2, 0, 1],
                [5, 1, 0, 3],
                [4, 2, 1, 5],
                [4, 5, 3],
                [4, 3, 0, 2],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const prismShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });
            return prismShape;
        }

        _createPyramidShape(height, width, depth) {
            const cannon = globalThis.Mikal_Cannon;
            const vertices = [
                new cannon.Vec3(-0.5, -0.5, -0.5), // 0 - - -
                new cannon.Vec3(-0.5, 0.0, 0.5), // 1 - - +
                new cannon.Vec3(-0.5, 0.5, -0.5), // 2 - + -
                //			new cannon.Vec3(-0.5,0.5,0.5),  // X - + +
                new cannon.Vec3(0.5, -0.5, -0.5), // 3 + - -
                //			new cannon.Vec3(0.5,-0.5,0.5),  // X + - +
                new cannon.Vec3(0.5, 0.5, -0.5), // 4 + + -
                new cannon.Vec3(0.0, 0.0, 0.5), // 5 + + +
            ];

            const faces = [
                [2, 0, 5],
                [5, 0, 3],
                [4, 2, 5],
                [4, 5, 3],
                [4, 3, 0, 2],
            ];

            for (const vertex of vertices) {
                vertex.x = vertex.x * width;
                vertex.y = vertex.y * height;
                vertex.z = vertex.z * depth;
            }

            const prismShape = new cannon.ConvexPolyhedron({
                faces: faces,
                vertices: vertices,
            });
            return prismShape;
        }

        _createMeshPointsForSprite(worldInfo) {
            const wi = worldInfo;
            // create 2x2 grid of points for sprite
            // 2d array of points
            // use worldinfo width and height and zElevation
            // All should have same zElevation
            // 0,0,0 is top left of sprite mesh
            const width = wi.GetWidth();
            const height = wi.GetHeight();
            const zElevation = wi.GetZElevation();
            const xMin = 0;
            const xMax = width;
            const yMin = 0;
            const yMax = height;
            const xStep = width;
            const yStep = height;
            const meshPoints = [];
            for (let y = yMin; y <= yMax; y += yStep) {
                const row = [];
                for (let x = xMin; x <= xMax; x += xStep) {
                    const point = new globalThis.Mikal_Cannon.Vec3(x, y, 0);
                    row.push(point);
                }
                meshPoints.push(row);
            }
            return meshPoints;
        }

        // create cannon-es mesh shape
        _createMeshShape(worldInfo) {
            const cannon = globalThis.Mikal_Cannon;
            // Get instance
            const shapeInst = this._inst.GetSdkInstance();
            // Get world info
            const wi = worldInfo;
            // Get mesh points
            const meshPoints = this._getMeshPoints(wi);
            this._createMeshPointsForSprite(wi);
            const vertices = [];
            // Create vertices list [x,y,z,x,y,z,...]
            for (const row of meshPoints) {
                for (const point of row) {
                    vertices.push(point);
                }
            }

            const gridWidth = meshPoints[0].length;
            const gridHeight = meshPoints.length;

            // Check if square grid, if not console.warn and return null
            if (gridWidth !== gridHeight) {
                console.warn("Mesh must be a square grid");
                return null;
            }

            // Get delta X and Y from first two vertices
            const deltaX = Math.abs(vertices[1].x - vertices[0].x);
            const deltaY = Math.abs(vertices[1].y - vertices[0].y);

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

            // Create heightfield shape
            const shape = new cannon.Heightfield(heightfield, {
                elementSize: deltaX,
            });

            return shape;
        }

        _getMeshPoints(worldInfo) {
            const cannon = globalThis.Mikal_Cannon;
            const wi = worldInfo;
            const points = wi?._meshInfo?.sourceMesh?._pts;
            if (!points) return this._createMeshPointsForSprite(wi);
            const width = wi.GetWidth();
            const height = wi.GetHeight();
            const meshPoints = [];
            for (const rows of points) {
                const meshRow = [];
                for (const point of rows) {
                    const x = point._x * width;
                    const y = point._y * height;
                    const z = point._zElevation;
                    meshRow.push(new cannon.Vec3(x, y, z));
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

        /*
    Trigger(method) {
      super.Trigger(method);
      const addonTrigger = addonTriggers.find((x) => x.method === method);
      if (addonTrigger) {
        this.GetScriptInterface().dispatchEvent(new C3.Event(addonTrigger.id));
      }
    }
	*/

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
            group,
            mask,
            skipBackfaces,
            mode
        ) {
            const vec3 = globalThis.glMatrix.vec3;
            const origin = vec3.fromValues(fromX, fromY, fromZ);
            const to = vec3.fromValues(x, y, z);
            let maxToI = vec3.distance(origin, to);
            vec3.sub(to, to, origin);
            // Normalize to, making dir vector
            vec3.normalize(to, to);
            const dir = to;
            maxToI = maxToI / vec3.length(dir);
            const command = {
                type: this.CommandType.Raycast,
                origin: { x: fromX, y: fromY, z: fromZ },
                dir: { x: dir[0], y: dir[1], z: dir[2] },
                maxToI,
            };
            const result = await this.comRapier.raycast(command);
            const hitPointWorld = vec3.create();
            vec3.add(
                hitPointWorld,
                origin,
                vec3.mul(
                    dir,
                    dir,
                    vec3.fromValues(result.toi, result.toi, result.toi)
                )
            );
            this.raycastResult = {
                hasHit: true,
                hitFaceIndex: 0,
                // origin + dir * toi
                hitPointWorld: [
                    hitPointWorld[0],
                    hitPointWorld[1],
                    hitPointWorld[2],
                ],
                hitNormalWorld: [
                    result.normal.x,
                    result.normal.y,
                    result.normal.z,
                ],
                distance: vec3.distance(origin, [
                    hitPointWorld[0],
                    hitPointWorld[1],
                    hitPointWorld[2],
                ]),
                hitUID: result.hitUID,
                tag,
            };
            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult
            );
            this.Trigger(
                C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult
            );
            return true;
        }

        _RaycastResultAsJSON() {
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
                defaultLinearDamping: damping,
            };
            this.PhysicsType.commands.push(command);
        }

        _SetAngularDamping(damping) {
            const command = {
                uid: this.uid,
                type: this.CommandType.SetLinearDamping,
                defaultLinearDamping: damping,
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
            const command = {
                type: this.CommandType.CreateCharacterController,
                uid: this.uid,
                tag,
                offset,
                up: { x: upX, y: upY, z: upZ },
                maxSlopeClimbAngle,
                minSlopeSlideAngle,
                applyImpulsesToDynamicBodies,
                enableAutostep,
                autostepMinWidth,
                autostepMaxHeight,
                enableSnapToGround,
                snapToGroundMaxDistance,
            };
            this.PhysicsType.commands.push(command);
        }

        _TranslateCharacterController(tag, x, y, z) {
            const command = {
                type: this.CommandType.TranslateCharacterController,
                uid: this.uid,
                tag,
                x,
                y,
                z,
            };
            this.PhysicsType.commands.push(command);
        }

        _Enable() {
            return this.enable ? 1 : 0;
        }

        _WorldGravityX() {
            const world = globalThis.Mikal_Cannon_world;
            return world.gravity.x;
        }

        _WorldGravityY() {
            const world = globalThis.Mikal_Cannon_world;
            return world.gravity.y;
        }

        _WorldGravityZ() {
            const world = globalThis.Mikal_Cannon_world;
            return world.gravity.z;
        }

        _IsEnabled() {
            return this.enable;
        }

        _IsImmovable() {
            return this.immovable;
        }

        _SetVelocity(x, y, z) {
            if (!this.body) return;
            this.body.velocity.set(x, y, z);
        }

        _SetImmovable(immovable) {
            this.immovable = immovable;
            if (!this.body) return;
            if (immovable) {
                this.body.mass = 0;
                this.body.sleep();
            } else {
                this.body.mass = this.defaultMass;
                this.body.wakeUp();
            }
            this.body.updateMassProperties();
        }

        _OnCollision() {
            return true;
        }

        _CollisionData() {
            const collisionData = this.collisionData;
            const target = collisionData?.target;
            const contact = collisionData?.contact;
            const result = {
                target: {
                    uid: target?.uid,
                    id: target?.id,
                },
                contact: {
                    ni: contact?.ni?.toArray(),
                    ri: contact?.ri?.toArray(),
                    rj: contact?.rj?.toArray(),
                },
            };
            return JSON.stringify(result);
        }

        _ApplyImpulse(x, y, z) {
            if (!this.body) return;
            const impulse = { x: x, y: y, z: z };
            const command = {
                type: this.CommandType.ApplyImpulse,
                uid: this.uid,
                impulse,
            };
            this.PhysicsType.commands.push(command);
        }

        _ApplyImpulseAtPoint(x, y, z, pointX, pointY, pointZ) {
            if (!this.body) return;
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
            if (!this.body) return;
            this.comRapier.setMass(this.uid, mass);
        }

        _SetCollisionFilterGroup(group) {
            if (!this.body) return;
            this.body.collisionFilterGroup = group;
        }

        _SetCollisionFilterMask(mask) {
            if (!this.body) return;
            this.body.collisionFilterMask = mask;
        }

        _ApplyForce(x, y, z, pointX, pointY, pointZ) {
            if (!this.body) return;
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
            if (!this.body) return;
            this.comRapier.applyTorque(this.uid, { x: x, y: y, z: z });
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
            if (!this.body) return;
            const cannon = globalThis.Mikal_Cannon;
            const world = globalThis.Mikal_Cannon_world;
            const otherBody = world.bodies.find(
                (body) => body.uid === otherUID
            );
            if (!otherBody) return;
            const localPivot = new cannon.Vec3(x, y, z);
            const otherLocalPivot = new cannon.Vec3(otherX, otherY, otherZ);
            const spring = new cannon.Spring(this.body, otherBody, {
                localPivotA: localPivot,
                localPivotB: otherLocalPivot,
                restLength,
                stiffness,
                damping,
            });
            this.body.springs.set(tag, spring);
        }

        _VelocityX() {
            if (!this.body) return 0;
            return this.body.velocity.x;
        }

        _VelocityY() {
            if (!this.body) return 0;
            return this.body.velocity.y;
        }

        _VelocityZ() {
            if (!this.body) return 0;
            return this.body.velocity.z;
        }

        _UpdateHeightfield() {
            if (!this.body) return;
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

        GetScriptInterfaceClass() {
            return scriptInterface;
        }
    };
}
