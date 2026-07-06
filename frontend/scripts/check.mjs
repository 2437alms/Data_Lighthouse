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
  "Data Lighthouse",
  "Data Lighthouse AI",
  "新建对话",
  "微信一键登录",
  "密码登录",
  "快速注册",
  "开始设置",
  "跳过，以后再说",
  "AI盯标",
  "我的项目",
  "新建项目",
  "重命名",
  "放弃跟进",
  "采购预算",
  "合同金额",
  "服务年限",
  "投标资格要求",
  "商务失分",
  "盯标中",
  "新增公告",
  "即将截止报名（3日内）",
  "即将截止支付投标保证金",
  "即将截止投标文件递交",
  "中标结果公示",
  "商机详情",
  "我的订阅",
  "学校物业周报",
  "知识库",
  "资证库",
  "标书库",
  "企业图库",
  "投标主体库",
  "测算成本库",
  "自定义知识库",
  "上传资料",
  "新建分类",
  "创建知识库",
  "历史对话",
  "用户信息",
  "普通用户",
  "VIP用户",
  "SVIP用户",
  "商机偏好设置",
  "区域偏好",
  "项目金额",
  "最小金额",
  "最大金额",
  "招标方式",
  "业主类型",
  "系统设置",
  "帮助与客服",
  "检查更新",
  "退出登录",
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
