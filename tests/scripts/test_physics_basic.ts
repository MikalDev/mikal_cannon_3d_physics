import { registerSuite, waitTicks, getPhysics } from "./testRunner.ts";

registerSuite("Basic Physics", [
    {
        name: "DynBox has physics behavior",
        fn: async (runtime, assert) => {
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            assert.ok(dynBox, "DynBox instance exists");
            const phys = getPhysics(dynBox);
            assert.ok(phys, "physics behavior is attached");
        },
    },
    {
        name: "DynBox is resting on Ground",
        fn: async (runtime, assert) => {
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const z = dynBox.z;
            // By the time tests run, box should have settled on ground
            assert.ok(z > -60, `DynBox should be above ground, z=${z}`);
            assert.ok(z < 200, `DynBox should not be flying, z=${z}`);
        },
    },
    {
        name: "Ground is fixed and does not move",
        fn: async (runtime, assert) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            assert.ok(ground, "Ground instance exists");
            const startZ = ground.z;

            await waitTicks(runtime, 10);

            const endZ = ground.z;
            assert.equal(endZ, startZ, "Ground z should not change");
        },
    },
    {
        name: "DynBox responds to impulse",
        fn: async (runtime, assert) => {
            const dynBox = runtime.objects.DynBox.getFirstInstance()!;
            const phys = getPhysics(dynBox);
            const startX = dynBox.x;
            const startY = dynBox.y;

            // Apply impulse along X and Y
            phys._ApplyImpulse(5, 5, 0);

            await waitTicks(runtime, 15);

            const newX = dynBox.x;
            const newY = dynBox.y;
            assert.ok(newX !== startX, `DynBox should move in X: start=${startX}, now=${newX}`);
            assert.ok(newY !== startY, `DynBox should move in Y: start=${startY}, now=${newY}`);
        },
    },
]);
