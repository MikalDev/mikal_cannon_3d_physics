const suites: any[] = [];

export function registerSuite(name: string, tests: any[]): void {
    suites.push({ name, tests });
}

export function waitTicks(runtime: IRuntime, n: number = 1): Promise<void> {
    return new Promise((resolve) => {
        let remaining = n;
        const handler = () => {
            if (--remaining <= 0) {
                runtime.removeEventListener("tick", handler);
                resolve();
            }
        };
        runtime.addEventListener("tick", handler);
    });
}

export function getPhysics(inst: any): any {
    return inst.behaviors.Rapier3DPhysics;
}

function makeAssert(testName: string) {
    let failed = false;
    const check = (pass: boolean, msg: string) => {
        if (!pass) {
            failed = true;
            console.error(`  FAIL: ${testName} - ${msg}`);
        }
    };
    return {
        get failed() { return failed; },
        ok(value: unknown, msg = "expected truthy") { check(!!value, msg); },
        equal(a: unknown, b: unknown, msg = "") { check(a === b, msg || `expected ${b}, got ${a}`); },
        near(a: number, b: number, tol = 0.01, msg = "") { check(Math.abs(a - b) <= tol, msg || `expected ~${b}, got ${a} (+-${tol})`); },
    };
}

export async function runAllTests(runtime: IRuntime): Promise<void> {
    console.log(`=== Running ${suites.length} suite(s) ===`);
    let passed = 0, failed = 0;

    for (const suite of suites) {
        console.log(`\n--- ${suite.name} ---`);
        for (const test of suite.tests) {
            const assert = makeAssert(test.name);
            try {
                await test.fn(runtime, assert);
            } catch (err: any) {
                console.error(`  FAIL: ${test.name} - threw: ${err.message}`);
                failed++;
                continue;
            }
            if (assert.failed) { failed++; } else { passed++; console.log(`  PASS: ${test.name}`); }
        }
    }

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed === 0) console.log("ALL TESTS PASSED");
}
