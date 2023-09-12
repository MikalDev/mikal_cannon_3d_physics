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
"ApplyImpulse": {
            "forward": (inst) => inst._ApplyImpulse,
            
            "autoScriptInterface": true,
            },
"SetImmovable": {
            "forward": (inst) => inst._SetImmovable,
            
            "autoScriptInterface": true,
            },
"EnablePhysics": {
            "forward": (inst) => inst._EnablePhysics,
            
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

  OnCreate() {}

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


B_C.Instance = getInstanceJs(
  C3.SDKBehaviorInstanceBase,
  scriptInterface,
  addonTriggers,
  C3
);
