import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import ScoreBadge from '../components/ScoreBadge';

const SECTION_META = {
  specialties: { icon: '🎯', name: 'التخصصات' },
  general: { icon: '📋', name: 'العام' },
  fitness: { icon: '💪', name: 'اللياقة' },
  shooting: { icon: '🔫', name: 'الرماية' },
  discipline: { icon: '🎖️', name: 'الانضباط' },
};

export default function SectionDetailPage({ user, specialties, soldiers }) {
  const { key } = useParams();
  const navigate = useNavigate();
  const meta = SECTION_META[key] || {};
  const [stats, setStats] = useState(null);
  const [sectionSoldiers, setSectionSoldiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSpecialty, setShowAddSpecialty] = useState(false);
  const [newSpec, setNewSpec] = useState({ name: '', weaponId: '' });
  const [weapons, setWeapons] = useState([]);

  useEffect(() => {
    loadData();
  }, [key]);

  async function loadData() {
    setLoading(true);
    try {
      if (key === 'specialties') {
        // For specialties, show the list of specialties
        setSectionSoldiers([]);
        setStats(null);
      } else {
        // For other sections, get stats and soldiers with evaluations
        const s = await api.getSectionStats(key).catch(() => ({}));
        setStats(s);

        // Get soldiers with their evaluations in this section
        const allSoldiers = await api.getSoldiers({}).catch(() => []);
        const withScores = await Promise.all(
          allSoldiers.map(async (soldier) => {
            try {
              const evals = await api.getSoldierEvaluations(soldier.id, { section_key: key });
              const avgScore = evals.length > 0
                ? Math.round(evals.reduce((sum, e) => sum + Number(e.score), 0) / evals.length)
                : null;
              return { ...soldier, avgScore, evalCount: evals.length, lastEval: evals[0] || null };
            } catch {
              return { ...soldier, avgScore: null, evalCount: 0, lastEval: null };
            }
          })
        );
        setSectionSoldiers(withScores);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return <div className="text-center p-5 text-muted-military">جاري التحميل...</div>;

  // Specialties section - show list of specialties
  if (key === 'specialties') {
    return (
      <div>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h4 className="text-gold mb-0">{meta.icon} {meta.name}</h4>
          {user?.role === 'commander' && (
            <button onClick={() => { setShowAddSpecialty(true); api.getWeapons().then(setWeapons).catch(() => {}); }} className="btn btn-gold btn-sm">+ إضافة تخصص</button>
          )}
        </div>
        <div className="row g-2">
          {specialties.map(sp => (
            <div key={sp.id} className="col-12 col-md-6 col-lg-4">
              <div className="card border-military p-3 soldier-card" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/sections/specialties/${sp.id}`)}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <div className="fw-bold text-gold">{sp.name}</div>
                    <div className="small text-muted-military">{sp.soldier_count || 0} فرد</div>
                  </div>
                  <span className="fs-4">🎯</span>
                </div>
              </div>
            </div>
          ))}
          {specialties.length === 0 && (
            <div className="col-12 text-center text-muted-military p-4">لا توجد تخصصات</div>
          )}
        </div>
        {showAddSpecialty && (
          <div className="modal-overlay" onClick={() => setShowAddSpecialty(false)}>
            <div className="modal-content p-4" onClick={e => e.stopPropagation()} style={{maxWidth:'400px',margin:'auto'}}>
              <h5 className="text-gold mb-3">إضافة تخصص جديد</h5>
              <div className="mb-2">
                <label className="small text-muted-military">اسم التخصص</label>
                <input className="form-control form-control-sm bg-dark text-light border-military" value={newSpec.name} onChange={e => setNewSpec({...newSpec,name:e.target.value})} />
              </div>
              <div className="mb-3">
                <label className="small text-muted-military">السلاح</label>
                <select className="form-select form-select-sm bg-dark text-light border-military" value={newSpec.weaponId} onChange={e => setNewSpec({...newSpec,weaponId:e.target.value})}>
                  <option value="">بدون سلاح</option>
                  {weapons.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-gold btn-sm flex-grow-1" onClick={async () => {
                  if (!newSpec.name) return;
                  try {
                    await api.createSpecialty({ name: newSpec.name, weaponId: newSpec.weaponId || null });
                    setShowAddSpecialty(false);
                    setNewSpec({ name: '', weaponId: '' });
                    window.location.reload();
                  } catch(e) { alert(e.message); }
                }}>حفظ</button>
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowAddSpecialty(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Other sections - show stats and soldiers table
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="text-gold mb-0">{meta.icon} {meta.name}</h4>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="row g-2 mb-4">
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center">
              <div className="small text-muted-military">متوسط الدرجة</div>
              <div className="fs-4 fw-bold text-gold">{stats.avg_score || '-'}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center">
              <div className="small text-muted-military">عدد الأفراد</div>
              <div className="fs-4 fw-bold text-gold">{stats.total_soldiers || 0}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center">
              <div className="small text-muted-military">عدد التمييزات</div>
              <div className="fs-4 fw-bold text-gold">{stats.total_evals || 0}</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-military p-3 text-center">
              <div className="small text-muted-military">أعلى درجة</div>
              <div className="fs-4 fw-bold text-gold">{stats.max_score || '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Soldiers table */}
      <div className="table-responsive">
        <table className="table table-sm table-hover border-military">
          <thead>
            <tr className="text-gold small">
              <th>الرتبة</th>
              <th>الاسم</th>
              <th>الحالة</th>
              <th>متوسط الدرجة</th>
              <th>عدد التمييزات</th>
              <th>آخر تمييز</th>
            </tr>
          </thead>
          <tbody>
            {sectionSoldiers.map(s => (
              <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/soldiers/${s.id}`)}>
                <td>
                  <span className="badge bg-dark border border-military px-2 py-1" style={{ fontSize: '0.65rem' }}>
                    {s.rank_name || '-'}
                  </span>
                </td>
                <td className="small">{s.name}</td>
                <td>
                  <span className={`badge ${s.status === 'active' ? 'bg-success' : s.status === 'leave' ? 'bg-warning' : 'bg-info'}`}>
                    {s.status === 'active' ? 'نشط' : s.status === 'leave' ? 'إجازة' : s.status === 'mission' ? 'مأمورية' : s.status || 'نشط'}
                  </span>
                </td>
                <td>{s.avgScore != null ? <ScoreBadge score={s.avgScore} /> : '-'}</td>
                <td className="small">{s.evalCount}</td>
                <td className="small">{s.lastEval ? new Date(s.lastEval.created_at).toLocaleDateString('ar-EG') : '-'}</td>
              </tr>
            ))}
            {sectionSoldiers.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-military small py-3">لا توجد بيانات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
