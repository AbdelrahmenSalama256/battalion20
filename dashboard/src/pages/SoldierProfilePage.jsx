import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ScoreBadge from '../components/ScoreBadge';

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

  useEffect(() => { loadSoldier(); }, [id]);

  async function loadSoldier() {
    setLoading(true);
    try {
      const data = await api.getSoldier(id);
      setSoldier(data);
    } catch (e) { console.error(e); }
    setLoading(false);
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
            <div className="fs-4 fw-bold text-gold">{distinctions.length}</div>
          </div>
          <div className="text-center">
            <div className="small text-muted-military">الجزاءات</div>
            <div className="fs-4 fw-bold text-danger">{punishments.length}</div>
          </div>
          <div className="text-center">
            <div className="small text-muted-military">التمييزات</div>
            <div className="fs-4 fw-bold text-info">{evaluations.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            style={{ color: activeTab === 'overview' ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
            نظرة عامة
          </button>
        </li>
        {SECTION_KEYS.map(sk => (
          <li key={sk} className="nav-item">
            <button className={`nav-link ${activeTab === sk ? 'active' : ''}`}
              onClick={() => setActiveTab(sk)}
              style={{ color: activeTab === sk ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
              {SECTION_NAMES[sk]}
            </button>
          </li>
        ))}
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'distinctions' ? 'active' : ''}`}
            onClick={() => setActiveTab('distinctions')}
            style={{ color: activeTab === 'distinctions' ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
            التمييزات
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'punishments' ? 'active' : ''}`}
            onClick={() => setActiveTab('punishments')}
            style={{ color: activeTab === 'punishments' ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
            الجزاءات
          </button>
        </li>
      </ul>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <h5 className="text-gold mb-3">الإحصائيات حسب السيكشن</h5>
          <div className="row g-2 mb-4">
            {SECTION_KEYS.map(sk => {
              const ss = sectionStats.find(s => s.section_key === sk);
              return (
                <div key={sk} className="col-6 col-md-4 col-lg">
                  <div className="card border-military p-3 text-center">
                    <div className="small text-muted-military">{SECTION_NAMES[sk]}</div>
                    <div className="fs-3 fw-bold text-gold">{ss ? ss.avg_score : '-'}</div>
                    <div className="small text-muted-military">{ss ? ss.eval_count : 0} تمييز</div>
                    {ss && <div className="small text-muted-military">الأعلى: {ss.max_score} | الأدنى: {ss.min_score}</div>}
                  </div>
                </div>
              );
            })}
          </div>

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
    </div>
  );
}
