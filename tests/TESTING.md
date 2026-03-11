# Integration Testing Guide

This test system injects JavaScript test scripts into a Construct 3 project template, producing a `.c3p` you open in C3 to run tests.

## Quick Start

```bash
npm run test:build       # inject scripts into template → tests/output/test-project.c3p
```

Then open `tests/output/test-project.c3p` in Construct 3 and preview. Check the browser console for results.

---

## Folder Structure

```
tests/
├── buildTestProject.js   # Build script — injects tests into template
├── template.c3p          # C3 project template (YOU create this, see below)
├── TESTING.md            # This file
├── scripts/              # Test scripts (injected into .c3p at scripts/ root)
│   ├── testRunner.js     # Test harness — entry point
│   ├── test_characterController.js
│   └── test_<feature>.js # Add more test files here
└── output/               # Generated (gitignored)
    └── test-project.c3p
```

All scripts are injected into the `.c3p` at the `scripts/` root (no subfolder). This means imports between test files use `"./filename.js"` with no path prefix.

---

## Creating the Template Project (template.c3p)

Open Construct 3 and create a new empty project. Set it up as follows:

### Project Settings
- **Name:** `PhysicsTestProject`
- **Scripts type:** Module (Project properties → Advanced → Scripts type → "Module")
- **Viewport:** 1280×720
- **Z axis scale:** Regular

### Required Objects

Create these objects on Layout 1. Each needs the **Cannon 3D Physics** behavior attached.

| Object Name | Type    | Physics Body Type      | Shape | Position        | Size          | Notes                     |
|-------------|---------|------------------------|-------|-----------------|---------------|---------------------------|
| `Ground`    | 3DShape | Fixed                  | Box   | (0, 0, z=-100) | 2000×2000×100 | Large flat surface        |
| `CCBox`     | 3DShape | Kinematic (position)   | Box   | (0, 0, z=100)  | 30×30×30      | Character controller test |
| `DynBox`    | 3DShape | Dynamic                | Box   | (200, 0, z=100) | 30×30×30     | Dynamic body tests        |
| `Sensor`    | 3DShape | Fixed (sensor=true)    | Box   | (400, 0, z=50) | 50×50×50      | Sensor/trigger tests      |

> **Important:** Set Shape to "Box" explicitly for all 3DShape objects. "Auto" does not work with 3DShape.

### Required Event Sheet

On **Event Sheet 1**, add one event:

- **Condition:** System → On start of layout
- **Action:** Add a **Script** action with this code:

```javascript
import { runAllTests } from "./testRunner.ts";
runAllTests(runtime);
```

### Camera

Add a **3D Camera** object. Position it so Floor is visible (e.g., `x:0, y:-500, z:300` looking at origin).

### Save

Save the project as `tests/template.c3p`.

---

## Writing Tests

### File Naming

Test files go in `tests/scripts/` and must:
- End with `.js`
- Start with `test_` (convention, not enforced)
- Export a `tests` array

### Test File Template

```javascript
/**
 * test_myFeature.js — Tests for <feature>.
 *
 * Required template objects: <list what you need>
 */

import { waitTicks, getPhysics } from "./testRunner.js";

export const tests = [
    {
        name: "descriptive test name",
        fn: async (runtime, assert) => {
            // 1. Get object instance
            const inst = runtime.objects.DynBox.getFirstInstance();
            const phys = getPhysics(inst);

            // 2. Wait for physics body to exist (tick 0 has no data)
            await waitTicks(runtime, 5);

            // 3. Do stuff
            phys._ApplyImpulse(0, 0, 100);

            // 4. Wait for physics to process
            await waitTicks(runtime, 10);

            // 5. Assert results
            assert.ok(inst.z > 100, "box should have moved up");
            assert.near(phys._VelocityZ(), 0, 5, "velocity roughly zero after bounce");
        },
    },
];
```

### Registering Test Files

After creating a new test file, register it in `tests/scripts/testRunner.js`:

```javascript
// Add import at top
import { tests as myTests } from "./test_myFeature.js";

// Add to allSuites array
const allSuites = [
    { name: "Character Controller", tests: ccTests },
    { name: "My Feature", tests: myTests },         // ← add here
];
```

### Assertion API

The `assert` object passed to each test has:

| Method | Description |
|--------|-------------|
| `assert.ok(value, msg)` | Passes if `value` is truthy |
| `assert.equal(a, b, msg)` | Passes if `a === b` (strict) |
| `assert.near(a, b, tol, msg)` | Passes if `abs(a - b) <= tol` (default 0.01) |

### Helpers

| Function | Description |
|----------|-------------|
| `waitTicks(runtime, n)` | Returns a Promise that resolves after `n` runtime ticks |
| `getPhysics(inst)` | Shorthand for `inst.behaviors.mikalCannon3dPhysics` |

---

## Tips

### Timing
- **Tick 0** has no physics data — always `waitTicks(runtime, 2+)` before reading physics state.
- Character controller commands are batched — wait 2-3 ticks after create/translate before reading results.
- Dynamic body interactions (impulse, gravity) need 5-10+ ticks for visible effect.

### Object Reuse
Tests run sequentially within a suite. If a test modifies an object (moves it, changes body type), subsequent tests see the modified state. Either:
- Reset state at the end of each test
- Use separate objects per test
- Accept sequential dependency

### Adding Template Objects
If a new test needs an object not in the template:
1. Open `tests/template.c3p` in C3
2. Add the object with physics behavior
3. Re-save as `tests/template.c3p`
4. Document the object in the test file's header comment
5. Run `npm run test:build` to regenerate

### Debugging
- Open browser dev tools before running the preview
- All test output goes to `console.log` / `console.error`
- Failed assertions show in red with details
- Breakpoints work in injected scripts (look under Sources → scripts/tests/)

---

## Automation (Future)

To fully automate with Playwright:

```javascript
const { chromium } = require("playwright");

const browser = await chromium.launch();
const page = await browser.newPage();

// Collect console output
const logs = [];
page.on("console", (msg) => logs.push(msg.text()));

// Open C3 preview URL (from remote preview or local)
await page.goto("http://preview-url-here");

// Wait for test completion
await page.waitForFunction(
    () => document.title.includes("TESTS DONE"),
    { timeout: 30000 }
);

// Parse results from console
const passed = logs.some((l) => l.includes("ALL TESTS PASSED"));
process.exit(passed ? 0 : 1);
```
