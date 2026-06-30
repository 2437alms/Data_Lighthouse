import { readFile } from "node:fs/promises";

const root = new URL("..", import.meta.url);
const requiredFiles = [
  "index.html",
  "src/app.js",
  "src/api.js",
  "src/data.js",
  "src/styles.css",
  "src/types.d.ts",
  "scripts/serve.mjs",
  "scripts/build-single.mjs"
];

const requiredTexts = [
  "DataLighthouse",
  "新对话",
  "AI盯标",
  "我的项目",
  "新建项目",
  "盯标中",
  "有更新",
  "即将截止报名",
  "商机详情",
  "我的订阅",
  "学校物业周报",
  "知识库",
  "历史对话",
  "商机雷达",
  "招标文件解析",
  "AI 辅助决策",
  "推荐商机",
  "AI盯标",
  "已中标",
  "FastAPI",
  "/api/chat/messages",
  "API_BASE_URL"
];

const contents = [];
for (const file of requiredFiles) {
  contents.push(await readFile(new URL(file, root), "utf8"));
}

const combined = contents.join("\n");
for (const text of requiredTexts) {
  if (!combined.includes(text)) {
    throw new Error(`缺少必要内容：${text}`);
  }
}

if (/绮惧|鍟嗘|鎺ㄨ|鐗╀/.test(combined)) {
  throw new Error("检测到旧版乱码文本，请清理后再交付。");
}

if (!combined.includes("window.__API_BASE_URL__") || !combined.includes("localStorage.getItem(\"API_BASE_URL\")")) {
  throw new Error("后端 API_BASE_URL 接入点不完整。");
}

console.log("检查通过：文件结构、核心文案、后端接口占位与编码均正常。");
