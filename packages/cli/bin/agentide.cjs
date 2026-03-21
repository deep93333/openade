#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_REPO = "https://github.com/deep93333/agentide.git";

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.error) {
    console.error(r.error.message);
    process.exit(1);
  }
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function hasCmd(name) {
  const r = spawnSync(name, ["--version"], { stdio: "pipe" });
  return r.status === 0;
}

function resolveBun() {
  if (hasCmd("bun")) {
    return "bun";
  }
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const candidates = [
    home && path.join(home, ".bun", "bin", "bun"),
    "/opt/homebrew/bin/bun",
    "/usr/local/bin/bun",
  ].filter(Boolean);
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function gitAvailable() {
  return hasCmd("git");
}

function printHelp() {
  console.log(`Usage:
  npx @agentide/cli [directory]
  agentide [directory]

One-liner (short URL):
  curl -fsSL https://raw.githubusercontent.com/deep93333/agentide/main/i | bash

Clones AgentIDE (if needed), installs dependencies, and runs the dev stack.

Environment:
  AGENTIDE_REPO   Git URL (default: ${DEFAULT_REPO})

Default directory: ./agentide
`);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "-h" || argv[0] === "--help") {
    printHelp();
    process.exit(0);
  }

  if (!gitAvailable()) {
    console.error("git is required. Install Git and retry.");
    process.exit(1);
  }

  const repo = process.env.AGENTIDE_REPO || DEFAULT_REPO;
  const target = path.resolve(process.cwd(), argv[0] || "agentide");

  if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) {
    console.error(`Not a directory: ${target}`);
    process.exit(1);
  }

  const gitDir = path.join(target, ".git");

  if (!fs.existsSync(target)) {
    run("git", ["clone", "--depth", "1", repo, target], { cwd: process.cwd() });
  } else if (fs.existsSync(gitDir)) {
    run("git", ["-C", target, "pull", "--ff-only"], { cwd: process.cwd() });
  } else {
    console.error(
      `Directory exists and is not a git clone: ${target}\nRemove it, pick another path, or clone manually.`,
    );
    process.exit(1);
  }

  const bunBin = resolveBun();
  if (!bunBin) {
    console.error(
      "Bun was not found. Install Bun (https://bun.sh) or run:\n" +
        `  curl -fsSL https://raw.githubusercontent.com/deep93333/agentide/main/i | bash`,
    );
    process.exit(1);
  }
  run(bunBin, ["install"], { cwd: target });
  run(bunBin, ["run", "dev"], { cwd: target });
}

main();
