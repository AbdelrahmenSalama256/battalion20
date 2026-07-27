import { useState, useEffect } from 'react';
import { api } from '../api';

const TYPE_TABS = [
  { key: '', label: 'الكل', icon: '📋' },
  { key: 'cabin', label: 'اختبارات الكبينة', icon: '🏠' },
  { key: 'theory', label: 'الاختبارات النظرية', icon: '📝' },
  { key: 'fitness', label: 'اللياقة البدنية', icon: '💪' },
];

const TYPE_COLORS = {
  cabin: '#C9A84C',
  theory: '#4ECDC4',
  fitness: '#45B7D1',
};

const FIELD_LABELS = {
  cabin: { task1: 'المهمة 1', task2: 'المهمة 2', task3: 'المهمة 3', average: 'المتوسط' },
  theory: { score: 'الدرجة', notes: 'الملاحظات' },
  fitness: { pushups: 'الضغط', pullups: 'المعدية', situps: 'البطن', running: 'الجري' },
};

export default function AssessmentsPage({ user }) {
  const [tab, setTab] = useState('');
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const limit = 30;

  useEffect(() => {
    loadData();
  }, [tab, page, dateFrom, dateTo]);

  async function loadData() {
    setLoading(true);
    try {
      const params = { page, limit };
      if (tab) params.type = tab;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const [sessRes, statsRes] = await Promise.all([
        api.getAssessments(params),
        api.getAssessmentStats(tab || undefined).catch(() => null),
      ]);

      setSessions(sessRes.sessions || []);
      setTotal(sessRes.total || 0);
      setStats(statsRes);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
    setSelectedIds(new Set());
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === sessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sessions.map(s => s.id)));
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.size || bulkDeleting) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} جلسة؟`)) return;
    setBulkDeleting(true);
    try {
      await api.bulkDeleteAssessments([...selectedIds]);
      loadData();
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
    setBulkDeleting(false);
  }

  const filtered = search
    ? sessions.filter(s =>
        (s.soldier_name || '').includes(search) ||
        (s.soldier_military_id || '').includes(search) ||
        (s.session_type || '').includes(search)
      )
    : sessions;

  return (
    <div className="container-fluid py-3" style={{ direction: 'rtl' }}>
      {/* Stats */}
      {stats && (
        <div className="row g-2 mb-3">
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center" style={{ background: 'rgba(10,15,7,0.7)', borderRadius: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C' }}>{stats.total || 0}</div>
              <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.5)' }}>إجمالي الجلسات</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center" style={{ background: 'rgba(10,15,7,0.7)', borderRadius: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#4ECDC4' }}>{stats.employees || 0}</div>
              <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.5)' }}>أفراد</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center" style={{ background: 'rgba(10,15,7,0.7)', borderRadius: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#45B7D1' }}>{stats.dates || 0}</div>
              <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.5)' }}>تواريخ</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center" style={{ background: 'rgba(10,15,7,0.7)', borderRadius: 14 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e8e0d0' }}>
                {stats.byType?.length || 0}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.5)' }}>أنواع</div>
            </div>
          </div>
        </div>
      )}

      {/* Type tabs */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {TYPE_TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`btn btn-sm ${tab === t.key ? 'btn-gold' : 'btn-outline-secondary'}`}
            style={{ borderRadius: 10, fontSize: 12 }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="d-flex gap-2 mb-3 flex-wrap align-items-end">
        <input type="text" placeholder="بحث بالاسم أو الرقم..." value={search} onChange={e => setSearch(e.target.value)}
          className="form-control form-control-sm bg-dark text-light border-military" style={{ fontSize: 12, maxWidth: 250 }} />
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          className="form-control form-control-sm bg-dark text-light border-military" style={{ fontSize: 12, maxWidth: 160 }} />
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
          className="form-control form-control-sm bg-dark text-light border-military" style={{ fontSize: 12, maxWidth: 160 }} />

        {selectedIds.size > 0 && user?.role === 'commander' && (
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            className="btn btn-sm btn-danger ms-auto" style={{ borderRadius: 10, fontSize: 12 }}>
            🗑️ حذف ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card border-military" style={{ background: 'rgba(10,15,7,0.7)', borderRadius: 16, overflow: 'hidden' }}>
        {loading ? (
          <div className="p-4 text-center" style={{ color: 'rgba(232,224,208,0.4)' }}>جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center" style={{ color: 'rgba(232,224,208,0.3)', fontSize: 13 }}>
            لا توجد بيانات
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table table-dark table-hover mb-0" style={{ fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {user?.role === 'commander' && (
                    <th style={{ width: 40 }}>
                      <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll} className="form-check-input" />
                    </th>
                  )}
                  <th>الرقم</th>
                  <th>الاسم</th>
                  <th>الرتبة</th>
                  <th>النوع</th>
                  <th>التاريخ</th>
                  <th>القيم</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {user?.role === 'commander' && (
                      <td>
                        <input type="checkbox" checked={selectedIds.has(s.id)}
                          onChange={() => toggleSelect(s.id)} className="form-check-input" />
                      </td>
                    )}
                    <td style={{ fontFamily: 'monospace', color: 'rgba(232,224,208,0.5)' }}>{s.soldier_military_id || '-'}</td>
                    <td style={{ color: '#e8e0d0' }}>{s.soldier_name || '-'}</td>
                    <td style={{ color: 'rgba(232,224,208,0.6)' }}>{s.soldier_rank_name || '-'}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 8, fontSize: 10,
                        background: `${TYPE_COLORS[s.session_type] || '#666'}22`,
                        color: TYPE_COLORS[s.session_type] || '#888',
                        border: `1px solid ${TYPE_COLORS[s.session_type] || '#666'}33`,
                      }}>
                        {TYPE_TABS.find(t => t.key === s.session_type)?.label || s.session_type}
                      </span>
                    </td>
                    <td style={{ color: 'rgba(232,224,208,0.6)', fontFamily: 'monospace', fontSize: 11 }}>{s.assessment_date}</td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        {Object.entries(s.values || {}).map(([k, v]) => (
                          <span key={k} style={{
                            padding: '1px 6px', borderRadius: 6, fontSize: 10,
                            background: 'rgba(255,255,255,0.05)', color: 'rgba(232,224,208,0.7)',
                          }}>
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="d-flex justify-content-center gap-2 mt-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 8 }}>السابق</button>
          <span style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', padding: '6px 12px' }}>
            صفحة {page} من {Math.ceil(total / limit)}
          </span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / limit)}
            className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 8 }}>التالي</button>
        </div>
      )}
    </div>
  );
}
