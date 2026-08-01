import { useState, useEffect } from 'react';
import { api } from '../api';

export default function MissingDataPage({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [onlyItems, setOnlyItems] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.getMissingData();
      setData(res);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  if (loading) return <div className="text-center p-5 text-muted-military">جاري التحميل...</div>;
  if (!data) return <div className="text-center p-5 text-muted-military">لا يمكن تحميل البيانات</div>;

  const items = data.items || [];
  const filtered = items.filter(m => {
    const q = filter.trim();
    const matchItem = onlyItems.length === 0 || onlyItems.includes(m.item);
    if (!matchItem) return false;
    if (!q) return true;
    return m.name.includes(q);
  });

  // Group by item for the summary chips
  const byItemEntries = Object.entries(data.byItem || {}).sort((a, b) => b[1] - a[1]);

  const qualityColor = data.qualityScore >= 80 ? '#4CAF50' : data.qualityScore >= 50 ? '#FFC107' : '#F44336';

  return (
    <div dir="rtl">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h4 className="text-gold mb-0">البيانات الناقصة</h4>
        <button className="btn btn-sm btn-outline-military" onClick={loadData}>تحديث</button>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card bg-dark border-military h-100">
            <div className="card-body text-center">
              <div className="display-6 fw-bold" style={{ color: qualityColor }}>{data.qualityScore}%</div>
              <div className="text-muted-military small">جودة البيانات</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-dark border-military h-100">
            <div className="card-body text-center">
              <div className="display-6 fw-bold text-gold">{data.totalSoldiers}</div>
              <div className="text-muted-military small">إجمالي الأفراد</div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card bg-dark border-military h-100">
            <div className="card-body text-center">
              <div className="display-6 fw-bold text-danger">{data.missingCount}</div>
              <div className="text-muted-military small">عنصر ناقص</div>
            </div>
          </div>
        </div>
      </div>

      {/* Missing item chips (dynamic) */}
      <div className="mb-3 d-flex flex-wrap gap-2">
        {byItemEntries.map(([item, count]) => {
          const active = onlyItems.includes(item);
          return (
            <button
              key={item}
              className={`btn btn-sm ${active ? 'btn-warning' : 'btn-outline-warning'}`}
              onClick={() => setOnlyItems(active ? onlyItems.filter(i => i !== item) : [...onlyItems, item])}
            >
              {item} <span className="badge bg-dark ms-1">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="card bg-dark border-military mb-4">
        <div className="card-body">
          <input
            className="form-control bg-dark border-military text-light"
            placeholder="بحث بالاسم..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="card bg-dark border-military">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover border-military mb-0">
              <thead>
                <tr className="text-gold small">
                  <th>الفرد</th>
                  <th>العنصر الناقص</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={i}>
                    <td className="small">{m.name}</td>
                    <td className="small text-warning">{m.item}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="2" className="text-center text-muted-military py-4">لا توجد عناصر مطابقة</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
