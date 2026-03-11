console.log("=== Physics Addon Test Runner loaded ===");

interface TestResult {
    testName: string;
    pass: boolean;
    msg: string;
}

interface Assert {
    ok(value: unknown, msg?: string): void;
    equal(a: unknown, b: unknown, msg?: string): void;
    near(a: number, b: number, tolerance?: number, msg?: string): void;
}

interface Test {
    name: string;
    fn: (runtime: IRuntime, assert: Assert) => Promise<void>;
}

interface Suite {
    name: string;
    tests: Test[];
}

const allSuites: Suite[] = [];

export function registerSuite(name: string, tests: Test[]): void {
    allSuites.push({ name, tests });
}

export function waitTicks(runtime: IRuntime, n: number = 1): Promise<void> {
    return new Promise((resolve) => {
        let remaining = n;
        const handler = () => {
            remaining--;
            if (remaining <= 0) {
                runtime.removeEventListener("tick", handler);
                resolve();
            }
        };
        runtime.addEventListener("tick", handler);
    });
}

export function getPhysics(inst: any): any {
    return (inst as any).behaviors.Rapier3DPhysics;
}

function createAssert(testName: string, results: TestResult[]): Assert {
    return {
        ok(value: unknown, msg: string = "") {
            const pass = !!value;
            results.push({ testName, pass, msg: msg || "ok" });
            if (!pass) console.error(`  FAIL: ${testName} - ${msg}`);
        },
        equal(a: unknown, b: unknown, msg: string = "") {
            const pass = a === b;
            const detail = msg || `expected ${b}, got ${a}`;
            results.push({ testName, pass, msg: detail });
            if (!pass) console.error(`  FAIL: ${testName} - ${detail}`);
        },
        near(a: number, b: number, tolerance: number = 0.01, msg: string = "") {
            const pass = Math.abs(a - b) <= tolerance;
            const detail = msg || `expected ~${b}, got ${a} (+-${tolerance})`;
            results.push({ testName, pass, msg: detail });
            if (!pass) console.error(`  FAIL: ${testName} - ${detail}`);
        },
    };
}

export async function runAllTests(runtime: IRuntime): Promise<void> {
    console.log(`Running ${allSuites.length} suite(s)...`);
    const results: TestResult[] = [];

    for (const suite of allSuites) {
        console.log(`\n--- ${suite.name} ---`);
        for (const test of suite.tests) {
            const testResults: TestResult[] = [];
            const assert = createAssert(test.name, testResults);
            try {
                await test.fn(runtime, assert);
            } catch (err: any) {
                testResults.push({ testName: test.name, pass: false, msg: `threw: ${err.message}` });
            }
            results.push(...testResults);
            if (testResults.every((r) => r.pass)) {
                console.log(`  PASS: ${test.name}`);
            } else {
                console.error(`  FAIL: ${test.name}`);
            }
        }
    }

    // Count per test (not per assertion)
    const testNames = new Set(results.map((r) => r.testName));
    let totalPass = 0;
    let totalFail = 0;
    for (const name of testNames) {
        const testResults = results.filter((r) => r.testName === name);
        if (testResults.every((r) => r.pass)) totalPass++;
        else totalFail++;
    }

    console.log(`\n=== Results: ${totalPass} passed, ${totalFail} failed (${results.length} assertions) ===`);
    if (totalFail === 0) console.log("ALL TESTS PASSED");
}
