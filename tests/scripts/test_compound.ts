/**
 * test_compound.ts — Compound colliders attached via revolute joint group tag.
 *
 * Required template objects: DynBox (Dynamic/Box), Ground (Fixed/Box)
 * Spawns extra DynBox instances at runtime and tags them via the behavior's
 * compoundColliderTag property.
 */
import { registerSuite, waitTicks, getPhysics } from "./testRunner.ts";

function spawnDynBox(runtime: IRuntime, x: number, y: number, z: number): any {
    const inst = runtime.objects.DynBox.createInstance(0, x, y);
    inst.z = z;
    return inst;
}

registerSuite("Compound Colliders", [
    {
        name: "tagged helper merges into joint body and follows it",
        fn: async (runtime: IRuntime, assert: any) => {
            const parent = spawnDynBox(runtime, 0, 600, 200);
            const target = spawnDynBox(runtime, 60, 600, 200);
            const helper = spawnDynBox(runtime, 0, 640, 200);
            await waitTicks(runtime, 5);

            const physParent = getPhysics(parent);
            const physHelper = getPhysics(helper);

            // Tag the helper at runtime (normally set in the editor property)
            physHelper.compoundColliderTag = "grp1";

            // Record the helper's offset relative to the parent
            const offsetBefore = { x: helper.x - parent.x, y: helper.y - parent.y };

            physParent._AddRevoluteJoint(0, 0, 0, 0, 0, 0, 0, 0, 1, target.uid, false, "grp1");
            await waitTicks(runtime, 5);

            assert.ok(physHelper._compoundHelperDisabled, "helper body should be disabled");

            // Push the parent; the helper must follow, keeping its offset
            physParent._ApplyImpulse(50, 0, 0);
            await waitTicks(runtime, 20);

            const offsetAfter = { x: helper.x - parent.x, y: helper.y - parent.y };
            assert.near(offsetAfter.x, offsetBefore.x, 20, `helper keeps x offset: ${offsetBefore.x} -> ${offsetAfter.x}`);
            assert.near(offsetAfter.y, offsetBefore.y, 20, `helper keeps y offset: ${offsetBefore.y} -> ${offsetAfter.y}`);
        },
    },
    {
        name: "untagged instances are not collected",
        fn: async (runtime: IRuntime, assert: any) => {
            const parent = spawnDynBox(runtime, 0, -600, 200);
            const target = spawnDynBox(runtime, 60, -600, 200);
            const bystander = spawnDynBox(runtime, 0, -640, 200);
            await waitTicks(runtime, 5);

            const physParent = getPhysics(parent);
            const physBystander = getPhysics(bystander);

            physParent._AddRevoluteJoint(0, 0, 0, 0, 0, 0, 0, 0, 1, target.uid, false, "grp2");
            await waitTicks(runtime, 5);

            assert.ok(!physBystander._compoundHelperDisabled, "untagged instance keeps its own body");
            assert.ok(physBystander.bodyDefined, "untagged instance body still defined");
        },
    },
]);
