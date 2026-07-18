import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

export function readJsonFile(path) {
    let text = readFileSync(path, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text);
}

/**
 * Bump version in version.json and loader.js (must stay in sync).
 * @param {"patch"|"minor"|"major"} part
 */
export function bumpVersion(root, part = "patch") {
    const versionPath = join(root, "version.json");
    const loaderPath = join(root, "loader.js");
    const data = readJsonFile(versionPath);
    const oldV = String(data.version || "0.0.0");
    const nums = oldV.split(".").map((n) => parseInt(n, 10) || 0);
    while (nums.length < 3) nums.push(0);

    if (part === "major") {
        nums[0] += 1;
        nums[1] = 0;
        nums[2] = 0;
    } else if (part === "minor") {
        nums[1] += 1;
        nums[2] = 0;
    } else {
        nums[2] += 1;
    }

    const newV = nums.join(".");
    data.version = newV;
    writeFileSync(versionPath, JSON.stringify(data, null, 2) + "\n", "utf8");

    let loader = readFileSync(loaderPath, "utf8");
    const updated = loader.replace(/var APP_VERSION = "[^"]+";/, `var APP_VERSION = "${newV}";`);
    if (!updated.includes(`APP_VERSION = "${newV}"`)) {
        throw new Error("loader.js: could not update APP_VERSION");
    }
    writeFileSync(loaderPath, updated, "utf8");

    return { oldV, newV };
}

export function printReleaseCommands(newV) {
    const msg = `Release v${newV} — describe your changes here`;
    console.log("\n--- Version bumped ---");
    console.log(`Ready to publish v${newV}\n`);
    console.log("Run these commands next (edit the commit message as needed):\n");
    console.log("git add .");
    console.log(`git commit -m "${msg}"`);
    console.log("git push");
    console.log("git push live main    REM only after you have tested on live");
}
