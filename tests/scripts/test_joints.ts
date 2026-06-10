/**
 * test_joints.ts — Fixed/rope/prismatic/revolute joints, JointExists/JointType,
 * command buffering (motor before joint, joint before target body).
 *
 * Required template objects: DynBox (Dynamic/Box), Ground (Fixed/Box)
 * Spawns extra DynBox instances at runtime.
 */
import { registerSuite, waitTicks, getPhysics } from "./testRunner.ts";

function spawnDynBox(runtime: IRuntime, x: number, y: number, z: number): any {
    const inst = runtime.objects.DynBox.createInstance(0, x, y);
    inst.z = z;
    return inst;
}

registerSuite("Joints", [
    {
        name: "fixed joint locks two dynamic bodies together",
        fn: async (runtime: IRuntime, assert: any) => {
            const a = spawnDynBox(runtime, -300, -300, 200);
            const b = spawnDynBox(runtime, -260, -300, 200);
            await waitTicks(runtime, 5);

            const physA = getPhysics(a);
            physA._AddFixedJoint(0, 0, 0, 0, 0, 0, b.uid, false, true, true);
            await waitTicks(runtime, 5);

            const gapBefore = Math.abs(a.x - b.x);
            physA._ApplyImpulse(40, 0, 20);
            await waitTicks(runtime, 20);
            const gapAfter = Math.abs(a.x - b.x);

            assert.near(gapAfter, gapBefore, 15, `bodies should keep their spacing: ${gapBefore} -> ${gapAfter}`);
            assert.equal(physA._JointExists(b.uid), 1, "JointExists should be 1");
            assert.equal(physA._JointType(b.uid), "fixed", "JointType should be fixed");
        },
    },
    {
        name: "rope joint limits separation",
        fn: async (runtime: IRuntime, assert: any) => {
            const a = spawnDynBox(runtime, 300, -300, 200);
            const b = spawnDynBox(runtime, 340, -300, 200);
            await waitTicks(runtime, 5);

            const physA = getPhysics(a);
            physA._AddRopeJoint(80, 0, 0, 0, 0, 0, 0, b.uid, false, true);
            await waitTicks(runtime, 5);

            // Yank one body away hard; the rope should keep them within
            // roughly the rope length
            physA._ApplyImpulse(-80, 0, 0);
            await waitTicks(runtime, 30);

            const separation = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
            assert.ok(separation < 150, `rope should cap separation, got ${separation}`);
            assert.equal(physA._JointType(b.uid), "rope", "JointType should be rope");
        },
    },
    {
        name: "revolute motor command issued before joint creation still applies",
        fn: async (runtime: IRuntime, assert: any) => {
            const a = spawnDynBox(runtime, -300, 300, 200);
            const b = spawnDynBox(runtime, -260, 300, 200);
            await waitTicks(runtime, 5);

            const physA = getPhysics(a);
            // Motor BEFORE the joint exists - should queue, then replay when
            // the joint is created
            physA._SetRevoluteMotor(b.uid, 5, 50);
            await waitTicks(runtime, 2);
            physA._AddRevoluteJoint(0, 0, 0, 0, 0, 0, 0, 0, 1, b.uid, false, "");
            await waitTicks(runtime, 20);

            const angVel = Math.abs(physA._AngularVelocityZ());
            assert.ok(angVel > 0.1, `motor should spin the body, angularVelocityZ=${angVel}`);
            assert.equal(physA._JointType(b.uid), "revolute", "JointType should be revolute");
        },
    },
    {
        name: "spring joint pulls bodies toward rest length",
        fn: async (runtime: IRuntime, assert: any) => {
            const a = spawnDynBox(runtime, 300, 300, 200);
            const b = spawnDynBox(runtime, 500, 300, 200);
            await waitTicks(runtime, 5);

            const physA = getPhysics(a);
            const before = Math.abs(a.x - b.x);
            // Stiff spring with short rest length pulls them together
            physA._AttachSpring("spr", b.uid, 20, 200, 10, 0, 0, 0, 0, 0, 0);
            await waitTicks(runtime, 40);
            const after = Math.abs(a.x - b.x);

            assert.ok(after < before - 20, `spring should pull bodies together: ${before} -> ${after}`);
            assert.equal(physA._JointType(b.uid), "spring", "JointType should be spring");
        },
    },
    {
        name: "JointExists is 0 for unrelated uid",
        fn: async (runtime: IRuntime, assert: any) => {
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const phys = getPhysics(dynBox);
            assert.equal(phys._JointExists(99999), 0, "no joint to unknown uid");
            assert.equal(phys._JointType(99999), "", "empty type for unknown uid");
        },
    },
]);
