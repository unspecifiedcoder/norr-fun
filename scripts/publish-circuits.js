/**
 * Copies the circom proving artifacts into the frontend's public directory.
 *
 * The browser SDK fetches `.wasm` and `.zkey` over HTTP at proof time, so the
 * artifacts have to be served as static files. They are build outputs, not
 * source, which is why this is a script rather than checked-in copies.
 *
 * Layout is flat and predictable -- `/circuits/<name>.wasm` and
 * `/circuits/<name>.zkey`. A nested layout previously disagreed with the paths
 * the app requested, and because Vite falls back to index.html for unmatched
 * paths, the mismatch returned an HTML page with a 200 instead of a 404. The
 * SDK then failed deep inside proof generation rather than at the fetch.
 *
 * Usage: npx hardhat zkit make && node scripts/publish-circuits.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "zkit/artifacts/circom");
const OUT = path.join(ROOT, "eerc-frontend/public/circuits");

/** app-facing name -> circom circuit name */
const CIRCUITS = {
  register: { file: "registration.circom", circuit: "RegistrationCircuit" },
  transfer: { file: "transfer.circom", circuit: "TransferCircuit" },
  mint: { file: "mint.circom", circuit: "MintCircuit" },
  withdraw: { file: "withdraw.circom", circuit: "WithdrawCircuit" },
  burn: { file: "burn.circom", circuit: "BurnCircuit" },
};

if (!fs.existsSync(SRC)) {
  throw new Error(
    `No circuit artifacts at ${path.relative(ROOT, SRC)} — run "npx hardhat zkit make" first`,
  );
}

fs.mkdirSync(OUT, { recursive: true });

let published = 0;
for (const [name, { file, circuit }] of Object.entries(CIRCUITS)) {
  const wasm = path.join(SRC, file, `${circuit}_js`, `${circuit}.wasm`);
  const zkey = path.join(SRC, file, `${circuit}.groth16.zkey`);

  for (const [from, to] of [
    [wasm, path.join(OUT, `${name}.wasm`)],
    [zkey, path.join(OUT, `${name}.zkey`)],
  ]) {
    if (!fs.existsSync(from)) {
      throw new Error(`Missing ${path.relative(ROOT, from)} — rerun the trusted setup`);
    }
    fs.copyFileSync(from, to);
  }

  const kb = (fs.statSync(path.join(OUT, `${name}.zkey`)).size / 1024) | 0;
  console.log(`${name.padEnd(9)} wasm + zkey (${kb} KB)`);
  published += 1;
}

console.log(`\nPublished ${published} circuits to ${path.relative(ROOT, OUT)}`);
