import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import {
  ComposedChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
} from "recharts";

const SECTION_META = {
  specialties: {
    icon: "🎯",
    color: "var(--military-gold-bright)",
    desc: "التخصصات والخبرات",
  },
  general: { icon: "📋", color: "#4CAF50", desc: "التمييزات العامة" },
  fitness: { icon: "💪", color: "#2196F3", desc: "اللياقة البدنية" },
  shooting: { icon: "🔫", color: "#FF9800", desc: "الرماية" },
  discipline: { icon: "🎖️", color: "#9C27B0", desc: "الانضباط" },
};

const CATEGORIES = [
  { key: "تعليم", color: "#ff6b6b", icon: "📚" },
  { key: "انضباط", color: "#4ecdc4", icon: "⚖️" },
  { key: "رقابة", color: "#45b7d1", icon: "👁️" },
  { key: "عام", color: "#a29bfe", icon: "📋" },
];

const CHART_DATA = [
  { date: "04-03", تعليم: 65, انضباط: 70, رقابة: 55, عام: 80 },
  { date: "05-27", تعليم: 72, انضباط: 68, رقابة: 60, عام: 85 },
  { date: "06-16", تعليم: 80, انضباط: 75, رقابة: 58, عام: 82 },
  { date: "06-19", تعليم: 78, انضباط: 82, رقابة: 65, عام: 88 },
];

function StatCard({ icon, label, value, trend, trendLabel, sub, delay }) {
  return (
    <div
      className="col-6 col-md-3"
      style={{ animation: `fadeUp 0.6s ease ${delay || 0}s both` }}
    >
      <div
        className="card border-military p-3 stat-card h-100"
        style={{
          background: "rgba(10,15,7,0.7)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-50%",
            right: "-50%",
            width: "200%",
            height: "200%",
            pointerEvents: "none",
            background: `radial-gradient(circle, ${trend === "up" ? "rgba(212,168,67,0.06)" : "rgba(255,107,107,0.06)"} 0%, transparent 60%)`,
          }}
        />
        <div className="d-flex justify-content-between align-items-start mb-2">
          <span style={{ fontSize: 24, opacity: 0.6 }}>{icon}</span>
          <span
            className={`badge ${trend === "up" ? "bg-success" : "bg-danger"}`}
            style={{
              fontSize: 10,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            {trend === "up" ? "⬆" : "⬇"} {trendLabel}
          </span>
        </div>
        <div className="small text-muted-military" style={{ fontSize: 11 }}>
          {label}
        </div>
        <div
          className="text-gold-bright fw-bold"
          style={{ fontSize: 28, lineHeight: 1.1 }}
        >
          {value}
        </div>
        {sub && (
          <div
            className="small text-muted-military mt-1"
            style={{ fontSize: 11 }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

function CategCard({ cat, data, delay }) {
  const vals = data.map((d) => d[cat.key]);
  const first = vals[0],
    last = vals[vals.length - 1];
  const change = last - first;
  const up = change >= 0;
  return (
    <div
      className="col-6 col-md"
      style={{ animation: `fadeUp 0.6s ease ${delay || 0}s both` }}
    >
      <div
        className="card border-military p-3 text-center h-100"
        style={{
          background: "rgba(10,15,7,0.7)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          cursor: "default",
          transition: "all 0.3s",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.4)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = "";
          e.currentTarget.style.boxShadow = "";
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 4 }}>{cat.icon}</div>
        <div className="small fw-bold mb-1" style={{ color: cat.color }}>
          {cat.key}
        </div>
        <div
          className="fw-bold"
          style={{ fontSize: 22, color: cat.color, lineHeight: 1 }}
        >
          {last}
        </div>
        <div
          className="small mt-1"
          style={{ color: up ? "#4ecdc4" : "#ff6b6b" }}
        >
          {up ? "⬆" : "⬇"} {change >= 0 ? "+" : ""}
          {change}
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div
      style={{
        background: "rgba(10,15,7,0.92)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "10px 14px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 4 }}
      >
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#e8e0d0",
            padding: "2px 0",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: p.color,
              display: "inline-block",
            }}
          />
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function DashboardPage({
  user,
  sections,
  notifications,
  onMarkRead,
}) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getResultsStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const canAccess = (key) => {
    if (user?.role === "commander") return true;
    const allowed = user?.permissions?.sections;
    if (!allowed || !allowed.length) return true;
    return allowed.includes(key);
  };

  const lastIdx = CHART_DATA.length - 1;
  const notifList = (notifications || []).slice(0, 10);
  const lastVals = CATEGORIES.map((c) => ({
    name: c.key,
    value: CHART_DATA[lastIdx][c.key],
    color: c.color,
    icon: c.icon,
  }));

  return (
    <div>
      {/* Sections Cards */}
      <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>
        الأقسام
      </h6>
      <div className="row g-3 justify-content-center mb-4">
        {(sections || [])
          .filter((s) => canAccess(s.key))
          .map((s) => {
            const meta = SECTION_META[s.key] || {};
            return (
              <div key={s.id} className="col-12 col-md-6 col-lg-4">
                <div
                  className="card border-military p-4 text-center soldier-card"
                  style={{
                    cursor: "pointer",
                    minHeight: 150,
                    borderRadius: 20,
                    background: "rgba(10,15,7,0.7)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    transition: "all 0.3s",
                  }}
                  onClick={() => navigate(`/sections/${s.key}`)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 48px rgba(0,0,0,0.5)";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  <div className="fs-1 mb-2">{meta.icon || s.icon}</div>
                  <h6 className="text-gold mb-1">{s.name}</h6>
                  <div className="small text-muted-muted">{meta.desc}</div>
                </div>
              </div>
            );
          })}
      </div>
      {/* Stats Row */}
      <div className="row g-3 mb-4">
        <StatCard
          icon="👤"
          label="إجمالي الأفراد"
          value={stats?.totalSoldiers || 0}
          trend="up"
          trendLabel={`${stats?.passRate || 0}%`}
          sub={`${stats?.totalResults || 0} تقييم`}
          delay={0}
        />
        <StatCard
          icon="📊"
          label="متوسط الدرجات"
          value={Number(stats?.avgScore || 0).toFixed(1)}
          trend={Number(stats?.avgScore || 0) >= 70 ? "up" : "down"}
          trendLabel={Number(stats?.avgScore || 0) >= 70 ? "ممتاز" : "مقبول"}
          sub="جميع الفئات"
          delay={0.05}
        />
        <StatCard
          icon="🥇"
          label="أفضل فئة"
          value={(() => {
            const last = CHART_DATA[lastIdx];
            const max = CATEGORIES.reduce((a, b) => (last[a.key] > last[b.key] ? a : b));
            return max.key;
          })()}
          trend="up"
          trendLabel="⬆"
          sub={`${(() => {
            const last = CHART_DATA[lastIdx];
            const max = CATEGORIES.reduce((a, b) => (last[a.key] > last[b.key] ? a : b));
            return last[max.key];
          })()} نقطة`}
          delay={0.1}
        />
        <StatCard
          icon="📉"
          label="الأدنى"
          value={(() => {
            const last = CHART_DATA[lastIdx];
            const min = CATEGORIES.reduce((a, b) => (last[a.key] < last[b.key] ? a : b));
            return min.key;
          })()}
          trend="up"
          trendLabel="⬆"
          sub={`${(() => {
            const last = CHART_DATA[lastIdx];
            const min = CATEGORIES.reduce((a, b) => (last[a.key] < last[b.key] ? a : b));
            return last[min.key];
          })()} نقطة`}
          delay={0.15}
        />
      </div>

      {/* Category Cards */}
      <div className="row g-2 mb-4">
        {CATEGORIES.map((cat, i) => (
          <CategCard
            key={cat.key}
            cat={cat}
            data={CHART_DATA}
            delay={0.05 * i}
          />
        ))}
      </div>

      {/* Main Chart - Line chart with all categories */}
      <div
        className="card border-military p-3 mb-4"
        style={{
          background: "rgba(10,15,7,0.7)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 20,
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="text-gold mb-0" style={{ fontSize: 14 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--military-gold-bright)",
                marginLeft: 6,
              }}
            />
            تطور الأداء{" "}
            <span
              className="text-muted-muted"
              style={{ fontWeight: 400, fontSize: 12 }}
            >
              حسب الفئة
            </span>
          </h6>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={CHART_DATA}
            margin={{ top: 20, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
            />
            <XAxis
              dataKey="date"
              tick={{
                fill: "rgba(232,224,208,0.5)",
                fontSize: 12,
                fontFamily: "Tajawal",
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{
                fill: "rgba(232,224,208,0.4)",
                fontSize: 11,
                fontFamily: "Tajawal",
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => (
                <span
                  style={{
                    color: "rgba(232,224,208,0.6)",
                    fontSize: 12,
                    fontFamily: "Tajawal",
                  }}
                >
                  {value}
                </span>
              )}
            />
            {CATEGORIES.map((c, i) =>
              i < 2 ? (
                <Bar
                  key={c.key}
                  dataKey={c.key}
                  fill={c.color + "cc"}
                  barSize={16}
                  radius={[2, 2, 0, 0]}
                />
              ) : (
                <Line
                  key={c.key}
                  type="monotone"
                  dataKey={c.key}
                  stroke={c.color}
                  strokeWidth={3}
                  dot={{ r: 5, fill: c.color, stroke: "#0a0f07", strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                />
              )
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: Compare chart + Notifications */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-6">
          <div
            className="card border-military p-3 h-100"
            style={{
              background: "rgba(10,15,7,0.7)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#4ecdc4",
                  marginLeft: 6,
                }}
              />
              مقارنة الفئات{" "}
              <span
                className="text-muted-muted"
                style={{ fontWeight: 400, fontSize: 12 }}
              >
                آخر تقييم
              </span>
            </h6>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={lastVals}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{
                    fill: "rgba(232,224,208,0.4)",
                    fontSize: 11,
                    fontFamily: "Tajawal",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{
                    fill: "rgba(232,224,208,0.85)",
                    fontSize: 13,
                    fontFamily: "Tajawal",
                    fontWeight: 600,
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" barSize={22} radius={[0, 8, 8, 0]}>
                  {lastVals.map((entry, i) => (
                    <Cell key={i} fill={entry.color + "cc"} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill="rgba(232,224,208,0.7)"
                    fontSize={13}
                    fontFamily="Tajawal"
                    fontWeight={700}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="col-12 col-md-6">
          <div
            className="card border-military p-3 h-100"
            style={{
              background: "rgba(10,15,7,0.7)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="text-gold mb-0" style={{ fontSize: 14 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#45b7d1",
                    marginLeft: 6,
                  }}
                />
                آخر الإشعارات
              </h6>
              <button
                className="btn btn-sm btn-outline-gold py-0 px-2"
                onClick={() => navigate("/notifications")}
                style={{ fontSize: 11 }}
              >
                عرض الكل
              </button>
            </div>
            <div style={{ maxHeight: 230, overflowY: "auto" }}>
              {notifList.length === 0 && (
                <div className="text-center text-muted-muted small py-4">
                  لا توجد إشعارات
                </div>
              )}
              {notifList.map((n) => (
                <div
                  key={n.id}
                  className={`d-flex gap-2 p-2 rounded mb-1 ${n.is_read ? "" : "unread"}`}
                  style={{
                    cursor: "pointer",
                    borderRight: n.is_read
                      ? "none"
                      : "2px solid var(--military-gold-bright)",
                    background: n.is_read
                      ? "transparent"
                      : "rgba(212,168,67,0.04)",
                    transition: "all 0.2s",
                  }}
                  onClick={() => {
                    if (!n.is_read) onMarkRead(n.id);
                    if (n.evaluated_id) navigate(`/soldiers/${n.evaluated_id}`);
                  }}
                >
                  <span>
                    {n.type === "evaluation"
                      ? "📋"
                      : n.type === "distinction"
                        ? "⭐"
                        : n.type === "punishment"
                          ? "⚠️"
                          : "📢"}
                  </span>
                  <div className="flex-grow-1 min-w-0">
                    <div className="small">{n.message || ""}</div>
                    <div
                      className="small"
                      style={{ color: "var(--text-muted)", fontSize: 10 }}
                    >
                      {n.created_at?.substring(0, 16) || ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mini stats */}
      <div className="row g-2 mb-4">
        {[
          {
            icon: "🏋️",
            label: "اللياقة",
            value: Number(stats?.avgFitness || 0).toFixed(1),
          },
          {
            icon: "🎯",
            label: "التخصص",
            value: Number(stats?.avgSpecialty || 0).toFixed(1),
          },
          {
            icon: "⚖️",
            label: "الانضباط",
            value: Number(stats?.avgDiscipline || 0).toFixed(1),
          },
          { icon: "📈", label: "اجتياز", value: `${stats?.passRate || 0}%` },
          {
            icon: "🏆",
            label: "ممتاز",
            value: stats?.distribution?.excellent || 0,
          },
          { icon: "📊", label: "تقييمات", value: stats?.totalResults || 0 },
        ].map((x, i) => (
          <div key={i} className="col-4 col-md-2">
            <div
              className="card border-military p-2 text-center h-100"
              style={{
                background: "rgba(10,15,7,0.7)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ fontSize: 16 }}>{x.icon}</div>
              <div className="small text-muted-muted" style={{ fontSize: 10 }}>
                {x.label}
              </div>
              <div
                className="fw-bold text-gold-bright"
                style={{ fontSize: 14 }}
              >
                {x.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
