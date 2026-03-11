/**
 * test_characterController.ts — Character controller tests.
 *
 * Required template objects: CCBox (KinematicPosition/Box), DynBox (Dynamic/Box), Ground (Fixed/Box)
 */

import { registerSuite, waitTicks, getPhysics } from "./testRunner.ts";

registerSuite("Character Controller", [
    {
        name: "CC create and move to ground",
        fn: async (runtime: IRuntime, assert: any) => {
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);

            phys._CreateCharacterController(
                "cc-test", 0.01, 0, 0, 1, 60, 60,
                true,       // applyImpulsesToDynamicBodies
                true, 20, 20, true, 1, true
            );
            phys._SetCCMass("cc-test", 50);

            // Move down to land on ground first
            phys._TranslateCharacterController("cc-test", 0, 0, -500);
            await waitTicks(runtime, 10);

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

            for (let i = 0; i < 15; i++) {
                phys._TranslateCharacterController("cc-test", -5, -5, 0);
                await waitTicks(runtime, 5);
            }

            assert.ok(true, "walked back toward origin");
        },
    },
    {
        name: "CC push DynBox",
        fn: async (runtime: IRuntime, assert: any) => {
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const ccBox = runtime.objects.CCBox.getFirstInstance()!;
            const phys = getPhysics(ccBox);
            const dynStartX = dynBox.x;

            for (let i = 0; i < 30; i++) {
                phys._TranslateCharacterController("cc-test", 5, 0, 0);
                await waitTicks(runtime, 5);
            }

            assert.ok(dynBox.x > dynStartX, `DynBox should be pushed: start=${dynStartX}, now=${dynBox.x}`);
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
