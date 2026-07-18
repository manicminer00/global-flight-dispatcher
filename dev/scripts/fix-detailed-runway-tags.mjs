import { readFileSync, writeFileSync } from "fs";

const FILES = ["airports-asobo-db.js", "airports-thirdparty-db.js"];

const GLIDER_NAME = /\b(Glider|Gliding|Soaring|Segelflug)\b/i;
const US_LOCAL = /^[0-9]/;
const GA_DEMOTE_NAME = /\b(Municipal|County|Memorial|Airfield|Airstrip|Farm|Grass|Private|Ultralight| UL\b)\b/i;

const changes = [];
const write = process.argv.includes("--write");

for (const path of FILES) {
    let text = readFileSync(path, "utf8");
    const tagPattern = path.includes("thirdparty")
        ? 'tag: "Third Party"'
        : 'tag: "Asobo Detailed Airports"';

    text = text.replace(
        new RegExp(`^\\{ icao: "([^"]+)", name: "([^"]+)", rwy: "([^"]+)", length: (\\d+),([^}]+)${tagPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^}]*)\\},?$`, "gm"),
        (line, icao, name, rwy, length, mid, tail) => {
            const len = Number(length);
            let newRwy = rwy;
            let reason = "";

            if (path.includes("asobo") && GLIDER_NAME.test(name) && rwy !== "GLIDER") {
                newRwy = "GLIDER";
                reason = "glider name";
            } else if (path.includes("asobo") && rwy === "BIZ JET" && len < 5500 && !/\b(International|Regional)\b/i.test(name)) {
                newRwy = "GA";
                reason = "small detailed biz-jet demote";
            } else if (
                rwy === "TURBO" &&
                len < 4500 &&
                !tail.includes("isMilitary: true") &&
                (US_LOCAL.test(icao) || GA_DEMOTE_NAME.test(name))
            ) {
                newRwy = "GA";
                reason = "US/local grass strip";
            }

            if (newRwy === rwy) return line;
            changes.push({ path, icao, name, from: rwy, to: newRwy, len, reason });
            return line.replace(`rwy: "${rwy}"`, `rwy: "${newRwy}"`);
        }
    );

    if (write) writeFileSync(path, text, "utf8");
}

if (write) {
    console.log(`Wrote ${changes.length} runway tag fixes.`);
} else {
    console.log(`Would fix ${changes.length} entries (pass --write to apply):`);
}
changes.forEach((c) => console.log(`  [${c.path}] ${c.icao} ${c.name}: ${c.from} -> ${c.to} (${c.len}ft, ${c.reason})`));
