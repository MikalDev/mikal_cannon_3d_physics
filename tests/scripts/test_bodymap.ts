/**
 * test_bodymap.ts — persistent body-map rows (perf change in behavior.js
 * updateBodies): rows are created once per body and mutated in place each
 * frame; rows of removed bodies are pruned via frame stamp.
 *
 * Required template objects: Ground (Fixed/Box), DynBox (Dynamic/Box)
 */
import { registerSuite, waitTicks, getPhysics, waitForBody } from "./testRunner.ts";

function bodyMap(): Map<number, any> {
    return (globalThis as any).Mikal_Rapier_Bodies;
}

function spawnDynBox(runtime: IRuntime, x: number, y: number, z: number): any {
    const inst = runtime.objects.DynBox.createInstance(0, x, y);
    inst.z = z;
    return inst;
}

registerSuite("Body Map", [
    {
        name: "map object is reused across frames (not rebuilt)",
        fn: async (runtime: IRuntime, assert: any) => {
            await waitTicks(runtime, 3); // ensure at least one batch arrived
            const mapBefore = bodyMap();
            assert.ok(mapBefore instanceof Map, "body map exists");
            await waitTicks(runtime, 5);
            assert.ok(bodyMap() === mapBefore, "map identity must be stable across frames");
        },
    },
    {
        name: "rows are persistent objects mutated in place",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            // Spawn high so it is guaranteed to still be falling while we sample
            const box = spawnDynBox(runtime, ground.x, ground.y - 200, 400);
            const hasBody = await waitForBody(runtime, box);
            assert.ok(hasBody, "box body created");

            const row = bodyMap().get(box.uid);
            assert.ok(row, "row exists");
            const rowTranslation = row.translation;
            const z1 = row.translation.z;

            await waitTicks(runtime, 10);

            const rowAgain = bodyMap().get(box.uid);
            assert.ok(rowAgain === row, "row must be the SAME object across frames");
            assert.ok(rowAgain.translation === rowTranslation, "nested translation object must also be reused");
            assert.ok(rowAgain.translation.z < z1, `translation must update in place while falling: ${z1} -> ${rowAgain.translation.z}`);

            box.destroy();
        },
    },
    {
        name: "rows of destroyed bodies are pruned",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const box = spawnDynBox(runtime, ground.x, ground.y - 200, 100);
            const hasBody = await waitForBody(runtime, box);
            assert.ok(hasBody, "box body created");
            const uid = box.uid;

            box.destroy();
            await waitTicks(runtime, 5);

            assert.ok(bodyMap().get(uid) === undefined, "destroyed body's row must be removed from the map");
            // And the sweep must not have taken healthy rows with it
            assert.ok(bodyMap().get(ground.uid), "surviving bodies keep their rows after the prune sweep");
        },
    },
    {
        name: "row survives a body replacement (box resize recreate)",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const box = spawnDynBox(runtime, ground.x, ground.y - 200, 100);
            const hasBody = await waitForBody(runtime, box);
            assert.ok(hasBody, "box body created");

            // Trigger the box-resize watch: scaling resizes the box, which
            // recreates the body under the same uid
            box.scaleZ = 2;
            await waitTicks(runtime, 10);

            const row = bodyMap().get(box.uid);
            assert.ok(row, "row still present after body recreation");
            assert.ok(row.mass !== undefined && row.bodyType === 0, "row carries live data for the replacement body (bodyType dynamic)");

            box.destroy();
        },
    },
]);
