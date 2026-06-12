/**
 * test_aa_diagnostics.ts — TEMPORARY diagnostic suite for the ground-collider
 * failures. Named "aa" so it runs before the other suites mutate the world.
 * Casts from DynBox's behavior: _Raycast self-excludes, so probing the Ground
 * from the Ground's own behavior would always miss.
 */
import { registerSuite, waitTicks, getPhysics } from "./testRunner.ts";

registerSuite("AA Diagnostics", [
    {
        name: "dump Ground/DynBox instance and body state",
        fn: async (runtime: IRuntime, assert: any) => {
            await waitTicks(runtime, 5);

            for (const objName of ["Ground", "DynBox"] as const) {
                const inst: any = (runtime.objects as any)[objName].getFirstInstance();
                console.log(`[diag] ${objName} uid=${inst.uid}`);
                console.log(`[diag]   x=${inst.x} y=${inst.y} z=${inst.z}`);
                console.log(`[diag]   width=${inst.width} height=${inst.height} depth=${inst.depth}`);
                console.log(`[diag]   scaleX=${inst.scaleX} scaleY=${inst.scaleY} scaleZ=${inst.scaleZ} (typeof scaleX: ${typeof inst.scaleX})`);
                // r489: per-instance Z origin and 3D origin accessors
                console.log(`[diag]   originZ=${inst.originZ} getOrigin3d=${JSON.stringify(typeof inst.getOrigin3d === "function" ? inst.getOrigin3d() : "n/a")}`);
                console.log(`[diag]   model originX/Y/Z=${inst.originX}/${inst.originY}/${inst.originZ} transformMode=${(inst as any).transformMode ?? "n/a"}`);

                const body = (globalThis as any).Mikal_Rapier_Bodies?.get(inst.uid);
                if (body) {
                    console.log(`[diag]   body: translation=(${body.translation?.x}, ${body.translation?.y}, ${body.translation?.z}) bodyType=${body.bodyType} mass=${body.mass}`);
                } else {
                    console.log(`[diag]   body: NO ROW in Mikal_Rapier_Bodies (body not created)`);
                }
                assert.ok(body, `${objName} should have a physics body row`);
            }
        },
    },
    {
        name: "probe Ground extent with rays cast from DynBox",
        fn: async (runtime: IRuntime, assert: any) => {
            const ground: any = (runtime.objects as any).Ground.getFirstInstance();
            const dynBox: any = (runtime.objects as any).DynBox.getFirstInstance();
            const phys = getPhysics(dynBox);

            // Straight down through the Ground instance's own center
            phys._Raycast("diag_center", ground.x, ground.y, 500, ground.x, ground.y, -500, "0xffff", "0xffff", false, 0);
            // 300px to the side: inside a 1000px scaled ground, outside a 100px one
            phys._Raycast("diag_edge", ground.x - 300, ground.y, 500, ground.x - 300, ground.y, -500, "0xffff", "0xffff", false, 0);
            // The original failing probe at layout origin
            phys._Raycast("diag_origin", 0, 0, 500, 0, 0, -500, "0xffff", "0xffff", false, 0);
            await waitTicks(runtime, 3);

            for (const tag of ["diag_center", "diag_edge", "diag_origin"]) {
                console.log(`[diag] ray ${tag}: hasHit=${phys._RaycastHasHit(tag)} hitUID=${phys._RaycastHitUID(tag)} hitZ=${phys._RaycastHitPointZ(tag)} dist=${phys._RaycastDistance(tag)}`);
            }
            console.log(`[diag] => center=1,edge=1,origin=1: ground scaled OK | center=1,edge=0: ground body UNSCALED | center=0: ground body missing or displaced`);
            assert.ok(true, "diagnostic only");
        },
    },
]);
