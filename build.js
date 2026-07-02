const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const distClient = path.join(root, "dist", "client");

fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });
fs.mkdirSync(distClient, { recursive: true });

copyFile("index.html", path.join(distClient, "index.html"));
copyFile("sample-addresses.csv", path.join(distClient, "sample-addresses.csv"));
copyDirectory(path.join(root, "src"), path.join(distClient, "src"));

function copyFile(source, target) {
  fs.copyFileSync(path.join(root, source), target);
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}