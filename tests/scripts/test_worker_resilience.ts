/**
 * test_worker_resilience.ts — a throwing worker command must not kill the
 * rest of the command batch (phase 1 of the hardening pass).
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
        name: "command after a throwing command still applies",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const victim = spawnDynBox(runtime, ground.x - 80, ground.y + 200, 100);
            const probe = spawnDynBox(runtime, ground.x + 80, ground.y + 200, 100);
            assert.ok(await waitForBody(runtime, victim), "victim body created");
            assert.ok(await waitForBody(runtime, probe), "probe body created");
            await waitTicks(runtime, 30); // settle

            const phys = getPhysics(probe);
            const startX = probe.x;

            // Malformed command FIRST (no impulse field -> throws inside the
            // worker's Rapier glue), then a valid impulse in the SAME batch.
            // Without per-command isolation the throw kills the batch and the
            // probe never moves.
            phys.PhysicsType.commands.push({
                type: phys.CommandType.ApplyImpulse,
                uid: victim.uid,
            });
            phys._ApplyImpulse(8, 0, 0);

            await waitTicks(runtime, 20);

            assert.ok(Math.abs(probe.x - startX) > 2, `valid command after the throwing one must still apply: x ${startX} -> ${probe.x}`);

            victim.destroy();
            probe.destroy();
        },
    },
    {
        name: "physics keeps stepping normally after the bad command",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const box = spawnDynBox(runtime, ground.x, ground.y + 200, 200);
            assert.ok(await waitForBody(runtime, box), "box body created");

            const z1 = box.z;
            await waitTicks(runtime, 10);
            assert.ok(box.z < z1, `world still simulates after the throwing command: z ${z1} -> ${box.z}`);

            box.destroy();
        },
    },
]);
