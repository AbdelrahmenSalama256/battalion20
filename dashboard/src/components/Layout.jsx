import { useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";


const ALL_TABS = [
  { id: "sections", label: "الرئيسية", icon: "📊", path: "/" },
  { id: "soldiers", label: "الأفراد", icon: "👥", path: "/soldiers" },
  { id: "exams", label: "الامتحانات", icon: "📝", path: "/exams" },
  {
    id: "announcements",
    label: "الإعلانات",
    icon: "📢",
    path: "/announcements",
  },
  { id: "personnel", label: "مكتب الأفراد", icon: "📋", path: "/personnel" },
  {
    id: "notifications",
    label: "الإشعارات",
    icon: "🔔",
    path: "/notifications",
  },
  {
    id: "users",
    label: "المستخدمين",
    icon: "👤",
    path: "/users",
    commanderOnly: true,
  },
  {
    id: "manage",
    label: "الإدارة",
    icon: "⚙️",
    path: "/manage",
    commanderOnly: true,
  },
  { id: "profile", label: "حسابي", icon: "👤", path: "/profile" },
];

export default function Layout({
  user,
  onLogout,
  children,
  data,
  onMarkRead,
  onMarkAll,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [sbOpen, setSbOpen] = useState(false);

  const notifications = data?.notifications || [];
  const unread = notifications.filter((n) => !n.is_read).length;

  const navTabs = useMemo(() => {
    if (user?.role === "commander") return ALL_TABS;
    return ALL_TABS.filter((t) => !t.commanderOnly);
  }, [user]);

  const currentTab =
    navTabs.find((t) => {
      if (location.pathname === "/") return t.id === "sections";
      return location.pathname.startsWith(t.path) && t.path !== "/";
    })?.id || "sections";

  const handleNavigate = (path) => {
    navigate(path);
    setSbOpen(false);
  };

  return (
    <div className="d-flex app-layout">
      {/* Desktop sidebar */}
      <div
        className="d-none d-md-flex flex-column border-start border-military"
        style={{
          width: 220,
          flexShrink: 0,
          background: "var(--military-card)",
        }}
      >
        <div className="text-center p-3 border-bottom border-military">
          <div className="fs-2">🛡️</div>
          <h6 className="text-gold mb-1">كتيبة 20</h6>
          <div className="small text-muted-military">{user?.name}</div>
          <button
            className="bell-btn mt-2"
            onClick={() => setNotifOpen((o) => !o)}
          >
            🔔{unread > 0 && <span className="bell-badge">{unread}</span>}
            {unread > 0 && <div className="bell-glow" />}
          </button>
        </div>
        <nav className="flex-grow-1 py-2 overflow-auto">
          {navTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => handleNavigate(t.path)}
              className={`sidebar-btn d-flex align-items-center gap-2 w-100 border-0 py-2 px-3 text-muted-military small ${currentTab === t.id ? "active" : ""}`}
              style={{
                background: "none",
                textAlign: "right",
                direction: "rtl",
              }}
            >
              <span className="fs-6" style={{ width: 24, textAlign: "center" }}>
                {t.icon}
              </span>
              <span className="flex-grow-1">{t.label}</span>
              {t.id === "notifications" && unread > 0 && (
                <span
                  className="badge bg-danger rounded-pill"
                  style={{ fontSize: "0.6rem" }}
                >
                  {unread}
                </span>
              )}
            </button>
          ))}
        </nav>
        {user?.role === 'commander' && (
          <button onClick={async () => {
            try {
              const token = localStorage.getItem('b20_token');
              const base = import.meta.env.VITE_API_URL || '/api';
              const res = await fetch(`${base}/cipher/download`, { headers: { Authorization: `Bearer ${token}` } });
              if (!res.ok) { alert('فشل التحميل'); return; }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'decoder-battalion20.html';
              document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            } catch(e) { alert('حدث خطأ في التحميل'); }
          }}
          className="sidebar-btn d-flex align-items-center gap-2 w-100 border-0 py-2 px-3 text-muted-military small"
          style={{ background: "none", textAlign: "right", borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <span className="fs-6" style={{ width: 24, textAlign: "center" }}>📄</span>
            <span style={{ fontSize: 11 }}>تحميل دليل فك التشفير</span>
          </button>
        )}
        <button
          onClick={() => {
            onLogout();
            setSbOpen(false);
          }}
          className="sidebar-btn d-flex align-items-center gap-2 w-100 border-0 border-top border-military py-2 px-3 text-muted-military small"
          style={{ background: "none", textAlign: "right" }}
        >
          <span className="fs-6" style={{ width: 24, textAlign: "center" }}>
            🚪
          </span>
          <span>تسجيل الخروج</span>
        </button>
      </div>

      {/* Mobile offcanvas */}
      <div
        className={`offcanvas offcanvas-start d-md-none ${sbOpen ? "show" : ""}`}
        style={{ width: 280, background: "var(--military-card)" }}
        tabIndex="-1"
      >
        <div className="offcanvas-header border-bottom border-military">
          <h6 className="text-gold mb-0">🛡️ كتيبة 20</h6>
          <button
            type="button"
            className="btn-close btn-close-white"
            onClick={() => setSbOpen(false)}
          ></button>
        </div>
        <div className="offcanvas-body p-0 d-flex flex-column">
          <div className="small text-muted-military text-center py-2 border-bottom border-military">
            {user?.name}
          </div>
          <nav className="flex-grow-1 py-2 overflow-auto">
            {navTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => handleNavigate(t.path)}
                className={`sidebar-btn d-flex align-items-center gap-2 w-100 border-0 py-2 px-3 text-muted-military small ${currentTab === t.id ? "active" : ""}`}
                style={{ background: "none", textAlign: "right" }}
              >
                <span
                  className="fs-6"
                  style={{ width: 24, textAlign: "center" }}
                >
                  {t.icon}
                </span>
                <span className="flex-grow-1">{t.label}</span>
              </button>
            ))}
          </nav>
          <button
            onClick={() => {
              onLogout();
              setSbOpen(false);
            }}
            className="sidebar-btn d-flex align-items-center gap-2 w-100 border-0 border-top border-military py-2 px-3 text-muted-military small"
            style={{ background: "none", textAlign: "right" }}
          >
            <span className="fs-6" style={{ width: 24, textAlign: "center" }}>
              🚪
            </span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
      {sbOpen && (
        <div
          className="offcanvas-backdrop fade show d-md-none"
          onClick={() => setSbOpen(false)}
        />
      )}

      {/* Notifications offcanvas */}
      <div
        className={`offcanvas offcanvas-start ${notifOpen ? "show" : ""}`}
        style={{ width: 340, background: "var(--military-card)" }}
      >
        <div className="offcanvas-header justify-content-between border-bottom border-military">
          <h5 className="text-gold mb-0">الإشعارات</h5>
          <div className="d-flex gap-2">
            <button onClick={onMarkAll} className="btn btn-sm btn-outline-gold">
              قراءة الكل
            </button>
            <button
              onClick={() => setNotifOpen(false)}
              className="btn btn-sm btn-outline-secondary"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="offcanvas-body p-2">
          {notifications.length === 0 && (
            <p className="text-muted-military text-center p-4">
              لا توجد إشعارات
            </p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-item d-flex gap-2 p-2 rounded border border-military mb-1 ${n.is_read ? "" : "unread"}`}
              onClick={() => {
                if (!n.is_read) onMarkRead(n.id);
                if (n.evaluated_id) {
                  navigate(`/soldiers/${n.evaluated_id}`);
                  setNotifOpen(false);
                }
              }}
            >
              <div className="fs-5">
                {n.type === "evaluation"
                  ? "📋"
                  : n.type === "distinction"
                    ? "⭐"
                    : n.type === "punishment"
                      ? "⚠️"
                      : "📢"}
              </div>
              <div className="flex-grow-1 min-w-0">
                <div className="small">{n.message}</div>
                {n.evaluated_name && (
                  <div className="notif-person">{n.evaluated_name}</div>
                )}
                <div className="notif-time">
                  {n.created_at?.substring(0, 16) || ""}
                </div>
              </div>
              {!n.is_read && (
                <div className="mt-2">
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--military-gold-bright)",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="d-flex flex-column flex-grow-1 overflow-hidden">
        <div className="d-md-none d-flex align-items-center p-2 border-bottom border-military bg-card gap-2">
          <button
            className="btn btn-sm btn-outline-gold"
            onClick={() => setSbOpen(true)}
          >
            ☰
          </button>
          <div className="flex-grow-1 text-center">
            <span className="text-gold small fw-bold">🛡️ كتيبة 20</span>
          </div>
          <button className="bell-btn" onClick={() => setNotifOpen((o) => !o)}>
            🔔{unread > 0 && <span className="bell-badge">{unread}</span>}
          </button>
        </div>
        <div className="flex-grow-1 overflow-auto p-3">{children}</div>
      </div>
    </div>
  );
}
