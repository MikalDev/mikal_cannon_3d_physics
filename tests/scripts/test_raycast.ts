/**
 * test_raycast.ts — Raycast expressions, miss reporting, self-exclusion.
 *
 * Required template objects: Ground (Fixed/Box), DynBox (Dynamic/Box)
 *
 * NOTE: _Raycast always excludes the casting instance (2.36.0 self-exclusion),
 * so probes aimed at the Ground are cast from DynBox's behavior.
 */
import { registerSuite, waitTicks, getPhysics, topZ } from "./testRunner.ts";

registerSuite("Raycast", [
    {
        name: "downward ray hits ground and fills hit expressions",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const phys = getPhysics(dynBox);
            await waitTicks(runtime, 3);

            // From well above the ground straight down through its center
            phys._Raycast("rc_hit", ground.x, ground.y, 500, ground.x, ground.y, -500, "0xffff", "0xffff", false, 0);
            await waitTicks(runtime, 3);

            const groundTop = topZ(ground);
            assert.equal(phys._RaycastHasHit("rc_hit"), 1, "ray should hit");
            assert.equal(phys._RaycastHitUID("rc_hit"), ground.uid, "should hit the Ground");
            assert.ok(phys._RaycastDistance("rc_hit") > 0, "distance should be positive");
            assert.near(phys._RaycastHitPointZ("rc_hit"), groundTop, 10, `hit point z near ground top (${groundTop})`);
            assert.near(phys._RaycastHitNormalZ("rc_hit"), 1, 0.1, "normal should point up");
            assert.ok(phys._RaycastSequence("rc_hit") > 0, "sequence should be set");
        },
    },
    {
        name: "miss is reported with hasHit 0 and a sequence",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const phys = getPhysics(ground);

            // Straight up into empty space
            phys._Raycast("rc_miss", 0, 0, 500, 0, 0, 2000, "0xffff", "0xffff", false, 0);
            await waitTicks(runtime, 3);

            assert.equal(phys._RaycastHasHit("rc_miss"), 0, "ray should miss");
            assert.equal(phys._RaycastHitUID("rc_miss"), -1, "hitUID should be -1 on miss");
            assert.equal(phys._RaycastDistance("rc_miss"), 0, "distance should be 0 on miss");
            assert.ok(phys._RaycastSequence("rc_miss") > 0, "miss results still carry a sequence");
        },
    },
    {
        name: "raycast excludes the casting instance",
        fn: async (runtime: IRuntime, assert: any) => {
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const phys = getPhysics(dynBox);
            await waitTicks(runtime, 3);

            // Cast from inside DynBox straight down; without self-exclusion
            // this would hit DynBox itself
            phys._Raycast("rc_self", dynBox.x, dynBox.y, dynBox.z, dynBox.x, dynBox.y, dynBox.z - 500, "0xffff", "0xffff", false, 0);
            await waitTicks(runtime, 3);

            assert.equal(phys._RaycastHasHit("rc_self"), 1, "ray should hit something below");
            assert.ok(phys._RaycastHitUID("rc_self") !== dynBox.uid, "ray must not hit the casting instance");
        },
    },
    {
        name: "repeated raycasts update every tick (sequence increments)",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const phys = getPhysics(dynBox);

            phys._Raycast("rc_seq", ground.x, ground.y, 500, ground.x, ground.y, -500, "0xffff", "0xffff", false, 0);
            await waitTicks(runtime, 2);
            const seq1 = phys._RaycastSequence("rc_seq");
            phys._Raycast("rc_seq", ground.x, ground.y, 500, ground.x, ground.y, -500, "0xffff", "0xffff", false, 0);
            await waitTicks(runtime, 2);
            const seq2 = phys._RaycastSequence("rc_seq");

            assert.ok(seq1 > 0, "first sequence set");
            assert.ok(seq2 > seq1, `sequence should increase: ${seq1} -> ${seq2}`);
        },
    },
]);
