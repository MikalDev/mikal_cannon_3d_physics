/**
 * test_compound_actions.ts — per-collider actions must cover the colliders
 * merged onto a compound body (phase 3 of the hardening pass).
 *
 * Adversarial setup: pre-fix, Set Mass and Set Collision Groups only touched
 * collider(0), so the merged helper collider kept its creation-time mass and
 * groups.
 *
 * Required template objects: Ground (Fixed/Box), DynBox (Dynamic/Box)
 */
import { registerSuite, waitTicks, getPhysics, waitForBody } from "./testRunner.ts";

function spawnDynBox(runtime: IRuntime, x: number, y: number, z: number): any {
    const inst = runtime.objects.DynBox.createInstance(0, x, y);
    inst.z = z;
    return inst;
}

async function buildCompound(runtime: IRuntime, assert: any, x: number, y: number, tag: string) {
    const parent = spawnDynBox(runtime, x, y, -10);
    const target = spawnDynBox(runtime, x + 60, y, -10);
    const helper = spawnDynBox(runtime, x, y + 40, -10);
    assert.ok(await waitForBody(runtime, parent), "parent body created");
    assert.ok(await waitForBody(runtime, target), "target body created");
    assert.ok(await waitForBody(runtime, helper), "helper body created");

    getPhysics(helper).compoundColliderTag = tag;
    getPhysics(parent)._AddRevoluteJoint(0, 0, 0, 0, 0, 0, 0, 0, 1, target.uid, false, tag);
    await waitTicks(runtime, 10); // merge + settle

    assert.ok(getPhysics(helper)._compoundHelperDisabled, "helper merged into the parent");
    return { parent, target, helper };
}

registerSuite("Compound Actions", [
    {
        name: "Set Mass sets the compound body TOTAL mass",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const { parent, target, helper } = await buildCompound(runtime, assert, ground.x - 200, ground.y + 150, "grpA");
            const phys = getPhysics(parent);

            phys._SetMass(10);
            await waitTicks(runtime, 5);

            // _Mass() reads the body total from the worker batch. Pre-fix only
            // collider(0) changed, so the total was 10 + helper mass.
            const total = phys._Mass();
            assert.near(total, 10, 0.5, `compound body total mass must equal the requested mass: ${total}`);

            helper.destroy();
            parent.destroy();
            target.destroy();
        },
    },
    {
        name: "Set Collision Groups covers the merged helper collider",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground = runtime.objects.Ground.getFirstInstance()!;
            const { parent, target, helper } = await buildCompound(runtime, assert, ground.x + 200, ground.y + 150, "grpB");
            const phys = getPhysics(parent);

            // Move the whole body into membership 0x0002
            phys._SetCollisionGroups("0x0002", "0xFFFF");
            await waitTicks(runtime, 5);

            // Ray filtered to 0x0001, aimed straight down through the HELPER
            // part of the compound. Pre-fix the merged collider kept its
            // default membership and caught this ray; post-fix the ray passes
            // through and hits the ground below.
            const probe = runtime.objects.DynBox.getFirstInstance()!;
            const probePhys = getPhysics(probe);
            probePhys._Raycast("cmp_groups", helper.x, helper.y, 500, helper.x, helper.y, -500, "0x0001", "0xffff", false, 0);
            await waitTicks(runtime, 3);

            assert.equal(probePhys._RaycastHasHit("cmp_groups"), 1, "ray should hit something (the ground)");
            assert.ok(probePhys._RaycastHitUID("cmp_groups") !== parent.uid, "filtered ray must NOT hit the regrouped compound collider");
            assert.equal(probePhys._RaycastHitUID("cmp_groups"), ground.uid, "filtered ray passes the compound and hits the ground");

            helper.destroy();
            parent.destroy();
            target.destroy();
        },
    },
]);
