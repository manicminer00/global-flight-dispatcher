#!/usr/bin/env node
/**
 * VECTOR master-verify — one script for all website pre-upload checks.
 *
 * Covers every runtime deploy asset (JS, HTML, assignments, missions, dispatch probes).
 * Does NOT re-validate airport field data or fleet performance specs (DB entry audits).
 *
 * Run:
 *   master-verify.bat              (repo root — works when PowerShell scripts are blocked)
 *   dev\scripts\master-verify.bat
 *   node dev/scripts/master-verify.mjs
 *   node dev/scripts/master-verify.mjs --no-bump   (verify only, no version change)
 *
 * On PASS: bumps PATCH in version.json + loader.js, then prints git commands.
 *
 * Exit 0 = pass. Exit 1 = fail.
 */
import { join } from "path";
import { spawn } from "child_process";
import { runWebsiteStaticChecks } from "./lib/website-static-checks.mjs";
import { bumpVersion, printReleaseCommands } from "./lib/version-bump.mjs";

const args = process.argv.slice(2);
const noBump = args.includes("--no-bump");
let bumpPart = "patch";
if (args.includes("--minor")) bumpPart = "minor";
if (args.includes("--major")) bumpPart = "major";

const root = process.cwd();
const SCRIPTS = join("dev", "scripts");
const BUDGET_MS = 8 * 60 * 1000;
const t0 = Date.now();

const failures = [];
const warnings = [];
const rows = [];

function elapsed() {
    return ((Date.now() - t0) / 1000).toFixed(1);
}

function run(cmd, args, label) {
    return new Promise((resolve) => {
        const start = Date.now();
        const child = spawn(cmd, args, { cwd: root, shell: false, env: process.env });
        let out = "";
        child.stdout?.on("data", (d) => { out += d; });
        child.stderr?.on("data", (d) => { out += d; });
        child.on("close", (code) => {
            resolve({ label, code: code ?? 1, out, ms: Date.now() - start, ok: code === 0 });
        });
        child.on("error", (err) => {
            resolve({ label, code: 1, out: String(err.message), ms: Date.now() - start, ok: false });
        });
    });
}

function parsePythonSection(out, sectionPattern) {
    const re = new RegExp(`=== ${sectionPattern}[^=]*===\\n([\\s\\S]*?)(?:\\n===|$)`);
    const m = out.match(re);
    if (!m) return null;
    const body = m[1].trim();
    if (!body || body.toLowerCase() === "none") return [];
    return body.split("\n").map((l) => l.trim()).filter(Boolean);
}

function recordInline(result) {
    rows.push({ label: result.label, ok: result.ok, sec: (result.ms / 1000).toFixed(1) });
    if (!result.ok) {
        failures.push(`${result.label}: ${result.detail || result.out}`);
    }
}

function recordSubprocess(result) {
    rows.push({ label: result.label, ok: result.ok, sec: (result.ms / 1000).toFixed(1) });
    if (!result.ok) {
        const tail = result.out.trim().split("\n").slice(-8).join("\n");
        failures.push(`${result.label} failed (exit ${result.code})\n${tail}`);
        return;
    }
    if (result.label === "audit-predeploy") {
        const issues = parsePythonSection(result.out, "ISSUES \\(bugs\\)");
        if (issues?.length) {
            failures.push(`audit-predeploy:\n${issues.join("\n")}`);
            rows[rows.length - 1].ok = false;
        }
        const warns = parsePythonSection(result.out, "WARNINGS \\(informational\\)");
        warns?.forEach((w) => warnings.push(`audit-predeploy: ${w}`));
    }
    if (result.label === "audit-fleet-missions") {
        const errBlock = result.out.split("ERRORS")[1]?.split("WARNINGS")[0] || "";
        const errLines = errBlock.split("\n").map((l) => l.trim()).filter((l) => l && l !== "None");
        if (errLines.length) {
            failures.push(`audit-fleet-missions:\n${errLines.join("\n")}`);
            rows[rows.length - 1].ok = false;
        }
        if (result.out.includes("Assignment mode:")) {
            const warnBlock = result.out.split("WARNINGS")[1]?.split("Reference written")[0] || "";
            warnBlock.split("\n").map((l) => l.trim()).filter((l) => l && l !== "None")
                .forEach((w) => warnings.push(`audit-fleet-missions (legacy advisory): ${w}`));
        }
    }
}

console.log("=== VECTOR master-verify (website pre-upload) ===");
console.log(`Repo: ${root}`);
console.log("Scope: all deploy runtime files; excludes airport/fleet field re-audit\n");

for (const result of runWebsiteStaticChecks(root)) {
    recordInline(result);
}

const subprocessJobs = [
    { cmd: "node", args: [join(SCRIPTS, "dispatch-physics-verify.mjs"), "--quick"], label: "dispatch-physics-verify" },
    { cmd: "node", args: [join(SCRIPTS, "validate-simbrief-phase-c.mjs")], label: "validate-simbrief-phase-c" },
    { cmd: "node", args: [join(SCRIPTS, "validate-mission-assignments.mjs")], label: "validate-mission-assignments" },
    { cmd: "node", args: [join(SCRIPTS, "dispatch-fleet-smoke.mjs")], label: "dispatch-fleet-smoke" },
    { cmd: "node", args: [join(SCRIPTS, "dispatch-regression-probe.mjs")], label: "dispatch-regression-probe" },
    { cmd: "python", args: [join(SCRIPTS, "audit-predeploy.py")], label: "audit-predeploy" },
    { cmd: "python", args: [join(SCRIPTS, "audit-fleet-missions.py")], label: "audit-fleet-missions" }
];

for (const job of subprocessJobs) {
    process.stdout.write(`${job.label}... `);
    const result = await run(job.cmd, job.args, job.label);
    console.log(result.ok ? `PASS (${(result.ms / 1000).toFixed(1)}s)` : `FAIL (${(result.ms / 1000).toFixed(1)}s)`);
    recordSubprocess(result);
}

console.log("--- Results ---");
const col = Math.max(...rows.map((r) => r.label.length), 12);
for (const r of rows) {
    console.log(`${r.label.padEnd(col)}  ${r.ok ? "PASS" : "FAIL"}  (${r.sec}s)`);
}

if (warnings.length) {
    console.log(`\n--- Advisory (${warnings.length}) — do not block upload ---`);
    warnings.slice(0, 15).forEach((w) => console.log(`  ! ${w}`));
    if (warnings.length > 15) console.log(`  ... and ${warnings.length - 15} more`);
}

console.log(`\nTotal: ${elapsed()}s`);

if (failures.length) {
    console.log(`\n=== FAILED (${failures.length}) ===`);
    failures.forEach((f) => console.log(`\n${f}`));
    process.exit(1);
}

if (Date.now() - t0 > BUDGET_MS) {
    console.log(`\nNOTE: run exceeded ${BUDGET_MS / 60000} min budget`);
}

console.log("\nmaster-verify: PASS — safe to upload website bundle");

if (!noBump) {
    try {
        const { oldV, newV } = bumpVersion(root, bumpPart);
        rows.push({ label: "version-bump", ok: true, sec: "0.0" });
        console.log(`\nVersion: ${oldV} → ${newV} (${bumpPart})`);
        printReleaseCommands(newV);
    } catch (err) {
        console.error(`\nVersion bump failed: ${err.message}`);
        process.exit(1);
    }
} else {
    console.log("\n(--no-bump: version unchanged)");
}

process.exit(0);
