import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ScoreBadge from '../components/ScoreBadge';
import { encNum } from '../utils/cipher';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const SECTION_NAMES = {
  general: 'عام', fitness: 'لياقة', shooting: 'رماية',
  discipline: 'انضباط', specialties: 'تخصص',
};

const SECTION_KEYS = ['general', 'fitness', 'shooting', 'discipline', 'specialties'];

const STATUS_MAP = {
  active: { label: 'نشط', class: 'bg-success' },
  leave: { label: 'إجازة', class: 'bg-warning' },
  mission: { label: 'مأمورية', class: 'bg-info' },
  other: { label: 'أخرى', class: 'bg-secondary' },
};

const ACTION_COLORS = {
  gold: '#FFD700', silver: '#C0C0C0', bronze: '#CD7F32', green: '#4CAF50',
  red: '#F44336', orange: '#FF9800', yellow: '#FFEB3B',
};

export default function SoldierProfilePage({ user, onRefresh }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [soldier, setSoldier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [evalForm, setEvalForm] = useState({ section_key: 'general', score: '', notes: '' });
  const [evalLoading, setEvalLoading] = useState(false);
  const [leaves, setLeaves] = useState([]);
  const [testSessions, setTestSessions] = useState([]);
  const [testLoaded, setTestLoaded] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => { loadSoldier(); setTestLoaded(false); setTestSessions([]); }, [id]);

  async function loadSoldier() {
    setLoading(true);
    try {
      const [data, lvRes] = await Promise.all([
        api.getSoldier(id),
        api.getLeaves({ soldier_id: id }).catch(() => ({ leaves: [] }))
      ]);
      setSoldier(data);
      setLeaves(lvRes.leaves || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleEvaluate(e) {
    e.preventDefault();
    if (!evalForm.score) return;
    setEvalLoading(true);
    try {
      await api.createEvaluation({ soldier_id: id, section_key: evalForm.section_key, score: parseFloat(evalForm.score), max_score: 100, notes: evalForm.notes || null });
      setEvalForm({ section_key: evalForm.section_key, score: '', notes: '' });
      await loadSoldier();
      if (onRefresh) onRefresh();
    } catch (err) { alert(err.message); }
    setEvalLoading(false);
  }

  async function handleConfirmReturn() {
    if (!window.confirm(`تأكيد عودة ${soldier.name} من الإجازة؟`)) return;
    try {
      await api.confirmReturnSoldier(id);
      await loadSoldier();
      if (onRefresh) onRefresh();
    } catch (err) { alert(err.message); }
  }

  async function loadTestResults() {
    if (testLoaded) return;
    setTestLoading(true);
    try {
      console.log('[TEST-RESULTS] fetching for soldier id:', id);
      const data = await api.getSoldierAssessments(id);
      console.log('[TEST-RESULTS] raw API response:', JSON.stringify(data).substring(0, 500));
      console.log('[TEST-RESULTS] data.sessions:', data.sessions, 'type:', typeof data.sessions, 'isArray:', Array.isArray(data.sessions));
      console.log('[TEST-RESULTS] data keys:', Object.keys(data));
      setTestSessions(data.sessions || []);
      setTestLoaded(true);
    } catch (e) { console.error('[TEST-RESULTS] ERROR:', e); }
    setTestLoading(false);
  }

  function handleTabClick(tab) {
    setActiveTab(tab);
    if (tab === 'test-results') loadTestResults();
  }

  if (loading) return <div className="text-center p-5 text-muted-military">جاري التحميل...</div>;
  if (!soldier) return <div className="text-center p-5 text-muted-military">الجندي غير موجود</div>;

  const status = STATUS_MAP[soldier.status] || STATUS_MAP.active;
  const evaluations = soldier.evaluations || [];
  const distinctions = soldier.distinctions || [];
  const punishments = soldier.punishments || [];
  const sectionStats = soldier.sectionStats || [];
  const specialties = soldier.specialties || [];

  function canConfirm() {
    if (user?.role === 'commander') return true;
    return user?.permissions?.canDistinguish;
  }

  async function handleConfirmDistinction(distId) {
    try {
      await api.confirmDistinction(distId);
      loadSoldier();
    } catch (e) { alert(e.message); }
  }

  // Group evaluations by section
  const evalsBySection = {};
  SECTION_KEYS.forEach(sk => {
    evalsBySection[sk] = evaluations.filter(e => e.section_key === sk);
  });

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/soldiers')}>رجوع</button>
      </div>

      {/* Info Card */}
      <div className="card border-military p-3 mb-4">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3">
          <div>
            <h4 className="text-gold mb-1">{soldier.name}</h4>
            <div className="small text-muted-military mb-1">
              <span className="badge bg-dark border border-military me-2">{soldier.rank_name || '-'}</span>
              {soldier.military_id && <span className="me-2">رقم: {soldier.military_id}</span>}
              {soldier.weapon_name && <span>{soldier.weapon_icon} {soldier.weapon_name}</span>}
            </div>
            <div className="mt-2">
              <span className={`badge ${status.class}`}>{status.label}</span>
              {soldier.status_notes && <span className="small text-muted-military me-2">({soldier.status_notes})</span>}
              {soldier.status === 'leave' && user?.role === 'commander' && (
                <button className="btn btn-sm btn-outline-success ms-2 py-0" onClick={handleConfirmReturn}>✓ تأكيد العودة</button>
              )}
            </div>
            {specialties.length > 0 && (
              <div className="mt-2">
                {specialties.map(sp => (
                  <span key={sp.id} className="badge bg-dark border border-military me-1">{sp.name}</span>
                ))}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="small text-muted-military">التمييزات</div>
            <div className="fs-4 fw-bold text-gold" style={{fontFamily:'monospace',letterSpacing:'0.08em'}}>{encNum(distinctions.length)}</div>
          </div>
          <div className="text-center">
            <div className="small text-muted-military">الجزاءات</div>
            <div className="fs-4 fw-bold text-danger" style={{fontFamily:'monospace',letterSpacing:'0.08em'}}>{encNum(punishments.length)}</div>
          </div>
          <div className="text-center">
            <div className="small text-muted-military">التمييزات</div>
            <div className="fs-4 fw-bold text-info" style={{fontFamily:'monospace',letterSpacing:'0.08em'}}>{encNum(evaluations.length)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => handleTabClick('overview')}
            style={{ color: activeTab === 'overview' ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
            نظرة عامة
          </button>
        </li>
        {SECTION_KEYS.map(sk => (
          <li key={sk} className="nav-item">
            <button className={`nav-link ${activeTab === sk ? 'active' : ''}`}
              onClick={() => handleTabClick(sk)}
              style={{ color: activeTab === sk ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
              {SECTION_NAMES[sk]}
            </button>
          </li>
        ))}
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'distinctions' ? 'active' : ''}`}
            onClick={() => handleTabClick('distinctions')}
            style={{ color: activeTab === 'distinctions' ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
            التمييزات
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'punishments' ? 'active' : ''}`}
            onClick={() => handleTabClick('punishments')}
            style={{ color: activeTab === 'punishments' ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
            الجزاءات
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'test-results' ? 'active' : ''}`}
            onClick={() => handleTabClick('test-results')}
            style={{ color: activeTab === 'test-results' ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
            نتائج الاختبارات
          </button>
        </li>
      </ul>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Evaluation Form */}
          {(user?.role === 'commander' || user?.permissions?.canEvaluate) && (
            <div className="card border-military p-3 mb-4">
              <h5 className="text-gold mb-3">إضافة تقييم</h5>
              <form onSubmit={handleEvaluate}>
                <div className="row g-2 align-items-end">
                  <div className="col-md-3">
                    <label className="form-label small text-muted-military">السيكشن</label>
                    <select className="form-select form-select-sm bg-dark text-light border-military"
                      value={evalForm.section_key} onChange={e => setEvalForm({ ...evalForm, section_key: e.target.value })}>
                      {SECTION_KEYS.map(sk => <option key={sk} value={sk}>{SECTION_NAMES[sk]}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label small text-muted-military">الدرجة (0-100)</label>
                    <input type="number" min="0" max="100" step="0.5" className="form-control form-control-sm bg-dark text-light border-military"
                      placeholder="الدرجة" value={evalForm.score}
                      onChange={e => setEvalForm({ ...evalForm, score: e.target.value })} required />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small text-muted-military">ملاحظات</label>
                    <input type="text" className="form-control form-control-sm bg-dark text-light border-military"
                      placeholder="ملاحظات (اختياري)" value={evalForm.notes}
                      onChange={e => setEvalForm({ ...evalForm, notes: e.target.value })} />
                  </div>
                  <div className="col-md-3">
                    <button type="submit" className="btn btn-sm btn-gold w-100" disabled={evalLoading}>
                      {evalLoading ? 'جاري الحفظ...' : 'حفظ التقييم'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <h5 className="text-gold mb-3">الإحصائيات حسب السيكشن</h5>
          <div className="row g-2 mb-4">
            {SECTION_KEYS.map(sk => {
              const ss = sectionStats.find(s => s.section_key === sk);
              return (
                <div key={sk} className="col-6 col-md-4 col-lg">
                  <div className="card border-military p-3 text-center">
                    <div className="small text-muted-military">{SECTION_NAMES[sk]}</div>
                    <div className="fs-3 fw-bold text-gold" style={{fontFamily:'monospace',letterSpacing:'0.08em'}}>{ss ? encNum(ss.avg_score) : '-'}</div>
                    <div className="small text-muted-military" style={{fontFamily:'monospace',letterSpacing:'0.08em'}}>{ss ? encNum(ss.eval_count) : encNum(0)} تقييم</div>
                    {ss && <div className="small text-muted-military" style={{fontFamily:'monospace',letterSpacing:'0.08em'}}>الأعلى: {encNum(ss.max_score)} | الأدنى: {encNum(ss.min_score)}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress Chart */}
          {evaluations.length >= 2 && (() => {
            const colors = { general: '#4CAF50', fitness: '#2196F3', shooting: '#FF9800', discipline: '#9C27B0', specialties: '#FFD700' };
            const barData = SECTION_KEYS
              .map(sk => {
                const ev = evaluations.find(e => e.section_key === sk);
                return ev ? { name: SECTION_NAMES[sk], score: Number(ev.score), color: colors[sk] } : null;
              })
              .filter(Boolean);
            return (
              <div className="card border-military p-3 mb-4" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
                <h5 className="text-gold mb-3" style={{ fontSize: 14 }}>الرسم البياني للتقدم</h5>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: 'rgba(232,224,208,0.5)', fontSize: 12, fontFamily: 'Tajawal' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'rgba(232,224,208,0.4)', fontSize: 11, fontFamily: 'Tajawal' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'rgba(10,15,7,0.92)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: 12, color: '#e8e0d0' }} />
                    <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={36}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.color + 'cc'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })()}

          {/* Recent Activity */}
          <h5 className="text-gold mb-3">آخر النشاطات</h5>
          <div className="small text-muted-military">
            {evaluations.length === 0 && distinctions.length === 0 && punishments.length === 0 ? (
              <div className="text-center p-3">لا توجد نشاطات بعد</div>
            ) : (
              [...evaluations.slice(0, 3).map(e => ({ type: 'evaluation', date: e.created_at, text: `تمييز ${SECTION_NAMES[e.section_key]} — ${e.score}`, color: 'info' })),
              ...distinctions.slice(0, 2).map(d => ({ type: 'distinction', date: d.created_at, text: `تمييز: ${d.reason}`, color: 'gold' })),
              ...punishments.slice(0, 2).map(p => ({ type: 'punishment', date: p.created_at, text: `جزاء: ${p.reason}`, color: 'danger' })),
              ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5).map((a, i) => (
                <div key={i} className={`text-${a.color} mb-1`} style={{ fontSize: '0.8rem' }}>
                  {new Date(a.date).toLocaleDateString('ar-EG')} — {a.text}
                </div>
              ))
              )}
          </div>

          {/* Leave History */}
          {leaves.length > 0 && (
            <>
              <h5 className="text-gold mb-3 mt-4">سجل الإجازات</h5>
              <div className="table-responsive">
                <table className="table table-sm table-hover border-military">
                  <thead>
                    <tr className="text-gold small">
                      <th>من</th>
                      <th>إلى</th>
                      <th>النوع</th>
                      <th>الحالة</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.slice(0, 10).map(lv => (
                      <tr key={lv.id}>
                        <td className="small">{lv.start_date ? new Date(lv.start_date).toLocaleDateString('ar-EG') : '-'}</td>
                        <td className="small">{lv.end_date ? new Date(lv.end_date).toLocaleDateString('ar-EG') : '-'}</td>
                        <td className="small">{lv.leave_type || 'عادية'}</td>
                        <td className="small">
                          <span className={`badge ${lv.status === 'completed' ? 'bg-success' : lv.status === 'active' ? 'bg-warning' : 'bg-secondary'}`}>
                            {lv.status === 'completed' ? 'مكتملة' : lv.status === 'active' ? 'نشط' : lv.status === 'cancelled' ? 'ملغاة' : lv.status}
                          </span>
                        </td>
                        <td className="small text-muted-military">{lv.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {soldier.last_leave_end && (
            <div className="small text-muted-military mt-2">
              آخر عودة من الإجازة: {new Date(soldier.last_leave_end).toLocaleDateString('ar-EG')}
            </div>
          )}
        </div>
      )}

      {/* Per-section evaluation tabs */}
      {SECTION_KEYS.map(sk => activeTab === sk && (
        <div key={sk}>
          <h5 className="text-gold mb-3">تمييزات {SECTION_NAMES[sk]}</h5>
          {evalsBySection[sk].length === 0 ? (
            <div className="text-center p-4 text-muted-military">لا توجد تمييزات في {SECTION_NAMES[sk]}</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover border-military">
                <thead>
                  <tr className="text-gold small">
                    <th>#</th>
                    <th>التاريخ</th>
                    <th>الدرجة</th>
                    <th>الدرجة العظمى</th>
                    <th>المقيّم</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {evalsBySection[sk].map((e, idx) => (
                    <tr key={e.id}>
                      <td className="small text-muted-military">{idx + 1}</td>
                      <td className="small">{new Date(e.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td><ScoreBadge score={e.score} /></td>
                      <td className="small">{e.max_score || 100}</td>
                      <td className="small">{e.evaluated_by_name || '-'}</td>
                      <td className="small">{e.notes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Section stats */}
          {(() => {
            const ss = sectionStats.find(s => s.section_key === sk);
            if (!ss) return null;
            return (
              <div className="row g-2 mt-2">
                <div className="col-4">
                  <div className="card border-military p-2 text-center">
                    <div className="small text-muted-military">المتوسط</div>
                    <div className="fw-bold text-gold">{ss.avg_score}</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="card border-military p-2 text-center">
                    <div className="small text-muted-military">الأعلى</div>
                    <div className="fw-bold text-success">{ss.max_score}</div>
                  </div>
                </div>
                <div className="col-4">
                  <div className="card border-military p-2 text-center">
                    <div className="small text-muted-military">الأدنى</div>
                    <div className="fw-bold text-danger">{ss.min_score}</div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ))}

      {/* Distinctions Tab */}
      {activeTab === 'distinctions' && (
        <div>
          <h5 className="text-gold mb-3">التمييزات</h5>
          {distinctions.length === 0 ? (
            <div className="text-center p-4 text-muted-military">لا توجد تمييزات</div>
          ) : (
            distinctions.map(d => (
              <div key={d.id} className={`card border-military p-3 mb-2 ${d.is_confirmed ? 'border-gold-glow' : ''}`}>
                <div className="d-flex justify-content-between align-items-start">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: ACTION_COLORS[d.color] || '#FFD700' }} />
                      <span className="fw-bold small">{d.reason}</span>
                      {d.is_confirmed && (
                        <span className="badge bg-gold text-dark" style={{ fontSize: '0.55rem' }}>✓ مؤكد ({d.confirmation_count})</span>
                      )}
                    </div>
                    <div className="small text-muted-military">
                      {SECTION_NAMES[d.section_key] || d.section_key}
                      {d.specialty_name && ` - ${d.specialty_name}`}
                    </div>
                    <div className="small text-muted-military mt-1">
                      بواسطة: {d.given_by_name || '-'} | {new Date(d.created_at).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                  <div className="d-flex gap-1">
                    {d.given_by !== user?.id && d.is_confirmed !== true && canConfirm() && (
                      <button className="btn btn-sm btn-outline-gold py-0 px-1"
                        onClick={() => handleConfirmDistinction(d.id)}
                        title="تأكيد التمييز">✓</button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Punishments Tab */}
      {activeTab === 'punishments' && (
        <div>
          <h5 className="text-gold mb-3">الجزاءات</h5>
          {punishments.length === 0 ? (
            <div className="text-center p-4 text-muted-military">لا توجد جزاءات</div>
          ) : (
            punishments.map(p => (
              <div key={p.id} className="card border-military p-3 mb-2">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: ACTION_COLORS[p.color] || '#F44336' }} />
                      <span className="fw-bold small">{p.reason}</span>
                    </div>
                    <div className="small text-muted-military">
                      {SECTION_NAMES[p.section_key] || p.section_key}
                      {p.specialty_name && ` - ${p.specialty_name}`}
                    </div>
                    <div className="small text-muted-military mt-1">
                      بواسطة: {p.given_by_name || '-'} | {new Date(p.created_at).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Test Results Tab */}
      {activeTab === 'test-results' && (() => {
        console.log('[TEST-RESULTS-RENDER] testLoading:', testLoading, 'testSessions.length:', testSessions.length, 'testLoaded:', testLoaded, 'activeTab:', activeTab);
        return (
        <div>
          <h5 className="text-gold mb-3">نتائج الاختبارات</h5>
          {testLoading ? (
            <div className="text-center p-4 text-muted-military">جاري التحميل...</div>
          ) : testSessions.length === 0 ? (
            <div className="text-center p-4 text-muted-military">لا توجد نتائج اختبارات مسجلة لهذا الفرد</div>
          ) : (() => {
            const SESSION_TYPE_NAMES = { cabin: 'كابينة', theory: 'نظري', fitness: 'لياقة' };
            const SESSION_TYPE_COLORS = { cabin: '#FFD700', theory: '#2196F3', fitness: '#4CAF50' };
            const grouped = {};
            testSessions.forEach(s => {
              const t = s.session_type;
              if (!grouped[t]) grouped[t] = [];
              grouped[t].push(s);
            });
            return Object.entries(grouped).map(([type, sessions]) => (
              <div key={type} className="mb-4">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: SESSION_TYPE_COLORS[type] || '#888' }} />
                  <h6 className="text-gold mb-0">{SESSION_TYPE_NAMES[type] || type}</h6>
                  <span className="badge bg-dark border border-military">{sessions.length} اختبار</span>
                </div>
                <div className="table-responsive">
                  <table className="table table-sm table-hover border-military">
                    <thead>
                      <tr className="text-gold small">
                        <th>#</th>
                        <th>التاريخ</th>
                        <th>التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s, idx) => (
                        <tr key={s.id}>
                          <td className="small text-muted-military">{idx + 1}</td>
                          <td className="small">
                            {s.assessment_date ? new Date(s.assessment_date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                          </td>
                          <td>
                            <div className="d-flex flex-wrap gap-2">
                              {Object.entries(s.values || {}).map(([key, val]) => (
                                <span key={key} className="badge bg-dark border border-military">
                                  {key}: <span className="text-gold">{val}</span>
                                </span>
                              ))}
                              {Object.keys(s.values || {}).length === 0 && (
                                <span className="small text-muted-military">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ));
          })()}
        </div>
        );
      })()}
    </div>
  );
}
