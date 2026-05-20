"use client";

import { useEffect, useState, useCallback } from "react";

import { ThemeToggle } from "../components/ThemeToggle";

interface L0Record {
  record_id: string;
  session_key: string;
  role: string;
  message_text: string;
  recorded_at: string;
}

interface L1Record {
  record_id: string;
  content: string;
  type: string;
  priority: number;
  scene_name: string;
  session_key: string;
  timestamp_str: string;
}

interface SceneEntry {
  filename: string;
  summary: string;
  heat: number;
  created: string;
  updated: string;
}

interface MemoryData {
  health: { status: string; uptime: number; stores: { vectorStore: boolean; embeddingService: boolean } };
  l0Count: number;
  l0Records: L0Record[];
  l1: { total: number; records: L1Record[] };
  l2: { scenes: SceneEntry[] };
  l3: { persona: string; lastUpdated: string | null };
}

type Tab = "l0" | "l1" | "l2" | "l3" | "status";
type TimeRange = "7d" | "30d" | "90d" | "all";

// ─── Type label mapping ─────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  persona: "偏好",
  episodic: "事件",
  instruction: "指令",
};
const TYPE_COLORS: Record<string, string> = {
  persona: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  episodic: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  instruction: "bg-amber-500/15 text-amber-300 border-amber-500/20",
};
function getTypeLabel(type: string) { return TYPE_LABELS[type] ?? type; }
function getTypeColor(type: string) { return TYPE_COLORS[type] ?? "bg-gray-500/15 text-gray-300 border-gray-500/20"; }

// ─── Actions helper ──────────────────────────────────────
async function doAction(action: string, params: Record<string, unknown> = {}) {
  const r = await fetch("/api/memory/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  });
  return r.json();
}

// ─── Constants ───────────────────────────────────────────
const PAGE_SIZE = 10;

// ─── Main ────────────────────────────────────────────────
export default function MemoryPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("status");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [sceneContent, setSceneContent] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const reload = useCallback(() => {
    fetch("/api/memory").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [menuOpen]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const r = await fetch("http://localhost:8420/search/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });
      const d = await r.json();
      setSearchResults(d.results ?? "(无结果)");
    } catch (e) {
      setSearchResults(`搜索失败: ${e}`);
    } finally {
      setSearching(false);
    }
  }

  async function handleBoost(record_id: string) {
    setMenuOpen(null);
    await doAction("boost", { record_id });
    reload();
  }
  async function handleDemote(record_id: string) {
    setMenuOpen(null);
    await doAction("demote", { record_id });
    reload();
  }
  async function handleDelete(record_id: string) {
    setMenuOpen(null);
    if (!confirm("确定删除这条记忆？")) return;
    await doAction("delete", { record_id });
    reload();
  }
  function handleStartEdit(r: L1Record) {
    setMenuOpen(null);
    setEditingId(r.record_id);
    setEditContent(r.content);
  }
  async function handleSaveEdit(record_id: string) {
    if (!editContent.trim()) return;
    await doAction("edit", { record_id, content: editContent.trim() });
    setEditingId(null);
    setEditContent("");
    reload();
  }
  function handleCancelEdit() {
    setEditingId(null);
    setEditContent("");
  }
  async function handleExpandScene(filename: string) {
    if (expandedScene === filename) { setExpandedScene(null); return; }
    if (!sceneContent[filename]) {
      const r = await doAction("get_scene_content", { filename });
      if (r.content) setSceneContent((prev) => ({ ...prev, [filename]: r.content }));
    }
    setExpandedScene(filename);
  }
  async function handleRegeneratePersona() {
    setRegenerating(true);
    await doAction("regenerate_persona");
    setTimeout(() => { reload(); setRegenerating(false); }, 3000);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-pulse text-[--text-muted]">加载记忆系统...</div>
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="card-glow rounded-xl p-6 text-center">
        <p className="text-red-400 mb-2">连接失败</p>
        <p className="text-sm text-[--text-muted]">{error}</p>
      </div>
    </div>
  );
  if (!data) return null;

  // 时间范围过滤
  const timeFilteredL1 = (() => {
    if (timeRange === "all") return data.l1.records;
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return data.l1.records.filter((r) => new Date(r.timestamp_str).getTime() >= cutoff);
  })();

  // 类型过滤
  const filteredL1 = timeFilteredL1.filter((r) => typeFilter === "all" ? true : r.type === typeFilter);

  // 动态类型列表
  const dynamicTypes = Array.from(new Set(timeFilteredL1.map((r) => r.type))).sort();

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredL1.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedL1 = filteredL1.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // 待审核 = session_key 以 suggest- 开头的
  const pendingMemories = data.l1.records.filter((r) => r.session_key?.startsWith("suggest-"));

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "status", label: "记忆概览" },
    { key: "l0", label: "L0 原子对话", count: data.l0Count },
    { key: "l1", label: "L1 原子记忆", count: data.l1.total },
    { key: "l2", label: "L2 记忆场景", count: data.l2.scenes.length },
    { key: "l3", label: "L3 记忆画像" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Page Header（对齐 dream/brain 页面风格） ─── */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-[--border-color] bg-[--bg-secondary]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <span className="text-lg">🧠</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[--text-primary]">记忆系统</h2>
            <p className="text-[11px] text-[--text-muted]">Memory System — 跨 AI 工具共享记忆</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pendingMemories.length > 0 && (
            <span className="relative px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 font-medium">
              {pendingMemories.length} 条待审核
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            </span>
          )}
          <ThemeToggle />
          <div className="flex items-center gap-2 text-xs text-[--text-muted]">
            <span className={`w-2 h-2 rounded-full ${data.health.status === "ok" ? "bg-green-500" : "bg-red-500"}`} />
            {data.health.status === "ok" ? "在线" : "离线"}
          </div>
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="flex-1 p-6 w-full space-y-5">

      {/* ─── Tabs ─── */}
      <div className="flex gap-1 p-1 rounded-lg bg-[--bg-secondary]/50 w-fit">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-[--bg-primary] text-[--text-primary] shadow-sm"
                : "text-[--text-muted] hover:text-[--text-primary]"
            }`}
          >
            {label}
            {count !== undefined && (
              <span className={`ml-1.5 text-xs ${activeTab === key ? "text-cyan-400" : "opacity-60"}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════ Tab: L0 原始对话 ═══════════ */}
      {activeTab === "l0" && (
        <div className="space-y-3">
          {data.l0Records.length === 0 ? (
            <div className="card-glow rounded-xl p-12 text-center">
              <div className="text-4xl mb-3 opacity-30">💬</div>
              <p className="text-[--text-muted] text-sm">暂无对话记录</p>
              <p className="text-[--text-muted] text-xs mt-1">与 AI 对话后会自动记录</p>
            </div>
          ) : (
            (() => {
              // 按 session_key 分组
              const grouped: Record<string, L0Record[]> = {};
              for (const r of data.l0Records) {
                const key = r.session_key || "unknown";
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(r);
              }
              return Object.entries(grouped).map(([sessionKey, records]) => {
                // 解析 suggest 内容
                const isSuggest = sessionKey.startsWith("suggest-");
                let suggestContent = "";
                let suggestType = "episodic";
                if (isSuggest) {
                  const userMsg = records.find((r) => r.role === "user");
                  const assistantMsg = records.find((r) => r.role === "assistant");
                  if (userMsg) {
                    const match = userMsg.message_text.match(/\[MEMORY_SUGGEST type=(\w+)\]\s*(.*)/);
                    if (match) { suggestType = match[1]; suggestContent = match[2]; }
                    else { suggestContent = userMsg.message_text; }
                  } else if (assistantMsg) {
                    suggestContent = assistantMsg.message_text;
                  }
                }

                return (
                <div key={sessionKey} className={`card-glow rounded-xl p-4 ${isSuggest ? "border-l-4 border-l-amber-500/50" : ""}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      isSuggest ? "bg-amber-500/10 text-amber-300 border-amber-500/20" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    }`}>
                      {isSuggest ? "💡 待审核" : "💬 对话"}
                    </span>
                    <span className="text-[11px] text-[--text-muted] font-mono">{sessionKey}</span>
                    <span className="text-[10px] text-[--text-muted] ml-auto">
                      {records[0]?.recorded_at ? new Date(records[0].recorded_at).toLocaleString("zh-CN") : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {records.map((r) => (
                      <div key={r.record_id} className="flex gap-2">
                        <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded shrink-0 ${
                          r.role === "user" ? "bg-blue-500/15 text-blue-300" : "bg-green-500/15 text-green-300"
                        }`}>
                          {r.role === "user" ? "用户" : "AI"}
                        </span>
                        <span className="text-sm text-[--text-primary] leading-snug">{r.message_text}</span>
                      </div>
                    ))}
                  </div>
                  {isSuggest && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-[--border-color]">
                      <button
                        onClick={async () => {
                          await doAction("approve_suggest", { record_id: records[0].record_id, content: suggestContent, type: suggestType });
                          reload();
                        }}
                        className="text-[11px] px-3 py-1.5 rounded bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20 transition-colors"
                      >✓ 确认记忆</button>
                      <button
                        onClick={async () => {
                          await doAction("reject_suggest", { session_key: sessionKey });
                          reload();
                        }}
                        className="text-[11px] px-3 py-1.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-colors"
                      >✕ 拒绝</button>
                      <span className="text-[10px] text-[--text-muted] ml-auto self-center">不操作则 23:00 自动通过</span>
                    </div>
                  )}
                </div>
              );});
            })()
          )}
        </div>
      )}

      {/* ═══════════ Tab: L1 原子记忆 ═══════════ */}
      {activeTab === "l1" && (
        <div className="space-y-4">
          {/* Search + Time Range */}
          <div className="card-glow rounded-xl p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="搜索记忆内容..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[--bg-primary] border border-[--border-primary] text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-cyan-500/50 focus:outline-none transition-colors"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-muted]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {/* Time Range Selector */}
              <select
                value={timeRange}
                onChange={(e) => { setTimeRange(e.target.value as TimeRange); setCurrentPage(1); }}
                className="px-3 py-2.5 rounded-lg bg-[--bg-primary] border border-[--border-primary] text-sm text-[--text-primary] focus:border-cyan-500/50 focus:outline-none transition-colors appearance-none cursor-pointer"
              >
                <option value="all">全部时间</option>
                <option value="7d">近 7 天</option>
                <option value="30d">近 30 天</option>
                <option value="90d">近 90 天</option>
              </select>
              <button onClick={handleSearch} disabled={searching} className="px-5 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 disabled:opacity-50 transition-colors">
                {searching ? "..." : "搜索"}
              </button>
            </div>
            {searchResults && (
              <div className="mt-3 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-medium text-cyan-400">搜索结果</span>
                  <button onClick={() => setSearchResults(null)} className="text-xs text-[--text-muted] hover:text-[--text-primary]">✕</button>
                </div>
                <pre className="text-sm text-[--text-primary] whitespace-pre-wrap leading-relaxed">{searchResults}</pre>
              </div>
            )}
          </div>

          {/* Dynamic Type Filter */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setTypeFilter("all"); setCurrentPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                typeFilter === "all"
                  ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                  : "text-[--text-muted] border-transparent hover:text-[--text-primary]"
              }`}
            >
              全部 <span className="opacity-70 ml-0.5">{timeFilteredL1.length}</span>
            </button>
            {dynamicTypes.map((type) => {
              const count = timeFilteredL1.filter((r) => r.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => { setTypeFilter(type); setCurrentPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    typeFilter === type
                      ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                      : "text-[--text-muted] border-transparent hover:text-[--text-primary]"
                  }`}
                >
                  {getTypeLabel(type)} <span className="opacity-70 ml-0.5">{count}</span>
                </button>
              );
            })}
          </div>

          {/* L1 Structured Cards */}
          <div className="space-y-3">
            {pagedL1.length === 0 ? (
              <div className="card-glow rounded-xl p-12 text-center">
                <div className="text-4xl mb-3 opacity-30">🧠</div>
                <p className="text-[--text-muted] text-sm">暂无记忆</p>
                <p className="text-[--text-muted] text-xs mt-1">与 AI 对话后会自动积累</p>
              </div>
            ) : (
              pagedL1.map((r) => (
                <div key={r.record_id} className="card-glow rounded-xl p-5 relative">
                  {/* Row 1: Type tag + Action menu */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${getTypeColor(r.type)}`}>
                      {getTypeLabel(r.type)}
                    </span>
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === r.record_id ? null : r.record_id); }}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-secondary] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {/* Dropdown menu */}
                      {menuOpen === r.record_id && (
                        <div className="absolute right-0 top-8 w-36 rounded-lg bg-[--bg-secondary] border border-[--border-primary] shadow-xl z-20 py-1 overflow-hidden">
                          <button onClick={() => handleBoost(r.record_id)} className="w-full px-3 py-2 text-left text-xs text-emerald-300 hover:bg-emerald-500/10 transition-colors">
                            👍 强化确信度
                          </button>
                          <button onClick={() => handleDemote(r.record_id)} className="w-full px-3 py-2 text-left text-xs text-orange-300 hover:bg-orange-500/10 transition-colors">
                            👎 降低确信度
                          </button>
                          <button onClick={() => handleStartEdit(r)} className="w-full px-3 py-2 text-left text-xs text-blue-300 hover:bg-blue-500/10 transition-colors">
                            ✏️ 编辑内容
                          </button>
                          <div className="border-t border-[--border-primary] my-1" />
                          <button onClick={() => handleDelete(r.record_id)} className="w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10 transition-colors">
                            🗑️ 删除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Content (or edit mode) */}
                  {editingId === r.record_id ? (
                    <div className="mb-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-3 rounded-lg bg-[--bg-primary] border border-cyan-500/30 text-sm text-[--text-primary] focus:outline-none resize-none leading-relaxed"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => handleSaveEdit(r.record_id)} className="px-3 py-1.5 rounded-md text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20">
                          保存
                        </button>
                        <button onClick={handleCancelEdit} className="px-3 py-1.5 rounded-md text-xs text-[--text-muted] border border-[--border-primary] hover:text-[--text-primary]">
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[14px] text-[--text-primary] leading-relaxed mb-3">{r.content}</p>
                  )}

                  {/* Row 3: Confidence bar */}
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex-1 h-1.5 rounded-full bg-[--bg-primary] overflow-hidden max-w-[180px]">
                      <div
                        className={`h-full rounded-full transition-all ${
                          r.priority < 40 ? "bg-orange-400" : r.priority < 70 ? "bg-blue-400" : "bg-cyan-400"
                        }`}
                        style={{ width: `${r.priority}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-[--text-muted]">{r.priority}/100</span>
                  </div>

                  {/* Row 4: Meta info */}
                  <div className="flex gap-3 text-[11px] text-[--text-muted]">
                    {r.scene_name && <span className="truncate max-w-[150px]">📍 {r.scene_name}</span>}
                    <span>{r.timestamp_str?.slice(0, 10)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination — always visible */}
          <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 rounded-md text-xs border border-[--border-primary] text-[--text-muted] hover:text-[--text-primary] disabled:opacity-30 transition-colors"
              >
                ← 上一页
              </button>
              <span className="text-xs text-[--text-muted]">第 {safePage} / {totalPages} 页</span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 rounded-md text-xs border border-[--border-primary] text-[--text-muted] hover:text-[--text-primary] disabled:opacity-30 transition-colors"
              >
                下一页 →
              </button>
            </div>
        </div>
      )}

      {/* ═══════════ Tab: L2 记忆场景 ═══════════ */}
      {activeTab === "l2" && (
        <div className="space-y-4">
          {data.l2.scenes.length === 0 ? (
            <div className="card-glow rounded-xl p-12 text-center">
              <div className="text-4xl mb-3 opacity-30">📂</div>
              <p className="text-[--text-muted] text-sm">暂无场景</p>
              <p className="text-[--text-muted] text-xs mt-1">对话积累后，系统会自动按项目/主题聚类你的记忆</p>
            </div>
          ) : (
            <>
              {/* Scene Card Grid (2 columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.l2.scenes.sort((a, b) => b.heat - a.heat).map((s) => {
                  const sceneName = s.filename.replace(/\.md$/, "");
                  const isSelected = expandedScene === s.filename;
                  // Count related L1 memories by scene_name
                  const relatedCount = data.l1.records.filter((r) => r.scene_name === sceneName || r.scene_name === s.filename).length;
                  return (
                    <button
                      key={s.filename}
                      onClick={() => handleExpandScene(s.filename)}
                      className={`card-glow rounded-xl p-4 text-left transition-all ${
                        isSelected ? "ring-1 ring-cyan-500/40 bg-cyan-500/5" : "hover:bg-[--bg-secondary]/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-blue-400">📂</span>
                        <h3 className="font-medium text-[--text-primary] text-sm truncate">{sceneName}</h3>
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-[--text-muted]">
                        <span>关联 {relatedCount} 条记忆</span>
                        <span className="flex items-center gap-1.5">
                          热度
                          <span className="inline-flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span key={i} className={`w-2 h-2 rounded-sm ${i <= Math.min(Math.round(s.heat / 2), 5) ? "bg-blue-400" : "bg-[--bg-secondary]"}`} />
                            ))}
                          </span>
                          {s.heat}
                        </span>
                      </div>
                      <div className="text-[10px] text-[--text-muted] mt-1.5">
                        更新 {s.updated?.slice(0, 10)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Scene Detail */}
              {expandedScene && (() => {
                const scene = data.l2.scenes.find((s) => s.filename === expandedScene);
                if (!scene) return null;
                const sceneName = scene.filename.replace(/\.md$/, "");
                const relatedMemories = data.l1.records.filter((r) => r.scene_name === sceneName || r.scene_name === scene.filename);
                return (
                  <div className="card-glow rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-[--text-primary] flex items-center gap-2">
                        <span className="text-blue-400">📂</span>
                        {sceneName}
                      </h3>
                      <button
                        onClick={() => setExpandedScene(null)}
                        className="text-xs text-[--text-muted] hover:text-[--text-primary]"
                      >✕ 关闭</button>
                    </div>

                    {/* Scene summary */}
                    <p className="text-sm text-[--text-muted] leading-relaxed mb-4">{scene.summary}</p>

                    {/* Related L1 Memories */}
                    <div className="border-t border-[--border-primary] pt-3">
                      <p className="text-xs text-[--text-muted] mb-3 font-medium">—— 关联的 L1 记忆 ——</p>
                      {relatedMemories.length === 0 ? (
                        <p className="text-xs text-[--text-muted]">暂无关联记忆</p>
                      ) : (
                        <div className="space-y-2">
                          {relatedMemories.map((r) => (
                            <div key={r.record_id} className="rounded-lg bg-[--bg-primary] border border-[--border-primary] p-3">
                              <div className="flex items-start gap-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0 mt-0.5 ${getTypeColor(r.type)}`}>
                                  {getTypeLabel(r.type)}
                                </span>
                                <p className="text-sm text-[--text-primary] flex-1 leading-relaxed">{r.content}</p>
                              </div>
                              <div className="flex items-center gap-3 mt-2 ml-[52px]">
                                <div className="flex-1 h-1 rounded-full bg-[--bg-secondary] overflow-hidden max-w-[120px]">
                                  <div
                                    className={`h-full rounded-full ${
                                      r.priority < 40 ? "bg-orange-400" : r.priority < 70 ? "bg-blue-400" : "bg-cyan-400"
                                    }`}
                                    style={{ width: `${r.priority}%` }}
                                  />
                                </div>
                                <span className="text-[10px] text-[--text-muted]">{r.priority}/100</span>
                                <span className="text-[10px] text-[--text-muted]">{r.timestamp_str?.slice(0, 10)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Scene raw content toggle */}
                    {sceneContent[expandedScene] && (
                      <details className="mt-4 border-t border-[--border-primary] pt-3">
                        <summary className="text-xs text-[--text-muted] cursor-pointer hover:text-[--text-primary]">查看场景原始内容</summary>
                        <pre className="text-xs text-[--text-primary] whitespace-pre-wrap leading-relaxed font-sans mt-2 p-3 rounded-lg bg-[--bg-primary]">
                          {sceneContent[expandedScene]}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* ═══════════ Tab: L3 记忆画像 ═══════════ */}
      {activeTab === "l3" && (
        <div className="space-y-4">
          {data.l3.persona ? (() => {
            // 从所有 L1 记忆提取结构化维度
            const techPrefs: string[] = [];
            const workHabits: string[] = [];
            const beliefs: string[] = [];
            const traits: string[] = [];

            data.l1.records.forEach((r) => {
              const c = r.content;
              if (/不要|不用|避免|排除|禁止|不希望/.test(c)) beliefs.push(c);
              else if (/偏好|喜欢|喜爱|使用|选择|倾向|UI|库|框架|语言|工具/.test(c)) techPrefs.push(c);
              else if (/习惯|风格|模式|方式|流程|定时|cron|规范|strict/.test(c)) workHabits.push(c);
              else if (r.type === "episodic" || /决定|决策|选定/.test(c)) workHabits.push(c);
              else traits.push(c);
            });

            const dimensions = [
              { icon: "🎯", label: "技术偏好", items: techPrefs },
              { icon: "💡", label: "工作习惯", items: workHabits },
              { icon: "🚫", label: "信念/排除", items: beliefs },
              { icon: "🧩", label: "特质", items: traits },
            ].filter((d) => d.items.length > 0);

            const keyL1 = data.l1.records
              .filter((r) => r.type === "persona" || r.type === "instruction")
              .sort((a, b) => b.priority - a.priority)
              .slice(0, 6);

            // 标签云：从所有 L1 记忆提取高频关键词
            const stopWords = new Set(["的", "在", "中", "了", "是", "和", "用", "为", "以", "不", "与", "也", "而", "有", "从", "对", "被", "到", "等", "这", "那", "个", "我", "你", "他", "她", "它", "们", "来", "去", "做", "使用", "进行", "通过"]);
            const wordFreq: Record<string, number> = {};
            data.l1.records.forEach((r) => {
              // 中文分词（按标点/空格拆分后取2-6字片段）+ 英文单词
              const words = r.content.match(/[a-zA-Z][a-zA-Z0-9_./-]{1,20}|[\u4e00-\u9fff]{2,6}/g) ?? [];
              words.forEach((w) => {
                const lower = w.toLowerCase();
                if (!stopWords.has(lower) && lower.length >= 2) {
                  wordFreq[lower] = (wordFreq[lower] ?? 0) + 1;
                }
              });
            });
            const tagCloud = Object.entries(wordFreq)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20);
            const maxFreq = tagCloud[0]?.[1] ?? 1;

            // 画像健康度：根据记忆类型覆盖+数量评分
            const hasPersona = data.l1.records.some((r) => r.type === "persona");
            const hasEpisodic = data.l1.records.some((r) => r.type === "episodic");
            const hasInstruction = data.l1.records.some((r) => r.type === "instruction");
            const typeCoverage = [hasPersona, hasEpisodic, hasInstruction].filter(Boolean).length; // 0-3
            const quantityScore = Math.min(data.l1.total / 30, 1); // 30条满分
            const hasL3 = data.l3.persona ? 1 : 0;
            const healthPct = Math.round(((typeCoverage / 3) * 40 + quantityScore * 40 + hasL3 * 20));
            const healthLabel = healthPct < 30 ? "刚起步" : healthPct < 60 ? "成长中" : healthPct < 90 ? "较完善" : "很完善";
            const healthTips: string[] = [];
            if (!hasPersona) healthTips.push("缺少「偏好」类记忆");
            if (!hasInstruction) healthTips.push("缺少「对AI的要求」类记忆");
            if (data.l1.total < 10) healthTips.push("记忆数量较少，多与 AI 交流");
            if (!hasL3) healthTips.push("画像未生成，可手动触发");

            return (
              <>
                {/* 画像健康度 + 标签云 并排 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {/* 画像健康度 */}
                  <div className="card-glow rounded-xl p-5">
                    <h4 className="text-xs font-medium text-[--text-primary] mb-3">画像完整度</h4>
                    <div className="flex items-center gap-4">
                      {/* 环形进度 */}
                      <div className="relative w-16 h-16 shrink-0">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="var(--bg-secondary, #1e293b)"
                            strokeWidth="3"
                          />
                          <path
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke={healthPct < 30 ? "#f97316" : healthPct < 60 ? "#3b82f6" : "#06b6d4"}
                            strokeWidth="3"
                            strokeDasharray={`${healthPct}, 100`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-bold text-[--text-primary]">{healthPct}%</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[--text-primary] mb-1">{healthLabel}</p>
                        {healthTips.length > 0 ? (
                          <ul className="space-y-1">
                            {healthTips.map((tip, i) => (
                              <li key={i} className="text-[11px] text-[--text-muted] flex items-center gap-1">
                                <span className="text-amber-400">•</span> {tip}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[11px] text-[--text-muted]">记忆覆盖全面，画像质量良好</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 标签云 */}
                  <div className="card-glow rounded-xl p-5">
                    <h4 className="text-xs font-medium text-[--text-primary] mb-3">AI 最了解你的关键词</h4>
                    {tagCloud.length === 0 ? (
                      <p className="text-[11px] text-[--text-muted]">记忆较少，暂无足够关键词</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {tagCloud.map(([word, freq]) => {
                          const size = 11 + Math.round((freq / maxFreq) * 5); // 11-16px
                          const opacity = 0.5 + (freq / maxFreq) * 0.5; // 0.5-1.0
                          return (
                            <span
                              key={word}
                              className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/15"
                              style={{ fontSize: `${size}px`, opacity }}
                            >
                              {word}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 结构化摘要卡片 */}
                {dimensions.length > 0 && (
                  <div className={`grid gap-3 ${dimensions.length >= 4 ? "grid-cols-2 lg:grid-cols-4" : dimensions.length === 3 ? "grid-cols-3" : dimensions.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {dimensions.map(({ icon, label, items }) => (
                      <div key={label} className="card-glow rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span>{icon}</span>
                          <h4 className="text-xs font-medium text-[--text-primary]">{label}</h4>
                        </div>
                        <ul className="space-y-1.5">
                          {items.slice(0, 3).map((item, i) => (
                            <li key={i} className="text-[12px] text-[--text-muted] leading-snug flex items-start gap-1.5">
                              <span className="text-cyan-400/60 mt-0.5 shrink-0">•</span>
                              <span className="line-clamp-2">{item}</span>
                            </li>
                          ))}
                          {items.length > 3 && (
                            <li className="text-[11px] text-[--text-muted] opacity-60">+{items.length - 3} 更多</li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* 完整画像区（折叠） */}
                <details className="card-glow rounded-xl p-5">
                  <summary className="flex items-center justify-between cursor-pointer">
                    <h3 className="font-medium text-[--text-primary] flex items-center gap-2">
                      <span className="text-amber-400">✨</span> AI 生成的完整画像
                    </h3>
                    <button
                      onClick={(e) => { e.preventDefault(); handleRegeneratePersona(); }}
                      disabled={regenerating}
                      className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
                    >
                      {regenerating ? "生成中..." : "🔄 重新生成"}
                    </button>
                  </summary>
                  <div className="mt-4 rounded-lg bg-[--bg-primary]/50 p-4 border border-[--border-primary]">
                    <pre className="whitespace-pre-wrap text-sm text-[--text-primary] leading-relaxed font-sans">{data.l3.persona}</pre>
                  </div>
                </details>

                {/* 画像来源（折叠） */}
                {keyL1.length > 0 && (
                  <details className="card-glow rounded-xl p-5">
                    <summary className="text-sm font-medium text-[--text-primary] cursor-pointer hover:text-cyan-300 transition-colors">
                      ▶ 构成此画像的 {keyL1.length} 条关键 L1 记忆
                    </summary>
                    <div className="mt-3 space-y-2">
                      {keyL1.map((r) => (
                        <div key={r.record_id} className="rounded-lg bg-[--bg-primary] border border-[--border-primary] p-3 flex items-start gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0 mt-0.5 ${getTypeColor(r.type)}`}>
                            {getTypeLabel(r.type)}
                          </span>
                          <p className="text-sm text-[--text-primary] flex-1 leading-relaxed">{r.content}</p>
                          <span className="text-[10px] text-[--text-muted] shrink-0">{r.priority}/100</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-[--text-muted] mt-3 flex items-center gap-1">
                      <span className="text-amber-400/70">💡</span>
                      修正画像：在「L1 原子记忆」中编辑/删除相关记忆，然后点击「重新生成」。
                    </p>
                  </details>
                )}
              </>
            );
          })() : (
            <div className="card-glow rounded-xl p-12 text-center">
              <div className="text-4xl mb-3 opacity-30">✨</div>
              <p className="text-[--text-muted] text-sm">L3 画像尚未生成</p>
              <p className="text-[--text-muted] text-xs mt-1">累计足够 L1 记忆后系统会自动生成，也可手动触发</p>
              <button
                onClick={handleRegeneratePersona}
                disabled={regenerating}
                className="mt-4 text-xs px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
              >
                {regenerating ? "生成中..." : "手动生成画像"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Tab: 记忆概览 ═══════════ */}
      {activeTab === "status" && (() => {
        // 计算衍生数据
        const recentL1 = data.l1.records.slice(0, 3);
        const progressTarget = 30;
        const progressPct = Math.min(Math.round((data.l1.total / progressTarget) * 100), 100);
        const progressStage = data.l1.total < 10 ? "🌱 起步期" : data.l1.total < 30 ? "🌿 成长期" : data.l1.total < 100 ? "🌳 稳定期" : "🏔️ 成熟期";
        
        // 来源统计（按 session_key 前缀）
        const sources: Record<string, number> = {};
        data.l1.records.forEach((r) => {
          const src = r.session_key?.startsWith("suggest-") ? "AI建议"
            : r.session_key?.includes("codebuddy") ? "CodeBuddy"
            : r.session_key?.includes("claude") ? "Claude"
            : r.session_key?.includes("manual") ? "手动"
            : "CodeBuddy";
          sources[src] = (sources[src] ?? 0) + 1;
        });

        // 建议
        const suggestions: string[] = [];
        if (data.l1.total < 10) suggestions.push("记忆较少，多与 AI 聊聊你的偏好和工作习惯");
        if (!data.l1.records.some((r) => r.type === "instruction")) suggestions.push("还没有「对AI的要求」类记忆，试试说「以后别太啰嗦」");
        if (!Object.keys(sources).includes("Claude")) suggestions.push("Claude Desktop 还没接入，可配置 mcp.json 共享记忆");
        if (data.l1.total >= 10 && !data.l3.persona) suggestions.push("已有足够记忆，可手动触发升华生成 L3 画像");
        if (suggestions.length === 0) suggestions.push("飞轮运转良好，继续正常使用即可");

        return (
          <div className="space-y-4">
            {/* Row 1: KPI 4 卡（通栏） */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "L1 记忆", value: data.l1.total, color: "text-purple-400", sub: "条" },
                { label: "L2 场景", value: data.l2.scenes.length, color: "text-blue-400", sub: "个" },
                { label: "L3 画像", value: data.l3.persona ? "✓" : "—", color: "text-amber-400", sub: data.l3.persona ? "已生成" : "待生成" },
                { label: "本周新增", value: `+${data.l1.records.filter((r) => { const d = new Date(r.timestamp_str); const now = new Date(); return (now.getTime() - d.getTime()) < 7 * 86400000; }).length}`, color: "text-emerald-400", sub: "条" },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="card-glow rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-[11px] text-[--text-muted]">{label}</div>
                  <div className="text-[10px] text-[--text-muted] opacity-60">{sub}</div>
                </div>
              ))}
            </div>

            {/* Row 2: 飞轮进度（通栏） */}
            <div className="card-glow rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-[--text-primary]">{progressStage}</h3>
                <span className="text-xs text-[--text-muted]">{data.l1.total}/{progressTarget} 条基础记忆</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[--bg-primary] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="text-[11px] text-[--text-muted] mt-2">
                {progressPct < 100
                  ? `距离「AI 基本了解你」还需约 ${progressTarget - data.l1.total} 条记忆，正常使用 3-5 天可达成`
                  : "AI 已具备基础记忆，飞轮持续优化中"}
              </p>
            </div>

            {/* Row 2.5: 待审核记忆 */}
            {(() => {
              const pendingSuggests = data.l0Records.filter((r) => r.session_key.startsWith("suggest-"));
              // 按 session_key 分组（一次 suggest 产生 user+assistant 两条）
              const grouped: Record<string, { content: string; reason: string; session_key: string; record_id: string; type: string }> = {};
              for (const r of pendingSuggests) {
                if (!grouped[r.session_key]) grouped[r.session_key] = { content: "", reason: "", session_key: r.session_key, record_id: r.record_id, type: "episodic" };
                if (r.role === "user") {
                  // 解析 [MEMORY_SUGGEST type=xxx] content
                  const match = r.message_text.match(/\[MEMORY_SUGGEST type=(\w+)\]\s*(.*)/);
                  if (match) {
                    grouped[r.session_key].type = match[1];
                    grouped[r.session_key].content = match[2];
                  } else {
                    grouped[r.session_key].content = r.message_text;
                  }
                } else {
                  grouped[r.session_key].reason = r.message_text;
                }
              }
              const items = Object.values(grouped).filter((g) => g.content);
              if (items.length === 0) return null;

              return (
                <div className="card-glow rounded-xl p-5 border-l-4 border-l-amber-500/50">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-medium text-[--text-primary]">💡 待审核记忆</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">{items.length} 条</span>
                    <span className="text-[10px] text-[--text-muted] ml-auto">不审核则 23:00 自动通过</span>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.session_key} className="flex items-start gap-3 p-3 rounded-lg bg-[--bg-primary]/50">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              item.type === "persona" ? "bg-purple-500/15 text-purple-300" :
                              item.type === "instruction" ? "bg-amber-500/15 text-amber-300" :
                              "bg-blue-500/15 text-blue-300"
                            }`}>
                              {item.type === "persona" ? "偏好" : item.type === "instruction" ? "指令" : "事件"}
                            </span>
                          </div>
                          <p className="text-sm text-[--text-primary] leading-snug">{item.content}</p>
                          {item.reason && <p className="text-[11px] text-[--text-muted] mt-1">💬 {item.reason}</p>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={async () => {
                              await doAction("approve_suggest", { record_id: item.record_id, content: item.content, type: item.type });
                              reload();
                            }}
                            className="text-[11px] px-2.5 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20 transition-colors"
                          >✓ 确认</button>
                          <button
                            onClick={async () => {
                              await doAction("reject_suggest", { session_key: item.session_key });
                              reload();
                            }}
                            className="text-[11px] px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 transition-colors"
                          >✕ 拒绝</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Row 3: 2x2 网格（四卡等大） */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 最近记住的 */}
              <div className="card-glow rounded-xl p-5 flex flex-col">
                <h3 className="text-sm font-medium text-[--text-primary] mb-3">最近记住的</h3>
                <div className="flex-1">
                  {recentL1.length === 0 ? (
                    <p className="text-sm text-[--text-muted]">暂无。与 AI 对话后会自动积累。</p>
                  ) : (
                    <div className="space-y-2.5">
                      {recentL1.map((r) => (
                        <div key={r.record_id} className="flex items-start gap-2">
                          <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded shrink-0 ${
                            r.type === "persona" ? "bg-purple-500/15 text-purple-300" :
                            r.type === "episodic" ? "bg-blue-500/15 text-blue-300" :
                            "bg-amber-500/15 text-amber-300"
                          }`}>
                            {r.type === "persona" ? "偏好" : r.type === "episodic" ? "事件" : "指令"}
                          </span>
                          <span className="text-sm text-[--text-primary] flex-1 leading-snug">{r.content}</span>
                          <span className="text-[10px] text-[--text-muted] whitespace-nowrap shrink-0">
                            {(() => {
                              const mins = Math.floor((Date.now() - new Date(r.timestamp_str).getTime()) / 60000);
                              return mins < 60 ? `${mins}分钟前` : mins < 1440 ? `${Math.floor(mins / 60)}小时前` : `${Math.floor(mins / 1440)}天前`;
                            })()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 升华流水线 */}
              <div className="card-glow rounded-xl p-5 flex flex-col">
                <h3 className="text-sm font-medium text-[--text-primary] mb-3">升华流水线</h3>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-1 rounded bg-[--bg-primary] text-[11px] text-[--text-muted]">L0 对话</span>
                    <span className="text-cyan-500/50">→</span>
                    <span className="px-2 py-1 rounded bg-[--bg-primary] text-[11px] text-[--text-muted]">每5条</span>
                    <span className="text-cyan-500/50">→</span>
                    <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-300 text-[11px]">L1 提取</span>
                    <span className="text-cyan-500/50">→</span>
                    <span className="px-2 py-1 rounded bg-[--bg-primary] text-[11px] text-[--text-muted]">90s</span>
                    <span className="text-cyan-500/50">→</span>
                    <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-300 text-[11px]">L2 聚类</span>
                    <span className="text-cyan-500/50">→</span>
                    <span className="px-2 py-1 rounded bg-[--bg-primary] text-[11px] text-[--text-muted]">50条</span>
                    <span className="text-cyan-500/50">→</span>
                    <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-300 text-[11px]">L3 画像</span>
                  </div>
                  <p className="text-[11px] text-[--text-muted] mt-3">
                    每晚 23:00 cron 触发升华 · Uptime {Math.floor(data.health.uptime / 60)} min
                  </p>
                </div>
              </div>

              {/* 记忆来源 */}
              <div className="card-glow rounded-xl p-5 flex flex-col">
                <h3 className="text-sm font-medium text-[--text-primary] mb-3">记忆来源</h3>
                <div className="flex-1">
                  <div className="space-y-2.5">
                    {Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                      <div key={src} className="flex items-center gap-3">
                        <span className="text-sm text-[--text-muted] w-24 shrink-0">{src}</span>
                        <div className="flex-1 h-2 rounded-full bg-[--bg-primary] overflow-hidden">
                          <div className="h-full rounded-full bg-cyan-500/60" style={{ width: `${Math.round((count / Math.max(data.l1.total, 1)) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-[--text-muted] w-8 text-right shrink-0">{count}</span>
                      </div>
                    ))}
                    {!Object.keys(sources).includes("Claude") && (
                      <div className="flex items-center gap-3 opacity-40">
                        <span className="text-sm text-[--text-muted] w-24">Claude</span>
                        <span className="text-xs text-[--text-muted]">未接入</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 建议 */}
              <div className="card-glow rounded-xl p-5 flex flex-col">
                <h3 className="text-sm font-medium text-[--text-primary] mb-3">💡 建议</h3>
                <div className="flex-1">
                  <div className="space-y-2">
                    {suggestions.map((s, i) => (
                      <p key={i} className="text-sm text-[--text-muted] flex items-start gap-2">
                        <span className="text-cyan-400 mt-0.5 shrink-0">•</span>
                        {s}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>
    </div>
  );
}
