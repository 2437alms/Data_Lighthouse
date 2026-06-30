export const radarSummary = {
  recommendedCount: 36,
  watchingCount: 12,
  wonCount: 3,
  highestMatch: 96
};

export const opportunities = [
  {
    id: "cq-school-001",
    title: "重庆南岸区云湾实验学校物业服务项目",
    type: "实时招标",
    stage: "报名中",
    city: "重庆",
    industry: "学校",
    budget: "386 万元/年",
    buyer: "重庆南岸区云湾实验学校",
    deadline: "2026-07-03 17:00",
    match: 96,
    summary: "校园综合物业服务，覆盖保洁、秩序、绿化与设备巡检，和当前学校业态经验高度匹配。",
    reasons: ["学校业态强匹配", "服务半径 2.4 公里", "历史报价区间接近", "存在二度人脉路径"],
    nextAction: "今天完成 CA 与供应商入库核验",
    favorite: true,
    watching: true
  },
  {
    id: "cq-hospital-002",
    title: "重庆两江新区康宁医院后勤物业服务项目",
    type: "实时招标",
    stage: "文件澄清",
    city: "重庆",
    industry: "医院",
    budget: "512 万元/年",
    buyer: "重庆两江新区康宁医院",
    deadline: "2026-07-08 18:00",
    match: 88,
    summary: "医院后勤服务范围完整，预算高于区域同类均值，需补齐院感服务方案与医疗场景案例。",
    reasons: ["预算规模高", "资质满足核心要求", "医院场景可突破"],
    nextAction: "补充医院后勤和院感培训材料",
    favorite: false,
    watching: false
  },
  {
    id: "cq-school-003",
    title: "重庆渝北区松林小学合同到期预测项目",
    type: "即将到期",
    stage: "提前建联",
    city: "重庆",
    industry: "学校",
    budget: "218 万元/年",
    buyer: "重庆渝北区松林小学",
    deadline: "预计 2026-09",
    match: 84,
    summary: "现服务合同将在四个月内到期，近两轮均由同一供应商承接，存在换手机会但需提前铺垫关系。",
    reasons: ["六个月内到期", "本地学校案例匹配", "可纳入AI盯标"],
    nextAction: "生成拜访计划并持续监测挂网公告",
    favorite: true,
    watching: true
  },
  {
    id: "cd-office-004",
    title: "成都高新区科创中心写字楼物业服务项目",
    type: "实时招标",
    stage: "评估中",
    city: "成都",
    industry: "写字楼",
    budget: "690 万元/年",
    buyer: "成都高新区科创中心",
    deadline: "2026-07-12 17:30",
    match: 79,
    summary: "预算规模较大，和综合设施管理能力相关，可作为跨城拓展储备机会。",
    reasons: ["预算规模高", "设施管理能力匹配", "跨城拓展储备"],
    nextAction: "确认成都本地履约资源",
    favorite: false,
    watching: false
  }
];

export const libraryItems = [
  { id: "doc-1", name: "学校物业服务评分办法模板", type: "标书资料", updatedAt: "2026-06-24" },
  { id: "doc-2", name: "重庆教育系统历史中标记录", type: "数据表", updatedAt: "2026-06-22" },
  { id: "doc-3", name: "医院后勤院感服务方案素材", type: "案例库", updatedAt: "2026-06-20" }
];

export const conversations = [
  {
    id: "conv-1",
    title: "重庆学校物业商机",
    time: "今天 09:42",
    prompt: "帮我找重庆已挂网的学校物业项目"
  },
  {
    id: "conv-2",
    title: "未来六个月到期项目",
    time: "昨天 16:18",
    prompt: "查找重庆未来六个月到期的学校物业合同"
  },
  {
    id: "conv-3",
    title: "云湾实验学校人脉",
    time: "6月26日",
    prompt: "如何和云湾实验学校项目建立联系"
  }
];

export const starterPrompts = [
  "帮我找重庆已挂网的学校物业项目",
  "查找未来六个月到期的学校合同",
  "分析云湾实验学校项目的人脉路径",
  "把高匹配商机加入AI盯标"
];
