#!/usr/bin/env node

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { program } = require("commander");
const pc = require("picocolors");
const prompts = require("prompts");

const DEFAULT_REPO = "https://github.com/deep93333/openade.git";

function optionSetFromCliOrEnv(flag) {
  if (typeof program.getOptionValueSource !== "function") return false;
  const src = program.getOptionValueSource(flag);
  return src === "cli" || src === "env";
}

function wantsInteractivePrompts(opts) {
  if (opts.yes) return false;
  if (process.env.CI) return false;
  if (!process.stdin.isTTY) return false;
  return true;
}

async function runSetupPrompts({ hasDirectoryArg, skipRunModePrompt }) {
  const questions = [];
  if (!hasDirectoryArg) {
    questions.push({
      type: "text",
      name: "directory",
      message: "Clone into folder",
      initial: "openade",
      validate: (value) => (String(value).trim() ? true : "Enter a folder name"),
    });
  }
  if (!skipRunModePrompt) {
    questions.push({
      type: "select",
      name: "runMode",
      message: "Run dev servers",
      choices: [
        { title: "Background — logs in ~/.openade/dev-server.log", value: "background" },
        { title: "Foreground — stream logs here", value: "foreground" },
      ],
      initial: 0,
    });
  }
  if (questions.length === 0) return {};
  console.log();
  return prompts(questions, {
    onCancel: () => {
      console.log(pc.yellow("\nCancelled."));
      process.exit(0);
    },
  });
}

function runInherited(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd,
  });
  if (r.error) {
    if (activeOra) activeOra.stop();
    console.error(pc.red(r.error.message));
    process.exit(1);
  }
  if (r.status !== 0) {
    if (activeOra) activeOra.stop();
    process.exit(r.status ?? 1);
  }
}

let activeOra = null;

function runQuiet(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...opts.env },
    cwd: opts.cwd,
  });
  if (r.error) {
    if (activeOra) activeOra.stop();
    console.error(pc.red(r.error.message));
    process.exit(1);
  }
  if (r.status !== 0) {
    if (activeOra) activeOra.stop();
    const err = [r.stderr, r.stdout].filter(Boolean).join("\n").trim();
    if (err) console.error(pc.red(err));
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
    home && path.join(home, ".bun", "bin", "bun.exe"),
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

function installBun(verbose) {
  if (verbose) {
    console.error(pc.yellow("Bun not found. Installing via https://bun.sh/install …"));
  }
  const r = spawnSync("bash", ["-c", "curl -fsSL https://bun.sh/install | bash >/dev/null"], {
    stdio: verbose ? ["ignore", "inherit", "inherit"] : ["ignore", "ignore", "ignore"],
  });
  if (r.status !== 0) {
    console.error(pc.red("Bun install failed. Install manually: https://bun.sh"));
    process.exit(r.status ?? 1);
  }
  const bunRoot = process.env.BUN_INSTALL || path.join(process.env.HOME || "", ".bun");
  const binDir = path.join(bunRoot, "bin");
  process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH || ""}`;
}

function ensureBun(verbose) {
  let bin = resolveBun();
  if (bin) return bin;
  installBun(verbose);
  bin = resolveBun();
  if (!bin) {
    console.error(
      pc.red(
        "Bun was not found after install. Open a new terminal and run again, or add ~/.bun/bin to PATH.",
      ),
    );
    process.exit(1);
  }
  return bin;
}

function checkPathNodeForVite() {
  const pathNode = spawnSync("node", ["-p", "process.versions.node"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (pathNode.status !== 0) return;
  const major = Number.parseInt(String(pathNode.stdout).trim().split(".")[0], 10);
  if (!Number.isFinite(major) || major >= 20) return;
  console.error(
    pc.red(
      `Node.js 20+ is required for the Vite app (node on your PATH reports v${String(pathNode.stdout).trim()}).`,
    ),
  );
  console.error(pc.yellow("Install Node 22 LTS: https://nodejs.org/ or: brew install node@22"));
  process.exit(1);
}

function gitAvailable() {
  return hasCmd("git");
}

function openadeStateDir() {
  const d = path.join(os.homedir(), ".openade");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function startDevBackground(bunBin, target) {
  const state = openadeStateDir();
  const logPath = path.join(state, "dev-server.log");
  const pidPath = path.join(state, "dev-server.pid");
  const logFd = fs.openSync(logPath, "a");
  try {
    fs.writeFileSync(
      logPath,
      `\n--- ${new Date().toISOString()} starting (cwd ${target}) ---\n`,
      { flag: "a" },
    );
  } catch {
    //
  }
  const child = spawn(bunBin, ["run", "dev"], {
    cwd: target,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env },
  });
  fs.closeSync(logFd);
  try {
    fs.writeFileSync(pidPath, `${child.pid}\n${target}\n`);
  } catch {
    //
  }
  child.unref();
  const appPort = process.env.VITE_APP_PORT || "3010";
  const serverPort =
    process.env.OPENADE_AGENT_PORT?.trim() ||
    process.env.AGENT_SERVER_PORT?.trim() ||
    "42891";
  console.log();
  console.log(pc.green(pc.bold("Openade is running in the background.")));
  console.log(`  ${pc.dim("Workspace")}  ${target}`);
  console.log(`  ${pc.dim("Log file")}   ${logPath}`);
  console.log(`  ${pc.dim("PID")}        ${child.pid}`);
  console.log(`  ${pc.dim("Stop")}       ${pc.cyan(`kill ${child.pid}`)}`);
  console.log(
    `  ${pc.dim("URLs")}       ${pc.cyan(`http://localhost:${appPort}`)} (app)  ${pc.dim(`agent :${serverPort}`)}`,
  );
  console.log(
    `  ${pc.dim("Foreground")}  ${pc.cyan("npx tryade --foreground")} ${pc.dim("(from repo directory)")}`,
  );
  console.log();
}

async function main() {
  program
    .name("tryade")
    .description("Clone Openade, install dependencies, start the dev stack")
    .option("-f, --foreground", "stream dev logs in this terminal (default: background + log file)")
    .option("-v, --verbose", "show git and bun install output")
    .option("-y, --yes", "skip interactive prompts (non-TTY default)")
    .argument("[directory]", "directory name for the clone")
    .addHelpText(
      "after",
      `
${pc.bold("Environment")}
  AGENTIDE_REPO    override git URL (default: ${DEFAULT_REPO})

${pc.bold("More")}
  Shell installer   curl -fsSL https://tryade.dev/install.sh | bash`,
    );

  await program.parseAsync(process.argv);

  const opts = program.opts();
  const verbose = Boolean(opts.verbose);
  let foreground = Boolean(opts.foreground);
  const explicitDirectory = program.args[0];
  const fgFromCliOrEnv = optionSetFromCliOrEnv("foreground");

  if (!gitAvailable()) {
    console.error(pc.red("git is required. Install Git and retry."));
    process.exit(1);
  }

  checkPathNodeForVite();

  let directory = explicitDirectory;
  if (wantsInteractivePrompts(opts)) {
    const answers = await runSetupPrompts({
      hasDirectoryArg: Boolean(explicitDirectory),
      skipRunModePrompt: fgFromCliOrEnv,
    });
    if (answers.directory) directory = answers.directory;
    if (!fgFromCliOrEnv && answers.runMode) {
      foreground = answers.runMode === "foreground";
    }
  }
  if (!directory) directory = "openade";

  const repo = process.env.OPENADE_REPO || process.env.AGENTIDE_REPO || DEFAULT_REPO;
  const target = path.resolve(process.cwd(), directory);

  if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) {
    console.error(pc.red(`Not a directory: ${target}`));
    process.exit(1);
  }

  const gitDir = path.join(target, ".git");
  const runGit = verbose ? runInherited : runQuiet;
  const runBunCmd = verbose ? runInherited : runQuiet;

  const { default: ora } = await import("ora");
  const spinner =
    !verbose && !foreground
      ? ora({ color: "green", discardStdin: false }).start("Preparing workspace…")
      : null;
  activeOra = spinner;

  const failSpinner = (msg) => {
    if (spinner) spinner.fail(pc.red(msg));
    else console.error(pc.red(msg));
    process.exit(1);
  };

  if (!fs.existsSync(target)) {
    if (spinner) spinner.text = "Cloning repository…";
    runGit("git", ["clone", "--depth", "1", "--quiet", repo, target], { cwd: process.cwd() });
  } else if (fs.existsSync(gitDir)) {
    if (spinner) spinner.text = "Updating repository…";
    runGit("git", ["-C", target, "pull", "--ff-only", "--quiet"], { cwd: process.cwd() });
  } else {
    failSpinner(`Path exists and is not a git clone: ${target}`);
  }

  if (spinner) spinner.text = "Checking Bun…";
  const bunBin = ensureBun(verbose);

  if (spinner) spinner.text = "Installing dependencies…";
  runBunCmd(bunBin, ["install"], { cwd: target });

  if (spinner) spinner.text = "Starting dev servers…";
  if (foreground) {
    if (spinner) spinner.stop();
    activeOra = null;
    runInherited(bunBin, ["run", "dev"], { cwd: target });
  } else {
    if (spinner) spinner.stopAndPersist({ symbol: pc.green("✔"), text: pc.green("Dev servers started") });
    activeOra = null;
    startDevBackground(bunBin, target);
  }
}

main().catch((e) => {
  console.error(pc.red(e instanceof Error ? e.message : String(e)));
  process.exit(1);
});
