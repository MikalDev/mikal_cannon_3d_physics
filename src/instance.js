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
		if (!this.body) {
			this.body = this.DefineBody()
		}

		const CannonPhysics = this._behaviorType._behavior
		CannonPhysics.Tick()

		if (!this.enable) return

		const wi = this._inst.GetWorldInfo();
		const body = this.body

		wi.SetX(body.position.x)
		wi.SetY(body.position.y)
		wi.SetZElevation(body.position.z-body.shapes[0].halfExtents.z)
		// angle
		const quat = this.body.quaternion
		const angles = new globalThis.Mikal_Cannon.Vec3()
		quat.toEuler(angles)
		const angle = angles.z
		wi.SetAngle(angle)
		wi.SetBboxChanged();
	}

    Trigger(method) {
      super.Trigger(method);
      const addonTrigger = addonTriggers.find((x) => x.method === method);
      if (addonTrigger) {
        this.GetScriptInterface().dispatchEvent(new C3.Event(addonTrigger.id));
      }
    }

    DefineBody() {
			const cannon = globalThis.Mikal_Cannon
			const shapeInst = this._inst.GetSdkInstance()
			const wi = this._inst.GetWorldInfo();
			const world = globalThis.Mikal_Cannon_world
			const zHeight = shapeInst._zHeight
			const shape = new cannon.Box(new cannon.Vec3(wi.GetWidth() / 2, wi.GetHeight() / 2, zHeight/2))
			const mass = this.immovable ? 0 : this.defaultMass
			const body = new cannon.Body({
				mass: mass,
				position: new cannon.Vec3(wi.GetX(), wi.GetY(), wi.GetZElevation()+zHeight/2),
				shape,
				angularFactor: new cannon.Vec3(0, 0, 1),
			})
			// body.type = this.immovable ? cannon.Body.STATIC : cannon.Body.DYNAMIC
			const damping = 0.1
			body.linearDamping = damping
			body.angularDamping = damping
			world.addBody(body)
			return body
	}

	_SetWorldGravity (x,y,z) {
		const cannon = globalThis.Mikal_Cannon
		const world = globalThis.Mikal_Cannon_world
		world.gravity = new 
		cannon.Vec3(x, y, z)
	}

	_Raycast(tag, fromX,fromY,fromZ,x,y,z) {
		// log parameters
		console.log(tag, fromX,fromY,fromZ,x,y,z)
		const cannon = globalThis.Mikal_Cannon
		const world = globalThis.Mikal_Cannon_world
		const from = new cannon.Vec3(fromX, fromY, fromZ)
		const to = new cannon.Vec3(x, y, z)
		const ray = new cannon.Ray(from,to)
		const options = {mode: cannon.Ray.CLOSEST, skipBackfaces: true}
		console.log(tag, ray, options)
		const hit = ray.intersectWorld(world, options)
		if (hit) {
			const result = ray.result
			// log result with message
			console.log(tag, result)
			this.raycastResult = 
			{
				hasHit: result.hasHit,
				hitFaceIndex: result.hitFaceIndex,
				hitPointWorld: result.hitPointWorld.toArray(),
				hitNormalWorld: result.hitNormalWorld.toArray(),
				distance: result.distance,
				// shape: result.shape,
				shouldStop: result.shouldStop		
			}
			console.log(JSON.stringify(this.raycastResult))
		} else {
			this.raycastResult = null
			// log miss
			console.log(tag, 'miss')
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

    GetScriptInterfaceClass() {
      return scriptInterface;
    }
  };
}
