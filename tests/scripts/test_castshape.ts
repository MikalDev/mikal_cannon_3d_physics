/**
 * test_castshape.ts — Shape cast alignment with raycast: scalar fields,
 * miss data, endpoint behavior, rotated-shape casts.
 *
 * Required template objects: Ground (Fixed/Box), DynBox (Dynamic/Box)
 *
 * NOTE: _CastShape's excludeUID -1 means "exclude self", so probes aimed at
 * the Ground are cast from DynBox's behavior.
 */
import { registerSuite, waitTicks, getPhysics, topZ } from "./testRunner.ts";

registerSuite("Shape Cast", [
    {
        name: "downward box cast hits ground with scalar fields",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const phys = getPhysics(dynBox);
            await waitTicks(runtime, 3);

            // Box shape, no rotation, from above the ground straight down.
            // maxToI 1 = cast exactly to the endpoint.
            phys._CastShape("cs_hit", 0, 30, 30, 30, 0, 0, 0, ground.x, ground.y, 500, ground.x, ground.y, -200, 1, 1, "0xffff", -1, true);
            await waitTicks(runtime, 3);

            const result = JSON.parse(phys._CastShapeResultAsJSON("cs_hit"));
            assert.ok(result.hasHit, "cast should hit the ground");
            assert.equal(result.hitUID, ground.uid, "should hit the Ground");
            assert.ok(result.distance > 0, "distance should be positive");
            assert.ok(typeof result.hitPointZ === "number", "scalar hitPointZ present");
            assert.ok(typeof result.witness1Z === "number", "scalar witness1Z present");
            assert.ok(typeof result.normal1Z === "number", "scalar normal1Z present");
            assert.ok(result.sequence > 0, "sequence should be set");
        },
    },
    {
        name: "miss returns full default result with sequence",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const phys = getPhysics(ground);

            // Cast upward into empty space
            phys._CastShape("cs_miss", 0, 30, 30, 30, 0, 0, 0, 0, 0, 500, 0, 0, 2000, 1, 1, "0xffff", -1, true);
            await waitTicks(runtime, 3);

            const result = JSON.parse(phys._CastShapeResultAsJSON("cs_miss"));
            assert.equal(result.hasHit, false, "cast should miss");
            assert.equal(result.hitUID, -1, "hitUID should be -1 on miss");
            assert.equal(result.distance, 0, "distance should be 0 on miss");
            assert.ok(result.sequence > 0, "miss results still carry a sequence");
        },
    },
    {
        name: "zero-distance cast stores an immediate miss",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const phys = getPhysics(ground);

            phys._CastShape("cs_zero", 0, 30, 30, 30, 0, 0, 0, 100, 100, 100, 100, 100, 100, 1, 1, "0xffff", -1, true);
            // No worker round-trip needed; result is stored synchronously
            const result = JSON.parse(phys._CastShapeResultAsJSON("cs_zero"));
            assert.equal(result.hasHit, false, "zero-distance cast should miss");
            assert.equal(result.hitUID, -1, "hitUID should be -1");
        },
    },
    {
        name: "rotated shape cast returns a result (quaternion fix)",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const phys = getPhysics(dynBox);

            // 45-degree rotated box cast straight down; with the old broken
            // quaternion argument order this produced garbage orientations
            phys._CastShape("cs_rot", 0, 30, 30, 30, 45, 45, 45, ground.x, ground.y, 500, ground.x, ground.y, -200, 1, 1, "0xffff", -1, true);
            await waitTicks(runtime, 3);

            const groundTop = topZ(ground);
            const result = JSON.parse(phys._CastShapeResultAsJSON("cs_rot"));
            assert.ok(result.hasHit, "rotated cast should still hit the ground");
            // Hit point should be near the ground top, allowing for the
            // rotated box's diagonal half-extent
            assert.ok(result.hitPointZ > groundTop - 40 && result.hitPointZ < groundTop + 40, `hit point z plausible: ${result.hitPointZ} (ground top ${groundTop})`);
        },
    },
]);
