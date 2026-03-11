/**
 * buildTestProject.js
 *
 * Copies c3-project-template/ to output/c3-project/, then injects test scripts
 * from tests/scripts/ into the output project (copies .ts files + updates project.c3proj).
 *
 * Usage:
 *   node tests/buildTestProject.js
 *   npm run test:build
 *
 * Then open tests/output/c3-project/ as a project folder in Construct 3.
 */

const fs = require("fs");
const path = require("path");

const TEMPLATE_DIR = path.resolve(__dirname, "c3-project-template");
const SCRIPTS_DIR = path.resolve(__dirname, "scripts");
const OUTPUT_DIR = path.resolve(__dirname, "output", "c3-project");

// ---------------------------------------------------------------------------
// 1. Validate inputs
// ---------------------------------------------------------------------------
if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(
        "ERROR: Template not found at tests/c3-project-template/\n" +
            "See tests/TESTING.md for setup instructions."
    );
    process.exit(1);
}

const scriptFiles = fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
    .sort();

if (scriptFiles.length === 0) {
    console.error("ERROR: No .ts/.js files found in tests/scripts/");
    process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Copy template to output (clean copy)
// ---------------------------------------------------------------------------
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true });
}
copyDirSync(TEMPLATE_DIR, OUTPUT_DIR);

// ---------------------------------------------------------------------------
// 3. Copy test scripts into output project's scripts/ folder
// ---------------------------------------------------------------------------
const outputScriptsDir = path.join(OUTPUT_DIR, "scripts");
if (!fs.existsSync(outputScriptsDir)) {
    fs.mkdirSync(outputScriptsDir, { recursive: true });
}

for (const filename of scriptFiles) {
    fs.copyFileSync(
        path.join(SCRIPTS_DIR, filename),
        path.join(outputScriptsDir, filename)
    );
}

// ---------------------------------------------------------------------------
// 4. Update project.c3proj to register injected scripts
// ---------------------------------------------------------------------------
const projPath = path.join(OUTPUT_DIR, "project.c3proj");
const proj = JSON.parse(fs.readFileSync(projPath, "utf8"));

const scriptRoot = proj.rootFileFolders.script;
const existingNames = new Set(scriptRoot.items.map((item) => item.name));

for (const filename of scriptFiles) {
    if (existingNames.has(filename)) continue;

    scriptRoot.items.push({
        name: filename,
        type: filename.endsWith(".ts")
            ? "application/typescript"
            : "application/javascript",
        sid: stableSid(filename),
        "script-info": {
            purpose: "none",
        },
    });
}

fs.writeFileSync(projPath, JSON.stringify(proj, null, "\t"), "utf8");

// ---------------------------------------------------------------------------
// 5. Generate importForEvents.ts with all test imports
// ---------------------------------------------------------------------------
const testFiles = scriptFiles.filter((f) => f.startsWith("test_"));
const importLines = [
    `import * as Tests from "./testRunner.ts";`,
    ...testFiles.map((f) => `import "./${f}";`),
];
fs.writeFileSync(
    path.join(outputScriptsDir, "importForEvents.ts"),
    importLines.join("\n") + "\n",
    "utf8"
);

// ---------------------------------------------------------------------------
// 6. Done
// ---------------------------------------------------------------------------
console.log(`✓ Copied template to ${OUTPUT_DIR}`);
console.log(`✓ Injected ${scriptFiles.length} test script(s):`);
for (const f of scriptFiles) console.log(`  scripts/${f}`);
console.log(`\nOpen tests/output/c3-project/ as a project folder in C3.`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function stableSid(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffffffff;
    }
    return 900000000000000 + (hash % 100000000000000);
}

function copyDirSync(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}
