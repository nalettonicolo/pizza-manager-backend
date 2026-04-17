/**
 * Pubblicazione: tenta git add / commit / push se git è disponibile, poi npm run deploy.
 * Evita errori quando git non è nel PATH (stesso problema su Windows senza Git).
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function findGit() {
  const winPaths = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Git", "cmd", "git.exe"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Git", "bin", "git.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Git", "bin", "git.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "git.exe"),
  ].filter(Boolean);
  for (const p of winPaths) {
    if (p && existsSync(p)) return p;
  }
  const r = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (r.status === 0) return "git";
  return null;
}

function runGit(git, args) {
  return spawnSync(git, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });
}

const git = findGit();
if (git) {
  console.log(`[publish] usando Git: ${git}`);
  runGit(git, ["add", "."]);
  runGit(git, ["commit", "-m", "Deploy"]);
  runGit(git, ["push"]);
} else {
  console.log(
    "[publish] Git non trovato: salto add/commit/push. Installa Git for Windows o aggiungi git al PATH per versionare.",
  );
}

const isWin = process.platform === "win32";
const deploy = spawnSync(isWin ? "npm.cmd" : "npm", ["run", "deploy"], {
  cwd: root,
  stdio: "inherit",
  shell: isWin,
});
process.exit(typeof deploy.status === "number" ? deploy.status : 1);
