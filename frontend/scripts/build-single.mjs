import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const data = await readFile(join(root, "src", "data.js"), "utf8");
const api = await readFile(join(root, "src", "api.js"), "utf8");
const app = await readFile(join(root, "src", "app.js"), "utf8");
const css = await readFile(join(root, "src", "styles.css"), "utf8");

function stripModules(source) {
  return source
    .replace(/^import[\s\S]*?;\s*/gm, "")
    .replace(/\bexport\s+(async\s+function|function|const|let|var|class)\b/g, "$1")
    .replace(/\bexport\s*\{[^}]+\};?/g, "");
}

const script = `${stripModules(data)}\n\n${stripModules(api)}\n\n${stripModules(app)}`.replaceAll("</script", "<\\/script");
const previewHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Data Lighthouse 数据灯塔 AI - 单文件预览</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${script}
    </script>
  </body>
</html>
`;

await writeFile(join(root, "src", "app.bundle.js"), `(() => {\n${script}\n})();\n`, "utf8");
await writeFile(join(root, "preview.html"), previewHtml, "utf8");
await writeFile(join(root, "index.html"), previewHtml, "utf8");
console.log("已生成 index.html、preview.html 和 src/app.bundle.js");
