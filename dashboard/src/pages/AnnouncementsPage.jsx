import { useState, useEffect } from 'react';
import { api } from '../api';
import { smartMatch } from '../utils/translit';
import Modal from '../components/Modal';
import BulkDeleteBar from '../components/BulkDeleteBar';

export default function AnnouncementsPage({ user }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getAnnouncements();
      setAnnouncements(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const canManage = user?.role === 'commander';

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(a => a.id)));
  }

  async function handleBulkDelete(ids) {
    await api.bulkDeleteAnnouncements(ids);
    setSelectedIds(new Set());
    load();
  }

  const filtered = announcements.filter(a =>
    !search || a.title?.includes(search) || a.body?.includes(search)
  );

  const priorityStyles = {
    urgent: { bg: 'bg-danger', label: 'عاجل' },
    normal: { bg: 'bg-primary', label: 'عادي' },
    info: { bg: 'bg-secondary', label: 'منخفض' },
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="text-gold mb-0">الإعلانات</h4>
        {canManage && (
          <button onClick={() => setShowForm({})} className="btn btn-gold btn-sm">+ إضافة إعلان</button>
        )}
      </div>

      <div className="mb-3">
        <input placeholder="بحث في الإعلانات..." value={search} onChange={e => setSearch(e.target.value)}
          className="form-control form-control-sm bg-dark text-light border-military" style={{ maxWidth: 250, fontSize: 12 }} />
      </div>

      {canManage && filtered.length > 0 && (
        <div className="mb-3">
          <label className="d-flex align-items-center gap-1 small text-muted-military" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
              onChange={toggleSelectAll} style={{ accentColor: 'var(--military-gold-bright)' }} />
            تحديد الكل
          </label>
        </div>
      )}

      {loading ? (
        <div className="text-center p-4 text-muted-military">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center p-4 text-muted-military">{search ? 'لا توجد نتائج' : 'لا توجد إعلانات'}</div>
      ) : (
        <div className="row g-2">
          {filtered.map(a => {
            const ps = priorityStyles[a.priority] || priorityStyles.normal;
            return (
              <div key={a.id} className="col-12">
                <div className={`card border-military p-3 ${selectedIds.has(a.id) ? 'border-gold' : ''}`}>
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="d-flex gap-2 flex-grow-1">
                      {canManage && (
                        <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)}
                          style={{ accentColor: 'var(--military-gold-bright)', marginTop: 4, flexShrink: 0 }} />
                      )}
                      <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 mb-1">
                        <h6 className="text-gold mb-0">{a.title}</h6>
                        <span className={`badge ${ps.bg}`} style={{ fontSize: '0.6rem' }}>{ps.label}</span>
                      </div>
                      <p className="small text-light mb-1" style={{ whiteSpace: 'pre-wrap' }}>{a.body || a.content}</p>
                      <div className="small text-muted-military">
                        بواسطة: {a.created_by_name || '-'} | {new Date(a.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {canManage && (
                      <div className="d-flex gap-1 me-2">
                        <button className="btn btn-sm btn-outline-gold py-0 px-1"
                          onClick={() => setShowForm(a)} title="تعديل">✏️</button>
                        <button className="btn btn-sm btn-outline-danger py-0 px-1"
                          onClick={async () => { if (confirm('حذف الإعلان?')) { await api.deleteAnnouncement(a.id); load(); } }} title="حذف">🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showForm != null && (
        <AnnouncementForm announcement={showForm}
          onClose={() => setShowForm(null)} onSaved={load} />
      )}

      <BulkDeleteBar selectedIds={selectedIds} onDelete={handleBulkDelete} label="إعلان" />
    </div>
  );
}

function AnnouncementForm({ announcement, onClose, onSaved }) {
  const [title, setTitle] = useState(announcement.title || '');
  const [body, setBody] = useState(announcement.body || announcement.content || '');
  const [priority, setPriority] = useState(announcement.priority || 'normal');

  async function save() {
    try {
      const data = { title, body, priority };
      if (announcement.id) {
        await api.updateAnnouncement(announcement.id, data);
      } else {
        await api.createAnnouncement(data);
      }
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal onClose={onClose}>
      <h5 className="text-gold mb-3">{announcement.id ? 'تعديل إعلان' : 'إضافة إعلان'}</h5>
      <input placeholder="العنوان" value={title} onChange={e => setTitle(e.target.value)}
        className="form-control bg-card text-light border-military mb-2" />
      <textarea placeholder="المحتوى" value={body} onChange={e => setBody(e.target.value)}
        className="form-control bg-card text-light border-military mb-2" rows={5} />
      <select value={priority} onChange={e => setPriority(e.target.value)}
        className="form-select bg-card text-light border-military mb-3">
        <option value="urgent">عاجل</option>
        <option value="normal">عادي</option>
        <option value="info">منخفض</option>
      </select>
      <div className="d-flex gap-2">
        <button onClick={save} disabled={!title || !body} className="btn btn-gold flex-grow-1">نشر</button>
        <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">إلغاء</button>
      </div>
    </Modal>
  );
}
