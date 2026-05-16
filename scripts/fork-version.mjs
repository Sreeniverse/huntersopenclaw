#!/usr/bin/env node

/**
 * Fork version manager for Sreeniverse/huntersopenclaw.
 *
 * Version format: YYYY.M.D-sreeni.N (CalVer + fork suffix)
 *
 * Usage:
 *   node scripts/fork-version.mjs              Print current version
 *   node scripts/fork-version.mjs --auto        Set version to today with auto-increment
 *   node scripts/fork-version.mjs --bump        Increment the sreeni.N suffix
 *   node scripts/fork-version.mjs --set 2      Set sreeni suffix to specific number
 *   node scripts/fork-version.mjs --tag         Create git tag v{version}
 *   node scripts/fork-version.mjs --sync       Run pnpm plugins:sync after version set
 *   node scripts/fork-version.mjs --release     --auto + --sync + --tag
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PKG_PATH = resolve(ROOT, "package.json");
const FORK_SUFFIX_RE = /^(\d{4}\.\d{1,2}\.\d{1,2})(-sreeni\.\d+)?$/u;

function readPkg() {
  return JSON.parse(readFileSync(PKG_PATH, "utf8"));
}

function writePkg(pkg) {
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
}

function todayCalVer() {
  const d = new Date();
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function parseVersion(version) {
  const m = version.match(FORK_SUFFIX_RE);
  if (!m) {
    return { date: version, forkN: 0 };
  }
  return { date: m[1], forkN: m[2] ? parseInt(m[2].split(".")[1], 10) : 0 };
}

function buildVersion(date, n) {
  return `${date}-sreeni.${n}`;
}

function run(cmd) {
  console.log(`  > ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

const args = process.argv.slice(2);
const doAuto = args.includes("--auto");
const doBump = args.includes("--bump");
const doSet = args.includes("--set");
const doTag = args.includes("--tag");
const doSync = args.includes("--sync");
const doRelease = args.includes("--release");

const setNIdx = args.indexOf("--set");
const setN = setNIdx !== -1 ? parseInt(args[setNIdx + 1], 10) : null;

if (doRelease) {
  // --release = --auto + --sync + --tag
  args.push("--auto", "--sync", "--tag");
}

const pkg = readPkg();
const current = pkg.version;
const parsed = parseVersion(current);

console.log(`Current version: ${current}`);

if (!doAuto && !doBump && doSet === false && setN === null && !doTag && !doSync) {
  // Just print current version
  if (parsed.forkN > 0) {
    console.log(`Fork suffix: sreeni.${parsed.forkN}`);
  } else {
    console.log(`No fork suffix (upstream version)`);
  }
  process.exit(0);
}

let newVersion = current;

if (doAuto) {
  const today = todayCalVer();
  if (parsed.date === today && parsed.forkN > 0) {
    // Same date, increment
    newVersion = buildVersion(today, parsed.forkN + 1);
  } else {
    // New date or no fork suffix, start at 1
    newVersion = buildVersion(today, 1);
  }
} else if (doBump) {
  if (parsed.forkN === 0) {
    // No fork suffix yet, add sreeni.1
    newVersion = buildVersion(parsed.date, 1);
  } else {
    newVersion = buildVersion(parsed.date, parsed.forkN + 1);
  }
} else if (setN !== null && setN > 0) {
  newVersion = buildVersion(parsed.date, setN);
}

if (newVersion !== current) {
  console.log(`Setting version: ${current} -> ${newVersion}`);
  pkg.version = newVersion;
  writePkg(pkg);
  console.log(`package.json updated to ${newVersion}`);
} else {
  console.log(`Version unchanged: ${current}`);
}

if (doSync) {
  console.log("\nSyncing plugin versions...");
  run("pnpm plugins:sync");
}

if (doTag) {
  const tag = `v${newVersion}`;
  console.log(`\nCreating git tag: ${tag}`);
  try {
    execSync(`git tag -a ${tag} -m "Release ${tag}"`, { cwd: ROOT, stdio: "inherit" });
    console.log(`Tag ${tag} created.`);
  } catch {
    console.error(`Tag ${tag} already exists or creation failed.`);
    process.exit(1);
  }
}

console.log(`\nDone. Version: ${newVersion}`);
