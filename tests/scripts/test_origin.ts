/**
 * test_origin.ts — r489 origin & box semantics (2.37.0).
 *
 * Verifies the origin-aware transform pair with a NON-middle origin (the
 * offset term is zero for middle origins, so the other suites don't
 * exercise it), and that model scale is visual-only after body creation.
 *
 * Required template objects: Ground (Fixed/Box), DynBox (Dynamic/Box)
 */
import { registerSuite, waitTicks, getPhysics, topZ } from "./testRunner.ts";

function spawnDynBox(runtime: IRuntime, x: number, y: number, z: number): any {
    const inst = runtime.objects.DynBox.createInstance(0, x, y);
    inst.z = z;
    return inst;
}

registerSuite("Origin & Box Semantics", [
    {
        name: "back-origin box rests with inst.z at its bottom face",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const groundTop = topZ(ground);

            const backBox = spawnDynBox(runtime, ground.x - 100, ground.y, groundTop + 100);
            backBox.setOrigin3d(0.5, 0.5, 0); // back/bottom — before body creation
            const midBox = spawnDynBox(runtime, ground.x + 100, ground.y, groundTop + 100);

            await waitTicks(runtime, 90); // settle on the ground

            // Back origin: inst.z is the bottom face, which rests on the ground.
            assert.near(backBox.z, groundTop, 10, `back-origin box z (${backBox.z}) should equal ground top (${groundTop})`);
            // Middle origin: inst.z is the center, half the depth higher.
            assert.near(midBox.z, groundTop + midBox.depth / 2, 10, `middle-origin box z (${midBox.z}) should be ground top + depth/2`);

            backBox.destroy();
            midBox.destroy();
        },
    },
    {
        name: "model scale set after creation does not move the physics body",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const groundTop = topZ(ground);

            const scaled = spawnDynBox(runtime, ground.x - 50, ground.y + 100, groundTop + 80);
            const plain = spawnDynBox(runtime, ground.x + 50, ground.y + 100, groundTop + 80);
            await waitTicks(runtime, 10); // bodies created

            // Visual-only transform: must not affect the physics box
            scaled.scaleZ = 3;

            await waitTicks(runtime, 90); // settle

            assert.near(scaled.z, plain.z, 5, `scaled box rests at ${scaled.z}, plain at ${plain.z} — model scale must not affect physics`);

            scaled.destroy();
            plain.destroy();
        },
    },
]);
