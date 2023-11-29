import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
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
"UpdateHeightfield": {
            "forward": (inst) => inst._UpdateHeightfield,
            
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
            },
"AttachSpring": {
            "forward": (inst) => inst._AttachSpring,
            
            "autoScriptInterface": true,
            },
"EnableDebugRender": {
            "forward": (inst) => inst._EnableDebugRender,
            
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
          },
"OnAnyRaycastResult": {
            "forward": (inst) => inst._OnAnyRaycastResult,
            
            "autoScriptInterface": true,
          },
"OnRaycastResult": {
            "forward": (inst) => inst._OnRaycastResult,
            
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
          },
"VelocityX": {
            "forward": (inst) => inst._VelocityX,
            
            "autoScriptInterface": true,
          },
"VelocityY": {
            "forward": (inst) => inst._VelocityY,
            
            "autoScriptInterface": true,
          },
"VelocityZ": {
            "forward": (inst) => inst._VelocityZ,
            
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
    this.debugRenderWidth = 1
    this.debugRender = false
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
    if (world) world.step() // world.step((1 / 60)*10, dt, 3);

    if (this.debugRender) {
      globalThis.Mikal_Rapier_debug_buffers = world.debugRender();
      globalThis.Mikal_Rapier_debug_buffers.width = this.debugRenderWidth
    } else {
      globalThis.Mikal_Rapier_debug_buffers = null
    }

    this.runtime.UpdateRender()
  }
};
const B_C = C3.Behaviors[BEHAVIOR_INFO.id];
B_C.Type = class extends C3.SDKBehaviorTypeBase {
  constructor(objectClass) {
    super(objectClass);
    if (globalThis.Mikal_Cannon_world) return
      RAPIER.init().then(() => {
      // Use the RAPIER module here.
      let gravity = { x: 0.0, y: 0.0, z: -90.81 };
      globalThis.Mikal_Cannon_world = new RAPIER.World(gravity)
      globalThis.Mikal_Rapier = RAPIER
    });
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
		this.shapeProperty = properties[2];
      }
      this._StartTicking2()
      this.defaultMass = 1
      this.body = null
	  this.shapePositionOffset = null
	  this.offsetPosition = null
	  this.shapeAngleOffset = null
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
				this.body = this.DefineBody(this.pluginType, this.shapeProperty)
				this._inst.GetSdkInstance()._setCannonBody(this.body, true)
		}

		if (!body) return
		if (!this.enable) return

		const CannonPhysics = this._behaviorType._behavior

		const shapeInst = this._inst.GetSdkInstance()
		let zHeight = shapeInst._zHeight
		if (!zHeight) zHeight = 0


		const wi = this._inst.GetWorldInfo();
		if (this.lastZ !== wi.GetZElevation()) {
			// body.position.z = wi.GetZElevation()+body.shapes[0].halfExtents.z
			const position = body.translation();
			body.setTranslation({ x: position.x, y: position.y, z:wi.GetZElevation()+zHeight/2}, true);
		}

		if (this.lastZAngle !== wi.GetAngle()) {
			const angle = wi.GetAngle()
			const angles = new globalThis.Mikal_Cannon.Vec3()
			const quat = gloalThis.glMatrix.quat
			const rotate = quatFromEuler(quat.create(), 0, 0, angle)
			body.setRotation({ x: rotate[0], y: rotate[1], z: rotate[2], w: rotate[3] }, true)
			if (this.rotate3D) this.rotate3D._zAngle = angle * 180 / Math.PI
		}

		/*
		if (this.lastX !== wi.GetX()) {
			body.position.x = wi.GetX()
		}

		if (this.lastY !== wi.GetY()) {
			body.position.y = wi.GetY()
		}

		if (this.lastZAngle !== wi.GetAngle()) {
			const angle = wi.GetAngle()
			const angles = new globalThis.Mikal_Cannon.Vec3()
			// body.quaternion.toEuler(angles, "ZYX")
			// body.quaternion.setFromEuler(angle.x, angle.y, angle, "ZXY")
			body.quaternion.setFromEuler(0, 0, angle, "ZXY")
			if (this.rotate3D) this.rotate3D._zAngle = angle * 180 / Math.PI
		}
		*/
		
		CannonPhysics.Tick()

		// const position = body.position
		const position = body.translation();
		const quatRot = body.rotation()

		wi.SetX(position.x)
		wi.SetY(position.y)
		if (this.pluginType == "3DObjectPlugin") {
			wi.SetZElevation(position.z)
		} else {
			wi.SetZElevation(position.z-zHeight/2)
		}
		// angle
	if (this.rotate3D) {
			this.rotate3D._useQuaternion = true
			this.rotate3D._quaternion = [quatRot.x, quatRot.y, quatRot.z, quatRot.w]
		} else {
			const quat = globalThis.glMatrix.quat
			const zRot = quat.fromValues(quatRot.x, quatRot.y, quatRot.z, quatRot.w)
			const angles = this._quaternionToEuler(zRot)
			const angle = angles[2]
			wi.SetAngle(angle)
		}

		this.lastX = wi.GetX()
		this.lastY = wi.GetY()
		this.lastZ = wi.GetZElevation()
		this.lastZAngle = wi.GetAngle()

		wi.SetBboxChanged();
	}

	PostCreate() {
		this.rotate3D = this._Behavior3DRotate()
		const pluginType = this._inst.GetPlugin()
		if (C3?.Plugins?.Shape3D && pluginType instanceof C3?.Plugins?.Shape3D) {
			this.pluginType = "Shape3DPlugin"
			if (!this.body) {
				const shape = this._inst.GetSdkInstance()._shape
				this.body = this.DefineBody(this.pluginType, shape)
			}
		} else if (C3?.Plugins?.Sprite && pluginType instanceof C3?.Plugins?.Sprite) {
			this.pluginType = "SpritePlugin"
			this.body = this.DefineBody(this.pluginType, null);
		} else if (C3?.Plugins?.Mikal_3DObject && pluginType instanceof C3?.Plugins?.Mikal_3DObject) {
			this.pluginType = "3DObjectPlugin"
		} else {
			this.pluginType = "invalid"
			console.error('invalid pluginType', pluginType)
		}
	}

	DefineBody(pluginType, shapeType) {
		const cannon = globalThis.Mikal_Cannon
		const shapeInst = this._inst.GetSdkInstance()
		const wi = this._inst.GetWorldInfo();
		const world = globalThis.Mikal_Cannon_world
		let zHeight = shapeInst._zHeight
		if (!zHeight) zHeight = 0
		let shape = null
		const enableRot = [true, true, true]
		if (pluginType === "Shape3DPlugin") {
			if (shapeType === 0) {
				// shape = new cannon.Box(new cannon.Vec3(wi.GetWidth() / 2, wi.GetHeight() / 2, zHeight/2))		  
				// Create a cuboid collider attached to the dynamic rigidBody.
				shape = RAPIER.ColliderDesc.cuboid(wi.GetWidth() / 2, wi.GetHeight() / 2, zHeight/2);
			} else if (shapeType === 1) {
				shape = this._createPrismShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			} else if (shapeType === 2) {
				shape = this._createWedgeShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			} else if (shapeType === 3) {
				shape = this._createPyramidShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			} else if (shapeType === 5) {
				shape = this._createCornerInShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			} else if (shapeType === 4) {
				shape = this._createCornerOutShape(wi.GetHeight(), wi.GetWidth(), zHeight)
			}
			// 3DShape can only rotate around z axis
			if (!this.rotate3D) {
				enableRot[0] = false
				enableRot[1] = false
			}
		} else if (pluginType === "3DObjectPlugin") {
			shape = this._create3DObjectShape(this.shapeProperty)
		} else if (pluginType === "SpritePlugin") {
			const width = wi.GetWidth()
			const height = wi.GetHeight()
			const offsetX = width/2
			const offsetY = height/2
			this.shapePositionOffset = new cannon.Vec3(-offsetX, (offsetY), 0)
			this.shapeAngleOffset = new cannon.Quaternion()
			this.shapeAngleOffset.setFromEuler(0, 0, -90*Math.PI/180, "ZXY")
			shape = this._createMeshShape(wi)
		} else {
			console.error('invalid pluginType', pluginType)
			return null
		}
		const mass = this.immovable ? 0 : this.defaultMass
		const x = wi.GetX()
		const y = wi.GetY()
		const z = wi.GetZElevation()+zHeight/2
		let angleX = 0
		let angleY = 0
		let angleZ = wi.GetAngle()

		this.lastX = x
		this.lastY = y
		this.lastZ = z
		this.lastZAngle = angleZ
		this.lastYAngle = angleY
		this.lastXAngle = angleX

		const position = new cannon.Vec3(x,y,z)

		    // Create a dynamic rigid-body.
		let rigidBodyDesc = null
		if (this.immovable) {
			rigidBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
		} else {
			rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z);
		}
    	const body = world.createRigidBody(rigidBodyDesc);
		body.setEnabledRotations(enableRot[0],enableRot[1],enableRot[2],true)
    	const collider = world.createCollider(shape, body);
		
		return body
		/*
		const body = new cannon.Body({
			mass: mass,
			position: position,
			angularFactor: angularFactor,
			type: cannon.Body.DYNAMIC,
		})
		
		if (this.shapePositionOffset) {
			body.addShape(shape, this.shapePositionOffset, this.shapeAngleOffset)
		} else {
			body.addShape(shape)
		}

		if (this.rotate3D) {
			angleX = this.rotate3D._xAngle * Math.PI / 180
			angleY = this.rotate3D._yAngle * Math.PI / 180
			this.rotate3D._zAngle = angleZ * 180 / Math.PI
			// angleZ = this.rotate3D._zAngle * Math.PI / 180
		}

		body.quaternion.setFromEuler(angleX, angleY, angleZ, "ZXY")
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

		body.springs = new Map();

		world.addBody(body)
		return body
		*/
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
		const cannon = globalThis.Mikal_Cannon
		const inst = this._inst.GetSdkInstance()
		const xMinBB = inst.xMinBB
		const xMaxBB = inst.xMaxBB
		const x = xMaxBB[0] -xMinBB[0]
		const y = xMaxBB[1] -xMinBB[1]
		const z = xMaxBB[2] -xMinBB[2]
		let shape = null
		// define shape
		switch (shapeProperty) {
			case 0:
			case 1:
				shape = new cannon.Box(new cannon.Vec3(x/2, y/2, z/2))
				break;
			case 2:
				shape = new cannon.Sphere(x/2)
				break
			case 3: 
				// 12 segments
				shape = new cannon.Cylinder(x/2, x/2, z, 12)
				break
			default:
				console.error('invalid shape', this.shape)
				return
		}
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

	_createPyramidShape(height, width, depth) {
		const cannon = globalThis.Mikal_Cannon
		const vertices = [
			new cannon.Vec3(-0.5,-0.5,-0.5),// 0 - - -
			new cannon.Vec3(-0.5,0.0,0.5), // 1 - - +
			new cannon.Vec3(-0.5,0.5,-0.5), // 2 - + -
//			new cannon.Vec3(-0.5,0.5,0.5),  // X - + +
			new cannon.Vec3(0.5,-0.5,-0.5), // 3 + - -
//			new cannon.Vec3(0.5,-0.5,0.5),  // X + - +
			new cannon.Vec3(0.5,0.5,-0.5),  // 4 + + -
			new cannon.Vec3(0.0,0.0,0.5),   // 5 + + +
		]

		const faces =   
			[[2,0,5],[5,0,3],[4,2,5],[4,5,3],[4,3,0,2]] 
	
		for (const vertex of vertices) {
			vertex.x = vertex.x * width
			vertex.y = vertex.y * height
			vertex.z = vertex.z * depth		
		}
		

		const prismShape = new cannon.ConvexPolyhedron({faces:faces, vertices:vertices})
		return prismShape
	}

	_createMeshPointsForSprite(worldInfo) {
		const wi = worldInfo
		// create 2x2 grid of points for sprite
		// 2d array of points
		// use worldinfo width and height and zElevation
		// All should have same zElevation
		// 0,0,0 is top left of sprite mesh
		const width = wi.GetWidth()
		const height = wi.GetHeight()
		const zElevation = wi.GetZElevation()
		const xMin = 0
		const xMax = width
		const yMin = 0
		const yMax = height
		const xStep = width
		const yStep = height
		const meshPoints = []
		for (let y = yMin; y <= yMax; y+=yStep) {
			const row = []
			for (let x = xMin; x <= xMax; x+=xStep) {
				const point = new globalThis.Mikal_Cannon.Vec3(x,y,0)
				row.push(point)
			}
			meshPoints.push(row)
		}
		return meshPoints
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
		this._createMeshPointsForSprite(wi)
		const vertices = []
		// Create vertices list [x,y,z,x,y,z,...]
		for (const row of meshPoints) {
			for (const point of row) {
				vertices.push(point)
			}
		}

		const gridWidth = meshPoints[0].length
		const gridHeight = meshPoints.length

		// Check if square grid, if not console.warn and return null
		if (gridWidth !== gridHeight) {
			console.warn('Mesh must be a square grid')
			return null
		}

		// Get delta X and Y from first two vertices
		const deltaX = Math.abs(vertices[1].x - vertices[0].x)
		const deltaY = Math.abs(vertices[1].y - vertices[0].y)

		// Create two dimensional heightfield array using only z values from vertices
		const heightfield = new Array(meshPoints.length).fill(0).map(() => new Array(meshPoints[0].length).fill(0))
		let index = meshPoints.length-1
		for (const row of meshPoints) {
			let index2 = 0
			for (const point of row) {
				heightfield[index][index2] = point.z
				index2++
			}
			index--
		}
		
		// Create heightfield shape
		const shape = new cannon.Heightfield(heightfield, {
			elementSize: deltaX,
		})

		return shape
	}

	_getMeshPoints(worldInfo) {
		const cannon = globalThis.Mikal_Cannon
		const wi = worldInfo
		const points = wi?._meshInfo?.sourceMesh?._pts
		if (!points) return this._createMeshPointsForSprite(wi)
		const width = wi.GetWidth()
		const height = wi.GetHeight()
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

	_Behavior3DRotate() {
		const inst = this._inst
		const rotate3D = inst.GetBehaviorSdkInstanceFromCtor(C3.Behaviors.mikal_rotate_shape)
		if (!rotate3D) return null
		return rotate3D
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

	_Raycast(tag, fromX,fromY,fromZ,x,y,z, group, mask, skipBackfaces, mode) {
		// log parameters
		const rapier = globalThis.Mikal_Rapier
		const world = globalThis.Mikal_Cannon_world
		const vec3 = globalThis.glMatrix.vec3
		const from = vec3.fromValues(fromX, fromY, fromZ)
		const to = vec3.fromValues(x, y, z)
		let maxToi = vec3.distance(from, to)
		vec3.sub(to, to, from)
		vec3.normalize(to,to)
		const ray = new rapier.Ray({x:from[0], y:from[1], z:from[2]}, {x:to[0], y:to[1], z:to[2]})
		maxToi = maxToi/vec3.length(to)
		const solid = skipBackfaces ? false : true
		const callback = (result) => {
			if (result === null) {
				this.raycastResult =
				{
					hasHit: false,
					hitFaceIndex: 0,
					hitPointWorld: [0,0,0],
					hitNormalWorld: [0,0,0],
					distance: 0,
					hitUID: 0,
					shouldStop: false,
					tag,
				}
				this.Trigger(C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult)
				this.Trigger(C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult)
				return
			}
			// log result with message
			const hitPointWorld = ray.pointAt(result.toi)
			this.raycastResult = 
			{
				hasHit: true,
				hitFaceIndex: 0,
				// origin + dir * toi
				hitPointWorld: [hitPointWorld.x, hitPointWorld.y, hitPointWorld.z],
				hitNormalWorld: [result.normal.x, result.normal.y, result.normal.z],
				distance: vec3.distance(from, [hitPointWorld.x, hitPointWorld.y, hitPointWorld.z]),
				hitUID: result.collider.parent.uid,
				shouldStop: false,
				tag,
			}
			this.Trigger(C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnAnyRaycastResult)
			this.Trigger(C3.Behaviors.mikal_cannon_3d_physics.Cnds.OnRaycastResult)
			return true
		}

		// const hit = world.castRayAndGetNormal(ray, maxToi, solid)
		const hit = world.castRayAndGetNormal(ray, maxToi*100, true)
		// Log results and parameters
		callback(hit)
	}



	_RaycastResultAsJSON () {
		return JSON.stringify(this.raycastResult)
	}

	_OnAnyRaycastResult() {
		return true
	}

	_OnRaycastResult(tag) {
		return this.raycastResult.tag === tag
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
		// this.body.applyImpulse(impulse, point)
		this.body.applyImpulseAtPoint({ x: x, y: y, z: z }, { x: pointX, y: pointY, z: pointZ }, true);
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

	_AttachSpring(tag, otherUID, restLength, stiffness, damping, x, y, z, otherX, otherY, otherZ ) {
		if (!this.body) return
		const cannon = globalThis.Mikal_Cannon
		const world = globalThis.Mikal_Cannon_world
		const otherBody = world.bodies.find((body) => body.uid === otherUID)
		if (!otherBody) return
		const localPivot = new cannon.Vec3(x, y, z)
		const otherLocalPivot = new cannon.Vec3(otherX, otherY, otherZ)
		const spring = new cannon.Spring(this.body, otherBody, {localPivotA: localPivot, localPivotB: otherLocalPivot, restLength, stiffness, damping})
		this.body.springs.set(tag, spring)
	}

	_VelocityX() {
		if (!this.body) return 0
		return this.body.velocity.x
	}

	_VelocityY() {
		if (!this.body) return 0
		return this.body.velocity.y
	}

	_VelocityZ() {
		if (!this.body) return 0
		return this.body.velocity.z
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
		const behavior = this._behaviorType._behavior
		behavior.debugRender = enable
		behavior.debugRenderWidth = width
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
