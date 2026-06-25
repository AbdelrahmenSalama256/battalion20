import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import ScoreBadge from '../components/ScoreBadge';

export default function SpecialtyDetailPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSpecialty();
  }, [id]);

  async function loadSpecialty() {
    setLoading(true);
    try {
      const data = await api.getSpecialty(id);
      setSpecialty(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return <div className="text-center p-5 text-muted-military">جاري التحميل...</div>;
  if (!specialty) return <div className="text-center p-5 text-muted-military">التخصص غير موجود</div>;

  const soldiers = specialty.soldiers || [];
  const stats = specialty.stats || {};

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h4 className="text-gold mb-0">🎯 {specialty.name}</h4>
          <div className="small text-muted-military">{specialty.description || ''}</div>
        </div>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/sections/specialties')}>
          رجوع
        </button>
      </div>

      {/* Stats */}
      <div className="row g-2 mb-4">
        <div className="col-6 col-md-3">
          <div className="card border-military p-3 text-center">
            <div className="small text-muted-military">متوسط النجاح</div>
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
      </div>

      {/* Soldiers table */}
      <h5 className="text-gold mb-3">الأفراد في هذا التخصص</h5>
      <div className="table-responsive">
        <table className="table table-sm table-hover border-military">
          <thead>
            <tr className="text-gold small">
              <th>الرتبة</th>
              <th>الاسم</th>
              <th>الحالة</th>
              <th>متوسط الدرجة</th>
              <th>عدد التمييزات</th>
              <th>تاريخ الإضافة</th>
            </tr>
          </thead>
          <tbody>
            {soldiers.map(s => (
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
                <td>{s.avg_score != null ? <ScoreBadge score={s.avg_score} /> : '-'}</td>
                <td className="small">{s.eval_count || 0}</td>
                <td className="small">{s.assigned_at ? new Date(s.assigned_at).toLocaleDateString('ar-EG') : '-'}</td>
              </tr>
            ))}
            {soldiers.length === 0 && (
              <tr><td colSpan={6} className="text-center text-muted-military small py-3">لا يوجد أفراد في هذا التخصص</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
