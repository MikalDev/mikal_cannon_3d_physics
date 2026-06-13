/**
 * test_worker_resilience.ts — bad commands must be contained: garbage vector
 * inputs are rejected before the WASM boundary (NaN poisoning panics Rapier
 * inside a LATER step, killing the world), and a throwing handler must not
 * take the rest of the frame's command batch with it.
 *
 * Required template objects: Ground (Fixed/Box), DynBox (Dynamic/Box)
 */
import { registerSuite, waitTicks, getPhysics, waitForBody } from "./testRunner.ts";

function spawnDynBox(runtime: IRuntime, x: number, y: number, z: number): any {
    const inst = runtime.objects.DynBox.createInstance(0, x, y);
    inst.z = z;
    return inst;
}

registerSuite("Worker Resilience", [
    {
        name: "commands after malformed commands still apply",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const victim = spawnDynBox(runtime, ground.x - 80, ground.y + 200, 100);
            const probe = spawnDynBox(runtime, ground.x + 80, ground.y + 200, 100);
            assert.ok(await waitForBody(runtime, victim), "victim body created");
            assert.ok(await waitForBody(runtime, probe), "probe body created");
            await waitTicks(runtime, 30); // settle

            const phys = getPhysics(probe);
            const startX = probe.x;

            // 1) Garbage impulse (no vector): input validation must reject it
            //    before the WASM boundary
            phys.PhysicsType.commands.push({
                type: phys.CommandType.ApplyImpulse,
                uid: victim.uid,
            });
            // 2) Joint creation with missing anchors: throws inside the
            //    handler; the per-command try/catch must contain it
            phys.PhysicsType.commands.push({
                type: phys.CommandType.AddRevoluteJoint,
                uid: victim.uid,
                targetUID: probe.uid,
            });
            // 3) A valid command in the SAME batch must still apply
            phys._ApplyImpulse(8, 0, 0);

            await waitTicks(runtime, 20);

            assert.ok(Math.abs(probe.x - startX) > 2, `valid command after the malformed ones must still apply: x ${startX} -> ${probe.x}`);

            victim.destroy();
            probe.destroy();
        },
    },
    {
        name: "physics keeps stepping normally after the bad commands",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const box = spawnDynBox(runtime, ground.x, ground.y + 200, 200);
            assert.ok(await waitForBody(runtime, box), "box body created");

            const z1 = box.z;
            await waitTicks(runtime, 10);
            assert.ok(box.z < z1, `world still simulates after the bad commands: z ${z1} -> ${box.z}`);

            box.destroy();
        },
    },
]);
