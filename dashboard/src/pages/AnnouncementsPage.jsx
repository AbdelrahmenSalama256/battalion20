import { useState, useEffect } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

export default function AnnouncementsPage({ user }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(null);

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

      {loading ? (
        <div className="text-center p-4 text-muted-military">جاري التحميل...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center p-4 text-muted-military">لا توجد إعلانات</div>
      ) : (
        <div className="row g-2">
          {announcements.map(a => {
            const ps = priorityStyles[a.priority] || priorityStyles.normal;
            return (
              <div key={a.id} className="col-12">
                <div className="card border-military p-3">
                  <div className="d-flex justify-content-between align-items-start">
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
            );
          })}
        </div>
      )}

      {showForm != null && (
        <AnnouncementForm announcement={showForm}
          onClose={() => setShowForm(null)} onSaved={load} />
      )}
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
