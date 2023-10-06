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

		if (!body) return
		if (!this.enable) return

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
		
		const CannonPhysics = this._behaviorType._behavior
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
		if (!this.body) {
			const shape = this._inst.GetSdkInstance()._shape
			this.body = this.DefineBody(shape)
		}
	}

  DefineBody(shapeType) {
    const cannon = globalThis.Mikal_Cannon
    const shapeInst = this._inst.GetSdkInstance()
    const wi = this._inst.GetWorldInfo();
    const world = globalThis.Mikal_Cannon_world
    const zHeight = shapeInst._zHeight
	let shape = null
	if (shapeType === 0) {
    	shape = new cannon.Box(new cannon.Vec3(wi.GetWidth() / 2, wi.GetHeight() / 2, zHeight/2))
	} else {
		shape = this._createWedgeShape(wi.GetHeight(), wi.GetWidth(), zHeight)
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
      angularFactor: new cannon.Vec3(0, 0, 1),
    })
	body.quaternion.setFromEuler(0, 0, angle, "ZXY")
	let quatAngles = new cannon.Vec3()
	body.quaternion.toEuler(quatAngles, "ZYX")
    // body.type = this.immovable ? cannon.Body.STATIC : cannon.Body.DYNAMIC
    body.linearDamping = world.defaultLinearDamping
    body.angularDamping = world.defaultLinearDamping
	body.uid = this._inst.GetUID()
    world.addBody(body)
    return body
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

    Trigger(method) {
      super.Trigger(method);
      const addonTrigger = addonTriggers.find((x) => x.method === method);
      if (addonTrigger) {
        this.GetScriptInterface().dispatchEvent(new C3.Event(addonTrigger.id));
      }
    }

	_SetWorldGravity (x,y,z) {
		const cannon = globalThis.Mikal_Cannon
		const world = globalThis.Mikal_Cannon_world
		world.gravity = new 
		cannon.Vec3(x, y, z)
	}

	_Raycast(tag, fromX,fromY,fromZ,x,y,z) {
		// log parameters
		const cannon = globalThis.Mikal_Cannon
		const world = globalThis.Mikal_Cannon_world
		const from = new cannon.Vec3(fromX, fromY, fromZ)
		const to = new cannon.Vec3(x, y, z)
		let dir = to.vsub(from)
		dir.normalize()
		const ray = new cannon.Ray(from,to)
		const options = {mode: cannon.Ray.CLOSEST, skipBackfaces: true}
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

	_ApplyImpulse(x, y, z) {
		if (!this.body) return
		const cannon = globalThis.Mikal_Cannon
		this.body.applyImpulse(new cannon.Vec3(x, y, z))
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

    GetScriptInterfaceClass() {
      return scriptInterface;
    }
  };
}
