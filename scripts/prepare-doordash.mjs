// Official pinned release only. No credentials are used during installation.
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
if (process.platform !== "linux" || process.arch !== "x64") process.exit(0);
const version = "0.2.6";
const name = `dd-cli-v${version}-linux-amd64`;
const root = path.resolve(".vendor/doordash");
const digest =
  "b6abad40c4881589611d3b87e8f5e68fa5473f12469bd2a9d71db7064c5ff051";
await mkdir(root, { recursive: true });
const archive = path.join(root, `${name}.tar.gz`);
let bytes;
try {
  bytes = await readFile(archive);
} catch {}
if (!bytes || createHash("sha256").update(bytes).digest("hex") !== digest) {
  const r = await fetch(
    `https://github.com/doordash-oss/doordash-cli/releases/download/v${version}/${name}.tar.gz`,
    { signal: AbortSignal.timeout(60000) },
  );
  if (!r.ok) throw Error("DoorDash release download failed");
  bytes = Buffer.from(await r.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== digest)
    throw Error("DoorDash release checksum mismatch");
  await writeFile(archive, bytes);
}
execFileSync("tar", ["-xzf", archive, "-C", root]);
await chmod(path.join(root, name, name), 0o755);
console.log("Verified DoorDash CLI v" + version + " ready.");
