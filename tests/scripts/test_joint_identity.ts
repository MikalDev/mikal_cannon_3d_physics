/**
 * test_joint_identity.ts — joints are identified by (body pair, type), so a
 * revolute and a spring can coexist between the same two bodies (phase 2 of
 * the hardening pass).
 *
 * Adversarial setup: under the 2.36.x per-pair registry, the spring
 * overwrote the revolute and SetRevoluteMotor called configureMotorVelocity
 * on the spring — which throws and killed the frame's command batch.
 *
 * Required template objects: DynBox (Dynamic/Box)
 */
import { registerSuite, waitTicks, getPhysics, waitForBody } from "./testRunner.ts";

function spawnDynBox(runtime: IRuntime, x: number, y: number, z: number): any {
    const inst = runtime.objects.DynBox.createInstance(0, x, y);
    inst.z = z;
    return inst;
}

registerSuite("Joint Identity", [
    {
        name: "revolute + spring on the same pair: motor drives the revolute",
        fn: async (runtime: IRuntime, assert: any) => {
            const a = spawnDynBox(runtime, -300, -100, 300);
            const b = spawnDynBox(runtime, -260, -100, 300);
            assert.ok(await waitForBody(runtime, a), "a body created");
            assert.ok(await waitForBody(runtime, b), "b body created");

            const physA = getPhysics(a);
            // Revolute first, then spring on the SAME pair (the overwrite case)
            physA._AddRevoluteJoint(0, 0, 0, 0, 0, 0, 0, 0, 1, b.uid, false, "");
            physA._AttachSpring("s1", b.uid, 40, 100, 5, 0, 0, 0, 0, 0, 0);
            await waitTicks(runtime, 5);

            physA._SetRevoluteMotor(b.uid, 5, 50);
            await waitTicks(runtime, 20);

            const angVel = Math.abs(physA._AngularVelocityZ());
            assert.ok(angVel > 0.1, `motor must drive the revolute despite the spring on the same pair: angularVelocityZ=${angVel}`);

            // And the command stream must still be alive afterwards
            const probe = spawnDynBox(runtime, -300, -100, 500);
            assert.ok(await waitForBody(runtime, probe), "probe body created");
            const probeStartX = probe.x;
            getPhysics(probe)._ApplyImpulse(8, 0, 0);
            await waitTicks(runtime, 15);
            assert.ok(Math.abs(probe.x - probeStartX) > 2, "commands still apply after motoring a multi-joint pair");

            probe.destroy();
            a.destroy();
            b.destroy();
        },
    },
    {
        name: "queued motor command waits for ITS joint type",
        fn: async (runtime: IRuntime, assert: any) => {
            const a = spawnDynBox(runtime, -300, -160, 300);
            const b = spawnDynBox(runtime, -260, -160, 300);
            assert.ok(await waitForBody(runtime, a), "a body created");
            assert.ok(await waitForBody(runtime, b), "b body created");

            const physA = getPhysics(a);
            // Motor command BEFORE any joint exists -> queues under "revolute"
            physA._SetRevoluteMotor(b.uid, 5, 50);
            await waitTicks(runtime, 2);

            // Spring created first: under the old per-pair queue this REPLAYED
            // the motor onto the spring (throw, motor lost). Typed queues must
            // leave it pending.
            physA._AttachSpring("s2", b.uid, 40, 100, 5, 0, 0, 0, 0, 0, 0);
            await waitTicks(runtime, 10);
            const angVelSpringOnly = Math.abs(physA._AngularVelocityZ());
            assert.ok(angVelSpringOnly < 0.05, `no spin while only the spring exists (motor still queued): ${angVelSpringOnly}`);

            // Revolute created: the queued motor must now replay onto it
            physA._AddRevoluteJoint(0, 0, 0, 0, 0, 0, 0, 0, 1, b.uid, false, "");
            await waitTicks(runtime, 20);
            const angVel = Math.abs(physA._AngularVelocityZ());
            assert.ok(angVel > 0.1, `queued motor replays when the revolute is created: angularVelocityZ=${angVel}`);

            a.destroy();
            b.destroy();
        },
    },
]);
