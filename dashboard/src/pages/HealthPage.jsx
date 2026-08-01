import { useState, useEffect } from 'react';
import { api } from '../api';

export default function HealthPage({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getHealthOverview();
      setData(res);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  if (user?.role !== 'commander') return null;
  if (loading) return <div className="text-center p-5 text-muted-military">جاري التحميل...</div>;
  if (err) return <div className="alert alert-danger">{err}</div>;

  const d = data;

  const statCard = (label, value, color = 'text-gold') => (
    <div className="col-6 col-md-3 mb-3">
      <div className="card bg-dark border-military h-100">
        <div className="card-body text-center">
          <div className={`display-6 fw-bold ${color}`}>{value}</div>
          <div className="text-muted-military small">{label}</div>
        </div>
      </div>
    </div>
  );

  const row = (label, value, ok = null) => (
    <tr>
      <td className="small">{label}</td>
      <td className="small">
        <span className={ok === null ? 'text-gold' : ok ? 'text-success' : 'text-danger'}>{value}</span>
      </td>
    </tr>
  );

  return (
    <div dir="rtl">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="text-gold mb-0">مراقب الصحة</h4>
        <button className="btn btn-sm btn-outline-military" onClick={load}>تحديث</button>
      </div>

      <div className="row">
        {statCard('الأفراد', d.counts?.soldiers ?? 0)}
        {statCard('جلسات الاختبار', d.counts?.sessions ?? 0)}
        {statCard('الدرجات', d.counts?.values ?? 0)}
        {statCard('التخصصات', d.counts?.specialties ?? 0)}
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card bg-dark border-military h-100">
            <div className="card-header border-military text-gold small">حالة قاعدة البيانات</div>
            <div className="card-body p-0">
              <table className="table table-sm border-military mb-0">
                <tbody>
                  {row('اتصال قاعدة البيانات', d.database === 'ok' ? 'سليم' : 'معطل', d.database === 'ok')}
                  {row('أفراد بدون رتبة', d.nulls?.no_rank ?? 0, (d.nulls?.no_rank ?? 0) === 0)}
                  {row('أفراد بدون تخصص', d.nulls?.no_specialty ?? 0, (d.nulls?.no_specialty ?? 0) === 0)}
                  {row('أفراد بدون رقم عسكري', d.nulls?.no_military_id ?? 0, (d.nulls?.no_military_id ?? 0) === 0)}
                  {row('جلسات يتيمة (بلا فرد)', d.orphans?.orphan_sessions ?? 0, (d.orphans?.orphan_sessions ?? 0) === 0)}
                  {row('درجات يتيمة (بلا جلسة)', d.orphans?.orphan_values ?? 0, (d.orphans?.orphan_values ?? 0) === 0)}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card bg-dark border-military h-100">
            <div className="card-header border-military text-gold small">التكرارات (نفس الرقم العسكري)</div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm border-military mb-0">
                  <thead>
                    <tr className="text-muted-military small"><th>الرقم العسكري</th><th>العدد</th></tr>
                  </thead>
                  <tbody>
                    {(d.duplicates?.by_military_id || []).map((r, i) => (
                      <tr key={i}>
                        <td className="small" dir="ltr">{r.military_id}</td>
                        <td className="small text-danger">{r.cnt}</td>
                      </tr>
                    ))}
                    {(d.duplicates?.by_military_id || []).length === 0 && (
                      <tr><td colSpan="2" className="text-center text-muted-military small py-3">لا توجد تكرارات</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-dark border-military mt-3">
        <div className="card-header border-military text-gold small">آخر عمليات الاستيراد</div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-sm border-military mb-0">
              <thead>
                <tr className="text-muted-military small">
                  <th>الملف</th><th>الوقت</th><th>الجلسات</th><th>الأفراد الجدد</th><th>أخطاء</th><th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {(d.importLogs || []).map(log => (
                  <tr key={log.id}>
                    <td className="small">{log.filename}</td>
                    <td className="small">{log.created_at ? new Date(log.created_at).toLocaleString('ar-EG') : '-'}</td>
                    <td className="small">{log.sessions_inserted} +{log.sessions_updated}</td>
                    <td className="small">{log.employees_detected}</td>
                    <td className="small text-danger">{log.validation_errors}</td>
                    <td className="small">{log.status === 'success' ? <span className="text-success">نجاح</span> : <span className="text-danger">فشل</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
