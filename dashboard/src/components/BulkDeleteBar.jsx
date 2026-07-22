import { useState } from 'react';

export default function BulkDeleteBar({ selectedIds, onDelete, label = 'عناصر' }) {
  const [loading, setLoading] = useState(false);
  const count = selectedIds.size;
  if (count === 0) return null;

  async function handleDelete() {
    if (!confirm(`هل أنت متأكد من حذف ${count} ${label}؟`)) return;
    setLoading(true);
    try {
      await onDelete([...selectedIds]);
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
    setLoading(false);
  }

  return (
    <div className="position-fixed bottom-0 start-0 end-0 d-flex justify-content-center pb-3" style={{ zIndex: 1050 }}>
      <div className="card border-gold shadow-lg d-flex flex-row align-items-center gap-3 px-4 py-2" style={{ background: '#1a1a2e' }}>
        <span className="text-gold fw-bold small">{count} محدد</span>
        <button onClick={handleDelete} disabled={loading} className="btn btn-sm btn-danger">
          {loading ? 'جاري...' : `🗑️ حذف المحدد`}
        </button>
      </div>
    </div>
  );
}
