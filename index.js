import fs from "fs/promises";
import path from "path";
import fetch from "node-fetch";
import readline from "readline";

// Prompt for endpoint
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "📁 Enter GitHub folder endpoint (e.g., Spylt or Project/images): ",
  async function (input) {
    rl.close();

    const baseURL = "https://github.com/Pravin-123456/Global-Assets/tree/main/";
    const githubFolderURL = `${baseURL}${input}`;

    const match = githubFolderURL.match(
      /github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+)\/(.+)/
    );
    if (!match) {
      console.error("❌ Invalid GitHub folder URL.");
      process.exit(1);
    }

    const [_, owner, repo, branch, folderPath] = match;
    const repoName = `${owner}/${repo}`;
    const cdnBase = `https://cdn.jsdelivr.net/gh/${repoName}@v1.0.0/${folderPath}/`;

    // Helper: convert file path to key
    function toKey(filePath) {
      const filename = path.basename(filePath).replace(/\.[^.]+$/, "");
      return filename
        .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (_, c) => c.toUpperCase());
    }

    // Helper: convert folder to export name
    function toExportName(folder) {
      return folder
        .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (_, c) => c.toUpperCase());
    }

    // Fetch files recursively
    async function listFiles(folder = "") {
      const url = `https://api.github.com/repos/${repoName}/contents/${folderPath}${
        folder ? "/" + folder : ""
      }?ref=${branch}`;
      const res = await fetch(url);
      if (!res.ok)
        throw new Error(
          `❌ Failed to fetch ${folder || "root"}: ${res.statusText}`
        );
      const data = await res.json();

      let files = [];
      for (const item of data) {
        if (item.type === "file") {
          files.push(path.posix.join(folder, item.name));
        } else if (item.type === "dir") {
          const nested = await listFiles(path.posix.join(folder, item.name));
          files = files.concat(nested);
        }
      }
      return files;
    }

    // Group by top-level folder
    function groupByTopFolder(files) {
      const groups = {};
      for (const file of files) {
        const [top, ...rest] = file.split("/");
        const groupKey = top || "Root";
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(file);
      }
      return groups;
    }

    // Generate export
    function generateExport(groupName, fileList) {
      const exportName = toExportName(groupName);
      let out = `export const ${exportName} = {\n`;
      for (const file of fileList) {
        const key = toKey(file);
        out += `  ${key}: \`\${cdnBase}${file}\`,\n`;
      }
      out += `};\n\n`;
      return out;
    }

    // Main executor
    async function run() {
      try {
        const allFiles = await listFiles();
        const grouped = groupByTopFolder(allFiles);

        let output = `// Auto-generated from ${githubFolderURL}\n`;
        output += `const cdnBase = "${cdnBase}";\n\n`;

        for (const [folder, files] of Object.entries(grouped)) {
          output += generateExport(folder, files);
        }

        await fs.writeFile("assets.js", output);
        console.log(
          `✅ assets.js created with ${allFiles.length} assets and ${
            Object.keys(grouped).length
          } export groups.`
        );
      } catch (err) {
        console.error("❌ Error:", err.message);
      }
    }

    await run();
  }
);
