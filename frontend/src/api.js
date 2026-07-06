import {
  conversations,
  knowledgeCategories,
  knowledgeDocuments,
  libraryItems,
  opportunities,
  radarSummary
} from "./data.js";

const API_BASE_URL = window.__API_BASE_URL__ || localStorage.getItem("API_BASE_URL") || "";

const ENDPOINTS = {
  radar: "/api/radar/summary",
  opportunities: "/api/opportunities",
  watchTargets: "/api/watch-targets",
  favorites: "/api/favorites",
  library: "/api/library",
  knowledgeCategories: "/api/knowledge/categories",
  knowledgeDocuments: "/api/knowledge/documents",
  knowledgeUpload: "/api/knowledge/documents/upload",
  conversations: "/api/conversations",
  chat: "/api/chat/messages"
};

async function request(path, options = {}, fallback) {
  if (!API_BASE_URL) {
    return clone(fallback);
  }

  try {
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    };
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.status === 204 ? null : response.json();
  } catch (error) {
    console.warn(`API fallback for ${path}:`, error);
    return clone(fallback);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentOpportunities() {
  const state = JSON.parse(localStorage.getItem("DL_OPPORTUNITY_STATE") || "{}");
  return opportunities.map((item) => ({ ...item, ...state[item.id] }));
}

function saveOpportunityState(id, patch) {
  const state = JSON.parse(localStorage.getItem("DL_OPPORTUNITY_STATE") || "{}");
  state[id] = { ...(state[id] || {}), ...patch };
  localStorage.setItem("DL_OPPORTUNITY_STATE", JSON.stringify(state));
}

function getKnowledgeState() {
  return JSON.parse(localStorage.getItem("DL_KNOWLEDGE_STATE") || "{\"documents\":[],\"deletedIds\":[]}");
}

function saveKnowledgeState(state) {
  localStorage.setItem("DL_KNOWLEDGE_STATE", JSON.stringify(state));
}

function currentKnowledgeDocuments() {
  const state = getKnowledgeState();
  const deleted = new Set(state.deletedIds || []);
  return [...knowledgeDocuments, ...(state.documents || [])].filter((item) => !deleted.has(item.id));
}

function withCategoryCounts(categories, documents) {
  return categories.map((category) => ({
    ...category,
    document_count: documents.filter((item) => item.category_key === category.key).length
  }));
}

function filterKnowledgeDocuments(filters = {}) {
  const q = String(filters.q || "").trim().toLowerCase();
  return currentKnowledgeDocuments()
    .filter((item) => !filters.category || item.category_key === filters.category)
    .filter((item) => !filters.type || filters.type === "all" || item.type === filters.type)
    .filter((item) => !filters.status || filters.status === "all" || item.status === filters.status)
    .filter((item) => {
      if (!q) return true;
      return [item.title, item.summary, item.source_filename, item.type, ...(item.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
}

function buildLocalKnowledgeDocument(payload) {
  const now = new Date().toISOString();
  return {
    id: `local-${Date.now()}`,
    category_key: payload.category_key,
    title: payload.title,
    type: payload.type || "资料",
    tags: Array.isArray(payload.tags)
      ? payload.tags
      : String(payload.tags || "")
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter(Boolean),
    summary: payload.summary || "",
    source_filename: payload.source_filename || null,
    stored_path: null,
    file_size: payload.file_size || 0,
    status: payload.status || "ready",
    created_at: now,
    updated_at: now,
    download_url: null
  };
}

function addLocalKnowledgeDocument(payload) {
  const document = buildLocalKnowledgeDocument(payload);
  const state = getKnowledgeState();
  state.documents = [...(state.documents || []), document];
  saveKnowledgeState(state);
  return document;
}

export async function getRadarSummary() {
  const list = currentOpportunities();
  const fallback = {
    ...radarSummary,
    recommendedCount: Math.min(list.length, 4),
    watchingCount: list.filter((item) => item.watching).length,
    highestMatch: Math.max(...list.map((item) => item.match))
  };
  return request(ENDPOINTS.radar, {}, fallback);
}

export async function getOpportunities() {
  return request(ENDPOINTS.opportunities, {}, currentOpportunities());
}

export async function getOpportunityDetail(id) {
  const fallback = currentOpportunities().find((item) => item.id === id) || null;
  return request(`${ENDPOINTS.opportunities}/${id}`, {}, fallback);
}

export async function getWatchTargets() {
  const fallback = currentOpportunities().filter((item) => item.watching);
  return request(ENDPOINTS.watchTargets, {}, fallback);
}

export async function getFavorites() {
  const fallback = currentOpportunities().filter((item) => item.favorite);
  return request(ENDPOINTS.favorites, {}, fallback);
}

export async function getLibraryItems() {
  return request(ENDPOINTS.library, {}, libraryItems);
}

export async function getKnowledgeCategories() {
  const fallback = withCategoryCounts(knowledgeCategories, currentKnowledgeDocuments());
  return request(ENDPOINTS.knowledgeCategories, {}, fallback);
}

export async function getKnowledgeDocuments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.category) params.set("category", filters.category);
  if (filters.q) params.set("q", filters.q);
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  const path = `${ENDPOINTS.knowledgeDocuments}${params.toString() ? `?${params}` : ""}`;
  return request(path, {}, filterKnowledgeDocuments(filters));
}

export async function getKnowledgeDocument(id) {
  const fallback = currentKnowledgeDocuments().find((item) => item.id === id) || null;
  return request(`${ENDPOINTS.knowledgeDocuments}/${id}`, {}, fallback);
}

export async function createKnowledgeDocument(payload) {
  if (!API_BASE_URL) return clone(addLocalKnowledgeDocument(payload));
  return request(
    ENDPOINTS.knowledgeDocuments,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    buildLocalKnowledgeDocument(payload)
  );
}

export async function uploadKnowledgeDocument(formData) {
  const file = formData.get("file");
  const payload = {
    category_key: formData.get("category_key"),
    title: formData.get("title") || file?.name || "未命名资料",
    type: formData.get("type") || "上传文件",
    tags: formData.get("tags") || "",
    summary: formData.get("summary") || "",
    source_filename: file?.name || null,
    file_size: file?.size || 0,
    status: formData.get("status") || "ready"
  };
  if (!API_BASE_URL) return clone(addLocalKnowledgeDocument(payload));
  return request(
    ENDPOINTS.knowledgeUpload,
    {
      method: "POST",
      body: formData
    },
    buildLocalKnowledgeDocument(payload)
  );
}

export async function deleteKnowledgeDocument(id) {
  if (!API_BASE_URL) {
    const state = getKnowledgeState();
    state.deletedIds = [...new Set([...(state.deletedIds || []), id])];
    state.documents = (state.documents || []).filter((item) => item.id !== id);
    saveKnowledgeState(state);
    return { ok: true };
  }
  return request(`${ENDPOINTS.knowledgeDocuments}/${id}`, { method: "DELETE" }, { ok: true });
}

export async function getConversations() {
  return request(ENDPOINTS.conversations, {}, conversations);
}

export async function sendChatMessage(content) {
  const normalized = content.replace(/\s/g, "");
  let matches = currentOpportunities();

  if (normalized.includes("重庆")) matches = matches.filter((item) => item.city === "重庆");
  if (normalized.includes("成都")) matches = matches.filter((item) => item.city === "成都");
  if (normalized.includes("学校")) matches = matches.filter((item) => item.industry === "学校");
  if (normalized.includes("医院")) matches = matches.filter((item) => item.industry === "医院");
  if (normalized.includes("到期")) matches = matches.filter((item) => item.type === "即将到期");
  if (normalized.includes("挂网") || normalized.includes("招标")) matches = matches.filter((item) => item.type === "实时招标");

  matches = matches.sort((a, b) => b.match - a.match).slice(0, 3);
  const fallback = {
    reply: matches.length
      ? `已筛出 ${matches.length} 条相关商机，并按匹配度排序。建议先处理靠前项目的报名材料与关键联系人路径。`
      : "暂未找到完全匹配的商机。可以放宽城市、业态或时间条件继续筛选。",
    opportunities: matches
  };

  return request(
    ENDPOINTS.chat,
    {
      method: "POST",
      body: JSON.stringify({ content })
    },
    fallback
  );
}

export async function toggleFavorite(id) {
  const item = currentOpportunities().find((entry) => entry.id === id);
  const next = !item?.favorite;
  saveOpportunityState(id, { favorite: next });
  await request(`${ENDPOINTS.favorites}/${id}`, { method: next ? "POST" : "DELETE" }, { ok: true });
  return next;
}

export async function updateOpportunityState(id, patch) {
  saveOpportunityState(id, patch);
  return request(`${ENDPOINTS.opportunities}/${id}`, { method: "PATCH", body: JSON.stringify(patch) }, { ok: true });
}

export async function toggleWatching(id) {
  const item = currentOpportunities().find((entry) => entry.id === id);
  const next = !item?.watching;
  saveOpportunityState(id, { watching: next });
  await request(`${ENDPOINTS.watchTargets}/${id}`, { method: next ? "POST" : "DELETE" }, { ok: true });
  return next;
}

export const backendContract = {
  API_BASE_URL,
  endpoints: ENDPOINTS,
  note: "FastAPI 可按这些路径返回 JSON；前端会在 window.__API_BASE_URL__ 或 localStorage.API_BASE_URL 存在时调用真实接口。"
};
