function getInstanceJs(parentClass, scriptInterface, addonTriggers, C3) {
  return class extends parentClass {
    constructor(inst, properties) {
      super(inst);

      if (properties) {
		this.enable = properties[0];
		this.immovable = properties[1];
		this.shape = properties[2];
      }
      this._StartTicking2()
      this.defaultMass = 1
      this.body = null
    }

    Release() {
      super.Release();
	  const world = globalThis.Mikal_Cannon_world
	  if (this.body) {
		  world.removeBody(this.body)
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

    Tick2() {
		const body = this.body

		if (this.pluginType === "3DObjectPlugin" && !body && this._inst.GetSdkInstance().loaded) {
				const loaded = this._inst.GetSdkInstance().loaded
				if (!loaded) return
				// Get bbox of 3DObject
				const xMinBB = this._inst.GetSdkInstance().xMinBB
				const xMaxBB = this._inst.GetSdkInstance().xMaxBB
				const x = xMaxBB[0] -xMinBB[0]
				const y = xMaxBB[1] -xMinBB[1]
				const z = xMaxBB[2] -xMinBB[2]
				// define shape as cannon box
				const cannon = globalThis.Mikal_Cannon
				const shape = new cannon.Box(new cannon.Vec3(x, y, z))
				this.body = this.DefineBody(this.pluginType, shape)
				this._inst.GetSdkInstance()._setCannonBody(this.body, true)
		}

		if (!body) return
		if (!this.enable) return

		const CannonPhysics = this._behaviorType._behavior
		if (this.pluginType === "3DObjectPlugin") {
			// _setCannonBody is called from 3DObjectPlugin
			CannonPhysics.Tick()
			return
		}

		const shapeInst = this._inst.GetSdkInstance()
		const zHeight = shapeInst._zHeight

		const wi = this._inst.GetWorldInfo();

		if (this.lastX !== wi.GetX()) {
			body.position.x = wi.GetX()
		}

		if (this.lastY !== wi.GetY()) {
			body.position.y = wi.GetY()
		}

		if (this.lastZ !== wi.GetZElevation()) {
			// body.position.z = wi.GetZElevation()+body.shapes[0].halfExtents.z
			body.position.z = wi.GetZElevation()+zHeight/2
		}

		if (this.lastZAngle !== wi.GetAngle()) {
			const angle = wi.GetAngle()
			body.quaternion.setFromEuler(0, 0, angle, "ZXY")
		}
		
		CannonPhysics.Tick()

		wi.SetX(body.position.x)
		wi.SetY(body.position.y)
		wi.SetZElevation(body.position.z-zHeight/2)
		// angle
		const quat = this.body.quaternion
		const angles = new globalThis.Mikal_Cannon.Vec3()
		quat.toEuler(angles, "ZYX")
		const angle = angles.z
		wi.SetAngle(angle)

		this.lastX = wi.GetX()
		this.lastY = wi.GetY()
		this.lastZ = wi.GetZElevation()
		this.lastZAngle = wi.GetAngle()

		wi.SetBboxChanged();
	}

	PostCreate() {
		const pluginType = this._inst.GetPlugin()
		if (pluginType instanceof C3?.Plugins?.Shape3D) {
			this.pluginType = "Shape3DPlugin"
			if (!this.body) {
				const shape = this._inst.GetSdkInstance()._shape
				this.body = this.DefineBody(this.pluginType, shape)
			}
		} else if (pluginType instanceof C3?.Plugins?.Mikal_3DObject) {
			this.pluginType = "3DObjectPlugin"
		} else {
			this.pluginType = "invalid"
			console.error('invalid pluginType', pluginType)
			debugger
		}
	}

	DefineBody(pluginType, shapeType) {
		const cannon = globalThis.Mikal_Cannon
		const shapeInst = this._inst.GetSdkInstance()
		const wi = this._inst.GetWorldInfo();
		const world = globalThis.Mikal_Cannon_world
		const zHeight = shapeInst._zHeight
		let shape = null
		let angularFactor = new cannon.Vec3(1, 1, 1)
		if (pluginType === "Shape3DPlugin") {
			if (shapeType === 0) {
				shape = new cannon.Box(new cannon.Vec3(wi.GetWidth() / 2, wi.GetHeight() / 2, zHeight/2))
			} else if (shapeType === 1) {
				shape = this._createPrismShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			} else if (shapeType === 2) {
				shape = this._createWedgeShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			} else if (shapeType === 5) {
				shape = this._createCornerInShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			} else if (shapeType === 4) {
				shape = this._createCornerOutShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			}
			// 3DShape can only rotate around z axis
			angularFactor.set(0, 0, 1)
		} else if (pluginType === "3DObjectPlugin") {
			shape = this._create3DObjectShape()
		} else {
			console.error('invalid pluginType', pluginType)
			return null
		}
		const mass = this.immovable ? 0 : this.defaultMass
		const x = wi.GetX()
		const y = wi.GetY()
		const z = wi.GetZElevation()+zHeight/2
		const angle = wi.GetAngle()

		this.lastX = x
		this.lastY = y
		this.lastZ = z
		this.lastZAngle = angle
		const body = new cannon.Body({
			mass: mass,
			position: new cannon.Vec3(x,y,z),
			shape,
			angularFactor: angularFactor,
			type: cannon.Body.DYNAMIC,
		})
		body.quaternion.setFromEuler(0, 0, angle, "ZXY")
		body.linearDamping = world.defaultLinearDamping
		body.angularDamping = world.defaultLinearDamping
		body.uid = this._inst.GetUID()
		body.addEventListener(cannon.Body.COLLIDE_EVENT_NAME, (e) => {
			const otherBody = e.body
			const contact = e.contact
			const target = e.target
			this.collisionData = {body, contact, target}
			this.Trigger(C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnCollision)
		} )

		world.addBody(body)
		return body
}
	_create3DObjectShape() {
		const cannon = globalThis.Mikal_Cannon
		const inst = this._inst.GetSdkInstance()
		const xMinBB = inst.xMinBB
		const xMaxBB = inst.xMaxBB
		// log bbox
		// calculate width, height, depth from xMinBB and xMaxBB 3 element arrays
		const width = xMaxBB[0] -xMinBB[0]
		const height = xMaxBB[1] -xMinBB[1]
		const depth = xMaxBB[2] -xMinBB[2]
		// create cannon box shape
		const shape = new cannon.Box(new cannon.Vec3(width/2, height/2, depth/2))
		return shape
	}

	_createWedgeShape(height, width, depth) {
		const cannon = globalThis.Mikal_Cannon
		const vertices = [
			new cannon.Vec3(0.5,0.5,0.5),
			new cannon.Vec3(0.5,-0.5,0.5),
			new cannon.Vec3(0.5,-0.5,-0.5),
			new cannon.Vec3(0.5,0.5,-0.5),
			new cannon.Vec3(-0.5,-0.5,-0.5),
			new cannon.Vec3(-0.5,0.5,-0.5),
		]
		
		const faces = [
			[1,4,2],
			[0,5,4,1],
			[0,3,5],
			[5,3,2,4],
			[0,1,2,3],	
		]
				
		for (const vertex of vertices) {
			vertex.x = vertex.x * width
			vertex.y = vertex.y * height
			vertex.z = vertex.z * depth		
		}
					
		const wedgeShape = new cannon.ConvexPolyhedron({faces:faces, vertices:vertices})

		return wedgeShape
		
	}

	_createCornerOutShape(height, width, depth) {
		const cannon = globalThis.Mikal_Cannon
		const vertices = [
			new cannon.Vec3(-0.5,-0.5,-0.5),// 0 - - -
			// new cannon.Vec3(-0.5,-0.5,0.5), // 1 - - +
			new cannon.Vec3(-0.5,0.5,-0.5), // 2 - + -
			// new cannon.Vec3(-0.5,0.5,0.5),  // 3 - + +
			new cannon.Vec3(0.5,-0.5,-0.5), // 4 + - -
			new cannon.Vec3(0.5,-0.5,0.5),  // 5 + - +
			new cannon.Vec3(0.5,0.5,-0.5),  // 6 + + -
			// new cannon.Vec3(0.5,0.5,0.5),   // 7 + + +
		]

		// right hand rule CCW
		const faces =[[3,0,2],[3,1,0],[4,1,3],[4,3,2],[4,2,0],[4,0,1]] 
	
		for (const vertex of vertices) {
			vertex.x = vertex.x * width
			vertex.y = vertex.y * height
			vertex.z = vertex.z * depth		
		}
					
		const cornerInShape = new cannon.ConvexPolyhedron({faces:faces, vertices:vertices})

		return cornerInShape
	}

	_createCornerInShape(height, width, depth) {
		const cannon = globalThis.Mikal_Cannon
		const vertices = [
			new cannon.Vec3(-0.5,-0.5,-0.5),// 0 - - -
			new cannon.Vec3(-0.5,-0.5,0.5), // 1 - - +
			new cannon.Vec3(-0.5,0.5,-0.5), // 2 - + -
			// new cannon.Vec3(-0.5,0.5,0.5),  // 3 - + +
			new cannon.Vec3(0.5,-0.5,-0.5), // 4 + - -
			new cannon.Vec3(0.5,-0.5,0.5),  // 5 + - +
			new cannon.Vec3(0.5,0.5,-0.5),  // 6 + + -
			new cannon.Vec3(0.5,0.5,0.5),   // 7 + + +
		]

		const faces =   
			[[4,6,1],[4,1,0],[4,0,3],[4,3,5],[4,5,6],[2,6,5],[2,5,3],[2,3,0],[2,0,1],[2,1,6]] 
	
		for (const vertex of vertices) {
			vertex.x = vertex.x * width
			vertex.y = vertex.y * height
			vertex.z = vertex.z * depth		
		}
					
		const cornerInShape = new cannon.ConvexPolyhedron({faces:faces, vertices:vertices})

		return cornerInShape
	}

	_createPrismShape(height, width, depth) {
		const cannon = globalThis.Mikal_Cannon
		const vertices = [
			new cannon.Vec3(-0.5,-0.5,-0.5),// 0 - - -
			new cannon.Vec3(-0.5,0.0,0.5), // 1 - - +
			new cannon.Vec3(-0.5,0.5,-0.5), // 2 - + -
//			new cannon.Vec3(-0.5,0.5,0.5),  // X - + +
			new cannon.Vec3(0.5,-0.5,-0.5), // 3 + - -
//			new cannon.Vec3(0.5,-0.5,0.5),  // X + - +
			new cannon.Vec3(0.5,0.5,-0.5),  // 4 + + -
			new cannon.Vec3(0.5,0.0,0.5),   // 5 + + +
		]

		const faces =   
			[[2,0,1],[5,1,0,3],[4,2,1,5],[4,5,3],[4,3,0,2]] 
	
		for (const vertex of vertices) {
			vertex.x = vertex.x * width
			vertex.y = vertex.y * height
			vertex.z = vertex.z * depth		
		}
		

		const prismShape = new cannon.ConvexPolyhedron({faces:faces, vertices:vertices})
		return prismShape
	}


	// create cannon-es mesh shape 
	_createMeshShape(worldInfo) {
		const cannon = globalThis.Mikal_Cannon
		// Get instance
		const shapeInst = this._inst.GetSdkInstance()
		// Get world info
		const wi = worldInfo;
		// Get mesh points
		const meshPoints = this._getMeshPoints(wi)
		const vertices = []
		// Create vertices list [x,y,z,x,y,z,...]
		for (const row of meshPoints) {
			for (const point of row) {
				vertices.push(point.x)
				vertices.push(point.y)
				vertices.push(point.z)
			}
		}
		// Create indices list [0,1,2, 1,2,3, ...]
		const indices = []
		for (let r = 0; r < meshPoints.length-1; r++) {
			const row = meshPoints[r]
			for (let p = 0; p < row.length-1; p++) {
				// tri top
				indices.push(p)
				indices.push(p+row.length)
				indices.push(p+row.length+1)
				// tri bottom
				indices.push(p)
				indices.push(p+row.length+1)
				indices.push(p+1)
			}
		}
		const shape = new cannon.Trimesh(vertices, indices)
		return shape
	}

	_getMeshPoints(worldInfo) {
		const cannon = globalThis.Mikal_Cannon
		const wi = worldInfo
		const points = wi?._meshInfo?.transformedMesh?._pts
		const width = wi.GetWidth()
		const height = wi.GetHeight()
		if (!points) return null
		const meshPoints = []
		for (const rows of points) {
			const meshRow = []
			for (const point of rows) {
				const x = point._x * width
				const y = point._y * height
				const z = point._zElevation
				meshRow.push(new cannon.Vec3(x,y,z))
			}
			meshPoints.push(meshRow)
		}
		return meshPoints
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

	_SetWorldGravity (x,y,z) {
		const cannon = globalThis.Mikal_Cannon
		const world = globalThis.Mikal_Cannon_world
		world.gravity = new 
		cannon.Vec3(x, y, z)
	}

	_Raycast(tag, fromX,fromY,fromZ,x,y,z, group, mask, skipBackfaces) {
		// log parameters
		const cannon = globalThis.Mikal_Cannon
		const world = globalThis.Mikal_Cannon_world
		const from = new cannon.Vec3(fromX, fromY, fromZ)
		const to = new cannon.Vec3(x, y, z)
		let dir = to.vsub(from)
		dir.normalize()
		const ray = new cannon.Ray(from,to)
		const options = {mode: cannon.Ray.CLOSEST, skipBackfaces: skipBackfaces, collisionFilterGroup: group, collisionFilterMask: mask}
		const hit = ray.intersectWorld(world, options)
		if (hit) {
			const result = ray.result
			// log result with message
			this.raycastResult = 
			{
				hasHit: result.hasHit,
				hitFaceIndex: result.hitFaceIndex,
				hitPointWorld: result.hitPointWorld.toArray(),
				hitNormalWorld: result.hitNormalWorld.toArray(),
				distance: result.distance,
				hitUID: result.body.uid,
				// shape: result.shape,
				shouldStop: result.shouldStop		
			}
		} else {
			this.raycastResult = null
			// log miss
		}	
	}

	_RaycastResultAsJSON () {
		return JSON.stringify(this.raycastResult)
	}

	_EnablePhysics(enable) {
		this.enable = enable
	}

	_SetDefaultLinearDamping(damping) {
		const world = globalThis.Mikal_Cannon_world
		if (!world) return
		world.defaultLinearDamping = damping
	}

	_SetLinearDamping(damping) {
		if (!this.body) return
		this.body.linearDamping = damping
	}

	_SetAngularDamping(damping) {
		if (!this.body) return
		this.body.angularDamping = damping
	}


	_Enable()
	{
		return this.enable ? 1 : 0
	}

	_WorldGravityX() {
		const world = globalThis.Mikal_Cannon_world
		return world.gravity.x
	}

	_WorldGravityY() {
		const world = globalThis.Mikal_Cannon_world
		return world.gravity.y
	}

	_WorldGravityZ() {
		const world = globalThis.Mikal_Cannon_world
		return world.gravity.z
	}

	_IsEnabled()
	{
		return this.enable
	}

	_IsImmovable()
	{
		return this.immovable
	}

	_SetVelocity(x,y,z) {
		if (!this.body) return
		this.body.velocity.set(x,y,z)
	}

	_SetImmovable(immovable) {
		this.immovable = immovable
		if (!this.body) return
		if (immovable) {
			this.body.mass = 0
			this.body.sleep()
		} else {
			this.body.mass = this.defaultMass
			this.body.wakeUp()
		}
		this.body.updateMassProperties()
	}

	_OnCollision() {
		return true
	}

	_CollisionData () {
		const collisionData = this.collisionData
		const target = collisionData?.target
		const contact = collisionData?.contact
		const result = {
			target: {
				uid: target?.uid,
				id: target?.id,
			},
			contact: {
				ni: contact?.ni?.toArray(),
				ri: contact?.ri?.toArray(),
				rj: contact?.rj?.toArray(),
			}
		}
		return JSON.stringify(result)
	}

	_ApplyImpulse(x,y,z,pointX,pointY,pointZ) {
		if (!this.body) return
		const cannon = globalThis.Mikal_Cannon
		const point = new cannon.Vec3(pointX, pointY, pointZ)
		const impulse = new cannon.Vec3(x, y, z)
		this.body.applyImpulse(impulse, point)
	}

	_SetMass(mass) {
		if (!this.body) return
		this.body.mass = mass
	}

	_SetCollisionFilterGroup(group) {
		if (!this.body) return
		this.body.collisionFilterGroup = group
	}

	_SetCollisionFilterMask(mask) {
		if (!this.body) return
		this.body.collisionFilterMask = mask
	}

	_ApplyForce(x,y,z,pointX,pointY,pointZ) {
		if (!this.body) return
		const cannon = globalThis.Mikal_Cannon
		const point = new cannon.Vec3(pointX, pointY, pointZ)
		const force = new cannon.Vec3(x, y, z)
		this.body.applyForce(force, point)
	}

	_ApplyTorque(x,y,z) {
		if (!this.body) return
		const cannon = globalThis.Mikal_Cannon
		const torque = new cannon.Vec3(x, y, z)
		this.body.applyTorque(torque)
	}

    GetScriptInterfaceClass() {
      return scriptInterface;
    }
  };
}
