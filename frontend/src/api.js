import { conversations, libraryItems, opportunities, radarSummary } from "./data.js";

const API_BASE_URL = window.__API_BASE_URL__ || localStorage.getItem("API_BASE_URL") || "";

const ENDPOINTS = {
  radar: "/api/radar/summary",
  opportunities: "/api/opportunities",
  watchTargets: "/api/watch-targets",
  favorites: "/api/favorites",
  library: "/api/library",
  conversations: "/api/conversations",
  chat: "/api/chat/messages"
};

async function request(path, options = {}, fallback) {
  if (!API_BASE_URL) {
    return clone(fallback);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      ...options
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

export async function getRadarSummary() {
  const list = currentOpportunities();
  const fallback = {
    ...radarSummary,
    recommendedCount: list.length,
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
