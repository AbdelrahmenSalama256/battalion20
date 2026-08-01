import { useState, useEffect } from 'react';
import { api } from '../api';

const SHEET_TYPES = [
  { key: 'cabin', label: 'اختبارات الكبينة', icon: '🏠' },
  { key: 'theory', label: 'الاختبارات النظرية', icon: '📝' },
  { key: 'fitness', label: 'اللياقة البدنية', icon: '💪' },
];

export default function SettingsPage({ user }) {
  const [mappings, setMappings] = useState([]);
  const [sheetType, setSheetType] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id, sheet_type, color_hex, specialty_name } | new template
  const [color, setColor] = useState('#FF0000');
  const [specName, setSpecName] = useState('');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => { loadMappings(); }, []);

  async function loadMappings() {
    setLoading(true);
    try {
      const res = await api.getColorMappings(sheetType || undefined);
      setMappings(res.mappings || []);
    } catch (e) {
      setErrMsg(e.message);
    }
    setLoading(false);
  }

  function startNew() {
    setEditing({ new: true, sheet_type: sheetType || 'theory', color_hex: 'FFFF0000', specialty_name: '' });
    setColor('#FF0000');
    setSpecName('');
    setErrMsg('');
  }

  function startEdit(m) {
    setEditing({ ...m, new: false });
    setColor(m.color_hex.startsWith('FF') ? '#' + m.color_hex.slice(2) : '#' + m.color_hex);
    setSpecName(m.specialty_name || '');
    setErrMsg('');
  }

  async function save() {
    if (!editing) return;
    if (!specName.trim()) { setErrMsg('أدخل اسم التخصص'); return; }
    try {
      const hex = editing.color_hex || color;
      await api.saveColorMapping({
        sheet_type: editing.sheet_type,
        color_hex: hex,
        specialty_name: specName.trim(),
      });
      setEditing(null);
      loadMappings();
    } catch (e) { setErrMsg(e.message); }
  }

  async function remove(id) {
    if (!confirm('حذف هذه الخريطة؟')) return;
    try {
      await api.deleteColorMapping(id);
      loadMappings();
    } catch (e) { setErrMsg(e.message); }
  }

  if (user?.role !== 'commander') return null;

  const visible = sheetType ? mappings.filter(m => m.sheet_type === sheetType) : mappings;

  return (
    <div dir="rtl">
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <h4 className="text-gold mb-0">الإعدادات — توزيع الألوان على التخصصات</h4>
        <div className="d-flex gap-2">
          <select className="form-select form-select-sm bg-dark border-military text-light" style={{ width: 'auto' }}
            value={sheetType} onChange={e => { setSheetType(e.target.value); loadMappings(); }}>
            <option value="">كل الأوراق</option>
            {SHEET_TYPES.map(st => <option key={st.key} value={st.key}>{st.icon} {st.label}</option>)}
          </select>
          <button className="btn btn-sm btn-warning" onClick={startNew}>+ إضافة خريطة</button>
        </div>
      </div>

      {errMsg && <div className="alert alert-danger py-2 small">{errMsg}</div>}

      <div className="card bg-dark border-military">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover border-military mb-0">
              <thead>
                <tr className="text-gold small">
                  <th>اللون</th>
                  <th>الورقة</th>
                  <th>التخصص</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(m => (
                  <tr key={m.id}>
                    <td>
                      <span className="d-inline-block me-2" style={{ width: 24, height: 24, borderRadius: 4, background: m.color_hex.startsWith('FF') ? '#' + m.color_hex.slice(2) : '#' + m.color_hex }} />
                      <code className="small text-muted-military">{m.color_hex}</code>
                    </td>
                    <td className="small">
                      {SHEET_TYPES.find(s => s.key === m.sheet_type)?.label || m.sheet_type}
                    </td>
                    <td className="small text-gold">{m.specialty_name || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-outline-military me-2" onClick={() => startEdit(m)}>تعديل</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(m.id)}>حذف</button>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && !loading && (
                  <tr><td colSpan="4" className="text-center text-muted-military py-4">لا توجد خرائط ألوان. أضف خريطة لربط لون في الشيت بتخصص.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editing && (
        <div className="modal fade show d-block" style={{ background: 'rgba(0,0,0,.6)' }} onClick={() => setEditing(null)}>
          <div className="modal-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-content bg-dark border-military">
              <div className="modal-header border-military">
                <h6 className="modal-title text-gold">{editing.new ? 'إضافة خريطة لون' : 'تعديل خريطة لون'}</h6>
                <button className="btn-close btn-close-white" onClick={() => setEditing(null)} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label text-muted-military small">الورقة</label>
                  <select className="form-select bg-dark border-military text-light"
                    value={editing.sheet_type}
                    disabled={!editing.new}
                    onChange={e => setEditing({ ...editing, sheet_type: e.target.value })}>
                    {SHEET_TYPES.map(st => <option key={st.key} value={st.key}>{st.label}</option>)}
                  </select>
                </div>
                <div className="mb-3 d-flex align-items-end gap-3">
                  <div>
                    <label className="form-label text-muted-military small">اللون</label>
                    <input type="color" className="form-control form-control-color" style={{ width: 60, height: 38 }}
                      value={color} onChange={e => setColor(e.target.value)} />
                  </div>
                  <div className="flex-grow-1">
                    <label className="form-label text-muted-military small">كود اللون في الشيت (ARGB)</label>
                    <input className="form-control bg-dark border-military text-light" dir="ltr"
                      placeholder="FF0000" value={editing.color_hex || ''}
                      onChange={e => setEditing({ ...editing, color_hex: e.target.value.toUpperCase().replace('#', 'FF') })} />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label text-muted-military small">اسم التخصص</label>
                  <input className="form-control bg-dark border-military text-light"
                    placeholder="مثال: موجهين" value={specName} onChange={e => setSpecName(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer border-military">
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>إلغاء</button>
                <button className="btn btn-warning btn-sm" onClick={save}>حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
