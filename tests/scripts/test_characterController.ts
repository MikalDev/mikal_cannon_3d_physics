/**
 * test_characterController.ts — Character controller tests.
 *
 * Required template objects: CCBox (KinematicPosition/Box), DynBox (Dynamic/Box), Ground (Fixed/Box)
 */

import { registerSuite, waitTicks, getPhysics, waitForBody } from "./testRunner.ts";

registerSuite("Character Controller", [
    {
        name: "CC create and move to ground",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);

            // The CCBox body is created asynchronously after its model loads;
            // commands issued before that are buffered, so wait for the body
            // or the grounded read below races the buffered translate.
            const hasBody = await waitForBody(runtime, ccBox);
            assert.ok(hasBody, "CCBox body should exist before creating the controller");

            // offset is in PIXELS (the instance scales it to physics units);
            // 0.01px is a degenerate skin gap, use a few pixels
            phys._CreateCharacterController(
                "cc-test", 5, 0, 0, 1, 60, 60,
                true,       // applyImpulsesToDynamicBodies
                true, 20, 20, true, 10, true
            );
            phys._SetCCMass("cc-test", 50);

            // Move down to land on ground first
            phys._TranslateCharacterController("cc-test", 0, 0, -500);
            await waitTicks(runtime, 10);

            // grounded reflects the LAST computeColliderMovement; settle with
            // a small downward probe like a per-tick gravity step would
            phys._TranslateCharacterController("cc-test", 0, 0, -5);
            await waitTicks(runtime, 5);

            console.log(`[diag] CC z after landing: ${ccBox.z}, ccResults: ${JSON.stringify(phys._ccResults)}`);
            const grounded = phys._CCGrounded();
            assert.equal(grounded, 1, "CC should be grounded");
        },
    },
    {
        name: "CC setup: spawn dynamic boxes around CC",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;

            // Spawn dynamic boxes in a ring around CCBox at ground level
            const offsets = [
                [60, 0], [-60, 0], [0, 60], [0, -60],
                [40, 40], [-40, 40], [40, -40], [-40, -40],
            ];
            for (const [ox, oy] of offsets) {
                const box = runtime.objects.DynBox.createInstance("Layer 0", ccBox.x + ox, ccBox.y + oy);
                box.z = ccBox.z + 15;
            }

            // Let them settle on ground
            await waitTicks(runtime, 30);

            const count = runtime.objects.DynBox.getAllInstances().length;
            assert.ok(count >= 9, `spawned dynamic boxes: ${count} instances`);
        },
    },
    {
        name: "CC walk +X",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);
            const startX = ccBox.x;

            for (let i = 0; i < 15; i++) {
                phys._TranslateCharacterController("cc-test", 5, 0, 0);
                await waitTicks(runtime, 5);
            }

            assert.ok(ccBox.x > startX, `moved +X: start=${startX}, now=${ccBox.x}`);
        },
    },
    {
        name: "CC walk +Y",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);
            const startY = ccBox.y;

            for (let i = 0; i < 15; i++) {
                phys._TranslateCharacterController("cc-test", 0, 5, 0);
                await waitTicks(runtime, 5);
            }

            assert.ok(ccBox.y > startY, `moved +Y: start=${startY}, now=${ccBox.y}`);
        },
    },
    {
        name: "CC walk back to origin",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);
            const startX = ccBox.x;
            const startY = ccBox.y;

            for (let i = 0; i < 15; i++) {
                phys._TranslateCharacterController("cc-test", -5, -5, 0);
                await waitTicks(runtime, 5);
            }

            assert.ok(ccBox.x < startX && ccBox.y < startY, `walked back: (${startX}, ${startY}) -> (${ccBox.x}, ${ccBox.y})`);
        },
    },
    {
        name: "CC push DynBox",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);

            // Spawn a box directly in the CC's +X path (getFirstInstance
            // would return the original DynBox far away from the CC).
            // +100 keeps it clear of the ring boxes at +/-60 — spawning
            // overlapped would let depenetration move it without the CC.
            const target = runtime.objects.DynBox.createInstance("Layer 0", ccBox.x + 100, ccBox.y);
            target.z = ccBox.z;
            const hasBody = await waitForBody(runtime, target);
            assert.ok(hasBody, "push target body should exist");
            await waitTicks(runtime, 20); // let it settle on the ground
            const dynStartX = target.x;

            for (let i = 0; i < 30; i++) {
                phys._TranslateCharacterController("cc-test", 5, 0, 0);
                await waitTicks(runtime, 5);
            }

            // Demand a real shove, not numeric drift
            assert.ok(target.x > dynStartX + 20, `DynBox should be pushed: start=${dynStartX}, now=${target.x}`);
            target.destroy();
        },
    },
    {
        name: "CC cleanup",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);

            phys._RemoveCharacterController("cc-test");
            await waitTicks(runtime, 3);
            assert.ok(true, "CC removed");
        },
    },
]);
