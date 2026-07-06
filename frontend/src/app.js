import {
  backendContract,
  deleteKnowledgeDocument,
  getConversations,
  getFavorites,
  getKnowledgeCategories,
  getKnowledgeDocument,
  getKnowledgeDocuments,
  getOpportunityDetail,
  getOpportunities,
  getRadarSummary,
  getWatchTargets,
  sendChatMessage,
  toggleFavorite,
  toggleWatching,
  updateOpportunityState,
  uploadKnowledgeDocument
} from "./api.js";

const app = document.querySelector("#app");

const AUTH_STORAGE_KEY = "DL_AUTHENTICATED";
const BLOCKED_OPPORTUNITIES_KEY = "DL_BLOCKED_OPPORTUNITIES";

let isAuthenticated = localStorage.getItem(AUTH_STORAGE_KEY) === "1";
let loginLoading = false;
let loginError = "";
let loginUsername = "";
let loginPassword = "";
let loginMode = "wechat";
let onboardingStep = 0;
let onboardingError = "";
let onboardingProfile = {
  name: "微信用户",
  phone: "",
  code: "",
  email: ""
};
let onboardingCompany = {
  query: "",
  selected: "",
  city: "重庆市"
};
let onboardingPreference = {
  province: "重庆市",
  city: "重庆市",
  cities: ["重庆市"],
  propertyTypes: ["学校"],
  serviceTypes: ["物业管理（全委）"],
  amountMin: "100",
  amountMax: "3000"
};
let route = "chat";
let selectedOpportunityId = "";
let selectedLibraryKey = "";
let selectedKnowledgeDocumentId = "";
let detailReturnRoute = "chat";
let detailMode = "normal";
let detailActiveSection = "项目基础信息";
let detailAnalysisPanel = "";
let detailBlockMenuOpen = false;
let blockingOpportunityId = "";
let sidebarOpen = true;
let userMenuOpen = false;
let historyOpen = true;
let historySkillFilter = "算法推荐";
let historySearch = "";
let historyTabsResizeHandler = null;
let subscriptionOpen = true;
let activeMode = "radar";
let draftMessage = "";
let selectedSkillCards = [];
let focusComposer = false;
let resultsOpen = true;
let radarCompact = false;
let watchFilter = "all";
let projectWorkspaceTab = "overview";
let detailHintOpen = true;
let knowledgeSearch = "";
let knowledgeTypeFilter = "all";
let knowledgeStatusFilter = "all";
let knowledgeUploadOpen = false;
let knowledgeCategoryOpen = false;
let knowledgeNotice = "";
const initialMessage = {
  role: "assistant",
  content: "你好，我是 Data Lighthouse。你可以直接问我商机、项目、人脉路径或到期合同，我会把可行动的机会整理在下方。"
};
const RELATIONSHIP_DEFAULT_ZOOM = 0.72;
let messages = [
  {
    ...initialMessage
  }
];
let chatResults = [];
let blockedChatResults = [];
let relationshipResult = null;
let resultMode = "opportunity";
let relationshipZoom = RELATIONSHIP_DEFAULT_ZOOM;
let relationshipPan = { x: 0, y: 0 };
let relationshipRouteIndex = 0;
let activeThreadId = "draft";
const chatThreads = new Map();

function hasConversation() {
  return messages.some((message) => message.role === "user");
}

function saveCurrentThread() {
  chatThreads.set(activeThreadId, {
    messages: [...messages],
    chatResults: [...chatResults],
    blockedChatResults: [...blockedChatResults],
    relationshipResult,
    resultMode,
    relationshipZoom,
    relationshipPan: { ...relationshipPan },
    relationshipRouteIndex,
    draftMessage,
    selectedSkillCards: [...selectedSkillCards],
    resultsOpen
  });
}

function loadChatThread(threadId, fallbackState) {
  saveCurrentThread();
  activeThreadId = threadId;
  const state = chatThreads.get(threadId) || fallbackState;
  chatThreads.set(threadId, state);
  messages = [...state.messages];
  chatResults = [...(state.chatResults || [])];
  blockedChatResults = [...(state.blockedChatResults || [])];
  relationshipResult = state.relationshipResult || null;
  resultMode = state.resultMode || "opportunity";
  relationshipZoom = state.relationshipZoom || RELATIONSHIP_DEFAULT_ZOOM;
  relationshipPan = state.relationshipPan || { x: 0, y: 0 };
  relationshipRouteIndex = state.relationshipRouteIndex || 0;
  draftMessage = state.draftMessage || "";
  selectedSkillCards = [...(state.selectedSkillCards || [])];
  resultsOpen = Boolean(state.resultsOpen);
  selectedOpportunityId = "";
  route = "chat";
  render();
}

function createEmptyThread() {
  return {
    messages: [{ ...initialMessage }],
    chatResults: [],
    blockedChatResults: [],
    relationshipResult: null,
    resultMode: "opportunity",
    relationshipZoom: RELATIONSHIP_DEFAULT_ZOOM,
    relationshipPan: { x: 0, y: 0 },
    relationshipRouteIndex: 0,
    relationshipRouteIndex: 0,
    draftMessage: "",
    selectedSkillCards: [],
    resultsOpen: false
  };
}

const modeConfig = {
  radar: {
    label: "商机雷达",
    icon: "target",
    skills: [
      ["算法推荐", "请帮我列出{城市}、{业态}、{X个月}内到期的项目"],
      ["人脉图谱", "我要拓展{XXX项目}，请帮我看下有无人脉可以触达"],
      ["智能画像", "帮我生成{XXXX公司}的画像"],
      ["市场分析", "帮我生成{城市}、{业态}的市场分析报告"]
    ]
  },
  bid: {
    label: "AI 标书",
    icon: "book",
    skills: [
      ["招标文件解析", "解析招标文件的评分办法、资格条件和关键响应要求"],
      ["投标文件生成", "生成物业服务投标文件结构和核心章节草稿"],
      ["标书输出智检", "检查标书格式、响应遗漏、废标风险和一致性问题"],
      ["质疑函生成", "根据疑点条款生成质疑函和澄清问题清单"]
    ]
  },
  decision: {
    label: "AI 辅助决策",
    icon: "pin",
    skills: [
      ["应标资格评估", "判断当前资质、业绩和人员配置是否满足应标条件"],
      ["竞争对手分析", "分析区域竞争对手、历史中标习惯和报价区间"],
      ["项目成本测算", "测算人工、物料、管理成本和毛利空间"],
      ["报价策略建议", "给出报价区间、风险边界和投标策略建议"]
    ]
  }
};

const historySkillTabs = [
  "算法推荐",
  "人脉图谱",
  "智能画像",
  "市场分析",
  "招标文件解读",
  "投标文件生成",
  "标书输出智检",
  "质疑函生成",
  "应标资格评估",
  "竞争对手分析",
  "项目成本测算",
  "报价策略建议"
];

function icon(name) {
  if (name === "logo") return `<span class="logo-text" aria-hidden="true">DL</span>`;
  if (name === "api") return `<span class="api-icon" aria-hidden="true">{}</span>`;

  const paths = {
    search: '<circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path>',
    collapse: sidebarOpen ? '<path d="m15 18-6-6 6-6"></path>' : '<path d="m9 18 6-6-6-6"></path>',
    chat: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    target: '<circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle>',
    star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z"></path>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path>',
    book: '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4-4V4z"></path><path d="M5 4v12"></path>',
    history: '<path d="M4 12a8 8 0 1 0 2.3-5.7"></path><path d="M4 5v5h5"></path><path d="M12 8v5l3 2"></path>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7Z"></path><path d="M22 2 11 13"></path>',
    wand: '<path d="m15 4 5 5"></path><path d="m14 5 5-5 5 5-5 5-5-5Z"></path><path d="M4 20 15 9"></path><path d="m6 8 2 2"></path><path d="m2 14 2 2"></path>',
    paperclip: '<path d="m21.4 11.6-8.8 8.8a6 6 0 0 1-8.5-8.5l9.5-9.5a4 4 0 0 1 5.7 5.7l-9.5 9.5a2 2 0 0 1-2.8-2.8l8.8-8.8"></path>',
    mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><path d="M12 19v3"></path>',
    pin: '<path d="M12 3 4 11l9 9 7-8-8-9z"></path>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path>',
    upload: '<path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M20 20H4"></path>',
    plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    folder: '<path d="M3 6h7l2 2h9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 15h10l1-15"></path>',
    logout: '<path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M21 19V5a2 2 0 0 0-2-2h-6"></path>'
  };

  return `
    <svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${paths[name] || '<circle cx="12" cy="12" r="4"></circle>'}
    </svg>
  `;
}

function setRoute(nextRoute) {
  if (route === "chat") saveCurrentThread();
  route = nextRoute === "radar" ? "chat" : nextRoute;
  userMenuOpen = false;
  render();
}

function startNewChat() {
  userMenuOpen = false;
  loadChatThread(`draft-${Date.now()}`, createEmptyThread());
}

function openOpportunity(id) {
  if (route !== "opportunity") detailReturnRoute = route;
  selectedOpportunityId = id;
  detailMode = "normal";
  detailActiveSection = "项目基础信息";
  detailAnalysisPanel = "";
  detailBlockMenuOpen = false;
  detailHintOpen = true;
  route = "opportunity";
  render();
}

function openLibraryDetail(key) {
  selectedLibraryKey = key;
  selectedKnowledgeDocumentId = "";
  knowledgeSearch = "";
  knowledgeTypeFilter = "all";
  knowledgeStatusFilter = "all";
  knowledgeUploadOpen = false;
  knowledgeCategoryOpen = false;
  knowledgeNotice = "";
  route = "libraryDetail";
  render();
}

function openProjectWorkspace(id) {
  selectedOpportunityId = id;
  detailReturnRoute = "favorites";
  detailMode = "project";
  projectWorkspaceTab = "overview";
  detailAnalysisPanel = "";
  detailHintOpen = true;
  route = "opportunity";
  render();
}

function returnFromDetail() {
  route = detailReturnRoute || "chat";
  selectedOpportunityId = "";
  detailMode = "normal";
  detailAnalysisPanel = "";
  render();
}

function returnToLibrary() {
  const parentKey = getParentKnowledgeKey(selectedLibraryKey);
  if (parentKey) {
    openLibraryDetail(parentKey);
    return;
  }

  selectedLibraryKey = "";
  selectedKnowledgeDocumentId = "";
  knowledgeSearch = "";
  knowledgeTypeFilter = "all";
  knowledgeStatusFilter = "all";
  knowledgeUploadOpen = false;
  knowledgeCategoryOpen = false;
  knowledgeNotice = "";
  route = "library";
  render();
}

function startNewProjectDraft() {
  const state = createEmptyThread();
  state.draftMessage = "帮我新建一个项目，项目名称是：";
  focusComposer = true;
  loadChatThread(`project-${Date.now()}`, state);
}

async function openHistoryThread(item) {
  const threadId = `history-${item.id}`;
  if (chatThreads.has(threadId)) {
    loadChatThread(threadId, chatThreads.get(threadId));
    return;
  }

  const state = await buildHistoryThreadState(item);
  loadChatThread(threadId, state);
}

async function buildHistoryThreadState(item) {
  if (item.id === "conv-1") return buildStaticSchoolHistoryThreadState();
  if (item.id === "conv-2") return buildPotentialHistoryThreadState();
  if (item.id === "conv-3") return buildRelationshipHistoryThreadState(item);

  const result = buildOpportunityResult(item.prompt, await getOpportunities());
  const state = {
    messages: [
      {
        role: "user",
        content: item.prompt
      },
      {
        role: "assistant",
        content: result.reply,
        resultLink: result.opportunities.length > 0,
        resultLabel: `查看推荐结果（${result.opportunities.length}）`,
        suggestions: buildSuggestedQuestions(item.prompt, result.opportunities)
      }
    ],
    chatResults: result.opportunities,
    relationshipResult: null,
    resultMode: "opportunity",
    relationshipZoom: RELATIONSHIP_DEFAULT_ZOOM,
    relationshipPan: { x: 0, y: 0 },
    draftMessage: "",
    resultsOpen: false
  };
  return state;
}

function buildRelationshipHistoryThreadState(item) {
  const relationship = buildRelationshipResult();
  return {
    messages: [
      {
        role: "user",
        content: item.prompt
      },
      {
        role: "assistant",
        content: "请进行企业身份认证……"
      },
      {
        role: "assistant",
        content:
          "根据您的信息，为您建立三个人脉路径。\n\n路径一：市场拓展部小刘——新大正物业——重庆医科大学附属第一医院——重庆医科大学\n\n路径二：市场拓展部小刘——营销中心副总经理——后勤处主任——重庆医科大学\n\n路径三：市场拓展部小刘——小张——重庆医科大学附属第二医院——重庆医科大学",
        resultLink: true,
        resultLabel: "查看人脉图谱",
        suggestions: ["查看项目招投标历史信息", "补充更多人脉", "查看甲方画像"]
      }
    ],
    chatResults: [],
    relationshipResult: relationship,
    resultMode: "relationship",
    relationshipZoom: RELATIONSHIP_DEFAULT_ZOOM,
    relationshipPan: { x: 0, y: 0 },
    relationshipRouteIndex: 0,
    draftMessage: "",
    resultsOpen: true
  };
}

function buildRelationshipResult() {
  const nodes = [
    { id: "N1", name: "市场拓展部小刘", type: "人员", role: "市场拓展部", tone: "person", x: 46, y: 230 },
    { id: "N2", name: "营销中心副总经理", type: "人员", role: "营销中心副总经理", tone: "green", x: 330, y: 70 },
    { id: "N3", name: "后勤处主任：XXX", type: "人员", role: "后勤处主任", tone: "green", x: 662, y: 70 },
    { id: "N4", name: "新大正物业", type: "企业", tone: "orange", x: 330, y: 260 },
    { id: "N5", name: "重庆医科大学附属第一医院", type: "医院/事业单位", tone: "orange", x: 604, y: 260 },
    { id: "N6", name: "望家欢农产品集团有限公司", type: "企业", tone: "orange", x: 535, y: 395 },
    { id: "N7", name: "目标项目：重庆医科大学", type: "目标项目/高校", tone: "target", x: 830, y: 260 },
    { id: "N8", name: "XXX合资公司", type: "企业", tone: "brown", x: 292, y: 468 },
    { id: "N9", name: "XXX", type: "主体/个人或法人", tone: "brown", x: 486, y: 468 },
    { id: "N10", name: "重庆军医大投资管理公司", type: "企业", tone: "brown", x: 692, y: 468 },
    { id: "N11", name: "小张", type: "人员", tone: "pink", x: 46, y: 540 },
    { id: "N12", name: "重庆医科大学附属第二医院", type: "医院/事业单位", tone: "pink", x: 535, y: 540 }
  ];
  const edges = [
    { from: "N1", to: "N2", relation: "同事", color: "gray" },
    { from: "N1", to: "N4", relation: "职员", color: "red" },
    { from: "N1", to: "N11", relation: "妻子", color: "gray" },
    { from: "N2", to: "N3", relation: "朋友", color: "gray" },
    { from: "N2", to: "N4", relation: "任职", color: "gray" },
    { from: "N4", to: "N5", relation: "服务", color: "red" },
    { from: "N4", to: "N6", relation: "服务", color: "gray" },
    { from: "N4", to: "N8", relation: "参股40%", color: "gray" },
    { from: "N5", to: "N7", relation: "上级单位", color: "red" },
    { from: "N6", to: "N7", relation: "供应商", color: "gray" },
    { from: "N7", to: "N3", relation: "员工", color: "gray" },
    { from: "N7", to: "N10", relation: "100%控股", color: "gray" },
    { from: "N8", to: "N9", relation: "法人", color: "gray" },
    { from: "N9", to: "N10", relation: "参股10%", color: "gray" },
    { from: "N11", to: "N12", relation: "任职", color: "gray" },
    { from: "N12", to: "N7", relation: "上级单位", color: "gray" }
  ];
  return {
    title: "人脉穿透",
    summary:
      "基于企业身份认证、历史中标关系和重庆教育系统资源，系统识别出 3 条可触达重庆医科大学绿化项目的路径。其中，新大正物业服务关系与附属医院链路优先级最高。",
    nodes,
    edges,
    routes: [
      "市场拓展部小刘——新大正物业——重庆医科大学附属第一医院——重庆医科大学",
      "市场拓展部小刘——营销中心副总经理——后勤处主任——重庆医科大学",
      "市场拓展部小刘——小张——重庆医科大学附属第二医院——重庆医科大学"
    ],
    routeEdges: [
      [
        ["N1", "N4"],
        ["N4", "N5"],
        ["N5", "N7"]
      ],
      [
        ["N1", "N2"],
        ["N2", "N3"],
        ["N7", "N3"]
      ],
      [
        ["N1", "N11"],
        ["N11", "N12"],
        ["N12", "N7"]
      ]
    ]
  };
}

async function buildStaticSchoolHistoryThreadState() {
  const opportunities = await getOpportunities();
  const results = buildHistoryResultList(opportunities, "school");
  return {
    messages: [
      { role: "user", content: "帮我查一下重庆现在学校有哪些挂网的物业项目？" },
      { role: "assistant", content: "好的，我搜一下。" },
      { role: "assistant", content: "共命中 17 个项目。" },
      { role: "assistant", content: "不过我记得您的偏好金额是 100-1000 万，要不要先按这个条件缩小范围？" },
      { role: "user", content: "按偏好过滤" },
      { role: "assistant", content: "好的，100-1000万范围内剩下 11 个。" },
      { role: "assistant", content: "我再确认一个细节——学校物业分类比较多，您想重点看哪类？" },
      { role: "user", content: "高校" },
      { role: "assistant", content: "明白了，高校项目，最终筛出 6 个项目，按发布时间倒序排列。" },
      { role: "assistant", content: "现在列出的是已经发布招标公告的项目。是否需要帮您列出未来六个月到期的未挂网的潜在商机项目信息？" },
      { role: "user", content: "需要" },
      {
        role: "assistant",
        content: "已列出。您现在是非会员，每日只能看5条信息。如需查看更多项目信息，请充值。",
        resultLink: true,
        resultLabel: "查看推荐结果",
        suggestions: ["帮我订阅重庆高校物业项目", "只看100-1000万项目", "把高匹配项目加入AI盯标"]
      }
    ],
    chatResults: results,
    relationshipResult: null,
    resultMode: "opportunity",
    relationshipZoom: RELATIONSHIP_DEFAULT_ZOOM,
    relationshipPan: { x: 0, y: 0 },
    relationshipRouteIndex: 0,
    draftMessage: "",
    resultsOpen: false
  };
}

async function buildPotentialHistoryThreadState() {
  const opportunities = await getOpportunities();
  const results = buildHistoryResultList(opportunities, "potential");
  return {
    messages: [
      { role: "user", content: "查找重庆未来六个月到期的学校物业合同" },
      { role: "assistant", content: "好的，我会优先筛选重庆学校业态、未来六个月内合同到期、暂未挂网但适合提前建联的项目。" },
      { role: "assistant", content: `共筛出 ${results.length} 个未挂网潜在商机，均建议先进入提前建联和持续盯防。` },
      {
        role: "assistant",
        content: "这些项目目前不是正式招标公告，重点不是立刻报名，而是确认合同到期窗口、现服务商关系、采购计划和校方关键联系人。",
        resultLink: true,
        resultLabel: `查看推荐结果（${results.length}）`,
        suggestions: ["把这4个项目加入AI盯标", "生成提前建联计划", "按匹配度排序"]
      }
    ],
    chatResults: results,
    relationshipResult: null,
    resultMode: "opportunity",
    relationshipZoom: RELATIONSHIP_DEFAULT_ZOOM,
    relationshipPan: { x: 0, y: 0 },
    relationshipRouteIndex: 0,
    draftMessage: "",
    resultsOpen: false
  };
}

function buildHistoryResultList(opportunities, scope = "school") {
  if (scope === "potential") {
    return opportunities
      .filter((item) => item.city === "重庆" && item.industry === "学校" && item.type === "即将到期")
      .sort((a, b) => b.match - a.match)
      .slice(0, 4);
  }

  const base = opportunities.filter((item) => item.city === "重庆" && item.industry === "学校" && (scope !== "school" || item.type === "实时招标"));
  const synthetic = [
    {
      id: "hist-school-1",
      title: "重庆大学虎溪校区物业管理服务项目",
      type: "实时招标",
      city: "重庆",
      industry: "学校",
      match: 95,
      buyer: "重庆大学",
      budget: "860万元",
      summary: "高校园区物业服务，已发布招标公告。",
      reasons: ["高校/大学", "100-1000万", "已挂网"]
    },
    {
      id: "hist-school-2",
      title: "西南大学北碚校区后勤物业服务项目",
      type: "实时招标",
      city: "重庆",
      industry: "学校",
      match: 92,
      buyer: "西南大学",
      budget: "980万元",
      summary: "高校综合后勤物业，按发布时间倒序展示。",
      reasons: ["高校/大学", "偏好金额", "招标公告"]
    },
    {
      id: "hist-school-3",
      title: "重庆师范大学大学城校区物业服务项目",
      type: "实时招标",
      city: "重庆",
      industry: "学校",
      match: 89,
      buyer: "重庆师范大学",
      budget: "720万元",
      summary: "教学区、宿舍区、公共区域物业服务。",
      reasons: ["高校/大学", "学校物业", "近期待办"]
    },
    {
      id: "hist-school-4",
      title: "重庆医科大学缙云校区物业保障项目",
      type: "实时招标",
      city: "重庆",
      industry: "学校",
      match: 87,
      buyer: "重庆医科大学",
      budget: "640万元",
      summary: "高校后勤保障与物业综合服务。",
      reasons: ["高校/大学", "100-1000万", "公告已发布"]
    }
  ];
  const merged = base.length >= 6 ? base : [...base, ...synthetic];
  return (scope === "all" ? merged : merged.filter((item) => Number(String(item.budget).match(/\d+/)?.[0] || 0) <= 1000)).slice(0, 6);
}

function buildOpportunityResult(content, opportunities) {
  const normalized = content.replace(/\s/g, "");
  let matches = [...opportunities];

  if (normalized.includes("重庆")) matches = matches.filter((item) => item.city === "重庆");
  if (normalized.includes("成都")) matches = matches.filter((item) => item.city === "成都");
  if (normalized.includes("学校")) matches = matches.filter((item) => item.industry === "学校");
  if (normalized.includes("医院")) matches = matches.filter((item) => item.industry === "医院");
  if (normalized.includes("到期")) matches = matches.filter((item) => item.type === "即将到期");
  if (normalized.includes("挂网") || normalized.includes("招标")) matches = matches.filter((item) => item.type === "实时招标");

  matches = matches.sort((a, b) => b.match - a.match).slice(0, 3);

  return {
    reply: matches.length
      ? `已筛出 ${matches.length} 条相关商机，并按匹配度排序。建议先处理靠前项目的报名材料与关键联系人路径。`
      : "暂未找到完全匹配的商机。可以放宽城市、业态或时间条件继续筛选。",
    opportunities: matches
  };
}

function getBlockedOpportunityRules() {
  try {
    return JSON.parse(localStorage.getItem(BLOCKED_OPPORTUNITIES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveBlockedOpportunityRules(rules) {
  localStorage.setItem(BLOCKED_OPPORTUNITIES_KEY, JSON.stringify(rules));
}

function getOpportunityBlockValue(item, type) {
  if (type === "project") return item.id;
  if (type === "buyer") return item.buyer || "";
  if (type === "industry") return item.industry || "";
  return "";
}

function isOpportunityBlocked(item, rules = getBlockedOpportunityRules()) {
  return rules.some((rule) => getOpportunityBlockValue(item, rule.type) === rule.value);
}

function splitBlockedOpportunities(list, rules = getBlockedOpportunityRules()) {
  const visible = [];
  const blocked = [];
  list.forEach((item) => {
    if (isOpportunityBlocked(item, rules)) blocked.push(item);
    else visible.push(item);
  });
  return { visible, blocked };
}

function getOpportunityBlockOptions(item) {
  return [
    {
      type: "project",
      label: "仅该项目",
      desc: "只屏蔽当前这一个标讯，不影响其他项目。",
      value: getOpportunityBlockValue(item, "project")
    },
    {
      type: "buyer",
      label: "该招标单位",
      desc: "屏蔽该甲方/代理机构发布的项目，并降低关联单位匹配权重。",
      value: getOpportunityBlockValue(item, "buyer")
    },
    {
      type: "industry",
      label: "该业态",
      desc: "屏蔽同一物业业态标讯，并降低关联单位匹配权重。",
      value: getOpportunityBlockValue(item, "industry")
    }
  ];
}

function blockOpportunityByRule(item, type) {
  const option = getOpportunityBlockOptions(item).find((entry) => entry.type === type);
  if (!option?.value) return;
  const rules = getBlockedOpportunityRules();
  const nextRule = {
    type,
    value: option.value,
    label: option.label,
    sourceTitle: item.title,
    createdAt: new Date().toISOString()
  };
  const nextRules = rules.some((rule) => rule.type === nextRule.type && rule.value === nextRule.value) ? rules : [...rules, nextRule];
  saveBlockedOpportunityRules(nextRules);
}

function pageTitle() {
  const titles = {
    chat: "新建对话",
    recommendations: "推荐商机",
    watch: "AI盯标",
    favorites: "我的项目",
    projectWorkspace: "项目工作台",
    preferences: "商机偏好设置",
    historyCenter: "历史对话",
    library: "知识库",
    libraryDetail: "知识库详情",
    api: "后端接口"
  };
  return titles[route] || "新建对话";
}

async function render() {
  if (!isAuthenticated) {
    app.innerHTML = renderLoginPage();
    bindLoginEvents();
    return;
  }

  const [summary, conversations] = await Promise.all([getRadarSummary(), getConversations()]);

  app.innerHTML = `
    <div class="app-shell ${sidebarOpen ? "" : "is-collapsed"}">
      ${renderSidebar(conversations)}
      <main class="workspace">
        ${renderRadar(summary)}
        <section class="workspace-body" aria-label="${pageTitle()}">
          ${await renderRoute()}
        </section>
      </main>
    </div>
  `;

  bindEvents();
  scrollMessages();
}

const companyCandidates = [
  { name: "新大正物业集团股份有限公司", city: "重庆市" },
  { name: "重庆新大正物业管理有限公司", city: "重庆市" },
  { name: "深圳市深粮贝格厨房食品供应链有限公司", city: "深圳市" },
  { name: "湖南省地质灾害综合治理工程有限公司", city: "长沙市" },
  { name: "成都高新区智慧物业服务有限公司", city: "成都市" }
];

function completeLogin() {
  localStorage.setItem(AUTH_STORAGE_KEY, "1");
  isAuthenticated = true;
  loginLoading = false;
  loginError = "";
  onboardingError = "";
  onboardingStep = 0;
  loginMode = "wechat";
  route = "chat";
  render();
}

function showRegisterOnboarding() {
  loginMode = "register";
  onboardingStep = 0;
  onboardingError = "";
  loginLoading = false;
  render();
}

function renderAgentBubble(content, extra = "") {
  return `
    <article class="agent-message ai">
      <div class="agent-avatar">${icon("logo")}</div>
      <div class="agent-bubble">
        ${content}
        ${extra}
      </div>
    </article>
  `;
}

function renderUserChoiceBubble(label) {
  return `
    <article class="agent-message user">
      <div class="agent-bubble">${label}</div>
      <strong>用户</strong>
    </article>
  `;
}

function maskPhone(phone) {
  if (!phone) return "未填写";
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

function onboardingPreferenceSummary() {
  const tags = [
    onboardingPreference.cities.length ? `城市：${onboardingPreference.cities.join("、")}` : "城市：未设置",
    onboardingPreference.propertyTypes.length ? `业态：${onboardingPreference.propertyTypes.join("、")}` : "业态：不限",
    onboardingPreference.serviceTypes.length ? `服务：${onboardingPreference.serviceTypes.join("、")}` : "服务：不限",
    `金额：${onboardingPreference.amountMin}-${onboardingPreference.amountMax}万元`
  ];
  return tags.join(" / ");
}

function renderCompanySuggestionButtons(query) {
  const keyword = String(query || "").trim();
  if (keyword.length < 2) return "";
  const matched = companyCandidates
    .filter((item) => item.name.includes(keyword) || item.city.includes(keyword))
    .slice(0, 4);
  if (!matched.length) return `<p class="company-empty">暂未找到匹配企业，可继续输入完整名称。</p>`;
  return `
    <div class="company-suggestions">
      ${matched
        .map(
          (item) => `
            <button type="button" data-company-suggestion="${item.name}" data-company-city="${item.city}">
              <strong>${item.name}</strong>
              <span>${item.city}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderOnboardingIntro() {
  return `
    ${renderAgentBubble(`
      <p>您好，欢迎使用数据灯塔！我可以帮您<strong>精准匹配商机、智能生成标书、辅助投标决策</strong>。</p>
      <p>为了给您推荐最匹配的项目，我需要先了解一些基本信息——<strong>大概2分钟就能完成</strong>。</p>
    `)}
    ${renderAgentBubble(`<p>接下来我会依次帮您确认：① 个人基础信息 ② 您所在的公司 ③ 您关注的商机类型。准备好了吗？</p>`)}
    <div class="agent-choice-row">
      <button type="button" data-onboarding-start>开始设置</button>
      <button type="button" data-onboarding-skip>跳过，以后再说</button>
    </div>
  `;
}

function renderPersonalStep() {
  return `
    ${renderUserChoiceBubble("开始设置")}
    ${renderAgentBubble(`
      <p>首先，请填写您的基本信息，这将用于商机推送通知。</p>
      <form class="agent-form personal-form" id="onboardingPersonalForm" novalidate>
        <label><span>姓名*</span><input name="name" value="${escapeHtml(onboardingProfile.name)}" placeholder="请输入姓名" /></label>
        <label><span>手机号*</span><input name="phone" inputmode="tel" value="${escapeHtml(onboardingProfile.phone)}" placeholder="请输入手机号" /></label>
        <label><span>验证码*</span><input name="code" inputmode="numeric" value="${escapeHtml(onboardingProfile.code)}" placeholder="请输入验证码" /></label>
        <label><span>邮箱</span><input name="email" value="${escapeHtml(onboardingProfile.email)}" placeholder="用于商机推送" /></label>
        ${onboardingError ? `<p class="agent-error">${onboardingError}</p>` : ""}
        <div class="agent-form-actions">
          <button type="submit">下一步</button>
          <button type="button" data-onboarding-skip>跳过</button>
        </div>
      </form>
    `)}
  `;
}

function renderOnboardingBackButton() {
  return `<button type="button" data-onboarding-prev>上一步</button>`;
}

function renderCompanyStep() {
  const query = onboardingCompany.query || onboardingCompany.selected;
  return `
    ${renderAgentBubble(`
      <p>请选择或输入您的公司——这将帮我更精准地识别您的市场机会。</p>
      <form class="agent-form company-form" id="onboardingCompanyForm" novalidate>
        <label>
          <span>请输入您的企业名</span>
          <input name="company" value="${escapeHtml(query)}" placeholder="输入2字以上触发模糊搜索" autocomplete="off" />
        </label>
        <div data-company-suggestion-list>${renderCompanySuggestionButtons(query)}</div>
        ${onboardingError ? `<p class="agent-error">${onboardingError}</p>` : ""}
        <div class="agent-form-actions">
          ${renderOnboardingBackButton()}
          <button type="submit">下一步</button>
          <button type="button" data-onboarding-skip>跳过</button>
        </div>
      </form>
    `)}
  `;
}

function renderPreferenceChipGroup(items, selected, field) {
  return items
    .map(
      (item) => `
        <label class="agent-chip">
          <input type="checkbox" value="${item}" data-onboarding-pref="${field}" ${selected.includes(item) ? "checked" : ""} />
          <span>${item}</span>
        </label>
      `
    )
    .join("");
}

function renderPreferenceStep() {
  return `
    ${renderAgentBubble(`
      <p>最后一步——告诉我您关注哪类商机，我会优先为您推荐。</p>
      <form class="agent-form preference-onboarding-form" id="onboardingPreferenceForm" novalidate>
        <section class="agent-pref-section">
          <div class="agent-pref-title"><strong>商机城市</strong><em>多选</em></div>
          <div class="agent-city-row">
            <select name="province">
              <option ${onboardingPreference.province === "重庆市" ? "selected" : ""}>重庆市</option>
              <option ${onboardingPreference.province === "四川省" ? "selected" : ""}>四川省</option>
              <option ${onboardingPreference.province === "湖南省" ? "selected" : ""}>湖南省</option>
              <option ${onboardingPreference.province === "广东省" ? "selected" : ""}>广东省</option>
            </select>
            <select name="city">
              <option ${onboardingPreference.city === "重庆市" ? "selected" : ""}>重庆市</option>
              <option ${onboardingPreference.city === "成都市" ? "selected" : ""}>成都市</option>
              <option ${onboardingPreference.city === "长沙市" ? "selected" : ""}>长沙市</option>
              <option ${onboardingPreference.city === "深圳市" ? "selected" : ""}>深圳市</option>
            </select>
            <button type="button" data-add-onboarding-city>+ 添加城市</button>
          </div>
          <div class="selected-city-row">
            ${onboardingPreference.cities
              .map(
                (city) => `
                  <span class="selected-city-pill">
                    ${city}
                    <button type="button" aria-label="删除${city}" data-remove-onboarding-city="${city}">×</button>
                  </span>
                `
              )
              .join("")}
          </div>
        </section>
        <section class="agent-pref-section">
          <div class="agent-pref-title"><strong>物业业态</strong><em>多选</em></div>
          <div class="agent-chip-grid">${renderPreferenceChipGroup(["住宅小区", "写字楼", "商业综合体", "工业园区", "医院", "学校", "政府机关", "交通枢纽", "不限"], onboardingPreference.propertyTypes, "propertyTypes")}</div>
        </section>
        <section class="agent-pref-section">
          <div class="agent-pref-title"><strong>物业服务类型</strong><em>多选</em></div>
          <div class="agent-chip-grid">${renderPreferenceChipGroup(["物业管理（全委）", "保安服务", "保洁服务", "绿化养护", "工程维修", "食堂餐饮", "会务接待", "不限"], onboardingPreference.serviceTypes, "serviceTypes")}</div>
        </section>
        <section class="agent-pref-section">
          <div class="agent-pref-title"><strong>项目金额</strong><em>区间</em></div>
          <div class="preference-amount agent-amount">
            <div>
              <strong>项目金额</strong>
              <span>最小金额 <b data-amount-min-label>${onboardingPreference.amountMin}</b> 万元 / 最大金额 <b data-amount-max-label>${onboardingPreference.amountMax}</b> 万元</span>
            </div>
            <div class="dual-range" data-dual-range>
              <input type="range" min="0" max="5000" value="${onboardingPreference.amountMin}" step="50" data-amount-min aria-label="最小项目金额" />
              <input type="range" min="0" max="5000" value="${onboardingPreference.amountMax}" step="50" data-amount-max aria-label="最大项目金额" />
              <div class="amount-range-values"><span>0万元</span><span>5000万元</span></div>
            </div>
          </div>
        </section>
        <div class="agent-form-actions">
          ${renderOnboardingBackButton()}
          <button type="submit">下一步</button>
          <button type="button" data-onboarding-skip>跳过</button>
        </div>
      </form>
    `)}
  `;
}

function renderConfirmStep() {
  const companyName = onboardingCompany.selected || onboardingCompany.query || "未填写";
  return `
    ${renderAgentBubble(`
      <p>信息确认如下，请核对：</p>
      <dl class="agent-confirm-list">
        <dt>个人</dt><dd>${escapeHtml(onboardingProfile.name || "未填写")}，${maskPhone(onboardingProfile.phone)}，${escapeHtml(onboardingProfile.email || "未填写")}</dd>
        <dt>公司</dt><dd>${escapeHtml(companyName)}，${escapeHtml(onboardingCompany.city || "未填写")}</dd>
        <dt>商机偏好</dt><dd>${escapeHtml(onboardingPreferenceSummary() || "未设置（全量推荐）")}</dd>
      </dl>
      <p>确认无误后，我将立即为您匹配商机。</p>
      <div class="agent-form-actions">
        ${renderOnboardingBackButton()}
        <button type="button" data-onboarding-confirm>确认</button>
      </div>
    `)}
  `;
}

function renderRegisterOnboardingPage() {
  const stepContent = onboardingStep === 0 ? renderOnboardingIntro() : onboardingStep === 1 ? renderPersonalStep() : onboardingStep === 2 ? renderCompanyStep() : onboardingStep === 3 ? renderPreferenceStep() : renderConfirmStep();
  return `
    <main class="login-page register-agent-page" aria-label="快速注册引导">
      <section class="agent-register-stage">
        <header class="agent-register-top">
          <div class="agent-brand">
            <span class="login-logo">${icon("logo")}</span>
            <div>
              <strong>数据灯塔AI</strong>
              <small>物业市场增长AI助手</small>
            </div>
          </div>
          <button type="button" data-login-mode="wechat">返回登录</button>
        </header>
        <div class="agent-register-shell">
          <section class="agent-register-chat">
            <p class="agent-register-title">首次登录，用户引导</p>
            ${stepContent}
          </section>
        </div>
      </section>
    </main>
  `;
}

function renderLoginPage() {
  if (loginMode === "register") return renderRegisterOnboardingPage();

  return `
    <main class="login-page ${loginLoading ? "is-authenticating" : ""}" aria-label="Data Lighthouse 登录">
      <section class="login-stage">
        <div class="login-visual" aria-label="商机雷达驾驶舱">
          <div class="login-visual-grid" aria-hidden="true"></div>
          <div class="login-brand-lockup">
            <span class="login-logo">${icon("logo")}</span>
            <div>
              <strong>数据灯塔AI</strong>
              <small>Data Lighthouse AI</small>
            </div>
          </div>

          <div class="login-opportunity-card card-new">
            <span>今日新增商机</span>
            <strong>1,286</strong>
            <em>↑ 12.5%</em>
          </div>
          <div class="login-opportunity-card card-bid">
            <span>今日中标</span>
            <strong>348</strong>
            <em>↑ 12.5%</em>
          </div>
          <div class="login-opportunity-card card-million">
            <span>今日新增商机合同金额</span>
            <strong>92</strong>
            <em>↑ 12.5%</em>
          </div>
          <div class="login-opportunity-card card-billion">
            <span>新增中标合同金额</span>
            <strong>17</strong>
            <em>↑ 12.5%</em>
          </div>

          <div class="radar-stage" aria-hidden="true">
            <span class="radar-halo halo-one"></span>
            <span class="radar-halo halo-two"></span>
            <span class="radar-halo halo-three"></span>
            <span class="radar-cross cross-x"></span>
            <span class="radar-cross cross-y"></span>
            <span class="radar-scan-beam"></span>
            <i class="radar-point point-a"></i>
            <i class="radar-point point-b"></i>
            <i class="radar-point point-c"></i>
            <i class="radar-point point-d"></i>
            <i class="radar-point point-e"></i>
          </div>

          <div class="login-slogan">
            <h1>商机快人一步，投标胜人一筹</h1>
            <p>数据驱动 · 智能决策 · 赋能增长</p>
          </div>
        </div>

        <aside class="login-panel" aria-label="账号登录">
          <div class="login-panel-head">
            <div class="login-panel-title">
              <span class="login-panel-mark">${icon("logo")}</span>
              <div>
                <strong>欢迎登录</strong>
                <small>${loginMode === "wechat" ? "使用微信授权快速进入工作台" : "使用账号进入数据灯塔AI工作台"}</small>
              </div>
            </div>
            <button class="quick-register-button" type="button" data-login-mode="register">快速注册</button>
          </div>

          <div class="login-tabs" role="tablist" aria-label="登录方式">
            <button class="${loginMode === "wechat" ? "active" : ""}" type="button" data-login-mode="wechat">微信一键登录</button>
            <button class="${loginMode === "password" ? "active" : ""}" type="button" data-login-mode="password">密码登录</button>
          </div>

          ${
            loginMode === "wechat"
              ? `<div class="wechat-login-panel">
                  <div class="wechat-orb" aria-hidden="true">
                    <span></span>
                  </div>
                  <div>
                    <h2>微信一键登录</h2>
                    <p>无需注册账号，使用微信授权即可快速登录。</p>
                  </div>
                  ${loginError ? `<p class="login-error" role="alert">${loginError}</p>` : ""}
                  <button class="wechat-login-button" type="button" data-wechat-login ${loginLoading ? "disabled" : ""}>
                    <span>${loginLoading ? "正在授权" : "微信授权登录"}</span>
                  </button>
                  <label class="remember-line login-agreement">
                    <input type="checkbox" checked ${loginLoading ? "disabled" : ""} />
                    <span>我已阅读并同意《用户服务协议》和《隐私政策》</span>
                  </label>
                </div>`
              : `<form class="login-form" id="loginForm" novalidate>
                  <label>
                    <span>用户名</span>
                    <input name="username" autocomplete="username" value="${escapeHtml(loginUsername)}" placeholder="请输入用户名" ${loginLoading ? "disabled" : ""} />
                  </label>
                  <label>
                    <span>密码</span>
                    <input name="password" type="password" autocomplete="current-password" value="${escapeHtml(loginPassword)}" placeholder="请输入密码" ${loginLoading ? "disabled" : ""} />
                  </label>

                  <div class="login-options">
                    <label class="remember-line">
                      <input name="remember" type="checkbox" checked ${loginLoading ? "disabled" : ""} />
                      <span>记住我</span>
                    </label>
                    <button type="button" class="forgot-button" ${loginLoading ? "disabled" : ""}>忘记密码</button>
                  </div>

                  ${loginError ? `<p class="login-error" role="alert">${loginError}</p>` : ""}

                  <button class="login-submit" type="submit" ${loginLoading ? "disabled" : ""}>
                    <span>${loginLoading ? "正在登录" : "登录"}</span>
                  </button>
                </form>`
          }
        </aside>
      </section>
    </main>
  `;
}

function bindLoginEvents() {
  document.querySelectorAll("[data-login-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      loginMode = button.dataset.loginMode;
      loginError = "";
      onboardingError = "";
      if (loginMode === "register") onboardingStep = 0;
      render();
    });
  });

  bindOnboardingEvents();
  bindPreferenceAmountRange();

  const wechatButton = document.querySelector("[data-wechat-login]");
  if (wechatButton) {
    wechatButton.addEventListener("click", () => {
      if (loginLoading) return;
      loginError = "";
      loginLoading = true;
      render();

      window.setTimeout(() => {
        showRegisterOnboarding();
      }, 700);
    });
  }

  const form = document.querySelector("#loginForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (loginLoading) return;

    loginUsername = String(form.elements.username.value || "").trim();
    loginPassword = String(form.elements.password.value || "").trim();

    if (!loginUsername || !loginPassword) {
      loginError = "请输入用户名和密码";
      render();
      return;
    }

    loginError = "";
    loginLoading = true;
    render();

    window.setTimeout(() => {
      showRegisterOnboarding();
    }, 700);
  });

  const forgotButton = document.querySelector(".forgot-button");
  if (forgotButton) {
    forgotButton.addEventListener("click", () => {
      loginError = "请联系系统管理员重置密码";
      render();
    });
  }
}

function collectOnboardingPreference() {
  const form = document.querySelector("#onboardingPreferenceForm");
  if (!form) return;
  const minInput = form.querySelector("[data-amount-min]");
  const maxInput = form.querySelector("[data-amount-max]");
  onboardingPreference = {
    ...onboardingPreference,
    province: form.elements.province.value,
    city: form.elements.city.value,
    amountMin: minInput ? minInput.value : onboardingPreference.amountMin,
    amountMax: maxInput ? maxInput.value : onboardingPreference.amountMax,
    propertyTypes: [...form.querySelectorAll('[data-onboarding-pref="propertyTypes"]:checked')].map((input) => input.value),
    serviceTypes: [...form.querySelectorAll('[data-onboarding-pref="serviceTypes"]:checked')].map((input) => input.value)
  };
}

function bindOnboardingEvents() {
  document.querySelectorAll("[data-onboarding-start]").forEach((button) => {
    button.addEventListener("click", () => {
      onboardingStep = 1;
      onboardingError = "";
      render();
    });
  });

  document.querySelectorAll("[data-onboarding-skip]").forEach((button) => {
    button.addEventListener("click", () => completeLogin());
  });

  document.querySelectorAll("[data-onboarding-confirm]").forEach((button) => {
    button.addEventListener("click", () => completeLogin());
  });

  document.querySelectorAll("[data-onboarding-prev]").forEach((button) => {
    button.addEventListener("click", () => {
      onboardingStep = Math.max(1, onboardingStep - 1);
      onboardingError = "";
      render();
    });
  });

  document.querySelectorAll("[data-add-onboarding-city]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.querySelector("#onboardingPreferenceForm");
      if (!form) return;
      const city = form.elements.city.value;
      if (!onboardingPreference.cities.includes(city)) {
        onboardingPreference = {
          ...onboardingPreference,
          province: form.elements.province.value,
          city,
          cities: [...onboardingPreference.cities, city]
        };
      }
      render();
    });
  });

  document.querySelectorAll("[data-remove-onboarding-city]").forEach((button) => {
    button.addEventListener("click", () => {
      const city = button.dataset.removeOnboardingCity;
      const nextCities = onboardingPreference.cities.filter((item) => item !== city);
      onboardingPreference = {
        ...onboardingPreference,
        cities: nextCities.length ? nextCities : []
      };
      render();
    });
  });

  document.querySelectorAll("[data-company-suggestion]").forEach((button) => {
    button.addEventListener("click", () => {
      onboardingCompany = {
        query: button.dataset.companySuggestion,
        selected: button.dataset.companySuggestion,
        city: button.dataset.companyCity || onboardingCompany.city
      };
      render();
    });
  });

  const personalForm = document.querySelector("#onboardingPersonalForm");
  if (personalForm) {
    personalForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const next = {
        name: String(personalForm.elements.name.value || "").trim(),
        phone: String(personalForm.elements.phone.value || "").trim(),
        code: String(personalForm.elements.code.value || "").trim(),
        email: String(personalForm.elements.email.value || "").trim()
      };
      onboardingProfile = next;
      if (!next.name || !next.phone || !next.code) {
        onboardingError = "请填写姓名、手机号和验证码。";
        render();
        return;
      }
      if (!/^1\d{10}$/.test(next.phone)) {
        onboardingError = "请输入 11 位手机号。";
        render();
        return;
      }
      if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) {
        onboardingError = "请输入正确的邮箱格式。";
        render();
        return;
      }
      onboardingError = "";
      onboardingStep = 2;
      render();
    });
  }

  const companyForm = document.querySelector("#onboardingCompanyForm");
  if (companyForm) {
    const input = companyForm.elements.company;
    input.addEventListener("input", () => {
      onboardingCompany = { ...onboardingCompany, query: input.value, selected: "" };
      const list = companyForm.querySelector("[data-company-suggestion-list]");
      if (list) list.innerHTML = renderCompanySuggestionButtons(input.value);
      list?.querySelectorAll("[data-company-suggestion]").forEach((button) => {
        button.addEventListener("click", () => {
          onboardingCompany = {
            query: button.dataset.companySuggestion,
            selected: button.dataset.companySuggestion,
            city: button.dataset.companyCity || onboardingCompany.city
          };
          render();
        });
      });
    });
    companyForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = String(companyForm.elements.company.value || "").trim();
      onboardingCompany = {
        ...onboardingCompany,
        query: value,
        selected: onboardingCompany.selected || value
      };
      if (value.length < 2) {
        onboardingError = "请输入至少 2 个字的企业名称。";
        render();
        return;
      }
      onboardingError = "";
      onboardingStep = 3;
      render();
    });
  }

  const preferenceForm = document.querySelector("#onboardingPreferenceForm");
  if (preferenceForm) {
    preferenceForm.addEventListener("submit", (event) => {
      event.preventDefault();
      collectOnboardingPreference();
      onboardingStep = 4;
      onboardingError = "";
      render();
    });
  }
}

function handleLogout() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  isAuthenticated = false;
  loginLoading = false;
  loginError = "";
  loginPassword = "";
  loginMode = "wechat";
  onboardingStep = 0;
  onboardingError = "";
  userMenuOpen = false;
  render();
}

function renderUserMenu() {
  return `
    <div class="user-popover" role="menu" aria-label="用户信息">
      <div class="user-popover-head">
        <span class="user-avatar user-popover-avatar" aria-hidden="true">用</span>
        <div class="user-popover-identity">
          <strong>市场拓展用户</strong>
          <span>新大正物业集团股份有限公司 <em>已认证</em></span>
        </div>
      </div>
      <div class="user-tier-options" aria-label="用户等级">
        <span>普通用户</span>
        <strong>VIP用户</strong>
        <span>SVIP用户</span>
      </div>
      <div class="user-menu-list">
        <button type="button" data-user-menu-action="preference">商机偏好设置</button>
        <button type="button" data-user-menu-action="settings">系统设置</button>
        <button type="button" data-user-menu-action="support">帮助与客服</button>
        <button type="button" data-user-menu-action="update">检查更新</button>
        <button class="danger" type="button" data-logout>${icon("logout")}退出登录</button>
      </div>
    </div>
  `;
}

function renderSidebar(conversations) {
  return `
    <aside class="sidebar" aria-label="主导航">
      <div class="brand-row">
        <button class="brand-button" data-new-chat title="回到新建对话">
          <span class="brand-mark">${icon("logo")}</span>
          <span class="brand-copy">
            <strong>Data Lighthouse</strong>
            <small>数据灯塔 AI</small>
          </span>
        </button>
        <button class="square-button" data-toggle-sidebar title="隐藏侧边栏">${icon("collapse")}</button>
      </div>

      <nav class="nav-list" aria-label="功能导航">
        <button class="nav-button ${route === "chat" && !hasConversation() ? "active" : ""}" data-new-chat>
          ${icon("chat")}
          <span>新建对话</span>
        </button>
        ${navButton("target", "watch", "AI盯标")}
        ${navButton("star", "favorites", "我的项目")}
        <div class="subscription-block" aria-label="我的订阅">
          <button class="subscription-head" type="button" data-toggle-subscriptions>
            ${icon("bell")}
            <span>我的订阅</span>
          </button>
          <button class="subscription-toggle" data-toggle-subscriptions aria-expanded="${subscriptionOpen}" title="${subscriptionOpen ? "收起我的订阅" : "展开我的订阅"}">
            ${subscriptionOpen ? "收起" : "展开"}
          </button>
          ${
            subscriptionOpen
              ? `<div class="subscription-list">
                  <button data-suggestion-prompt="查看并编辑订阅程序：学校物业周报，每周一 09:00 推荐重庆学校物业商机，预算 200 万以上，优先即将挂网项目">
                    <strong>学校物业周报</strong>
                    <span>每周一 09:00 · 重庆 / 学校 / 200万+</span>
                  </button>
                  <button data-suggestion-prompt="查看并编辑订阅程序：医院后勤标讯，每天 08:30 扫描医院保洁、运维和后勤服务招标">
                    <strong>医院后勤标讯</strong>
                    <span>每天 08:30 · 保洁 / 运维 / 后勤</span>
                  </button>
                  <button data-suggestion-prompt="查看并编辑订阅程序：合同到期提醒，每月 25 日推荐未来六个月内到期的物业合同">
                    <strong>合同到期提醒</strong>
                    <span>每月 25 日 · 未来6个月到期项目</span>
                  </button>
                </div>`
              : ""
          }
        </div>
        ${navButton("book", "library", "知识库")}
      </nav>

      <div class="history-block">
        <button class="history-toggle ${route === "historyCenter" ? "active" : ""}" data-route="historyCenter">
          ${icon("history")}
          <span>历史对话</span>
        </button>
      </div>

      <div class="user-menu-wrap ${userMenuOpen ? "is-open" : ""}">
        <button class="user-profile" type="button" data-toggle-user-menu aria-expanded="${userMenuOpen}" title="用户信息">
          <span class="user-avatar" aria-hidden="true">用</span>
          <span class="user-copy">
            <strong>用户信息</strong>
            <small>市场拓展账号</small>
          </span>
        </button>
        ${userMenuOpen ? renderUserMenu() : ""}
      </div>
    </aside>
  `;
}

function navButton(iconName, navRoute, label) {
  return `
    <button class="nav-button ${route === navRoute ? "active" : ""}" data-route="${navRoute}">
      ${icon(iconName)}
      <span>${label}</span>
    </button>
  `;
}

function renderRadar(summary) {
  if (radarCompact) {
    return `
      <header class="radar-bar" aria-label="商机扫描">
        <button class="mobile-sidebar-button" data-toggle-sidebar title="打开侧边栏">${icon("collapse")}</button>
        <section class="radar-widget is-compact" aria-label="商机扫描关键信息">
          <strong>商机扫描</strong>
          <span>${summary.watchingCount} AI盯标</span>
          <span>${summary.wonCount} 已中标</span>
          <span>${summary.recommendedCount} 推荐</span>
          <button class="radar-toggle" data-toggle-radar title="最大化商机扫描">□</button>
        </section>
      </header>
    `;
  }

  return `
    <header class="radar-bar" aria-label="商机扫描">
      <button class="mobile-sidebar-button" data-toggle-sidebar title="打开侧边栏">${icon("collapse")}</button>
      <section class="radar-widget" aria-label="商机扫描">
        <button class="radar-toggle" data-toggle-radar title="最小化商机扫描">−</button>
        <div class="radar-panel" aria-label="商机扫描中">
          <div class="radar-visual-mini" aria-hidden="true">
            <span class="radar-ring ring-one"></span>
            <span class="radar-ring ring-two"></span>
            <span class="radar-axis axis-x"></span>
            <span class="radar-axis axis-y"></span>
            <span class="radar-sweep-mini"></span>
            <i class="radar-dot-mini dot-a"></i>
            <i class="radar-dot-mini dot-b"></i>
            <i class="radar-dot-mini dot-c"></i>
          </div>
          <div class="radar-panel-copy">
            <strong>商机扫描</strong>
            <span>正在扫描标讯、人脉、进度</span>
          </div>
        </div>
        <div class="radar-metrics">
          <button data-route="watch"><strong>${summary.watchingCount}</strong><span>AI盯标</span></button>
          <button type="button" data-suggestion-prompt="查看最近已中标的项目，并分析可复用的中标路径"><strong>${summary.wonCount}</strong><span>已中标</span></button>
          <button data-route="recommendations"><strong>${summary.recommendedCount}</strong><span>推荐商机</span></button>
        </div>
      </section>
    </header>
  `;
}

async function renderRoute() {
  if (route === "opportunity") return renderOpportunityDetail(await getOpportunityDetail(selectedOpportunityId));
  if (route === "recommendations") return renderOpportunityList("推荐商机", await getOpportunities(), "按匹配度排序的高价值物业商机，可直接进入详情或加入AI盯标。");
  if (route === "watch") return renderWatchPage(await getWatchTargets());
  if (route === "favorites") return renderMyProjectsPage(await getFavorites());
  if (route === "projectWorkspace") return renderProjectWorkspace(await getOpportunityDetail(selectedOpportunityId));
  if (route === "preferences") return renderOpportunityPreferences();
  if (route === "historyCenter") return renderHistoryCenter(await getConversations());
  if (route === "library") return renderLibrary(await getKnowledgeCategories(), await getKnowledgeDocuments());
  if (route === "libraryDetail") {
    const [sourceCategories, allDocuments, documents] = await Promise.all([
      getKnowledgeCategories(),
      getKnowledgeDocuments(),
      getKnowledgeDocuments({
        category: selectedLibraryKey,
        q: knowledgeSearch,
        type: knowledgeTypeFilter,
        status: knowledgeStatusFilter
      })
    ]);
    const categories = getLibraryCategories(sourceCategories, allDocuments);
    const selectedDocument =
      selectedKnowledgeDocumentId && documents.some((item) => item.id === selectedKnowledgeDocumentId)
        ? await getKnowledgeDocument(selectedKnowledgeDocumentId)
        : documents[0] || null;
    if (selectedDocument) selectedKnowledgeDocumentId = selectedDocument.id;
    return renderLibraryDetail(categories.find((item) => item.key === selectedLibraryKey), documents, selectedDocument, categories);
  }
  if (route === "api") return renderApiContract();
  return renderChat();
}

function getConversationSkill(item) {
  if (item.skill) return item.skill;
  if (item.id === "conv-3" || item.title.includes("人脉")) return "人脉图谱";
  return "算法推荐";
}

function renderHistorySkillTabs() {
  return `
    <div class="history-center-tabs-wrap">
      <button class="history-tab-arrow is-left" type="button" data-history-tab-scroll="left" aria-label="向左滚动分类" hidden>‹</button>
      <div class="history-center-tabs" data-history-tabs>
        ${historySkillTabs
          .map(
            (skill) => `
              <button class="${historySkillFilter === skill ? "active" : ""}" type="button" data-history-skill="${skill}">
                ${skill}
              </button>
            `
          )
          .join("")}
      </div>
      <button class="history-tab-arrow is-right" type="button" data-history-tab-scroll="right" aria-label="向右滚动分类">›</button>
    </div>
  `;
}

function renderHistoryCenterItem(item) {
  const searchText = `${item.title} ${item.prompt} ${getConversationSkill(item)}`.toLowerCase();
  return `
    <button class="history-center-item" data-history-id="${item.id}" data-history-title="${escapeHtml(item.title)}" data-history-prompt="${escapeHtml(item.prompt)}" data-history-search="${escapeHtml(searchText)}">
      <span class="history-center-icon">${icon("history")}</span>
      <span class="history-center-copy">
        <strong>${item.title}</strong>
        <em>${item.prompt}</em>
      </span>
      <span class="history-center-time">${item.time}</span>
    </button>
  `;
}

function renderHistoryCenter(conversations) {
  const normalizedSearch = historySearch.trim().toLowerCase();
  const visibleItems = conversations.filter((item) => {
    if (getConversationSkill(item) !== historySkillFilter) return false;
    if (!normalizedSearch) return true;
    return `${item.title} ${item.prompt}`.toLowerCase().includes(normalizedSearch);
  });
  return `
    <section class="content-panel history-center-panel" aria-label="历史对话">
      <div class="section-head">
        <div>
          <p class="eyebrow">History</p>
          <h1>历史对话</h1>
          <p>按技能归档历史问题，点击任意记录即可恢复对应对话与推荐结果。</p>
        </div>
      </div>
      ${renderHistorySkillTabs()}
      <label class="history-center-search">
        ${icon("search")}
        <input id="historySearchInput" value="${escapeHtml(historySearch)}" placeholder="搜索对话" aria-label="搜索对话" />
      </label>
      <div class="history-center-list">
        ${
          visibleItems.length
            ? visibleItems.map((item) => renderHistoryCenterItem(item)).join("")
            : ""
        }
        <div class="empty-note history-center-empty" data-history-empty ${visibleItems.length ? "hidden" : ""}>当前技能下暂无匹配的历史对话。</div>
      </div>
    </section>
  `;
}

function renderChat() {
  const conversationStarted = hasConversation();
  const hasRelationshipResult = resultMode === "relationship" && Boolean(relationshipResult);
  const hasResults = hasRelationshipResult || chatResults.length > 0;
  const isHistoryConversation = activeThreadId.startsWith("history-");
  return `
    <section class="chat-layout ${conversationStarted ? "has-conversation" : ""} ${hasResults && resultsOpen ? "has-results" : ""} ${isHistoryConversation ? "is-history-thread" : ""}">
      ${
        isHistoryConversation
          ? `<div class="history-chat-toolbar">
              <button type="button" data-return-history-center>返回</button>
            </div>`
          : ""
      }
      ${
        conversationStarted
          ? ""
          : `<div class="hero-copy">
              <div class="product-title">
                <strong>Data Lighthouse</strong>
                <span>数据灯塔 AI</span>
              </div>
              <h1>你的物业市场增长 AI 助手</h1>
              <div class="mode-tabs" aria-label="能力入口">
                ${Object.entries(modeConfig).map(([key, item]) => renderModeButton(key, item)).join("")}
              </div>
              <div class="quick-grid">
                ${modeConfig[activeMode].skills.map(([label, prompt]) => renderSkillButton(label, prompt)).join("")}
              </div>
            </div>`
      }

      <div class="chat-main">
        <section class="conversation-card" aria-label="AI 对话窗口">
          <div class="message-stream" id="messageStream">
            ${messages.map(renderMessage).join("")}
          </div>
          <form class="composer" id="chatForm">
            ${renderSelectedSkillCards()}
            <textarea name="message" rows="3" placeholder="今天帮你做些什么？@ 引用对话文件，/ 调用技能与指令">${escapeHtml(draftMessage)}</textarea>
            <div class="composer-actions">
              <button type="button" class="composer-icon-button" data-composer-action="optimize" title="提示词优化" aria-label="提示词优化">${icon("wand")}</button>
              <button type="button" class="composer-icon-button" data-composer-action="upload" title="文件上传" aria-label="文件上传">${icon("paperclip")}</button>
              <button type="button" class="composer-icon-button" data-composer-action="voice" title="语音输入" aria-label="语音输入">${icon("mic")}</button>
              <button type="submit" class="composer-icon-button send-button" title="发送" aria-label="发送">${icon("send")}</button>
            </div>
          </form>
        </section>
      </div>

      ${
        hasResults && resultsOpen
          ? hasRelationshipResult
            ? renderRelationshipPanel(relationshipResult)
            : `<aside class="result-rail" aria-label="对话推荐结果">
                <div class="result-head">
                  <div>
                    <h2>${isHistoryConversation ? "重庆高校物业挂网项目筛选结果" : "推荐结果"}</h2>
                    <p>${isHistoryConversation ? `共筛出 ${chatResults.length} 条重点商机` : `共 ${chatResults.length} 条推荐商机`}</p>
                  </div>
                  <div class="result-head-actions">
                    <button class="subscribe-button" type="button" data-subscribe-opportunities>订阅商机</button>
                    <button data-toggle-results aria-label="关闭推荐结果">×</button>
                  </div>
                </div>
                ${isHistoryConversation ? renderResultInsight(chatResults) : ""}
                <div class="${isHistoryConversation ? "history-result-list" : ""}">
                  ${chatResults.map((item, index) => (isHistoryConversation ? renderHistoryResultCard(item, index) : renderOpportunityCard(item))).join("")}
                </div>
              </aside>`
          : ""
      }
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatMessageContent(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function renderModeButton(key, item) {
  return `
    <button class="${activeMode === key ? "active" : ""}" data-mode="${key}">
      ${icon(item.icon)}${item.label}
    </button>
  `;
}

function renderSkillButton(label, prompt) {
  return `<button data-skill-label="${label}" data-skill-prompt="${prompt}">${label}</button>`;
}

function renderSelectedSkillCards() {
  if (!selectedSkillCards.length) return "";
  return `
    <div class="selected-skill-row" aria-label="已选择技能">
      ${selectedSkillCards
        .map(
          (skill) => `
            <span class="selected-skill-card">
              <strong>${escapeHtml(skill)}</strong>
              <button type="button" data-remove-skill-card="${escapeHtml(skill)}" aria-label="删除${escapeHtml(skill)}">×</button>
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderMessage(message) {
  return `
    <article class="message ${message.role}">
      <strong>${message.role === "user" ? "你" : "Data Lighthouse"}</strong>
      <p>${formatMessageContent(message.content)}</p>
      ${
        message.resultLink
          ? `<button class="message-result-link" type="button" data-toggle-results>${message.resultLabel || "查看推荐结果"}</button>`
          : ""
      }
      ${
        message.blockedLink
          ? `<button class="message-result-link blocked-result-link" type="button" data-show-blocked-opportunities>查看已屏蔽项目</button>`
          : ""
      }
      ${
        message.suggestions?.length
          ? `<div class="suggestion-list" aria-label="AI 推荐问题">
              <span>你可以继续问</span>
              ${message.suggestions.map((question) => `<button data-suggestion-prompt="${question}">${question}</button>`).join("")}
            </div>`
          : ""
      }
    </article>
  `;
}

function renderRelationshipPanel(result) {
  const routeLabels = ["一", "二", "三"];
  return `
    <aside class="result-rail relationship-rail" aria-label="人脉穿透结果">
      <div class="result-head relationship-head">
        <div>
          <h2>${result.title}</h2>
          <p>识别 3 条可触达路径</p>
        </div>
        <button data-toggle-results aria-label="关闭人脉图谱">×</button>
      </div>
      <section class="result-insight relationship-insight" aria-label="数据解读">
        <strong>数据解读</strong>
        <p>${result.summary}</p>
      </section>
      <div class="relationship-tools" aria-label="人脉图谱缩放工具">
        <button type="button" data-relationship-zoom="out" aria-label="缩小人脉图谱">－</button>
        <span data-relationship-zoom-label>${Math.round(relationshipZoom * 100)}%</span>
        <button type="button" data-relationship-zoom="in" aria-label="放大人脉图谱">＋</button>
        <button type="button" data-relationship-zoom="reset">重置</button>
        <small>右键长按拖动画布</small>
      </div>
      <div class="relationship-graph-wrap" data-relationship-viewport>
        <div class="relationship-graph" data-relationship-stage style="${getRelationshipTransformStyle()}" aria-label="重庆医科大学绿化项目人脉关系图">
          <svg class="relationship-lines" viewBox="0 0 980 660" role="img" aria-label="人脉路径连线">
            <defs>
              <marker id="relationshipArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#5f6670"></path>
              </marker>
              <marker id="relationshipArrowRed" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 Z" fill="#c40000"></path>
              </marker>
            </defs>
            ${renderRelationshipEdges(result)}
          </svg>
          ${renderRelationshipNodes(result)}
        </div>
      </div>
      <div class="relationship-routes" aria-label="人脉路径列表">
        ${result.routes
          .map(
            (route, index) => `
              <button class="${relationshipRouteIndex === index ? "active" : ""}" type="button" data-relationship-route="${index}">
                <span>路径${routeLabels[index]}：</span><strong>${route}</strong>
              </button>
            `
          )
          .join("")}
      </div>
    </aside>
  `;
}

function getRelationshipTransformStyle() {
  return `transform: translate(${relationshipPan.x}px, ${relationshipPan.y}px) scale(${relationshipZoom});`;
}

function getRelationshipNodeSize(node) {
  return node.tone === "target" ? 112 : 104;
}

function getRelationshipNodeCenter(node) {
  const size = getRelationshipNodeSize(node);
  return {
    x: node.x + size / 2,
    y: node.y + size / 2
  };
}

function getRelationshipPrimaryName(node) {
  if (node.tone === "target") return node.name.replace("目标项目：", "");
  if (!node.role) return node.name;
  const primary = node.name.replace(node.role, "").replace(/^[:：]/, "");
  return primary || node.name;
}

function renderRelationshipEdges(result) {
  const nodeById = new Map(result.nodes.map((node) => [node.id, node]));
  const activeRouteEdges = new Set((result.routeEdges?.[relationshipRouteIndex] || []).map(([from, to]) => `${from}->${to}`));
  return result.edges
    .map((edge) => {
      const from = nodeById.get(edge.from);
      const to = nodeById.get(edge.to);
      if (!from || !to) return "";
      const start = getRelationshipNodeCenter(from);
      const end = getRelationshipNodeCenter(to);
      const labelX = (start.x + end.x) / 2;
      const labelY = (start.y + end.y) / 2 - 8;
      const isMain = activeRouteEdges.has(`${edge.from}->${edge.to}`) || activeRouteEdges.has(`${edge.to}->${edge.from}`);
      return `
        <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" class="relationship-edge ${isMain ? "main" : ""}" marker-end="url(#${isMain ? "relationshipArrowRed" : "relationshipArrow"})"></line>
        <text x="${labelX}" y="${labelY}">${edge.relation}</text>
      `;
    })
    .join("");
}

function renderRelationshipNodes(result) {
  return result.nodes
    .map((node) => {
      const label = node.role || node.type;
      return `
        <div class="relationship-node ${node.tone}" style="left: ${node.x}px; top: ${node.y}px;">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(getRelationshipPrimaryName(node))}</strong>
          <em>${escapeHtml(node.type)}</em>
        </div>
      `;
    })
    .join("");
}

function renderResultInsight(list) {
  return `
    <section class="result-insight" aria-label="数据解读">
      <strong>数据解读</strong>
      <p>截至2026年6月29日，从实时标讯库（共1,699条）中筛选出重庆市学校物业项目 ${list.length} 条。其中，服务开始时间落在未来6个月内（2026年6月29日至12月26日）的需求重点关注项目共 ${Math.min(list.length, 6)} 条。</p>
    </section>
  `;
}

function renderHistoryResultCard(item, index) {
  if (blockingOpportunityId === item.id) return renderHistoryBlockChoiceCard(item);
  const project = buildProjectFieldModel(item, index);
  const openAttr = String(item.id || "").startsWith("hist-")
    ? ""
    : `data-open-opportunity="${item.id}" tabindex="0" role="button" aria-label="查看${project.title}详情"`;
  return `
    <article class="history-result-card" ${openAttr}>
      <div class="my-project-match"><span>匹配度</span><strong>${project.match}%</strong></div>
      <div class="history-result-main">
        <div class="my-project-topline">
          <strong>${project.title}</strong>
          ${renderOpportunityStatusTag(item, project)}
        </div>
        <div class="my-project-alerts">
          <em>距投标保证金支付截止时间：${project.guaranteeDeadline}</em>
          <em>距投标文件递交截止时间：${project.submitDeadline}</em>
        </div>
        <div class="my-project-meta">
          <span><b>业主单位：</b>${project.buyer}</span>
          <span><b>采购预算：</b>${project.contractAmount}</span>
          <span><b>合同金额：</b>${project.annualAmount}</span>
          <span><b>服务年限：</b>${project.servicePeriod}</span>
        </div>
      </div>
      <div class="my-project-indicators" aria-label="投标指标">
        <span>${project.tenderType}</span>
        <span>利润率：${project.profitRate}</span>
        <span>投标资格要求：${project.qualification}</span>
        <span>商务失分：${project.businessLoss}</span>
      </div>
      <div class="history-result-actions">
        <button type="button" data-watch="${item.id}">${item.watching ? "取消盯标" : "加入盯标"}</button>
        <button type="button" data-block-opportunity-start="${item.id}">屏蔽</button>
      </div>
    </article>
  `;
}

function renderHistoryBlockChoiceCard(item) {
  return `
    <article class="history-result-card history-result-blocking">
      <button class="block-cancel" type="button" data-block-opportunity-cancel aria-label="取消屏蔽">×</button>
      <div class="block-choice-head">
        <strong>屏蔽范围</strong>
        <span>${item.title}</span>
      </div>
      <div class="block-choice-list">
        ${getOpportunityBlockOptions(item)
          .map(
            (option, index) => `
              <button type="button" data-block-opportunity="${item.id}" data-block-type="${option.type}">
                <b>${index + 1}. ${option.label}</b>
                <span>${option.desc}</span>
              </button>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderWatchPage(list) {
  const filters = getWatchFilterItems(list);
  const filtered = filterWatchList(list);
  const allFilter = filters.find((item) => item.key === "all") || filters[0];
  const signalFilters = filters.filter((item) => item.key !== "all");
  return `
    <section class="content-panel watch-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">AI watch</p>
          <h1>AI盯标</h1>
          <p>持续监控报名、澄清、开标与合同到期信号，优先提示需要动作的项目。</p>
        </div>
      </div>
      <section class="watch-hero-monitor" aria-label="AI智能监控运行状态">
        <div>
          <span class="watch-live-dot" aria-hidden="true"></span>
          <strong>AI 智能监控运行中</strong>
          <p>持续监控报名、澄清、开标与合同到期信号，优先提示需要动作的项目。</p>
        </div>
        <aside>
          <strong>${allFilter.countNumber}</strong>
          <span>当前盯标中</span>
        </aside>
      </section>
      <div class="watch-filter-toolbar">
        <span>按预警信号筛选项目：</span>
        <button type="button" data-clear-watch-filter>× 清除筛选 / 显示全部</button>
      </div>
      <div class="watch-summary">
        ${signalFilters.map(renderWatchFilterCard).join("")}
      </div>
      <div class="watch-tender-list">
        ${filtered.length ? filtered.map(renderWatchTenderItem).join("") : `<div class="empty-note">当前筛选下暂无AI盯标项目。</div>`}
      </div>
    </section>
  `;
}

function getWatchFilterItems(list) {
  const baseFilters = [
    ["all", "盯标中"],
    ["announcement", "新增公告"],
    ["signup", "即将截止报名（3日内）"],
    ["deposit", "即将截止支付投标保证金（3日内）"],
    ["bid", "即将截止投标文件递交（3日内）"],
    ["result", "中标结果公示"]
  ];

  return baseFilters.map(([key, label]) => {
    const count = filterWatchListByKey(list, key).length;
    return {
      key,
      label,
      countNumber: count,
      count: `${count}个`,
      note: key === "result" && count ? `我司中标：${Math.min(count, 5)}个` : ""
    };
  });
}

function renderWatchFilterCard(item) {
  return `
    <button class="watch-filter-card ${watchFilter === item.key ? "active" : ""}" data-watch-filter="${item.key}">
      <span>${item.label}</span>
      ${item.note ? `<em>${item.note}</em>` : ""}
      <strong>${item.count}</strong>
    </button>
  `;
}

function filterWatchList(list) {
  return filterWatchListByKey(list, watchFilter);
}

function filterWatchListByKey(list, key) {
  if (key === "all") return list;
  return list.filter((item, index) => {
    if (key === "announcement") return index === 0;
    if (key === "signup") return index % 2 === 0;
    if (key === "deposit") return index % 2 === 1;
    if (key === "bid") return true;
    if (key === "result") return index === 0;
    return true;
  });
}

function buildProjectFieldModel(item, index = 0) {
  const watchStatuses = [
    "未挂网",
    "预采公告",
    "已发招标公告/投标中",
    "开标中",
    "候选人公示",
    "暂停",
    "流标",
    "终止",
    "重新招标",
    "中标公示",
    "已中标/未中标",
    "合同公示"
  ];
  const tenderTypes = ["电子标", "纸质标", "电子+纸质标"];
  const policies = ["专门面向中小微", "中小微价格抵扣", "中小微分包"];

  return {
    match: item.match || 95,
    title: item.title || "重庆大学物业管理服务",
    buyer: item.buyer || "重庆大学",
    manager: item.manager || "新大正物业集团股份有限公司",
    contractAmount: item.contractAmount || item.budget || "1200万元",
    annualAmount: item.annualAmount || item.yearlyAmount || "400万元",
    servicePeriod: item.servicePeriod || "3年",
    signupDeadline: item.signupDeadline || "5天",
    guaranteeDeadline: item.guaranteeDeadline || "10天",
    submitDeadline: item.submitDeadline || "10天",
    microPolicy: item.microPolicy || policies[index % policies.length],
    buyerChanged: item.buyerChanged ?? index === 0,
    announcementTitle: item.announcementTitle || `${item.title || "重庆大学物业管理服务"}新增公告`,
    watchStatus: item.watchStatus || watchStatuses[index % watchStatuses.length],
    tenderType: item.tenderType || tenderTypes[index % tenderTypes.length],
    profitRate: item.profitRate || "10%",
    qualification: item.qualification || "满足",
    businessLoss: item.businessLoss || "无"
  };
}

function renderOpportunityStatusTag(item, project, mode = "auto") {
  const isUngated = mode === "listed" ? false : item.type === "即将到期" || ["未挂网", "预采公告"].includes(item.watchStatus);
  const days = isUngated ? project.signupDeadline : project.submitDeadline;
  return `<span class="opportunity-status-tag">${isUngated ? "未挂网" : "已挂网"}｜${days}${isUngated ? "到期" : "截止"}</span>`;
}

function renderOpportunityDetailEyebrow(item, project) {
  const isUngated = item.type === "即将到期" || item.stage === "提前建联" || ["未挂网", "预采公告"].includes(item.watchStatus);
  return isUngated ? "即将到期 · 提前建联" : "实时招标 · 报名中";
}

function renderWatchTenderItem(item, index) {
  const project = buildProjectFieldModel(item, index);
  return `
    <article class="watch-tender-item" data-open-opportunity="${item.id}" tabindex="0" role="button" aria-label="查看${item.title}详情">
      <div class="watch-tender-match"><span>匹配度</span><strong>${project.match}%</strong></div>
      <div class="watch-tender-main">
        <div class="watch-tender-title">
          <strong>${project.title}</strong>
          ${renderOpportunityStatusTag(item, project)}
        </div>
        <div class="watch-tags">
          <em>距报名截止时间：${project.signupDeadline}</em>
          <em>距投标保证金支付截止时间：${project.guaranteeDeadline}</em>
          <em>距投标文件提交截止时间：${project.submitDeadline}</em>
          <em>${project.microPolicy}</em>
          ${project.buyerChanged ? `<em>甲方人员有更换</em>` : ""}
          <em>新增公告：${project.announcementTitle}</em>
        </div>
        <div class="watch-tender-meta">
          <span><b>业主单位：</b>${project.buyer}</span>
          <span><b>在管单位：</b>${project.manager}</span>
          <span><b>采购预算：</b>${project.contractAmount}</span>
          <span><b>合同金额：</b>${project.annualAmount}</span>
          <span><b>服务年限：</b>${project.servicePeriod}</span>
        </div>
      </div>
      <div class="watch-tender-side">
        <strong>盯标状态：<span>${project.watchStatus}</span></strong>
        <button data-watch="${item.id}">取消盯标</button>
      </div>
    </article>
  `;
}

function renderMyProjectsPage(list) {
  const tenderProjects = list.filter((item) => item.type === "实时招标");
  return `
    <section class="content-panel my-projects-page">
      <div class="project-create-entry">
        <div>
          <p class="eyebrow">My projects</p>
          <h1>我的项目</h1>
          <p>集中管理已经获取招标文件、正在投标推进中的项目。</p>
        </div>
        <button data-new-project>新建项目</button>
      </div>
      <div class="my-project-grid">
        ${tenderProjects.length ? tenderProjects.map(renderMyProjectCard).join("") : `<div class="empty-note">暂无我的项目。可以点击上方新建项目开始。</div>`}
      </div>
    </section>
  `;
}

function renderMyProjectCard(item, index) {
  const project = buildProjectFieldModel(item, index);
  return `
    <article class="my-project-card" data-open-project-workspace="${item.id}" tabindex="0" role="button" aria-label="进入${item.title}商机详情">
      <div class="my-project-match"><span>匹配度</span><strong>${project.match}%</strong></div>
      <div class="my-project-main">
        <div class="my-project-topline">
          <strong>${project.title}</strong>
          ${renderOpportunityStatusTag(item, project, "listed")}
        </div>
        <div class="my-project-alerts">
          <em>距投标保证金支付截止时间：${project.guaranteeDeadline}</em>
          <em>距投标文件递交截止时间：${project.submitDeadline}</em>
          <em>${project.microPolicy}</em>
        </div>
        <div class="my-project-meta">
          <span><b>业主单位：</b>${project.buyer}</span>
          <span><b>在管单位：</b>${project.manager}</span>
          <span><b>采购预算：</b>${project.contractAmount}</span>
          <span><b>合同金额：</b>${project.annualAmount}</span>
          <span><b>服务年限：</b>${project.servicePeriod}</span>
        </div>
      </div>
      <div class="my-project-indicators" aria-label="投标指标">
        <span>${project.tenderType}</span>
        <span>利润率：${project.profitRate}</span>
        <span>投标资格要求：${project.qualification}</span>
        <span>商务失分：${project.businessLoss}</span>
      </div>
    </article>
  `;
}

async function renameProject(id) {
  const current = await getOpportunityDetail(id);
  const nextTitle = window.prompt("请输入新的项目名称", current?.title || "");
  if (!nextTitle || !nextTitle.trim()) return;
  await updateOpportunityState(id, { title: nextTitle.trim() });
  render();
}

async function abandonProject(id) {
  const current = await getOpportunityDetail(id);
  const confirmed = window.confirm(`确定放弃跟进“${current?.title || "该项目"}”吗？此项目将从我的项目中移除。`);
  if (!confirmed) return;
  if (current?.favorite) {
    await toggleFavorite(id);
  } else {
    await updateOpportunityState(id, { favorite: false });
  }
  if (selectedOpportunityId === id && route === "opportunity" && detailMode === "project") {
    selectedOpportunityId = "";
    detailMode = "normal";
    route = "favorites";
  }
  render();
}

function renderProjectSecondaryMenu(item) {
  return `
    <div class="project-secondary-menu" aria-label="项目二级菜单">
      <button type="button" data-project-action="rename" data-project-id="${item.id}">重命名</button>
      <button type="button" data-project-action="abandon" data-project-id="${item.id}">放弃跟进</button>
    </div>
  `;
}

function renderProjectDetailTopbar(item) {
  return `
    <div class="project-detail-topbar">
      ${renderProjectSecondaryMenu(item)}
      <button class="text-button project-detail-return" data-return-from-detail>返回</button>
    </div>
  `;
}

function getProjectTabs() {
  return [
    ["overview", "项目详情"],
    ["parse", "招标文件解析"],
    ["qualification", "应标资格评估"],
    ["competitor", "竞争对手分析"],
    ["cost", "项目成本测算"],
    ["price", "报价策略建议"],
    ["proposal", "投标文件生成"],
    ["check", "标书输出智检"],
    ["challenge", "质疑函生成"],
    ["history", "历史对话"]
  ];
}

function renderProjectWorkspace(item) {
  if (!item) {
    return `
      <section class="content-panel detail-empty">
        <button class="text-button" data-return-from-detail>返回</button>
        <div class="empty-note">未找到该项目。</div>
      </section>
    `;
  }

  return `
    <section class="project-workspace">
      <nav class="project-workspace-tabs" aria-label="项目能力">
        ${getProjectTabs()
          .map(
            ([key, label]) => `
              <button class="${projectWorkspaceTab === key ? "active" : ""}" data-project-tab="${key}">
                ${label}
              </button>
            `
          )
          .join("")}
      </nav>
      ${renderProjectDetailTopbar(item)}
      <div class="project-workspace-layout">
        <main class="project-workspace-main">
          <section class="live-opportunities">
            <h2>实时商机</h2>
            ${["项目延期公告", "项目报名公告", "预采公告"]
              .map(
                (title) => `
                  <article>
                    <label><input type="checkbox" /> ${item.title.replace(/物业服务项目|合同到期预测项目/g, "")}${title}</label>
                    <span>业主单位：${item.buyer}</span>
                    <span>招标预算：未公示</span>
                  </article>
                `
              )
              .join("")}
          </section>
          <section class="bid-history">
            <h2>招投标历史</h2>
            ${[2023, 2024]
              .map(
                (year) => `
                  <article>
                    <strong>【${year}年08月】至【${year + 1}年08月】合同期</strong>
                    <p>项目编号 SZCG2023000442</p>
                    <p>中标单位 深圳市深粮贝格厨房食品供应链有限公司</p>
                    <p>中标金额 700.00万元</p>
                  </article>
                `
              )
              .join("")}
          </section>
        </main>
        <aside class="project-deadline-panel">
          <div class="project-policy-row">
            <span>电子标</span>
            <span>${buildProjectFieldModel(item).microPolicy}</span>
          </div>
          <div class="project-fee-box">
            <strong>报名费：200元</strong>
            <strong>投标保证金：5万元</strong>
            <strong>履约保证金：20万元</strong>
          </div>
          ${[
            ["12天x小x分", "开标截止时间（未投标）"],
            ["5天x小x分", "保证金支付截止时间（已支付）"],
            ["3天x小x分", "招标质疑期截止时间"],
            ["1天x小x分", "报名截止时间（已报名）"]
          ]
            .map(([time, label]) => `<article><strong>${time}</strong><span>${label}</span></article>`)
            .join("")}
        </aside>
      </div>
      <div class="project-workspace-composer">
        <textarea readonly>今天帮你做些什么？ @ 引用对话文件，/ 调用技能与指令</textarea>
        <div class="composer-actions workspace-composer-actions" aria-label="项目工作台对话工具">
          <button type="button" class="composer-icon-button" title="提示词优化" aria-label="提示词优化">${icon("wand")}</button>
          <button type="button" class="composer-icon-button" title="文件上传" aria-label="文件上传">${icon("paperclip")}</button>
          <button type="button" class="composer-icon-button" title="语音输入" aria-label="语音输入">${icon("mic")}</button>
          <button type="button" class="composer-icon-button send-button" title="发送" aria-label="发送">${icon("send")}</button>
        </div>
      </div>
    </section>
  `;
}

function renderOpportunityList(title, list, subtitle) {
  const { visible, blocked } = splitBlockedOpportunities(list);
  const displayList = title === "推荐商机" ? visible.slice(0, 4) : visible;
  return `
    <section class="content-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Opportunity</p>
          <h1>${title}</h1>
          <p>${subtitle}${blocked.length ? ` 已隐藏 ${blocked.length} 个屏蔽项目。` : ""}</p>
        </div>
        <button class="text-button" data-route="chat">发起新建对话</button>
      </div>
      <div class="cards-grid">
        ${displayList.length ? displayList.map(renderOpportunityCard).join("") : `<div class="empty-note">暂无数据。可以在商机卡片中加入AI盯标，项目请从“我的项目”的新建项目入口添加。</div>`}
      </div>
    </section>
  `;
}

function renderOpportunityCard(item, index = 0) {
  if (blockingOpportunityId === item.id) return renderOpportunityBlockChoiceCard(item);
  const project = buildProjectFieldModel(item, index);
  return `
    <article class="opportunity-card" data-open-opportunity="${item.id}" tabindex="0" role="button" aria-label="查看${item.title}详情">
      <div class="my-project-match"><span>匹配度</span><strong>${project.match}%</strong></div>
      <div class="history-result-main">
        <div class="my-project-topline">
          <strong>${project.title}</strong>
          ${renderOpportunityStatusTag(item, project)}
        </div>
        <div class="my-project-alerts">
          <em>距投标保证金支付截止时间：${project.guaranteeDeadline}</em>
          <em>距投标文件递交截止时间：${project.submitDeadline}</em>
        </div>
        <div class="my-project-meta">
          <span><b>业主单位：</b>${project.buyer}</span>
          <span><b>采购预算：</b>${project.contractAmount}</span>
          <span><b>合同金额：</b>${project.annualAmount}</span>
          <span><b>服务年限：</b>${project.servicePeriod}</span>
        </div>
      </div>
      <div class="my-project-indicators" aria-label="投标指标">
        <span>${project.tenderType}</span>
        <span>利润率：${project.profitRate}</span>
        <span>投标资格要求：${project.qualification}</span>
        <span>商务失分：${project.businessLoss}</span>
      </div>
      <div class="history-result-actions">
        <button type="button" data-open-opportunity="${item.id}">查看详情</button>
        <button type="button" data-watch="${item.id}">${item.watching ? "取消盯标" : "加入盯标"}</button>
        <button type="button" data-block-opportunity-start="${item.id}">屏蔽</button>
      </div>
    </article>
  `;
}

function renderOpportunityBlockChoiceCard(item) {
  return `
    <article class="opportunity-card opportunity-card-blocking" aria-label="选择屏蔽${item.title}的范围">
      <button class="block-cancel" type="button" data-block-opportunity-cancel aria-label="取消屏蔽">×</button>
      <div class="block-choice-head">
        <strong>屏蔽范围</strong>
        <span>${item.title}</span>
      </div>
      <div class="block-choice-list">
        ${getOpportunityBlockOptions(item)
          .map(
            (option, index) => `
              <button type="button" data-block-opportunity="${item.id}" data-block-type="${option.type}">
                <b>${index + 1}. ${option.label}</b>
                <span>${option.desc}</span>
              </button>
            `
          )
          .join("")}
      </div>
    </article>
  `;
}

function renderDetailBlockMenu(item) {
  return `
    <div class="detail-block-menu" role="menu" aria-label="选择屏蔽范围">
      <button class="block-cancel" type="button" data-toggle-detail-block-menu aria-label="关闭屏蔽菜单">×</button>
      <div class="block-choice-head">
        <strong>屏蔽范围</strong>
        <span>${item.title}</span>
      </div>
      <div class="block-choice-list">
        ${getOpportunityBlockOptions(item)
          .map(
            (option, index) => `
              <button type="button" data-block-opportunity-detail="${item.id}" data-block-type="${option.type}">
                <b>${index + 1}. ${option.label}</b>
                <span>${option.desc}</span>
              </button>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderOpportunityDetail(item) {
  if (!item) {
    return `
      <section class="content-panel detail-empty">
        <button class="text-button" data-return-from-detail>返回</button>
        <div class="empty-note">未找到该商机，可能已下线或后端暂未返回详情。</div>
      </section>
    `;
  }

  if (detailMode === "project") return renderProjectOpportunityBlankDetail(item);

  const project = buildProjectFieldModel(item);
  return `
    <section class="detail-page opportunity-detail-page ${detailAnalysisPanel ? "has-analysis-drawer" : ""}">
      <div class="detail-toolbar opportunity-detail-toolbar">
        <button class="text-button" data-return-from-detail>返回</button>
        <div class="detail-action-group">
          <button class="detail-action-button watch" data-watch="${item.id}">${item.watching ? "取消盯标" : "加入盯标"}</button>
          <button class="detail-action-button write" data-profile-prompt="为${item.title}生成AI写标书提纲">AI写标书</button>
          <span class="detail-block-menu-wrap">
            <button class="detail-action-button block" data-toggle-detail-block-menu>屏蔽</button>
            ${detailBlockMenuOpen ? renderDetailBlockMenu(item) : ""}
          </span>
        </div>
      </div>
      <div class="opportunity-detail-layout">
        <main class="opportunity-detail-main">
          <article class="opportunity-detail-title">
            <p class="eyebrow">${renderOpportunityDetailEyebrow(item, project)}</p>
            <h1>${item.title}</h1>
            <p>${item.summary}</p>
          </article>
          ${renderOpportunityAiInsight(project, item)}
        <section class="detail-card detail-wide-card" id="项目基础信息">
          <h2>项目基础信息</h2>
          <dl class="detail-info-grid">
            <dt>项目名</dt><dd>${project.title}</dd>
            <dt>业主单位</dt><dd>${project.buyer}<button data-profile-prompt="生成${project.buyer}甲方画像">甲方画像</button></dd>
            <dt>在管企业</dt><dd>${project.manager}<button data-profile-prompt="生成${project.manager}项目画像">项目画像</button></dd>
            <dt>采购预算/合同额</dt><dd>${project.contractAmount}</dd>
            <dt>合同年金额</dt><dd>${project.annualAmount}</dd>
            <dt>服务期限</dt><dd>${project.servicePeriod}</dd>
            <dt>物业业态</dt><dd>${item.industry}</dd>
            <dt>服务类型</dt><dd>${item.type === "实时招标" ? "物业管理综合服务" : "到期合同续约机会"}</dd>
            <dt>项目地址</dt><dd>${item.city}市重点区域</dd>
          </dl>
        </section>
          ${renderDetailAnalysisButtons()}
        </main>
        ${renderDetailAnalysisDrawer(item, project)}
      </div>
    </section>
  `;
}

function renderOpportunityAiInsight(project, item) {
  return `
    <section class="opportunity-ai-insight detail-ai-brief" aria-label="AI解读区">
      <div class="detail-ai-brief-head">
        <strong>AI解读</strong>
        <span>从六个方面判断该商机是否值得投入投标资源</span>
      </div>
      <div class="detail-ai-brief-body">
        <p><b>1. 项目基础信息：</b>${project.title} 位于${item.city}，业态为${item.industry}，采购预算/合同额为 ${project.contractAmount}，合同年金额约 ${project.annualAmount}，服务期限为 ${project.servicePeriod}。从预算规模、服务周期和项目类型看，该项目属于可形成稳定年度收入的物业服务机会，适合作为区域重点项目推进。</p>
        <p><b>2. 应标资格分析：</b>当前项目要求重点集中在独立法人资格、良好商业信誉、依法纳税社保、无重大违法记录、非关联投标和不接受联合体等基础条件。以现有资质和学校/医院/园区类服务案例判断，主体资格具备投标基础，但仍需提前核验近三年业绩证明、人员证书、财务审计材料和电子签章有效性。</p>
        <p><b>3. 人脉穿透分析：</b>该项目的触达路径不应只停留在采购公告层面。系统已识别业主单位、当前服务企业、附属单位和供应商之间的潜在关系链，建议优先验证“在管企业服务关系”和“后勤/采购相关联系人”两条路径，以判断是否存在提前沟通、需求澄清或差异化方案切入空间。</p>
        <p><b>4. 招投标信息分析：</b>当前最关键节点是投标文件递交截止、投标保证金支付截止和质疑期。若继续推进，应先锁定保证金、CA、授权委托、报名材料和标书目录，再围绕评分办法拆解技术分、商务分和价格分，避免临近截止时出现材料缺口。</p>
        <p><b>5. 甲方信息分析：</b>${project.buyer} 具备持续物业采购需求，历史采购频次和服务类型较稳定。若甲方过往供应商集中度较高，投标策略需要突出服务响应、人员稳定、信息化管理和类似项目履约质量，而不是只依赖价格优势。</p>
        <p><b>6. 潜在竞争对手分析：</b>当前在管企业 ${project.manager} 具备续约优势，可能在现场熟悉度、历史评价和人员衔接上占优。建议重点对比其过往中标金额、服务范围和扣分短板，形成“更低风险交接、更高标准化巡检、更强项目经理配置”的差异化表达。</p>
        <p><b>最终结论：</b>该项目值得进入重点跟进池。建议先完成资格材料核验和保证金节点确认，再同步推进人脉触达与竞争对手拆解；若商务得分短板可控制在 2 分以内，可按高优先级组织投标。</p>
      </div>
    </section>
  `;
}

function getDetailAnalysisItems() {
  return [
    ["qualification", "应标资格分析", "核验资格门槛、商务分和材料缺口"],
    ["relationship", "人脉穿透分析", "查看可触达路径和关键关系链"],
    ["tender", "招投标信息分析", "拆解公告、合同轮次和投标节点"],
    ["buyer", "甲方信息分析", "分析甲方采购习惯和潜在机会"],
    ["competitor", "潜在竞争对手分析", "识别在管企业优势和差异化打法"]
  ];
}

function renderDetailAnalysisButtons() {
  return `
    <section class="detail-card detail-analysis-entry">
      <div>
        <h2>深度分析</h2>
        <p>点击下方模块，在右侧窗口查看对应详细内容。</p>
      </div>
      <div class="detail-analysis-buttons">
        ${getDetailAnalysisItems()
          .map(
            ([key, label, desc]) => `
              <button class="${detailAnalysisPanel === key ? "active" : ""}" type="button" data-detail-analysis="${key}">
                <strong>${label}</strong>
                <span>${desc}</span>
              </button>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderDetailAnalysisDrawer(item, project) {
  if (!detailAnalysisPanel) return "";
  const panel = getDetailAnalysisItems().find(([key]) => key === detailAnalysisPanel);
  const title = panel?.[1] || "详细分析";
  const content = {
    qualification: renderQualificationAnalysis(project),
    relationship: renderRelationshipAnalysisDrawer(),
    tender: renderTenderInfoAnalysis(item),
    buyer: renderBuyerInfoAnalysis(project),
    competitor: renderCompetitorAnalysis(project)
  }[detailAnalysisPanel];
  return `
    <aside class="detail-analysis-drawer" aria-label="${title}">
      <header>
        <div>
          <span>详细信息</span>
          <h2>${title}</h2>
        </div>
        <button type="button" data-detail-analysis-close aria-label="关闭${title}">×</button>
      </header>
      <div class="detail-analysis-drawer-body">
        ${content || ""}
      </div>
    </aside>
  `;
}

function renderQualificationAnalysis(project) {
  const qualificationRows = [
    "独立承担民事责任的能力",
    "良好的商业信誉和健全的财务会计制度",
    "参加政府采购活动前三年内，在经营活动中没有重大违法记录",
    "依法缴纳税收和社会保障资金的良好记录",
    "单位负责人非同一人、无直接控股管理关系",
    "不接受联合体投标"
  ];
  const scoreRows = [
    ["企业认证", "得分3分/满分4分"],
    ["类似项目业绩", "得分8分/满分10分"],
    ["项目评价", "得分8分/满分10分"],
    ["信息化系统平台", "得分2分/满分2分"],
    ["机械化保障和无人化智能设备计划", "得分1分/满分2分"],
    ["项目总监", "得分2分/满分2分"],
    ["项目总监业绩", "得分1分/满分2分"],
    ["关键岗位", "得分6分/满分8分"]
  ];
  return `
    <section class="drawer-ai-summary">
      <strong>AI总结</strong>
      <p>当前主体资格与 ${project.title} 的基础门槛基本匹配，可进入投标准备。主要风险集中在类似项目业绩证明、项目评价材料颗粒度、关键岗位证书有效期和无人化设备方案完整度。建议在正式编标前完成证照清单复核，并把商务得分短板控制在可接受范围内。</p>
    </section>
    <section class="analysis-table-section">
      <h3>投标资格要求核验</h3>
      <table class="analysis-table qualification-table">
        <tbody>
          ${qualificationRows.map((label) => `<tr><th>${label}</th><td>√</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
    <section class="analysis-table-section">
      <h3 class="analysis-title-with-score"><span>商务得分分析</span><b>总得分31分/满分40分</b></h3>
      <table class="analysis-table score-table">
        <tbody>
          ${scoreRows.map(([label, score]) => `<tr><th>${label}</th><td>${score}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderRelationshipAnalysisDrawer() {
  const result = buildRelationshipResult();
  const routeLabels = ["一", "二", "三"];
  return `
    <section class="drawer-ai-summary">
      <strong>AI总结</strong>
      <p>${result.summary} 建议优先选择红色主路径进行线下验证，再用第二、第三路径补充甲方需求侧信息。</p>
    </section>
    <div class="relationship-tools" aria-label="人脉图谱缩放工具">
      <button type="button" data-relationship-zoom="out" aria-label="缩小人脉图谱">－</button>
      <span data-relationship-zoom-label>${Math.round(relationshipZoom * 100)}%</span>
      <button type="button" data-relationship-zoom="in" aria-label="放大人脉图谱">＋</button>
      <button type="button" data-relationship-zoom="reset">重置</button>
      <small>右键长按拖动画布</small>
    </div>
    <div class="relationship-graph-wrap detail-relationship-graph" data-relationship-viewport>
      <div class="relationship-graph" data-relationship-stage style="${getRelationshipTransformStyle()}" aria-label="人脉关系图">
        <svg class="relationship-lines" viewBox="0 0 980 660" role="img" aria-label="人脉路径连线">
          <defs>
            <marker id="relationshipArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#5f6670"></path>
            </marker>
            <marker id="relationshipArrowRed" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#c40000"></path>
            </marker>
          </defs>
          ${renderRelationshipEdges(result)}
        </svg>
        ${renderRelationshipNodes(result)}
      </div>
    </div>
    <div class="relationship-routes" aria-label="人脉路径列表">
      ${result.routes
        .map(
          (route, index) => `
            <button class="${relationshipRouteIndex === index ? "active" : ""}" type="button" data-relationship-route="${index}">
              <span>路径${routeLabels[index]}：</span><strong>${route}</strong>
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTenderInfoAnalysis(item) {
  return `
    <section class="drawer-ai-summary">
      <strong>AI总结</strong>
      <p>该项目需要优先盯住报名、保证金、质疑期和投标文件递交四个节点。历史轮次中同类公告与合同公示较集中，说明采购流程相对规范；当前应把标书目录、附件下载、保证金凭证和电子签章作为第一批核验项。</p>
    </section>
    ${renderBidTimeline(item)}
  `;
}

function renderBuyerInfoAnalysis(project) {
  return `
    <section class="drawer-ai-summary">
      <strong>AI总结</strong>
      <p>${project.buyer} 的物业采购需求稳定，合作乙方数量较多，说明并非完全封闭型甲方。建议重点观察其过往综合管理、食材配送、设施维护等服务采购频次，判断本次是否存在更换服务标准或供应商的窗口。</p>
    </section>
    ${renderBuyerAnalysis(project)}
  `;
}

function renderCompetitorAnalysis(project) {
  return `
    <section class="drawer-ai-summary">
      <strong>AI总结</strong>
      <p>潜在竞争主要来自当前在管企业 ${project.manager} 及本地综合物业服务商。当前在管企业具备现场熟悉度和续约惯性，但也可能存在服务模式固化、成本结构偏高、信息化响应不足等可切入点。建议用项目经理配置、智慧巡检、机械化设备和过渡期方案形成差异化。</p>
    </section>
    ${renderManagerAnalysis(project)}
  `;
}

function renderSectionInsight(content) {
  return `
    <div class="section-ai-note">
      <strong>AI解读</strong>
      <span>${content}</span>
    </div>
  `;
}

function renderCooperationAnalysis(project) {
  return `
    ${renderSectionInsight("根据业主对供应商的更换频率，以及与在管企业的合作紧密度，当前项目存在可切入机会，建议优先验证当前在管企业续约倾向。")}
    <div class="cooperation-analysis-panel">
      <div class="cooperation-tagline">
        <span>【${project.buyer}】在【综合管理】中共采购</span><b>43次</b>
      </div>
      <div class="cooperation-tagline">
        <span>当前在管企业【${project.manager}】共中标</span><b>10次</b>
      </div>
      <section class="cooperation-history">
        <h3>业主合作的物业公司</h3>
        ${[
          ["2026-06", "广州仁众物业管理有限公司", "￥61.17万元", ""],
          ["2026-05", "广东德盾保安服务有限公司", "￥46.71万元", ""],
          ["2026-01", project.manager, "￥3,292.87万元", "当前在管企业"],
          ["2025-12", project.manager, "￥9,304.24万元", "当前在管企业"],
          ["2025-12", "广州广电城市服务集团股份有限公司", "￥110.19万元", ""]
        ]
          .map(
            ([date, company, amount, tag]) => `
              <article>
                <time>${date}</time>
                <strong>${company}</strong>
                ${tag ? `<em>${tag}</em>` : ""}
                <span>${amount}</span>
              </article>
            `
          )
          .join("")}
        <button data-profile-prompt="查看${project.buyer}合作物业公司详情">查看详情 ›</button>
      </section>
      <section class="cooperation-current">
        <h3>业主与在管企业合作关系：<b>一般</b></h3>
        <div class="party-chart-body compact">
          <div class="party-donut"><strong>共43次</strong></div>
          <ul>
            ${["广东华信服务集团有限公司|10次", "广州广电城市服务集团股份有限公司|8次", "广东宏德科技物业有限公司|8次", "广州市创昂智慧物业管理服务有限公司|3次", "广东华信物业管理有限公司|3次"]
              .map((item, index) => {
                const [label, count] = item.split("|");
                return `<li class="${index === 0 ? "highlight" : ""}"><span>${label}</span><b>${count}</b></li>`;
              })
              .join("")}
          </ul>
        </div>
      </section>
    </div>
  `;
}

function renderBuyerAnalysis(project) {
  return `
    <div class="party-stat-card buyer-stat-card">
      <header class="party-profile-head">
        <div class="party-logo-mark">校</div>
        <div>
          <strong>${project.buyer}</strong>
          <button data-profile-prompt="生成${project.buyer}甲方画像">直达甲方画像</button>
          <p>地址：广东省广州市天河区五山　联系电话：02085280081　<a>27个更多联系人 ›</a></p>
        </div>
      </header>
      <div class="party-stat-strip">
        <strong>物业项目招标统计</strong>
        <span>采购总次数 <b>375次</b></span>
        <span>采购总金额 <b>3.36亿</b></span>
        <span>历史合作乙方 <b>195家</b></span>
        <button>375个项目 ›</button>
      </div>
      <div class="party-chart-grid">
        ${renderDonutBlock("该业主常合作物业公司TOP5", "59次", ["广州市金妮宝食用油有限公司", "广东华信服务集团有限公司", "快意电梯股份有限公司", "广州广电城市服务集团股份有限公司", "广东宏德科技物业有限公司"], ["21次", "10次", "10次", "9次", "9次"], "blue")}
        ${renderDonutBlock("该业主的潜在物业商机", "340次", ["食材配送", "食堂承包", "综合管理", "设施维护", "其他餐饮"], ["127次", "109次", "47次", "36次", "21次"], "blue")}
      </div>
    </div>
  `;
}

function renderManagerAnalysis(project) {
  return `
    <div class="party-stat-card manager-stat-card">
      <header class="party-profile-head">
        <div class="party-logo-mark manager">企</div>
        <div>
          <strong>${project.manager}</strong>
          <button data-profile-prompt="生成${project.manager}项目画像">直达项目画像</button>
          <p>地址：广州越秀区环市东路450号广东华信中心22楼　<a>27个更多联系人 ›</a></p>
        </div>
        <small>统计时间：2012年至今</small>
      </header>
      <div class="party-stat-strip manager-strip">
        <strong>物业项目中标统计</strong>
        <span>中标总次数 <b>785次</b></span>
        <span>中标总金额 <b>26.84亿</b></span>
        <span>历史合作甲方 <b>286家</b></span>
        <button>785个项目 ›</button>
      </div>
      <p class="party-summary-line">【${project.manager}】近十年在物业行业主要和【政府机构】合作，主要提供的物业服务为【综合管理】，重点业务地区在【广东】</p>
      <div class="party-chart-grid four">
        ${renderDonutBlock("该企业常合作业主单位TOP5", "72次", ["广东省卫生健康委员会", "广东省人民政府港澳事务办公室", "广东省卫生健康委员会事务中心", "中山火炬开发区人民医院", "广东省人民政府参事室"], ["16次", "15次", "15次", "14次", "12次"], "blue")}
        ${renderDonutBlock("该企业服务的业主类型分布", "785次", ["政府机构", "教育单位", "商业公司", "医疗单位", "金融企业"], ["431次", "179次", "110次", "38次", "27次"], "orange")}
        ${renderDonutBlock("该企业主要提供的物业服务", "872次", ["综合管理", "绿化养护", "保洁服务", "其他物业", "保安服务"], ["703次", "50次", "48次", "37次", "34次"], "orange")}
        ${renderDonutBlock("该企业的重点业务地区TOP5", "771次", ["广东", "湖南", "河南", "海南", "安徽"], ["714次", "38次", "8次", "6次", "5次"], "orange")}
      </div>
    </div>
  `;
}

function renderDonutBlock(title, total, labels, values, tone) {
  return `
    <article class="party-donut-block ${tone}">
      <div class="party-chart-title">
        <strong>${title}</strong>
        <span><b>次数</b><i>金额</i></span>
      </div>
      <div class="party-chart-body">
        <div class="party-donut"><strong>${total}</strong></div>
        <ul>
          ${labels
            .map(
              (label, index) => `
                <li class="${index === 1 || (tone === "orange" && index === 0) ? "highlight" : ""}">
                  <span>${label}</span><b>${values[index]}</b>
                </li>
              `
            )
            .join("")}
        </ul>
      </div>
    </article>
  `;
}

function renderBidTimeline(item) {
  return `
    <div class="bid-timeline">
      <article class="bid-cycle">
        <header><span>【2023年08月】至【2024年08月】合同期</span><strong>当前招标轮次</strong></header>
        <p>项目编号：SZCG2023000442</p>
        <div class="bid-event"><time>2024-07-19</time><b>招标公告</b><span>【延续合同】${item.title}（B包）合同公示</span><a>附件下载</a></div>
        <div class="bid-event"><time>2024-07-19</time><b>预采公告</b><span>【延续合同】${item.title}（A包）合同公示</span></div>
      </article>
      <article class="bid-cycle">
        <header><span>【2023年08月】至【2024年08月】合同期</span></header>
        <p>项目编号：SZCG2023000442 · 中标单位：深圳市深粮贝格厨房食品供应链有限公司 · 中标金额：700.00万元</p>
        <div class="bid-event"><time>2024-07-19</time><b class="soft">结果-合同公告</b><span>【延续合同】${item.title}（B包）合同公示</span><a>下载</a></div>
        <div class="bid-event"><time>2024-07-19</time><b class="soft">结果-合同公告</b><span>【延续合同】${item.title}（A包）合同公示</span><a>下载</a></div>
      </article>
    </div>
  `;
}

function renderProjectOpportunityBlankDetail(item) {
  return `
    <section class="project-blank-detail ${detailHintOpen ? "has-hint" : "is-hint-closed"}">
      <nav class="project-workspace-tabs project-blank-tabs" aria-label="项目功能模块">
        ${getProjectTabs()
          .map(
            ([key, label]) => `
              <button class="${projectWorkspaceTab === key ? "active" : ""}" data-project-tab="${key}">
                ${label}
              </button>
            `
          )
          .join("")}
      </nav>
      ${renderProjectDetailTopbar(item)}
      <main class="project-blank-main" aria-label="${item.title}商机详情">
        <div class="project-blank-canvas" aria-hidden="true"></div>
      </main>
      ${renderDetailHintPanel(item)}
    </section>
  `;
}

function renderDetailHintPanel(item) {
  if (!detailHintOpen) {
    return `
      <button class="detail-hint-dock" data-toggle-detail-hint aria-label="展开右侧提示">
        <strong>进度</strong>
        <span>报名已确认</span>
        <i>□</i>
      </button>
    `;
  }

  return `
    <aside class="detail-hint-panel" aria-label="右侧提示窗口">
      <div class="detail-hint-policy">
        <span>电子标</span>
        <span>${buildProjectFieldModel(item).microPolicy}</span>
        <button data-toggle-detail-hint aria-label="最小化右侧提示">−</button>
      </div>
      <div class="detail-hint-fees">
        <strong>报名费：200元</strong>
        <strong>投标保证金：5万元</strong>
        <strong>履约保证金：20万元</strong>
      </div>
      <div class="detail-hint-countdowns">
        ${[
          ["12天x小x分", "开标截止时间", "未投标"],
          ["5天x小x分", "保证金支付截止时间", "已支付"],
          ["3天x小x分", "招标质疑期截止时间", ""],
          ["1天x小x分", "报名截止时间", "已报名"]
        ]
          .map(
            ([time, label, state]) => `
              <article>
                <strong>${time}</strong>
                <span>${label}${state ? ` <small>（${state}）</small>` : ""}</span>
              </article>
            `
          )
          .join("")}
      </div>
    </aside>
  `;
}

function getDocumentTypes(documents) {
  return [...new Set(documents.map((item) => item.type).filter(Boolean))];
}

function formatFileSize(value) {
  const size = Number(value || 0);
  if (!size) return "无附件";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

function normalizeCategory(item) {
  return {
    key: item.key,
    name: item.name,
    description: item.description || item.desc || "",
    document_count: item.document_count || 0,
    sort_order: item.sort_order || 0,
    parent_key: item.parent_key || "",
    isCustomBase: Boolean(item.isCustomBase),
    isCreate: Boolean(item.isCreate)
  };
}

function getKnowledgeLibraryState() {
  try {
    return JSON.parse(localStorage.getItem("DL_KNOWLEDGE_LIBRARY_STATE") || "{\"bases\":[],\"subcategories\":{}}");
  } catch {
    return { bases: [], subcategories: {} };
  }
}

function saveKnowledgeLibraryState(state) {
  localStorage.setItem("DL_KNOWLEDGE_LIBRARY_STATE", JSON.stringify(state));
}

function buildKnowledgeEntryKey(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;
}

function getLibraryCategories(categories, documents) {
  const state = getKnowledgeLibraryState();
  const fixedBases = categories
    .filter((item) => item.key !== "custom" && !item.parent_key)
    .map(normalizeCategory);
  const customBases = (state.bases || []).map((item, index) =>
    normalizeCategory({
      ...item,
      isCustomBase: true,
      document_count: documents.filter((document) => document.category_key === item.key).length,
      sort_order: 100 + index
    })
  );
  const subcategories = Object.entries(state.subcategories || {}).flatMap(([parentKey, list]) =>
    (list || []).map((item, index) =>
      normalizeCategory({
        ...item,
        parent_key: parentKey,
        document_count: documents.filter((document) => document.category_key === item.key).length,
        sort_order: 1000 + index
      })
    )
  );
  const createEntry = normalizeCategory({
    key: "custom",
    name: "自定义知识库",
    description: "新建一个专属知识库，设置名称和备注后开始沉淀资料。",
    sort_order: 999,
    isCreate: true
  });

  return [...fixedBases, ...customBases, ...subcategories, createEntry].sort((a, b) => a.sort_order - b.sort_order);
}

function getChildKnowledgeCategories(parentKey, categories) {
  return categories.filter((item) => item.parent_key === parentKey);
}

function getParentKnowledgeKey(key) {
  const state = getKnowledgeLibraryState();
  return (
    Object.entries(state.subcategories || {}).find(([, list]) => (list || []).some((item) => item.key === key))?.[0] || ""
  );
}

function createCustomKnowledgeBase(formData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return null;
  const state = getKnowledgeLibraryState();
  const base = {
    key: buildKnowledgeEntryKey("custom"),
    name,
    description: String(formData.get("description") || "").trim() || "自定义知识库",
    sort_order: 100 + (state.bases || []).length
  };
  state.bases = [...(state.bases || []), base];
  saveKnowledgeLibraryState(state);
  return normalizeCategory({ ...base, isCustomBase: true });
}

function createChildKnowledgeCategory(parentKey, formData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return null;
  const state = getKnowledgeLibraryState();
  const list = state.subcategories?.[parentKey] || [];
  const child = {
    key: buildKnowledgeEntryKey(`${parentKey}-child`),
    parent_key: parentKey,
    name,
    description: String(formData.get("description") || "").trim() || "二级分类",
    sort_order: list.length + 1
  };
  state.subcategories = { ...(state.subcategories || {}), [parentKey]: [...list, child] };
  saveKnowledgeLibraryState(state);
  return normalizeCategory(child);
}

function deleteCustomKnowledgeBase(key) {
  const state = getKnowledgeLibraryState();
  const exists = (state.bases || []).some((item) => item.key === key);
  if (!exists) return false;
  state.bases = (state.bases || []).filter((item) => item.key !== key);
  const { [key]: _removed, ...restSubcategories } = state.subcategories || {};
  state.subcategories = restSubcategories;
  saveKnowledgeLibraryState(state);
  return true;
}

function deleteChildKnowledgeCategory(key) {
  const parentKey = getParentKnowledgeKey(key);
  if (!parentKey) return "";
  const state = getKnowledgeLibraryState();
  const list = state.subcategories?.[parentKey] || [];
  state.subcategories = {
    ...(state.subcategories || {}),
    [parentKey]: list.filter((item) => item.key !== key)
  };
  saveKnowledgeLibraryState(state);
  return parentKey;
}

function renderLibrary(categories, documents) {
  const bases = getLibraryCategories(categories, documents).filter((item) => !item.parent_key);
  return `
    <section class="content-panel knowledge-page">
      <div class="section-head">
        <div>
          <p class="eyebrow">Library</p>
          <h1>知识库</h1>
          <p>把资证、标书、图库、主体和成本参数集中成可检索、可上传、可沉淀的资料资产。</p>
        </div>
      </div>
      <div class="knowledge-list" aria-label="知识库分类">
        ${bases
          .map(
            (item) => `
              <button class="knowledge-item ${item.isCreate ? "is-create" : ""}" data-library-key="${item.key}">
                <span>${icon(item.isCreate ? "plus" : "book")}</span>
                <div>
                  <strong>${item.name}</strong>
                  <small>${item.description}</small>
                </div>
                ${item.isCreate ? "" : `<b>${item.document_count} 份</b>`}
              </button>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderLibraryDetail(item, documents, selectedDocument, categories = []) {
  if (!item) {
    return `
      <section class="content-panel library-blank-page">
        <button class="text-button" data-return-library>返回</button>
        <div class="empty-note">未找到该知识库分类。</div>
      </section>
    `;
  }

  const category = normalizeCategory(item);
  if (category.isCreate) return renderCreateKnowledgeBasePage();

  const types = getDocumentTypes(documents);
  const childCategories = getChildKnowledgeCategories(category.key, categories);
  const isChildCategory = Boolean(category.parent_key);
  return `
    <section class="content-panel knowledge-workbench">
      <div class="library-blank-head">
        <button class="text-button" data-return-library>返回</button>
        <div>
          <p class="eyebrow">Knowledge base</p>
          <h1>${category.name}</h1>
          <p>${category.description}</p>
        </div>
        <div class="knowledge-actions">
          <button class="text-button knowledge-upload-toggle" data-toggle-knowledge-upload>
            ${icon("upload")}${knowledgeUploadOpen ? "收起上传" : "上传资料"}
          </button>
          ${
            isChildCategory
              ? ""
              : `<button class="text-button knowledge-upload-toggle" data-toggle-knowledge-category-form>
                  ${icon("folder")}${knowledgeCategoryOpen ? "收起分类" : "新建分类"}
                </button>`
          }
          ${
            category.isCustomBase
              ? `<button class="text-button danger-button" data-delete-knowledge-base="${category.key}">${icon("trash")}删除知识库</button>`
              : ""
          }
          ${
            isChildCategory
              ? `<button class="text-button danger-button" data-delete-knowledge-category="${category.key}">${icon("trash")}删除分类</button>`
              : ""
          }
        </div>
      </div>
      ${knowledgeNotice ? `<div class="knowledge-notice">${knowledgeNotice}</div>` : ""}
      ${
        knowledgeUploadOpen
          ? `<form class="knowledge-upload-form" id="knowledgeUploadForm">
              <input type="hidden" name="category_key" value="${escapeHtml(category.key)}" />
              <label>
                <span>资料标题</span>
                <input name="title" placeholder="例如：学校物业评分办法模板" required />
              </label>
              <label>
                <span>资料类型</span>
                <input name="type" placeholder="标书资料 / 资质证书 / 数据表" value="上传文件" />
              </label>
              <label>
                <span>标签</span>
                <input name="tags" placeholder="用逗号分隔，如：学校,重庆,评分办法" />
              </label>
              <label>
                <span>附件</span>
                <input name="file" type="file" required />
              </label>
              <label class="knowledge-upload-summary">
                <span>摘要</span>
                <textarea name="summary" rows="3" placeholder="写一句这份资料可以如何复用"></textarea>
              </label>
              <input type="hidden" name="status" value="ready" />
              <button type="submit">${icon("upload")}保存资料</button>
            </form>`
          : ""
      }
      ${
        !isChildCategory && knowledgeCategoryOpen
          ? `<form class="knowledge-upload-form knowledge-category-form" id="knowledgeCategoryForm">
              <input type="hidden" name="parent_key" value="${escapeHtml(category.key)}" />
              <label>
                <span>分类名称</span>
                <input name="name" placeholder="例如：重庆学校项目资料" required />
              </label>
              <label class="knowledge-upload-summary">
                <span>备注解释</span>
                <textarea name="description" rows="3" placeholder="说明这个二级分类沉淀哪些资料"></textarea>
              </label>
              <button type="submit">${icon("folder")}保存分类</button>
            </form>`
          : ""
      }
      ${
        !isChildCategory && childCategories.length
          ? `<section class="knowledge-child-list" aria-label="${category.name}二级分类">
              ${childCategories
                .map(
                  (child) => `
                    <button data-library-key="${child.key}">
                      <span>${icon("folder")}</span>
                      <strong>${child.name}</strong>
                      <small>${child.description}</small>
                      <b>${child.document_count} 份</b>
                    </button>
                  `
                )
                .join("")}
            </section>`
          : ""
      }
      <div class="knowledge-toolbar" role="search">
        <label>
          ${icon("search")}
          <input id="knowledgeSearch" value="${escapeHtml(knowledgeSearch)}" placeholder="搜索标题、摘要、文件名或标签" />
        </label>
        <select id="knowledgeTypeFilter" aria-label="资料类型筛选">
          <option value="all">全部类型</option>
          ${types.map((type) => `<option value="${escapeHtml(type)}" ${knowledgeTypeFilter === type ? "selected" : ""}>${type}</option>`).join("")}
        </select>
        <select id="knowledgeStatusFilter" aria-label="状态筛选">
          <option value="all" ${knowledgeStatusFilter === "all" ? "selected" : ""}>全部状态</option>
          <option value="ready" ${knowledgeStatusFilter === "ready" ? "selected" : ""}>可用</option>
          <option value="draft" ${knowledgeStatusFilter === "draft" ? "selected" : ""}>草稿</option>
          <option value="archived" ${knowledgeStatusFilter === "archived" ? "selected" : ""}>归档</option>
        </select>
      </div>
      <div class="knowledge-workbench-grid">
        <section class="knowledge-document-list" aria-label="${category.name}资料列表">
          ${
            documents.length
              ? documents.map((document) => renderKnowledgeDocumentRow(document, selectedDocument?.id)).join("")
              : `<div class="empty-note">当前筛选下暂无资料。可以调整搜索条件，或上传一份新资料。</div>`
          }
        </section>
        ${renderKnowledgePreview(selectedDocument)}
      </div>
    </section>
  `;
}

function renderCreateKnowledgeBasePage() {
  return `
    <section class="content-panel library-blank-page">
      <div class="library-blank-head">
        <button class="text-button" data-return-library>返回</button>
        <div>
          <p class="eyebrow">Create knowledge base</p>
          <h1>自定义知识库</h1>
          <p>设置新知识库名称和备注解释，保存后会出现在知识库列表中。</p>
        </div>
      </div>
      ${knowledgeNotice ? `<div class="knowledge-notice">${knowledgeNotice}</div>` : ""}
      <form class="knowledge-create-form" id="knowledgeBaseForm">
        <label>
          <span>知识库名称</span>
          <input name="name" placeholder="例如：重庆学校拓展资料库" required />
        </label>
        <label>
          <span>备注解释</span>
          <textarea name="description" rows="5" placeholder="说明这个知识库用于沉淀哪些资料、给谁使用、如何复用"></textarea>
        </label>
        <button type="submit">${icon("plus")}创建知识库</button>
      </form>
    </section>
  `;
}

function renderKnowledgeDocumentRow(document, activeId) {
  return `
    <article class="knowledge-document-row ${activeId === document.id ? "active" : ""}" data-knowledge-doc="${document.id}" tabindex="0" role="button">
      <div class="knowledge-document-icon">${icon("file")}</div>
      <div>
        <div class="knowledge-document-title">
          <strong>${document.title}</strong>
          <span>${document.type}</span>
        </div>
        <p>${document.summary || "暂无摘要"}</p>
        <div class="knowledge-document-meta">
          <span>${formatDate(document.updated_at)}</span>
          <span>${formatFileSize(document.file_size)}</span>
          ${(document.tags || []).map((tag) => `<em>${tag}</em>`).join("")}
        </div>
      </div>
      <button data-delete-knowledge="${document.id}" title="删除资料">${icon("trash")}</button>
    </article>
  `;
}

function renderKnowledgePreview(document) {
  if (!document) {
    return `
      <aside class="knowledge-preview">
        <div class="empty-note">选择一份资料查看详情。</div>
      </aside>
    `;
  }

  const href = document.download_url ? `${backendContract.API_BASE_URL || ""}${document.download_url}` : "";
  return `
    <aside class="knowledge-preview" aria-label="资料详情">
      <div class="knowledge-preview-head">
        <span>${icon("file")}</span>
        <div>
          <p class="eyebrow">${document.type}</p>
          <h2>${document.title}</h2>
        </div>
      </div>
      <dl class="knowledge-preview-list">
        <dt>状态</dt><dd>${document.status === "ready" ? "可用" : document.status}</dd>
        <dt>文件名</dt><dd>${document.source_filename || "未绑定附件"}</dd>
        <dt>文件大小</dt><dd>${formatFileSize(document.file_size)}</dd>
        <dt>更新时间</dt><dd>${formatDate(document.updated_at)}</dd>
      </dl>
      <div class="knowledge-preview-tags">
        ${(document.tags || []).length ? document.tags.map((tag) => `<em>${tag}</em>`).join("") : "<span>暂无标签</span>"}
      </div>
      <p>${document.summary || "暂无摘要。"}</p>
      <div class="knowledge-preview-actions">
        ${
          href
            ? `<a class="text-button" href="${href}" target="_blank" rel="noreferrer">打开附件</a>`
            : `<span class="knowledge-muted">当前资料只有元数据</span>`
        }
      </div>
    </aside>
  `;
}

function renderOptionChips(items, selected = []) {
  return items
    .map(
      (item) => `
        <label class="preference-chip">
          <input type="checkbox" ${selected.includes(item) ? "checked" : ""} />
          <span>${item}</span>
        </label>
      `
    )
    .join("");
}

function renderOpportunityPreferences() {
  return `
    <section class="content-panel preference-page">
      <div class="section-head">
        <div>
          <p class="eyebrow">Preference</p>
          <h1>商机偏好设置</h1>
          <p>按区域、项目条件和业主类型设置自动推荐范围，后续用于订阅和商机筛选。</p>
        </div>
        <button class="text-button" data-route="chat">返回新建对话</button>
      </div>

      <div class="preference-steps">
        <section class="preference-step">
          <div class="preference-step-title">
            <span>01</span>
            <div>
              <h2>请选择您的区域偏好</h2>
              <p>只选择省份和城市，用于限定商机推荐区域。</p>
            </div>
          </div>
          <div class="preference-field-grid">
            <label>
              <span>省份</span>
              <select aria-label="省份">
                <option selected>重庆市</option>
                <option>四川省</option>
                <option>湖南省</option>
                <option>广东省</option>
              </select>
            </label>
            <label>
              <span>城市</span>
              <select aria-label="城市">
                <option selected>重庆市</option>
                <option>成都市</option>
                <option>长沙市</option>
                <option>深圳市</option>
              </select>
            </label>
          </div>
        </section>

        <section class="preference-step">
          <div class="preference-step-title">
            <span>02</span>
            <div>
              <h2>请选择您的商机偏好</h2>
              <p>围绕项目金额、合同周期、招标方式、业务类型和业态筛选。</p>
            </div>
          </div>
          <div class="preference-amount">
            <div>
              <strong>项目金额</strong>
              <span>最小金额 <b data-amount-min-label>200</b> 万元 / 最大金额 <b data-amount-max-label>3000</b> 万元</span>
            </div>
            <div class="dual-range" data-dual-range>
              <input type="range" min="0" max="5000" value="200" step="50" data-amount-min aria-label="最小项目金额" />
              <input type="range" min="0" max="5000" value="3000" step="50" data-amount-max aria-label="最大项目金额" />
              <div class="amount-range-values">
                <span>0万元</span>
                <span>5000万元</span>
              </div>
            </div>
          </div>
          <div class="preference-group">
            <strong>合同周期</strong>
            <div>${renderOptionChips(["不限", "1年以下", "1年", "2年", "3年", "5年", "5年以上"], ["不限", "3年"])}</div>
          </div>
          <div class="preference-group">
            <strong>招标方式</strong>
            <div>${renderOptionChips(["公开招标", "邀请招标", "竞争性谈判", "单一来源", "询价", "电子卖场"], ["公开招标"])}</div>
          </div>
          <div class="preference-group">
            <strong>业务类型</strong>
            <div>${renderOptionChips(["不限", "物业服务", "保洁服务", "秩序维护", "工程运维", "后勤综合"], ["不限", "物业服务"])}</div>
          </div>
          <div class="preference-group">
            <strong>业态</strong>
            <div>${renderOptionChips(["不限", "公共", "学校", "商住", "航空", "医养", "城服"], ["学校", "公共"])}</div>
          </div>
        </section>

        <section class="preference-step">
          <div class="preference-step-title">
            <span>03</span>
            <div>
              <h2>请选择您的业主类型偏好</h2>
              <p>支持选择标准业主类型，也可补充其他关键词。</p>
            </div>
          </div>
          <div class="preference-group">
            <strong>业主类型</strong>
            <div>${renderOptionChips(["不限", "政府单位", "教育单位", "医疗单位", "中央企业", "国有企业", "互联网企业", "金融企业", "制造企业"], ["教育单位", "国有企业"])}</div>
          </div>
          <label class="preference-keyword">
            <span>其他关键词</span>
            <input placeholder="请输入关键词" value="高校、产业园、医院后勤" />
          </label>
        </section>
      </div>
    </section>
  `;
}

function renderApiContract() {
  return `
    <section class="content-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">FastAPI Ready</p>
          <h1>后端接口预留</h1>
          <p>设置 <code>window.__API_BASE_URL__</code> 或 <code>localStorage.API_BASE_URL</code> 后，前端会调用真实 FastAPI；未设置时使用本地 mock 数据。</p>
        </div>
      </div>
      <div class="api-grid">
        ${Object.entries(backendContract.endpoints)
          .map(([name, path]) => `<article><strong>${name}</strong><code>${path}</code></article>`)
          .join("")}
      </div>
      <pre class="code-block">localStorage.setItem("API_BASE_URL", "http://127.0.0.1:8000");</pre>
    </section>
  `;
}

function bindPreferenceAmountRange() {
  const minInput = document.querySelector("[data-amount-min]");
  const maxInput = document.querySelector("[data-amount-max]");
  const minLabel = document.querySelector("[data-amount-min-label]");
  const maxLabel = document.querySelector("[data-amount-max-label]");
  if (!minInput || !maxInput || !minLabel || !maxLabel) return;

  const sync = (source) => {
    let minValue = Number(minInput.value);
    let maxValue = Number(maxInput.value);
    if (minValue > maxValue) {
      if (source === "min") {
        maxValue = minValue;
        maxInput.value = String(maxValue);
      } else {
        minValue = maxValue;
        minInput.value = String(minValue);
      }
    }
    minLabel.textContent = String(minValue);
    maxLabel.textContent = String(maxValue);
  };

  minInput.addEventListener("input", () => sync("min"));
  maxInput.addEventListener("input", () => sync("max"));
  sync("min");
}

function clampRelationshipZoom(value) {
  return Math.min(1.8, Math.max(0.6, Number(value.toFixed(2))));
}

function applyRelationshipTransform() {
  const stage = document.querySelector("[data-relationship-stage]");
  if (stage) stage.style.transform = `translate(${relationshipPan.x}px, ${relationshipPan.y}px) scale(${relationshipZoom})`;

  const label = document.querySelector("[data-relationship-zoom-label]");
  if (label) label.textContent = `${Math.round(relationshipZoom * 100)}%`;
}

function updateHistoryTabArrows() {
  const tabs = document.querySelector("[data-history-tabs]");
  const left = document.querySelector('[data-history-tab-scroll="left"]');
  const right = document.querySelector('[data-history-tab-scroll="right"]');
  if (!tabs || !left || !right) return;

  const maxScroll = Math.max(0, tabs.scrollWidth - tabs.clientWidth);
  const current = tabs.scrollLeft;
  const hasOverflow = maxScroll > 2;
  left.hidden = !hasOverflow || current <= 2;
  right.hidden = !hasOverflow || current >= maxScroll - 2;
}

function filterHistoryCenterItems() {
  const input = document.querySelector("#historySearchInput");
  if (!input) return;
  const keyword = input.value.trim().toLowerCase();
  historySearch = input.value;
  const items = Array.from(document.querySelectorAll("[data-history-search]"));
  let visibleCount = 0;
  items.forEach((item) => {
    const matched = !keyword || item.dataset.historySearch.includes(keyword);
    item.hidden = !matched;
    if (matched) visibleCount += 1;
  });
  const empty = document.querySelector("[data-history-empty]");
  if (empty) empty.hidden = visibleCount > 0;
}

function bindHistoryCenterTabs() {
  const tabs = document.querySelector("[data-history-tabs]");
  if (historyTabsResizeHandler) {
    window.removeEventListener("resize", historyTabsResizeHandler);
    historyTabsResizeHandler = null;
  }
  if (!tabs) return;

  updateHistoryTabArrows();
  requestAnimationFrame(updateHistoryTabArrows);
  tabs.addEventListener("scroll", updateHistoryTabArrows, { passive: true });
  historyTabsResizeHandler = updateHistoryTabArrows;
  window.addEventListener("resize", historyTabsResizeHandler);

  document.querySelectorAll("[data-history-tab-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const direction = button.dataset.historyTabScroll === "left" ? -1 : 1;
      tabs.scrollBy({ left: direction * Math.round(tabs.clientWidth * 0.72), behavior: "smooth" });
      window.setTimeout(updateHistoryTabArrows, 260);
    });
  });

  document.querySelectorAll("[data-history-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      historySkillFilter = button.dataset.historySkill;
      render();
    });
  });

  const searchInput = document.querySelector("#historySearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", filterHistoryCenterItems);
    searchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        filterHistoryCenterItems();
      }
    });
  }
}

function bindEvents() {
  document.querySelectorAll("[data-new-chat]").forEach((button) => {
    button.addEventListener("click", () => startNewChat());
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route));
  });

  bindHistoryCenterTabs();

  document.querySelectorAll("[data-return-history-center]").forEach((button) => {
    button.addEventListener("click", () => {
      saveCurrentThread();
      route = "historyCenter";
      resultsOpen = false;
      render();
    });
  });

  bindPreferenceAmountRange();

  document.querySelectorAll("[data-toggle-user-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      userMenuOpen = !userMenuOpen;
      render();
    });
  });

  document.querySelectorAll("[data-user-menu-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.userMenuAction === "preference") {
        setRoute("preferences");
        return;
      }
      userMenuOpen = false;
      render();
    });
  });

  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => handleLogout());
  });

  document.querySelectorAll("[data-return-from-detail]").forEach((button) => {
    button.addEventListener("click", () => returnFromDetail());
  });

  document.querySelectorAll("[data-return-library]").forEach((button) => {
    button.addEventListener("click", () => returnToLibrary());
  });

  document.querySelectorAll("[data-library-key]").forEach((button) => {
    button.addEventListener("click", () => openLibraryDetail(button.dataset.libraryKey));
  });

  document.querySelectorAll("[data-knowledge-doc]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      selectedKnowledgeDocumentId = element.dataset.knowledgeDoc;
      knowledgeNotice = "";
      render();
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectedKnowledgeDocumentId = element.dataset.knowledgeDoc;
        knowledgeNotice = "";
        render();
      }
    });
  });

  document.querySelectorAll("[data-delete-knowledge]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const confirmed = window.confirm("确定删除这份资料吗？");
      if (!confirmed) return;
      await deleteKnowledgeDocument(button.dataset.deleteKnowledge);
      if (selectedKnowledgeDocumentId === button.dataset.deleteKnowledge) selectedKnowledgeDocumentId = "";
      knowledgeNotice = "资料已删除。";
      render();
    });
  });

  document.querySelectorAll("[data-delete-knowledge-base]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const confirmed = window.confirm("确定删除这个自定义知识库吗？");
      if (!confirmed) return;
      const deleted = deleteCustomKnowledgeBase(button.dataset.deleteKnowledgeBase);
      if (!deleted) return;
      selectedLibraryKey = "";
      selectedKnowledgeDocumentId = "";
      knowledgeNotice = "";
      route = "library";
      render();
    });
  });

  document.querySelectorAll("[data-delete-knowledge-category]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const confirmed = window.confirm("确定删除这个二级分类吗？");
      if (!confirmed) return;
      const parentKey = deleteChildKnowledgeCategory(button.dataset.deleteKnowledgeCategory);
      if (!parentKey) return;
      selectedLibraryKey = parentKey;
      selectedKnowledgeDocumentId = "";
      knowledgeSearch = "";
      knowledgeTypeFilter = "all";
      knowledgeStatusFilter = "all";
      knowledgeUploadOpen = false;
      knowledgeCategoryOpen = false;
      knowledgeNotice = "分类已删除。";
      render();
    });
  });

  document.querySelectorAll("[data-toggle-knowledge-upload]").forEach((button) => {
    button.addEventListener("click", () => {
      knowledgeUploadOpen = !knowledgeUploadOpen;
      knowledgeNotice = "";
      render();
    });
  });

  document.querySelectorAll("[data-toggle-knowledge-category-form]").forEach((button) => {
    button.addEventListener("click", () => {
      knowledgeCategoryOpen = !knowledgeCategoryOpen;
      knowledgeNotice = "";
      render();
    });
  });

  const knowledgeSearchInput = document.querySelector("#knowledgeSearch");
  if (knowledgeSearchInput) {
    knowledgeSearchInput.addEventListener("change", (event) => {
      knowledgeSearch = event.target.value;
      selectedKnowledgeDocumentId = "";
      render();
    });
    knowledgeSearchInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        knowledgeSearch = event.target.value;
        selectedKnowledgeDocumentId = "";
        render();
      }
    });
  }

  const knowledgeTypeSelect = document.querySelector("#knowledgeTypeFilter");
  if (knowledgeTypeSelect) {
    knowledgeTypeSelect.addEventListener("change", (event) => {
      knowledgeTypeFilter = event.target.value;
      selectedKnowledgeDocumentId = "";
      render();
    });
  }

  const knowledgeStatusSelect = document.querySelector("#knowledgeStatusFilter");
  if (knowledgeStatusSelect) {
    knowledgeStatusSelect.addEventListener("change", (event) => {
      knowledgeStatusFilter = event.target.value;
      selectedKnowledgeDocumentId = "";
      render();
    });
  }

  const knowledgeUploadForm = document.querySelector("#knowledgeUploadForm");
  if (knowledgeUploadForm) {
    knowledgeUploadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const created = await uploadKnowledgeDocument(new FormData(knowledgeUploadForm));
      selectedKnowledgeDocumentId = created.id;
      knowledgeUploadOpen = false;
      knowledgeNotice = "资料已保存。";
      render();
    });
  }

  const knowledgeBaseForm = document.querySelector("#knowledgeBaseForm");
  if (knowledgeBaseForm) {
    knowledgeBaseForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const created = createCustomKnowledgeBase(new FormData(knowledgeBaseForm));
      if (!created) {
        knowledgeNotice = "请填写知识库名称。";
        render();
        return;
      }
      selectedLibraryKey = created.key;
      knowledgeNotice = "知识库已创建。";
      route = "libraryDetail";
      render();
    });
  }

  const knowledgeCategoryForm = document.querySelector("#knowledgeCategoryForm");
  if (knowledgeCategoryForm) {
    knowledgeCategoryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const parentKey = new FormData(knowledgeCategoryForm).get("parent_key");
      const created = createChildKnowledgeCategory(parentKey, new FormData(knowledgeCategoryForm));
      if (!created) {
        knowledgeNotice = "请填写分类名称。";
        render();
        return;
      }
      knowledgeCategoryOpen = false;
      knowledgeNotice = "分类已创建。";
      render();
    });
  }

  document.querySelectorAll("[data-toggle-sidebar]").forEach((button) => {
    button.addEventListener("click", () => {
      sidebarOpen = !sidebarOpen;
      render();
    });
  });

  document.querySelectorAll("[data-toggle-history]").forEach((button) => {
    button.addEventListener("click", () => {
      historyOpen = !historyOpen;
      render();
    });
  });

  document.querySelectorAll("[data-toggle-subscriptions]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      subscriptionOpen = !subscriptionOpen;
      render();
    });
  });

  document.querySelectorAll("[data-toggle-results]").forEach((button) => {
    button.addEventListener("click", () => {
      resultsOpen = !resultsOpen;
      saveCurrentThread();
      render();
    });
  });

  document.querySelectorAll("[data-relationship-zoom]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.relationshipZoom;
      if (action === "reset") {
        relationshipZoom = RELATIONSHIP_DEFAULT_ZOOM;
        relationshipPan = { x: 0, y: 0 };
      } else {
        relationshipZoom = clampRelationshipZoom(relationshipZoom + (action === "in" ? 0.15 : -0.15));
      }
      applyRelationshipTransform();
      saveCurrentThread();
    });
  });

  const relationshipViewport = document.querySelector("[data-relationship-viewport]");
  if (relationshipViewport) {
    relationshipViewport.addEventListener("contextmenu", (event) => event.preventDefault());
    relationshipViewport.addEventListener("mousedown", (event) => {
      if (event.button !== 2) return;
      event.preventDefault();
      const start = {
        x: event.clientX,
        y: event.clientY,
        panX: relationshipPan.x,
        panY: relationshipPan.y
      };
      relationshipViewport.classList.add("is-dragging");

      const handleMove = (moveEvent) => {
        relationshipPan = {
          x: start.panX + moveEvent.clientX - start.x,
          y: start.panY + moveEvent.clientY - start.y
        };
        applyRelationshipTransform();
      };

      const handleUp = () => {
        relationshipViewport.classList.remove("is-dragging");
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        saveCurrentThread();
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
    });
  }

  document.querySelectorAll("[data-toggle-detail-hint]").forEach((button) => {
    button.addEventListener("click", () => {
      detailHintOpen = !detailHintOpen;
      render();
    });
  });

  document.querySelectorAll("[data-detail-analysis]").forEach((button) => {
    button.addEventListener("click", () => {
      detailAnalysisPanel = button.dataset.detailAnalysis;
      render();
    });
  });

  document.querySelectorAll("[data-detail-analysis-close]").forEach((button) => {
    button.addEventListener("click", () => {
      detailAnalysisPanel = "";
      render();
    });
  });

  document.querySelectorAll("[data-toggle-radar]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      radarCompact = !radarCompact;
      render();
    });
  });

  document.querySelectorAll("[data-watch-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      watchFilter = button.dataset.watchFilter;
      render();
    });
  });

  document.querySelectorAll("[data-clear-watch-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      watchFilter = "all";
      render();
    });
  });

  document.querySelectorAll("[data-open-project-workspace]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openProjectWorkspace(element.dataset.openProjectWorkspace);
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProjectWorkspace(element.dataset.openProjectWorkspace);
      }
    });
  });

  document.querySelectorAll("[data-project-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.dataset.projectAction === "rename") {
        await renameProject(button.dataset.projectId);
        return;
      }
      if (button.dataset.projectAction === "abandon") {
        await abandonProject(button.dataset.projectId);
      }
    });
  });

  document.querySelectorAll("[data-project-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      projectWorkspaceTab = button.dataset.projectTab;
      render();
    });
  });

  document.querySelectorAll("[data-new-project]").forEach((button) => {
    button.addEventListener("click", () => startNewProjectDraft());
  });

  document.querySelectorAll("[data-history-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await openHistoryThread({
        id: button.dataset.historyId,
        title: button.dataset.historyTitle,
        prompt: button.dataset.historyPrompt
      });
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      activeMode = button.dataset.mode;
      render();
    });
  });

  document.querySelectorAll("[data-skill-prompt]").forEach((button) => {
    button.addEventListener("click", () => runSkill(button.dataset.skillLabel, button.dataset.skillPrompt));
  });

  document.querySelectorAll("[data-remove-skill-card]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      selectedSkillCards = selectedSkillCards.filter((item) => item !== button.dataset.removeSkillCard);
      saveCurrentThread();
      render();
    });
  });

  document.querySelectorAll("[data-suggestion-prompt]").forEach((button) => {
    button.addEventListener("click", () => fillComposer(button.dataset.suggestionPrompt));
  });

  document.querySelectorAll("[data-profile-prompt]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      fillComposer(button.dataset.profilePrompt);
      route = "chat";
      render();
    });
  });

  document.querySelectorAll("[data-detail-section]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const section = button.dataset.detailSection;
      detailActiveSection = section;
      document.querySelectorAll("[data-detail-section]").forEach((item) => item.classList.toggle("active", item.dataset.detailSection === section));
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
      saveCurrentThread();
    });
  });

  const detailSectionElements = [...document.querySelectorAll(".opportunity-detail-page .detail-wide-card[id]")];
  if (detailSectionElements.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        detailActiveSection = visible.target.id;
        document
          .querySelectorAll("[data-detail-section]")
          .forEach((item) => item.classList.toggle("active", item.dataset.detailSection === detailActiveSection));
      },
      { root: null, rootMargin: "-150px 0px -55% 0px", threshold: [0.16, 0.32, 0.5] }
    );
    detailSectionElements.forEach((section) => observer.observe(section));
  }

  document.querySelectorAll("[data-relationship-route]").forEach((button) => {
    button.addEventListener("click", () => {
      relationshipRouteIndex = Number(button.dataset.relationshipRoute || 0);
      saveCurrentThread();
      render();
    });
  });

  document.querySelectorAll("[data-open-opportunity]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openOpportunity(element.dataset.openOpportunity);
    });
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openOpportunity(element.dataset.openOpportunity);
      }
    });
  });

  document.querySelectorAll("[data-watch]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!String(button.dataset.watch || "").startsWith("hist-")) {
        const nextWatching = await toggleWatching(button.dataset.watch);
        if (route === "opportunity" && selectedOpportunityId === button.dataset.watch) {
          button.textContent = nextWatching ? "取消盯标" : "加入盯标";
          return;
        }
      }
      chatResults = chatResults.map((item) => (item.id === button.dataset.watch ? { ...item, watching: !item.watching } : item));
      saveCurrentThread();
      render();
    });
  });

  document.querySelectorAll("[data-block-opportunity-start]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      blockingOpportunityId = button.dataset.blockOpportunityStart;
      render();
    });
  });

  document.querySelectorAll("[data-block-opportunity-cancel]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      blockingOpportunityId = "";
      render();
    });
  });

  document.querySelectorAll("[data-block-opportunity]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = button.dataset.blockOpportunity;
      const type = button.dataset.blockType || "project";
      const allOpportunities = await getOpportunities();
      const item = [...chatResults, ...blockedChatResults, ...allOpportunities].find((entry) => entry.id === id);
      if (!item) return;
      blockOpportunityByRule(item, type);
      const split = splitBlockedOpportunities([...chatResults, ...blockedChatResults]);
      chatResults = split.visible;
      blockedChatResults = split.blocked;
      blockingOpportunityId = "";
      saveCurrentThread();
      render();
    });
  });

  document.querySelectorAll("[data-toggle-detail-block-menu]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      detailBlockMenuOpen = !detailBlockMenuOpen;
      render();
    });
  });

  document.querySelectorAll("[data-block-opportunity-detail]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = await getOpportunityDetail(button.dataset.blockOpportunityDetail);
      if (!item) return;
      blockOpportunityByRule(item, button.dataset.blockType || "project");
      detailBlockMenuOpen = false;
      returnFromDetail();
    });
  });

  document.querySelectorAll("[data-show-blocked-opportunities]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      chatResults = [...chatResults, ...blockedChatResults.map((item) => ({ ...item, blockedRevealed: true }))];
      blockedChatResults = [];
      resultsOpen = true;
      saveCurrentThread();
      render();
    });
  });

  document.querySelectorAll("[data-subscribe-opportunities]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      messages = [
        ...messages,
        {
          role: "assistant",
          content: "已为您创建本次问题的商机订阅，后续同类项目会优先提醒。"
        }
      ];
      saveCurrentThread();
      render();
    });
  });

  const form = document.querySelector("#chatForm");
  if (form) {
    form.elements.message.addEventListener("input", (event) => {
      draftMessage = event.target.value;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = form.elements.message;
      await submitChat(input.value);
    });
  }
}

async function submitChat(rawText) {
  const content = String(rawText || "").trim();
  if (!content) return;

  messages = [...messages, { role: "user", content }];
  draftMessage = "";
  selectedSkillCards = [];
  chatResults = [];
  blockedChatResults = [];
  relationshipResult = null;
  resultMode = "opportunity";
  relationshipZoom = RELATIONSHIP_DEFAULT_ZOOM;
  relationshipPan = { x: 0, y: 0 };
  resultsOpen = false;
  route = "chat";
  saveCurrentThread();
  render();

  const result = await sendChatMessage(content);
  const split = splitBlockedOpportunities(result.opportunities);
  chatResults = split.visible;
  blockedChatResults = split.blocked;
  const totalCount = chatResults.length + blockedChatResults.length;
  const blockedNotice = blockedChatResults.length ? `您有 ${blockedChatResults.length} 个已屏蔽的项目未显示。` : "";
  messages = [
    ...messages,
    {
      role: "assistant",
      content: blockedNotice ? `共找到 ${totalCount} 个项目。${blockedNotice}` : result.reply,
      resultLink: chatResults.length > 0,
      resultLabel: `查看推荐结果（${chatResults.length}）`,
      blockedLink: blockedChatResults.length > 0,
      suggestions: buildSuggestedQuestions(content, chatResults)
    }
  ];
  resultsOpen = false;
  saveCurrentThread();
  render();
}

async function runSkill(label, prompt) {
  if (label && !selectedSkillCards.includes(label)) {
    selectedSkillCards = [...selectedSkillCards, label];
  }
  focusComposer = true;
  saveCurrentThread();
  render();
}

function fillComposer(content) {
  draftMessage = content;
  focusComposer = true;
  render();
}

function buildSuggestedQuestions(content, opportunities) {
  const first = opportunities[0];
  if (first) {
    return [
      `查看${first.title}的关键风险`,
      `分析${first.buyer}的人脉路径`,
      `把${first.title}加入AI盯标`
    ];
  }

  if (content.includes("标书")) {
    return ["解析招标文件", "生成投标文件", "进行标书输出智检"];
  }

  return ["放宽城市重新筛选", "只看学校业态项目", "查找未来六个月到期合同"];
}

function scrollMessages() {
  const stream = document.querySelector("#messageStream");
  if (stream) stream.scrollTop = stream.scrollHeight;
  if (focusComposer) {
    const input = document.querySelector("#chatForm textarea");
    if (input) {
      input.focus();
      input.selectionStart = input.value.length;
      input.selectionEnd = input.value.length;
    }
    focusComposer = false;
  }
}

render().catch((error) => {
  app.innerHTML = `<main class="runtime-error"><h1>页面加载失败</h1><p>${error.message}</p></main>`;
});
