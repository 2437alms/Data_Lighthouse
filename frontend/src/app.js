import {
  backendContract,
  getConversations,
  getFavorites,
  getLibraryItems,
  getOpportunityDetail,
  getOpportunities,
  getRadarSummary,
  getWatchTargets,
  sendChatMessage,
  toggleFavorite,
  toggleWatching
} from "./api.js";

const app = document.querySelector("#app");

let route = "chat";
let selectedOpportunityId = "";
let detailReturnRoute = "chat";
let detailMode = "normal";
let sidebarOpen = true;
let historyOpen = true;
let subscriptionOpen = true;
let activeMode = "radar";
let draftMessage = "";
let focusComposer = false;
let resultsOpen = true;
let radarCompact = false;
let watchFilter = "all";
let projectWorkspaceTab = "overview";
let detailHintOpen = true;
const initialMessage = {
  role: "assistant",
  content: "你好，我是 DataLighthouse。你可以直接问我商机、项目、人脉路径或到期合同，我会把可行动的机会整理在下方。"
};
let messages = [
  {
    ...initialMessage
  }
];
let chatResults = [];
let activeThreadId = "draft";
const chatThreads = new Map();

function hasConversation() {
  return messages.some((message) => message.role === "user");
}

function saveCurrentThread() {
  chatThreads.set(activeThreadId, {
    messages: [...messages],
    chatResults: [...chatResults],
    draftMessage,
    resultsOpen
  });
}

function loadChatThread(threadId, fallbackState) {
  saveCurrentThread();
  activeThreadId = threadId;
  const state = chatThreads.get(threadId) || fallbackState;
  chatThreads.set(threadId, state);
  messages = [...state.messages];
  chatResults = [...state.chatResults];
  draftMessage = state.draftMessage || "";
  resultsOpen = Boolean(state.resultsOpen);
  selectedOpportunityId = "";
  route = "chat";
  render();
}

function createEmptyThread() {
  return {
    messages: [{ ...initialMessage }],
    chatResults: [],
    draftMessage: "",
    resultsOpen: false
  };
}

const modeConfig = {
  radar: {
    label: "商机雷达",
    icon: "target",
    skills: [
      ["算法推荐", "帮我按匹配度推荐当前最值得跟进的物业商机"],
      ["人脉图谱", "分析目标项目的人脉关系路径和关键联系人"],
      ["智能画像", "扫描重庆学校客户与关键联系人"],
      ["市场分析", "分析重庆学校市场竞争情况"]
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
    send: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
    pin: '<path d="M12 3 4 11l9 9 7-8-8-9z"></path>'
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
  render();
}

function startNewChat() {
  loadChatThread(`draft-${Date.now()}`, createEmptyThread());
}

function openOpportunity(id) {
  if (route !== "opportunity") detailReturnRoute = route;
  selectedOpportunityId = id;
  detailMode = "normal";
  detailHintOpen = true;
  route = "opportunity";
  render();
}

function openProjectWorkspace(id) {
  selectedOpportunityId = id;
  detailReturnRoute = "favorites";
  detailMode = "project";
  projectWorkspaceTab = "overview";
  detailHintOpen = true;
  route = "opportunity";
  render();
}

function returnFromDetail() {
  route = detailReturnRoute || "chat";
  selectedOpportunityId = "";
  detailMode = "normal";
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
    draftMessage: "",
    resultsOpen: false
  };
  return state;
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

function pageTitle() {
  const titles = {
    chat: "新对话",
    recommendations: "推荐商机",
    watch: "AI盯标",
    favorites: "我的项目",
    projectWorkspace: "项目工作台",
    library: "知识库",
    api: "后端接口"
  };
  return titles[route] || "新对话";
}

async function render() {
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

function renderSidebar(conversations) {
  return `
    <aside class="sidebar" aria-label="主导航">
      <div class="brand-row">
        <button class="brand-button" data-new-chat title="回到新对话">
          <span class="brand-mark">${icon("logo")}</span>
          <span class="brand-copy">
            <strong>DataLighthouse</strong>
            <small>数据灯塔 AI</small>
          </span>
        </button>
        <button class="square-button" data-toggle-sidebar title="隐藏侧边栏">${icon("collapse")}</button>
      </div>

      <label class="search-box">
        ${icon("search")}
        <input placeholder="搜索对话" aria-label="搜索对话" />
      </label>

      <nav class="nav-list" aria-label="功能导航">
        <button class="nav-button ${route === "chat" && !hasConversation() ? "active" : ""}" data-new-chat>
          ${icon("chat")}
          <span>新对话</span>
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
        <button class="history-toggle" data-toggle-history aria-expanded="${historyOpen}">
          ${icon("history")}
          <span>历史对话</span>
          <i>${historyOpen ? "收起" : "展开"}</i>
        </button>
        ${
          historyOpen
            ? `<div class="history-list">
                ${conversations
                  .map(
                    (item) => `
                      <button class="history-item" data-history-id="${item.id}" data-history-title="${escapeHtml(item.title)}" data-history-prompt="${escapeHtml(item.prompt)}">
                        <strong>${item.title}</strong>
                        <span>${item.time}</span>
                      </button>
                    `
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>

      <button class="user-profile" type="button" title="用户信息">
        <span class="user-avatar" aria-hidden="true">用</span>
        <span class="user-copy">
          <strong>用户信息</strong>
          <small>市场拓展账号</small>
        </span>
      </button>
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
          <span>${summary.recommendedCount} 推荐</span>
          <span>${summary.watchingCount} AI盯标</span>
          <span>${summary.wonCount} 已中标</span>
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
          <button data-route="recommendations"><strong>${summary.recommendedCount}</strong><span>推荐商机</span></button>
          <button data-route="watch"><strong>${summary.watchingCount}</strong><span>AI盯标</span></button>
          <button type="button" data-suggestion-prompt="查看最近已中标的项目，并分析可复用的中标路径"><strong>${summary.wonCount}</strong><span>已中标</span></button>
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
  if (route === "library") return renderLibrary(await getLibraryItems());
  if (route === "api") return renderApiContract();
  return renderChat();
}

function renderChat() {
  const conversationStarted = hasConversation();
  const hasResults = chatResults.length > 0;
  return `
    <section class="chat-layout ${conversationStarted ? "has-conversation" : ""} ${hasResults && resultsOpen ? "has-results" : ""}">
      ${
        conversationStarted
          ? ""
          : `<div class="hero-copy">
              <div class="product-title">
                <strong>DataLighthouse</strong>
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
            <textarea name="message" rows="3" placeholder="今天帮你做些什么？@ 引用对话文件，/ 调用技能与指令">${escapeHtml(draftMessage)}</textarea>
            <div class="composer-actions">
              <button type="button" data-route="api">${icon("api")}接口说明</button>
              <button type="submit" class="send-button">${icon("send")}发送</button>
            </div>
          </form>
        </section>
      </div>

      ${
        hasResults && resultsOpen
          ? `<aside class="result-rail" aria-label="对话推荐结果">
              <div class="result-head">
                <h2>推荐结果</h2>
                <button data-toggle-results aria-label="关闭推荐结果">×</button>
              </div>
              ${chatResults.map(renderOpportunityCard).join("")}
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

function renderMessage(message) {
  return `
    <article class="message ${message.role}">
      <strong>${message.role === "user" ? "你" : "DataLighthouse"}</strong>
      <p>${message.content}</p>
      ${
        message.resultLink
          ? `<button class="message-result-link" type="button" data-toggle-results>${message.resultLabel || "查看推荐结果"}</button>`
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

function renderWatchPage(list) {
  const filters = getWatchFilterItems(list);
  const filtered = filterWatchList(list);
  return `
    <section class="content-panel watch-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">AI watch</p>
          <h1>AI盯标</h1>
          <p>持续监控报名、澄清、开标与合同到期信号，优先提示需要动作的项目。</p>
        </div>
      </div>
      <div class="watch-summary">
        ${filters.map(renderWatchFilterCard).join("")}
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
    ["updated", "有更新"],
    ["signup", "即将截止报名（3天内）"],
    ["deposit", "即将截止保证金（3天内）"],
    ["bid", "即将截标（3天内）"],
    ["result", "已出结果"]
  ];

  return baseFilters.map(([key, label]) => {
    const count = filterWatchListByKey(list, key).length;
    return {
      key,
      label,
      count: `${count}个`,
      note: key === "result" && count ? `我司中标${Math.min(count, 5)}个` : ""
    };
  });
}

function renderWatchFilterCard(item) {
  return `
    <button class="watch-filter-card ${watchFilter === item.key ? "active" : ""}" data-watch-filter="${item.key}">
      <span>${item.label}</span>
      <strong>${item.count}</strong>
      ${item.note ? `<em>${item.note}</em>` : ""}
    </button>
  `;
}

function filterWatchList(list) {
  return filterWatchListByKey(list, watchFilter);
}

function filterWatchListByKey(list, key) {
  if (key === "all") return list;
  return list.filter((item, index) => {
    if (key === "updated") return index === 0;
    if (key === "signup") return index % 2 === 0;
    if (key === "deposit") return index % 2 === 1;
    if (key === "bid") return true;
    if (key === "result") return index === 0;
    return true;
  });
}

function renderWatchTenderItem(item, index) {
  return `
    <article class="watch-tender-item" data-open-opportunity="${item.id}" tabindex="0" role="button" aria-label="查看${item.title}详情">
      <div class="watch-tender-main">
        <div class="watch-tender-title">
          <strong>${item.title}</strong>
          <span>报名费：200元</span>
          <span>投标保证金：5万元</span>
        </div>
        <div class="watch-tags">
          <em>7天后获取标书截止</em>
          <em>10天后保证金支付截止</em>
          <em>24天后投标截止</em>
          ${index === 0 ? `<em>中小微企业扶植政策</em><em>有领导更换</em>` : ""}
        </div>
        <div class="watch-tender-meta">
          <span><b>业主单位：</b>${item.buyer}</span>
          <span><b>在管单位：</b>新大正物业集团股份有限公司</span>
          <span><b>合同额：</b>${item.budget}</span>
        </div>
      </div>
      <div class="watch-tender-side">
        <strong>盯标状态：<span>已报名</span></strong>
        <button data-watch="${item.id}">取消盯标</button>
      </div>
    </article>
  `;
}

function renderMyProjectsPage(list) {
  return `
    <section class="content-panel my-projects-page">
      <div class="project-create-entry">
        <div>
          <p class="eyebrow">My projects</p>
          <h1>我的项目</h1>
          <p>集中管理正在推进的商机、AI盯标项目和投标准备事项。</p>
        </div>
        <button data-new-project>新建项目</button>
      </div>
      <div class="my-project-grid">
        ${list.length ? list.map(renderMyProjectCard).join("") : `<div class="empty-note">暂无我的项目。可以点击上方新建项目开始。</div>`}
      </div>
    </section>
  `;
}

function renderMyProjectCard(item) {
  return `
    <article class="my-project-card" data-open-project-workspace="${item.id}" tabindex="0" role="button" aria-label="进入${item.title}商机详情">
      <div class="my-project-card-head">
        <strong>${item.title}</strong>
        <span>${item.stage}</span>
      </div>
      <div class="my-project-meta">
        <span><b>业主单位</b>${item.buyer}</span>
        <span><b>在管单位</b>新大正物业集团股份有限公司</span>
        <span><b>合同额</b>${item.budget}</span>
      </div>
      <div class="watch-tags project-tags">
        <em>电子标</em>
        <em>中小微企业扶植政策</em>
        <em>${item.city}</em>
      </div>
      <p>${item.nextAction}</p>
    </article>
  `;
}

function getProjectTabs() {
  return [
    ["overview", "商机详情"],
    ["history", "历史对话"],
    ["parse", "招标文件解析"],
    ["qualification", "应标资格评估"],
    ["competitor", "竞争对手分析"],
    ["cost", "项目成本测算"],
    ["price", "报价策略建议"],
    ["proposal", "投标文件生成"],
    ["check", "标书输出智检"],
    ["challenge", "质疑函生成"]
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
      <div class="project-workspace-layout">
        <main class="project-workspace-main">
          <button class="text-button" data-return-from-detail>返回</button>
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
            <span>中小微企业扶植政策</span>
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
      </div>
    </section>
  `;
}

function renderOpportunityList(title, list, subtitle) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Opportunity</p>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
        <button class="text-button" data-route="chat">发起新对话</button>
      </div>
      <div class="cards-grid">
        ${list.length ? list.map(renderOpportunityCard).join("") : `<div class="empty-note">暂无数据。可以在商机卡片中加入我的项目或AI盯标。</div>`}
      </div>
    </section>
  `;
}

function renderOpportunityCard(item) {
  return `
    <article class="opportunity-card" data-open-opportunity="${item.id}" tabindex="0" role="button" aria-label="查看${item.title}详情">
      <div class="card-top">
        <span>${item.type}</span>
        <strong>${item.match}%</strong>
      </div>
      <h3>${item.title}</h3>
      <p>${item.summary}</p>
      <div class="meta-line">
        <span>${item.city}</span>
        <span>${item.industry}</span>
        <span>${item.budget}</span>
      </div>
      <div class="reason-row">
        ${item.reasons.map((reason) => `<em>${reason}</em>`).join("")}
      </div>
      <div class="card-actions">
        <button data-open-opportunity="${item.id}">查看详情</button>
        <button data-favorite="${item.id}">${item.favorite ? "已加入项目" : "加入我的项目"}</button>
        <button data-watch="${item.id}">${item.watching ? "已AI盯标" : "加入AI盯标"}</button>
      </div>
    </article>
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

  return `
    <section class="detail-page">
      <div class="detail-toolbar">
        <button class="text-button" data-return-from-detail>返回</button>
      </div>
      <article class="detail-hero">
        <div>
          <p class="eyebrow">${item.type} · ${item.stage}</p>
          <h1>${item.title}</h1>
          <p>${item.summary}</p>
        </div>
        <div class="detail-match">
          <strong>${item.match}%</strong>
          <span>综合匹配度</span>
        </div>
      </article>
      <div class="detail-grid">
        <section class="detail-card">
          <h2>核心信息</h2>
          <dl class="detail-list">
            <dt>城市</dt><dd>${item.city}</dd>
            <dt>业态</dt><dd>${item.industry}</dd>
            <dt>预算</dt><dd>${item.budget}</dd>
            <dt>采购方</dt><dd>${item.buyer}</dd>
            <dt>截止时间</dt><dd>${item.deadline}</dd>
            <dt>下一步</dt><dd>${item.nextAction}</dd>
          </dl>
        </section>
        <section class="detail-card">
          <h2>推荐理由</h2>
          <div class="reason-row detail-reasons">
            ${item.reasons.map((reason) => `<em>${reason}</em>`).join("")}
          </div>
        </section>
      </div>
    </section>
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
      <main class="project-blank-main" aria-label="${item.title}商机详情">
        <button class="text-button" data-return-from-detail>返回</button>
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
        <span>中小微企业扶植政策</span>
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

function renderLibrary(items) {
  return `
    <section class="content-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Library</p>
          <h1>知识库</h1>
          <p>后续可接 PostgreSQL 文件索引、向量检索和项目知识库。</p>
        </div>
      </div>
      <div class="library-list">
        ${items
          .map(
            (item) => `
              <article>
                ${icon("book")}
                <div>
                  <strong>${item.name}</strong>
                  <span>${item.type} · 更新于 ${item.updatedAt}</span>
                </div>
              </article>
            `
          )
          .join("")}
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

function bindEvents() {
  document.querySelectorAll("[data-new-chat]").forEach((button) => {
    button.addEventListener("click", () => startNewChat());
  });

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => setRoute(button.dataset.route));
  });

  document.querySelectorAll("[data-return-from-detail]").forEach((button) => {
    button.addEventListener("click", () => returnFromDetail());
  });

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

  document.querySelectorAll("[data-toggle-detail-hint]").forEach((button) => {
    button.addEventListener("click", () => {
      detailHintOpen = !detailHintOpen;
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

  document.querySelectorAll("[data-suggestion-prompt]").forEach((button) => {
    button.addEventListener("click", () => fillComposer(button.dataset.suggestionPrompt));
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

  document.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await toggleFavorite(button.dataset.favorite);
      render();
    });
  });

  document.querySelectorAll("[data-watch]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await toggleWatching(button.dataset.watch);
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
  chatResults = [];
  resultsOpen = false;
  route = "chat";
  saveCurrentThread();
  render();

  const result = await sendChatMessage(content);
  chatResults = result.opportunities;
  messages = [
    ...messages,
    {
      role: "assistant",
      content: result.reply,
      resultLink: result.opportunities.length > 0,
      resultLabel: `查看推荐结果（${result.opportunities.length}）`,
      suggestions: buildSuggestedQuestions(content, result.opportunities)
    }
  ];
  resultsOpen = false;
  saveCurrentThread();
  render();
}

async function runSkill(label, prompt) {
  fillComposer(`调用「${label}」：${prompt}`);
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
