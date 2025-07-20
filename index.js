import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";

// 🔁 GitHub public folder URL enter your url here
const githubFolderURL = "https://github.com/Pravin-123456/Global-Assets/tree/main/Spylt";

// 🔁 Parse the repo structure from the GitHub folder URL
const urlMatch = githubFolderURL.match(
  /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)/
);

if (!urlMatch) {
  console.error("❌ Invalid GitHub folder URL.");
  process.exit(1);
}

const [_, owner, repoName, branch, folderPath] = urlMatch;
const repo = `${owner}/${repoName}`;
const githubAPI = `https://api.github.com/repos/${repo}/contents/${folderPath}`;
const cdnBase = `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${folderPath}/`;

// 🔁 Convert file names to camelCase keys
function toKey(filePath) {
  const parts = filePath.split("/"); // e.g., ["images", "logo.png"]
  const folder = parts.length > 1 ? parts[0] : "";
  const filename = parts[parts.length - 1].replace(/\.[^.]+$/, ""); // remove extension
  const ext = path.extname(filePath).slice(1); // file extension (e.g., png)

  // Capitalize the first letter of filename
  const namePart = filename
    .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());

  const key = `${namePart}`;
  return key;
}

// 🔁 Recursively list all files in the GitHub directory
async function listFiles(folder = "") {
  const url = `https://api.github.com/repos/${repo}/contents/${folderPath}${folder ? "/" + folder : ""}?ref=${branch}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`❌ Failed to fetch ${folder || "root"}: ${res.statusText}`);
  const data = await res.json();

  let files = [];

  for (const item of data) {
    if (item.type === "file") {
      files.push(path.posix.join(folder, item.name));
    } else if (item.type === "dir") {
      const subFiles = await listFiles(path.posix.join(folder, item.name));
      files = files.concat(subFiles);
    }
  }

  return files;
}

// 🔁 Main generator
async function main() {
  const files = await listFiles();

  let output = `// Auto-generated from ${githubFolderURL}\n`;
  output += `const cdnBase = "${cdnBase}";\n\n`;
  output += `export const Assets = {\n`;

  for (const file of files) {
    const key = toKey(file);
    const url = `\${cdnBase}${file}`;
    output += `  ${key}: \`${url}\`,\n`;
  }

  output += `};\n`;

  await fs.writeFile("assets.js", output);
  console.log(`✅ assets.js created with ${files.length} assets.`);
}

main().catch((err) => console.error("❌ Error:", err));
