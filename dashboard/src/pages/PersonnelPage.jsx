import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { smartMatch } from '../utils/translit';

export default function PersonnelPage({ user, soldiers }) {
  const [dash, setDash] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [needing, setNeeding] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startModal, setStartModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ soldier_id: '', start_date: '', end_date: '', notes: '' });
  const [soldierInfo, setSoldierInfo] = useState(null);
  const [soldierInfoLoading, setSoldierInfoLoading] = useState(false);
  const [searchNeeding, setSearchNeeding] = useState('');
  const [searchActive, setSearchActive] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l, n, o] = await Promise.all([
        api.getPersonnelDashboard(),
        api.getActiveLeaves(),
        api.getSoldiersNeedingLeave(),
        api.getOverdueReturns(),
      ]);
      setDash(d);
      setLeaves(l.leaves || []);
      setNeeding(n.soldiers || []);
      setOverdue(o.leaves || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!leaveForm.soldier_id) { setSoldierInfo(null); return; }
    let cancelled = false;
    setSoldierInfoLoading(true);
    (async () => {
      try {
        const [sold, puns, activeLeaves] = await Promise.all([
          api.getSoldier(leaveForm.soldier_id),
          api.getPunishments(leaveForm.soldier_id),
          api.getLeaves({ soldier_id: leaveForm.soldier_id, status: 'active' }),
        ]);
        if (!cancelled) setSoldierInfo({ soldier: sold, punishments: puns || [], activeLeaves: activeLeaves.leaves || [] });
      } catch (e) { /* ignore */ }
      if (!cancelled) setSoldierInfoLoading(false);
    })();
    return () => { cancelled = true; };
  }, [leaveForm.soldier_id]);

  const startLeave = async (e) => {
    e.preventDefault();
    try {
      await api.createLeave(leaveForm);
      setStartModal(false);
      setLeaveForm({ soldier_id: '', start_date: '', end_date: '', notes: '' });
      setSoldierInfo(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const confirmReturn = async (id) => {
    try {
      await api.confirmReturn(id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading && !dash) {
    return <div className="d-flex justify-content-center p-5"><div className="loading-spinner" /></div>;
  }

  const filteredNeeding = needing.filter(s =>
    !searchNeeding || smartMatch(searchNeeding, s.name) || smartMatch(searchNeeding, s.military_id || '')
  );
  const filteredLeaves = leaves.filter(l =>
    !searchActive || smartMatch(searchActive, l.soldier_name) || smartMatch(searchActive, l.military_id || '')
  );

  return (
    <div className="container-fluid py-3" dir="rtl">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="text-gold mb-0">📋 مكتب الأفراد</h5>
          <small className="text-muted-military">إدارة إجازات وبيانات الأفراد</small>
        </div>
        <button className="btn btn-gold btn-sm" onClick={() => { setLeaveForm({ soldier_id: '', start_date: '', end_date: '', notes: '' }); setSoldierInfo(null); setStartModal(true); }}>
          + تسجيل إجازة جديدة
        </button>
      </div>

      {/* Stats cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3 col-6">
          <div className="card bg-card border-military p-3 text-center stat-card">
            <div className="text-gold-bright fs-3 fw-bold">{dash?.total || 0}</div>
            <div className="text-muted-military small">إجمالي الأفراد (كل التخصصات)</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card bg-card border-military p-3 text-center stat-card">
            <div className="text-warning fs-3 fw-bold">{dash?.onLeave || 0}</div>
            <div className="text-muted-military small">في إجازة</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card bg-card border-military p-3 text-center stat-card">
            <div className="text-danger fs-3 fw-bold">{dash?.needWarning?.length || needing.length || 0}</div>
            <div className="text-muted-military small">يحتاج إجازة (أكثر من 21 يوم)</div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card bg-card border-military p-3 text-center stat-card">
            <div className="text-success fs-3 fw-bold">{dash?.returningTodayCount || dash?.returningToday || 0}</div>
            <div className="text-muted-military small">العودة اليوم</div>
          </div>
        </div>
      </div>

      {/* Needing leave */}
      <div className="card bg-card border-military mb-4">
        <div className="card-header bg-transparent border-military d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span className="text-danger fw-bold">⚠ أفراد تجاوزوا 21 يوم بدون إجازة</span>
          <div className="d-flex gap-2 align-items-center">
            <input placeholder="بحث..." value={searchNeeding} onChange={e => setSearchNeeding(e.target.value)}
              className="form-control form-control-sm bg-dark text-light border-military" style={{ maxWidth: 180, fontSize: 12 }} />
            <span className="badge bg-danger">{filteredNeeding.length}</span>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-dark table-sm mb-0">
              <thead><tr><th>#</th><th>الرتبة</th><th>الاسم</th><th>الرقم العسكري</th><th>أيام بدون إجازة</th><th></th></tr></thead>
              <tbody>
                {filteredNeeding.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td><span className="text-gold">{s.rank_name || ''}</span></td>
                    <td>{s.name}</td>
                    <td className="text-muted-military">{s.military_id || '—'}</td>
                    <td><span className={`badge ${s.days_since_leave > 30 ? 'bg-danger' : 'bg-warning text-dark'}`}>{s.days_since_leave} يوم</span></td>
                    <td>
                      <button className="btn btn-sm btn-outline-gold" onClick={() => { setLeaveForm(f => ({ ...f, soldier_id: s.id })); setSoldierInfo(null); setStartModal(true); }}>
                        تسجيل إجازة
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredNeeding.length === 0 && <tr><td colSpan={6} className="text-center text-muted-military small py-3">{searchNeeding ? 'لا توجد نتائج' : 'جميع الأفراد ضمن المدة النظامية ✓'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Active leaves */}
      <div className="card bg-card border-military mb-4">
        <div className="card-header bg-transparent border-military d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span className="text-warning fw-bold">📋 إجازات نشطة</span>
          <div className="d-flex gap-2 align-items-center">
            <input placeholder="بحث..." value={searchActive} onChange={e => setSearchActive(e.target.value)}
              className="form-control form-control-sm bg-dark text-light border-military" style={{ maxWidth: 180, fontSize: 12 }} />
            <span className="badge bg-warning text-dark">{filteredLeaves.length}</span>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-dark table-sm mb-0">
              <thead><tr><th>#</th><th>الجندي</th><th>الرقم العسكري</th><th>من</th><th>إلى</th><th>الأيام المتبقية</th><th>الحالة</th><th></th></tr></thead>
              <tbody>
                {filteredLeaves.map((l, i) => {
                  const remaining = l.remaining_days !== null ? parseInt(l.remaining_days) : null;
                  const isOverdue = remaining !== null && remaining < 0;
                  const isToday = remaining === 0;
                  return (
                    <tr key={l.id}>
                      <td>{i + 1}</td>
                      <td>{l.soldier_name}</td>
                      <td className="text-muted-military">{l.military_number || '—'}</td>
                      <td>{new Date(l.start_date).toLocaleDateString('ar-EG')}</td>
                      <td>{new Date(l.end_date).toLocaleDateString('ar-EG')}</td>
                      <td>
                        {isOverdue ? (
                          <span className="badge bg-danger">متأخر {Math.abs(remaining)} يوم</span>
                        ) : isToday ? (
                          <span className="badge bg-success">اليوم</span>
                        ) : (
                          <span className="badge bg-info text-dark">{remaining} يوم</span>
                        )}
                      </td>
                      <td>
                        {l.return_confirmed ? (
                          <span className="badge bg-success">تمت العودة</span>
                        ) : isOverdue ? (
                          <span className="badge bg-danger">متأخر</span>
                        ) : (
                          <span className="badge bg-warning text-dark">في إجازة</span>
                        )}
                      </td>
                      <td>
                        {!l.return_confirmed && (
                          <button className="btn btn-sm btn-success" onClick={() => confirmReturn(l.id)}>
                            تأكيد العودة
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredLeaves.length === 0 && <tr><td colSpan={8} className="text-center text-muted-military small py-3">{searchActive ? 'لا توجد نتائج' : 'لا توجد إجازات نشطة'}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overdue returns */}
      {overdue.length > 0 && (
        <div className="card bg-card border-military mb-4">
          <div className="card-header bg-transparent border-military d-flex justify-content-between align-items-center">
            <span className="text-danger fw-bold">⏰ متأخرون عن العودة</span>
            <span className="badge bg-danger">{overdue.length}</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-dark table-sm mb-0">
                <thead><tr><th>#</th><th>الجندي</th><th>الرقم العسكري</th><th>تاريخ العودة</th><th>متأخر</th><th></th></tr></thead>
                <tbody>
                  {overdue.map((l, i) => (
                    <tr key={l.id}>
                      <td>{i + 1}</td>
                      <td>{l.soldier_name}</td>
                      <td className="text-muted-military">{l.military_number || '—'}</td>
                      <td>{new Date(l.end_date).toLocaleDateString('ar-EG')}</td>
                      <td><span className="badge bg-danger">{l.overdue_days} يوم</span></td>
                      <td>
                        <button className="btn btn-sm btn-success" onClick={() => confirmReturn(l.id)}>
                          تأكيد العودة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming returns */}
      {dash?.upcomingReturns?.length > 0 && (
        <div className="card bg-card border-military mb-4">
          <div className="card-header bg-transparent border-military d-flex justify-content-between align-items-center">
            <span className="text-info fw-bold">📅 العودة خلال 7 أيام</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-dark table-sm mb-0">
                <thead><tr><th>#</th><th>الجندي</th><th>الرقم العسكري</th><th>تاريخ العودة</th><th>الأيام المتبقية</th></tr></thead>
                <tbody>
                  {dash.upcomingReturns.map((l, i) => (
                    <tr key={l.id}>
                      <td>{i + 1}</td>
                      <td>{l.soldier_name}</td>
                      <td className="text-muted-military">{l.military_number || '—'}</td>
                      <td>{new Date(l.end_date).toLocaleDateString('ar-EG')}</td>
                      <td>
                        <span className={`badge ${l.days_remaining <= 1 ? 'bg-success' : 'bg-info text-dark'}`}>
                          {l.days_remaining} يوم
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Start Leave Modal */}
      {startModal && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content bg-card border-military">
              <div className="modal-header border-military">
                <h6 className="modal-title text-gold">تسجيل إجازة جديدة</h6>
                <button className="btn-close btn-close-white" onClick={() => setStartModal(false)} />
              </div>
              <form onSubmit={startLeave}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small text-muted-military">الجندي</label>
                    <select className="form-select" value={leaveForm.soldier_id} required
                      onChange={e => { setLeaveForm(f => ({ ...f, soldier_id: e.target.value })); setSoldierInfo(null); }}>
                      <option value="">اختر جندي...</option>
                      {(soldiers || []).filter(s => s.status !== 'leave').map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.military_id || '—'})</option>
                      ))}
                    </select>
                  </div>

                  {/* Soldier info alerts */}
                  {soldierInfoLoading && <div className="text-center text-muted-military small py-2">جاري تحميل بيانات الجندي...</div>}
                  {soldierInfo && (
                    <div className="mb-3">
                      {soldierInfo.punishments.length > 0 && (
                        <div className="alert alert-danger py-2 px-3 mb-2 small" role="alert" style={{ background: 'rgba(178,34,34,0.15)', border: '1px solid rgba(178,34,34,0.3)', color: '#ff6b6b' }}>
                          <strong>⚠ تنبيه: هذا الجندي لديه {soldierInfo.punishments.length} خصم/عقوبة!</strong>
                          <ul className="mb-0 mt-1" style={{ listStyle: 'none', padding: 0 }}>
                            {soldierInfo.punishments.slice(0, 3).map(p => (
                              <li key={p.id} className="small">• {p.reason} ({p.created_at?.substring(0, 10)})</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {soldierInfo.activeLeaves.length > 0 && (
                        <div className="alert alert-warning py-2 px-3 mb-2 small" role="alert" style={{ background: 'rgba(255,193,7,0.15)', border: '1px solid rgba(255,193,7,0.3)', color: '#ffc107' }}>
                          <strong>⚠ هذا الجندي في إجازة حالياً!</strong>
                          {soldierInfo.activeLeaves.map(al => (
                            <div key={al.id} className="small mt-1">من {new Date(al.start_date).toLocaleDateString('ar-EG')} إلى {new Date(al.end_date).toLocaleDateString('ar-EG')}</div>
                          ))}
                        </div>
                      )}
                      {!soldierInfo.punishments.length && !soldierInfo.activeLeaves.length && (
                        <div className="alert py-2 px-3 mb-2 small" style={{ background: 'rgba(46,125,50,0.15)', border: '1px solid rgba(46,125,50,0.3)', color: '#81c784' }}>
                          ✅ لا يوجد خصومات أو عقوبات نشطة — يمكن تسجيل الإجازة
                        </div>
                      )}
                    </div>
                  )}

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small text-muted-military">تاريخ البداية</label>
                      <input type="date" className="form-control" value={leaveForm.start_date} required
                        onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="col-6">
                      <label className="form-label small text-muted-military">تاريخ النهاية</label>
                      <input type="date" className="form-control" value={leaveForm.end_date} required
                        onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small text-muted-military">ملاحظات</label>
                    <textarea className="form-control" rows={2} value={leaveForm.notes}
                      onChange={e => setLeaveForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer border-military">
                  <button type="button" className="btn btn-secondary" onClick={() => setStartModal(false)}>إلغاء</button>
                  <button type="submit" className="btn btn-gold">تسجيل الإجازة</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
