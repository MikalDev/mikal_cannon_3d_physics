const C3 = self.C3;

const BEHAVIOR_INFO = {
    id: "mikal_cannon_3d_physics",
    Acts: {
      "SetWorldGravity": {
            "forward": (inst) => inst._SetWorldGravity,
            
            "autoScriptInterface": true,
            },
"Raycast": {
            "forward": (inst) => inst._Raycast,
            
            "autoScriptInterface": true,
            },
"SetImmovable": {
            "forward": (inst) => inst._SetImmovable,
            
            "autoScriptInterface": true,
            },
"SetDefaultLinearDamping": {
            "forward": (inst) => inst._SetDefaultLinearDamping,
            
            "autoScriptInterface": true,
            },
"SetLinearDamping": {
            "forward": (inst) => inst._SetLinearDamping,
            
            "autoScriptInterface": true,
            },
"SetAngularDamping": {
            "forward": (inst) => inst._SetAngularDamping,
            
            "autoScriptInterface": true,
            },
"SetVelocity": {
            "forward": (inst) => inst._SetVelocity,
            
            "autoScriptInterface": true,
            },
"EnablePhysics": {
            "forward": (inst) => inst._EnablePhysics,
            
            "autoScriptInterface": true,
            },
"ApplyImpulse": {
            "forward": (inst) => inst._ApplyImpulse,
            
            "autoScriptInterface": true,
            },
"SetMass": {
            "forward": (inst) => inst._SetMass,
            
            "autoScriptInterface": true,
            },
"SetCollisionFilterGroup": {
            "forward": (inst) => inst._SetCollisionFilterGroup,
            
            "autoScriptInterface": true,
            },
"SetCollisionFilterMask": {
            "forward": (inst) => inst._SetCollisionFilterMask,
            
            "autoScriptInterface": true,
            },
"ApplyForce": {
            "forward": (inst) => inst._ApplyForce,
            
            "autoScriptInterface": true,
            },
"ApplyTorque": {
            "forward": (inst) => inst._ApplyTorque,
            
            "autoScriptInterface": true,
            }
    },
    Cnds: {
      "IsEnabled": {
            "forward": (inst) => inst._IsEnabled,
            
            "autoScriptInterface": true,
          },
"IsImmovable": {
            "forward": (inst) => inst._IsImmovable,
            
            "autoScriptInterface": true,
          },
"OnCollision": {
            "forward": (inst) => inst._OnCollision,
            
            "autoScriptInterface": true,
          }
    },
    Exps: {
      "RaycastResultAsJSON": {
            "forward": (inst) => inst._RaycastResultAsJSON,
            
            "autoScriptInterface": true,
          },
"Enable": {
            "forward": (inst) => inst._Enable,
            
            "autoScriptInterface": true,
          },
"WorldGravityX": {
            "forward": (inst) => inst._WorldGravityX,
            
            "autoScriptInterface": true,
          },
"WorldGravityY": {
            "forward": (inst) => inst._WorldGravityY,
            
            "autoScriptInterface": true,
          },
"WorldGravityZ": {
            "forward": (inst) => inst._WorldGravityZ,
            
            "autoScriptInterface": true,
          },
"CollisionData": {
            "forward": (inst) => inst._CollisionData,
            
            "autoScriptInterface": true,
          }
    },
  };

const camelCasedMap = new Map();

function camelCasify(str) {
  // If the string is already camelCased, return it
  if (camelCasedMap.has(str)) {
    return camelCasedMap.get(str);
  }
  // Replace any non-valid JavaScript identifier characters with spaces
  let cleanedStr = str.replace(/[^a-zA-Z0-9$_]/g, " ");

  // Split the string on spaces
  let words = cleanedStr.split(" ").filter(Boolean);

  // Capitalize the first letter of each word except for the first one
  for (let i = 1; i < words.length; i++) {
    words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
  }

  // Join the words back together
  let result = words.join("");

  // If the first character is a number, prepend an underscore
  if (!isNaN(parseInt(result.charAt(0)))) {
    result = "_" + result;
  }

  camelCasedMap.set(str, result);

  return result;
}

C3.Behaviors[BEHAVIOR_INFO.id] = class extends C3.SDKBehaviorBase {
  constructor(opts) {
    super(opts);
    this.runtime = opts.runtime;
  }

  Release() {
    super.Release();
  }

  Tick() {
    const tickCount = this.runtime.GetTickCount();
    if (tickCount === this.tickCount) return
    this.tickCount = tickCount
    const dt = this.runtime.GetDt(this._inst)*10;
    const world = globalThis.Mikal_Cannon_world
    if (world) world.step((1 / 60)*10, dt, 3);
    this.runtime.UpdateRender()
  }

};
const B_C = C3.Behaviors[BEHAVIOR_INFO.id];
B_C.Type = class extends C3.SDKBehaviorTypeBase {
  constructor(objectClass) {
    super(objectClass);
    if (globalThis.Mikal_Cannon_world) return
    globalThis.Mikal_Cannon_world = new globalThis.Mikal_Cannon.World();
    const world = globalThis.Mikal_Cannon_world
    // Default gravity
    world.gravity.set(0, 0, -9.82); // m/s²
    world.defaultLinearDamping = 0.1
    console.log('Mikal_Cannon_world', world)
  }

  Tick() {
    const tickCount = this.runtime.GetTickCount();
    if (tickCount === this.tickCount) return
    this.tickCount = tickCount
    const dt = this.runtime.GetDt(this._inst)*10;
    const world = globalThis.Mikal_Cannon_world
    if (world) world.step((1 / 60)*10, dt, 3);
    this.runtime.UpdateRender()
  }

  Release() {
    super.Release();
  }
};

//====== SCRIPT INTERFACE ======
const map = new WeakMap();

function getScriptInterface(parentClass, map) {
  return class extends parentClass {
    constructor() {
      super();
      map.set(this, parentClass._GetInitInst().GetSdkInstance());
    }
  };
}


const scriptInterface = getScriptInterface(self.IBehaviorInstance, map);

// extend script interface with plugin actions
Object.keys(BEHAVIOR_INFO.Acts).forEach((key) => {
  const ace = BEHAVIOR_INFO.Acts[key];
  if (!ace.autoScriptInterface) return;
  scriptInterface.prototype[camelCasify(key)] = function (...args) {
    const sdkInst = map.get(this);
    B_C.Acts[camelCasify(key)].call(sdkInst, ...args);
  };
});

const addonTriggers = [];

// extend script interface with plugin conditions
Object.keys(BEHAVIOR_INFO.Cnds).forEach((key) => {
  const ace = BEHAVIOR_INFO.Cnds[key];
  if (!ace.autoScriptInterface || ace.isStatic || ace.isLooping) return;
  if (ace.isTrigger) {
    scriptInterface.prototype[camelCasify(key)] = function (callback, ...args) {
      const callbackWrapper = () => {
        const sdkInst = map.get(this);
        if (B_C.Cnds[camelCasify(key)].call(sdkInst, ...args)) {
          callback();
        }
      };
      this.addEventListener(key, callbackWrapper, false);
      return () => this.removeEventListener(key, callbackWrapper, false);
    };
  } else {
    scriptInterface.prototype[camelCasify(key)] = function (...args) {
      const sdkInst = map.get(this);
      return B_C.Cnds[camelCasify(key)].call(sdkInst, ...args);
    };
  }
});

// extend script interface with plugin expressions
Object.keys(BEHAVIOR_INFO.Exps).forEach((key) => {
  const ace = BEHAVIOR_INFO.Exps[key];
  if (!ace.autoScriptInterface) return;
  scriptInterface.prototype[camelCasify(key)] = function (...args) {
    const sdkInst = map.get(this);
    return B_C.Exps[camelCasify(key)].call(sdkInst, ...args);
  };
});
//====== SCRIPT INTERFACE ======

//============ ACES ============
B_C.Acts = {};
B_C.Cnds = {};
B_C.Exps = {};
Object.keys(BEHAVIOR_INFO.Acts).forEach((key) => {
  const ace = BEHAVIOR_INFO.Acts[key];
  B_C.Acts[camelCasify(key)] = function (...args) {
    if (ace.forward) ace.forward(this).call(this, ...args);
    else if (ace.handler) ace.handler.call(this, ...args);
  };
});
Object.keys(BEHAVIOR_INFO.Cnds).forEach((key) => {
  const ace = BEHAVIOR_INFO.Cnds[key];
  B_C.Cnds[camelCasify(key)] = function (...args) {
    if (ace.forward) return ace.forward(this).call(this, ...args);
    if (ace.handler) return ace.handler.call(this, ...args);
  };
  if (ace.isTrigger && ace.autoScriptInterface) {
    addonTriggers.push({
      method: B_C.Cnds[camelCasify(key)],
      id: key,
    });
  }
});
Object.keys(BEHAVIOR_INFO.Exps).forEach((key) => {
  const ace = BEHAVIOR_INFO.Exps[key];
  B_C.Exps[camelCasify(key)] = function (...args) {
    if (ace.forward) return ace.forward(this).call(this, ...args);
    if (ace.handler) return ace.handler.call(this, ...args);
  };
});
//============ ACES ============

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

		if (this.pluginType === "3DObject" && !body) {
			return
				const loaded = this._inst.GetSdkInstance().loaded
				if (!loaded) return
				// Get bbox of 3DObject
				console.log('3DObject loaded', loaded)
				const xMinBB = this._inst.GetSdkInstance().xMinBB
				const xMaxBB = this._inst.GetSdkInstance().xMaxBB
				console.log('xMinBB', xMinBB)
				console.log('xMaxBB', xMaxBB)
				const x = xMaxBB[0] -xMinBB[0]
				const y = xMaxBB[1] -xMinBB[1]
				const z = xMaxBB[2] -xMinBB[2]
				// define shape as cannon box
				const cannon = globalThis.Mikal_Cannon
				const shape = new cannon.Box(new cannon.Vec3(1, 1, 1))
				this.body = this.DefineBody(shape)
		}

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
		const pluginType = this._inst.GetPlugin()
		if (pluginType instanceof C3?.Plugins?.Shape3D) {
			this.pluginType = "Shape3DPlugin"
			if (!this.body) {
				const shape = this._inst.GetSdkInstance()._shape
				this.body = this.DefineBody(pluginType, shape)
			}
		} else if (pluginType instanceof C3?.Plugins?.Mikal_3DObject) {
			this.pluginType = "3DObjectPlugin"
			this.body = this.DefineBody(pluginType, null)
		} else {
			this.pluginType = "invalid"
		}
	}

	DefineBody(pluginType, shapeType) {
		const cannon = globalThis.Mikal_Cannon
		const shapeInst = this._inst.GetSdkInstance()
		const wi = this._inst.GetWorldInfo();
		const world = globalThis.Mikal_Cannon_world
		const zHeight = shapeInst._zHeight
		let shape = null
		console.log('shapeType', shapeType, 'this.shape', this.shape)
		let angularFactor = new cannon.Vec3(1, 1, 1)
		if (pluginType instanceof C3?.Plugins?.Shape3D) {
			if (shapeType === 0) {
				shape = new cannon.Box(new cannon.Vec3(wi.GetWidth() / 2, wi.GetHeight() / 2, zHeight/2))
			} else {
				shape = this._createWedgeShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			}
			// 3DShape can only rotate around z axis
			angularFactor.set(0, 0, 1)
		} else if (pluginType instanceof C3?.Plugins?.Mikal_3DObject) {
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
		})
		body.quaternion.setFromEuler(0, 0, angle, "ZXY")
		let quatAngles = new cannon.Vec3()
		body.quaternion.toEuler(quatAngles, "ZYX")
		// body.type = this.immovable ? cannon.Body.STATIC : cannon.Body.DYNAMIC
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
		console.log('xMinBB', xMinBB)
		console.log('xMaxBB', xMaxBB)
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
		console.log('mesh shape', shape)
		return shape
	}

	_getMeshPoints(worldInfo) {
		const cannon = globalThis.Mikal_Cannon
		const wi = worldInfo
		const points = wi?._meshInfo?.transformedMesh?._pts
		const width = wi.GetWidth()
		const height = wi.GetHeight()
		console.log('width', width)
		console.log('height', height)
		console.log('meshInfo', wi?._meshInfo)
		console.log('points', points)
		if (!points) return null
		const meshPoints = []
		for (const rows of points) {
			const meshRow = []
			for (const point of rows) {
				const x = point._x * width
				const y = point._y * height
				const z = point._zElevation
				meshRow.push(new cannon.Vec3(x,y,z))
				if (z > 0) console.log('z', z)
			}
			meshPoints.push(meshRow)
		}
		console.log('meshPoints', meshPoints)
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
		console.log('OnCollision')
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


B_C.Instance = getInstanceJs(
  C3.SDKBehaviorInstanceBase,
  scriptInterface,
  addonTriggers,
  C3
);
