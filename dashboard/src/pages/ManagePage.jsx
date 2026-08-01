import { useState, useEffect } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';

const TABS = [
  { key: 'specialties', label: 'التخصصات' },
  { key: 'weapons', label: 'الأسلحة' },
  { key: 'ranks', label: 'الرتب' },
  { key: 'rankTypes', label: 'أنواع الرتب' },
];

export default function ManagePage({ user }) {
  const [activeTab, setActiveTab] = useState('specialties');
  const [clearConfirm, setClearConfirm] = useState(false);

  if (user?.role !== 'commander') return null;

  async function handleClearAll() {
    if (!clearConfirm) { setClearConfirm(true); return; }
    if (!confirm('هل أنت متأكد من حذف جميع البيانات؟ لن تتمكن من التراجع!')) return;
    try {
      await api.clearAll();
      setClearConfirm(false);
      window.location.reload();
    } catch (e) { alert('خطأ: ' + e.message); }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="text-gold mb-0">الإدارة</h4>
        <button onClick={handleClearAll}
          className={`btn btn-sm ${clearConfirm ? 'btn-danger' : 'btn-outline-danger'}`}>
          {clearConfirm ? '⚠️ تأكيد الحذف الكامل' : '🗑️ حذف كل البيانات'}
        </button>
      </div>
      {clearConfirm && (
        <p style={{ fontSize: 11, color: '#ff6b6b', marginBottom: 12 }}>
          سيتم حذف جميع الأفراد والبيانات. اضغط مرة أخرى للتأكيد.
        </p>
      )}

      <ul className="nav nav-tabs mb-3">
        {TABS.map(t => (
          <li key={t.key} className="nav-item">
            <button className={`nav-link ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
              style={{ color: activeTab === t.key ? 'var(--military-gold-bright)' : 'var(--military-text-muted)' }}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'specialties' && <SpecialtiesManager />}
      {activeTab === 'weapons' && <WeaponsManager />}
      {activeTab === 'ranks' && <RanksManager />}
      {activeTab === 'rankTypes' && <RankTypesManager />}
    </div>
  );
}

/* ─── Specialties ─── */
function SpecialtiesManager() {
  const [items, setItems] = useState([]);
  const [weapons, setWeapons] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const [sp, wp] = await Promise.all([api.getSpecialties(), api.getWeapons()]);
      setItems(sp);
      setWeapons(wp);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm('حذف التخصص؟')) return;
    await api.deleteSpecialty(id);
    load();
  }

  if (loading) return <div className="text-center p-3 text-muted-military">جاري التحميل...</div>;
  return (
    <div>
      <button onClick={() => setShowForm({})} className="btn btn-gold btn-sm mb-2">+ إضافة تخصص</button>
      <div className="table-responsive">
        <table className="table table-sm table-hover border-military">
          <thead><tr className="text-gold small"><th>الاسم</th><th>السلاح</th><th>العدد</th><th></th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td className="small">{i.name}</td>
                <td className="small text-muted-military">{weapons.find(w => w.id === i.weapon_id)?.name || '-'}</td>
                <td className="small text-muted-military">{i.soldier_count || 0}</td>
                <td className="d-flex gap-1">
                  <button className="btn btn-sm btn-outline-gold py-0 px-1" onClick={() => setShowForm(i)} title="تعديل">✏️</button>
                  <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => handleDelete(i.id)} title="حذف">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm != null && (
        <ItemForm item={showForm} fields={[
          { key: 'name', label: 'الاسم', type: 'text' },
          { key: 'weaponId', label: 'السلاح', type: 'select', options: weapons.map(w => ({ value: w.id, label: w.name })) },
          { key: 'description', label: 'الوصف', type: 'textarea' },
        ]}
          onSave={async (data) => {
            if (showForm.id) await api.updateSpecialty(showForm.id, data);
            else await api.createSpecialty(data);
          }}
          onClose={() => setShowForm(null)} onDone={load} />
      )}
    </div>
  );
}

/* ─── Weapons ─── */
function WeaponsManager() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setItems(await api.getWeapons()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm('حذف السلاح؟ سيتم حذف التخصصات المرتبطة به.')) return;
    await api.deleteWeapon(id);
    load();
  }

  if (loading) return <div className="text-center p-3 text-muted-military">جاري التحميل...</div>;
  return (
    <div>
      <button onClick={() => setShowForm({})} className="btn btn-gold btn-sm mb-2">+ إضافة سلاح</button>
      <div className="table-responsive">
        <table className="table table-sm table-hover border-military">
          <thead><tr className="text-gold small"><th>الأيقونة</th><th>الاسم</th><th></th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td className="small">{i.icon || '-'}</td>
                <td className="small">{i.name}</td>
                <td className="d-flex gap-1">
                  <button className="btn btn-sm btn-outline-gold py-0 px-1" onClick={() => setShowForm(i)} title="تعديل">✏️</button>
                  <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => handleDelete(i.id)} title="حذف">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm != null && (
        <ItemForm item={showForm} fields={[
          { key: 'name', label: 'الاسم', type: 'text' },
          { key: 'icon', label: 'الأيقونة', type: 'text' },
          { key: 'description', label: 'الوصف', type: 'textarea' },
        ]}
          onSave={async (data) => {
            if (showForm.id) await api.updateWeapon(showForm.id, data);
            else await api.createWeapon(data);
          }}
          onClose={() => setShowForm(null)} onDone={load} />
      )}
    </div>
  );
}

/* ─── Ranks ─── */
function RanksManager() {
  const [items, setItems] = useState([]);
  const [rankTypes, setRankTypes] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try {
      const [ranks, types] = await Promise.all([api.getRanks(), api.getRankTypes()]);
      setItems(ranks);
      setRankTypes(types);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm('حذف الرتبة؟')) return;
    await api.deleteRank(id);
    load();
  }

  if (loading) return <div className="text-center p-3 text-muted-military">جاري التحميل...</div>;
  return (
    <div>
      <button onClick={() => setShowForm({})} className="btn btn-gold btn-sm mb-2">+ إضافة رتبة</button>
      <div className="table-responsive">
        <table className="table table-sm table-hover border-military">
          <thead><tr className="text-gold small"><th>الاسم</th><th>النوع</th><th>الترتيب</th><th></th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td className="small">{i.name}</td>
                <td className="small" style={{ color: i.type_color || '#999' }}>{i.type_name || '-'}</td>
                <td className="small text-muted-military">{i.sort_order}</td>
                <td className="d-flex gap-1">
                  <button className="btn btn-sm btn-outline-gold py-0 px-1" onClick={() => setShowForm(i)} title="تعديل">✏️</button>
                  <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => handleDelete(i.id)} title="حذف">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm != null && (
        <ItemForm item={showForm} fields={[
          { key: 'name', label: 'الاسم', type: 'text' },
          { key: 'type_id', label: 'النوع', type: 'select', options: rankTypes.map(t => ({ value: t.id, label: t.name })) },
          { key: 'sort_order', label: 'الترتيب', type: 'text' },
        ]}
          onSave={async (data) => {
            data.sort_order = data.sort_order ? parseInt(data.sort_order) : 0;
            if (showForm.id) await api.updateRank(showForm.id, data);
            else await api.createRank(data);
          }}
          onClose={() => setShowForm(null)} onDone={load} />
      )}
    </div>
  );
}

/* ─── Rank Types ─── */
function RankTypesManager() {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { setItems(await api.getRankTypes()); } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!confirm('حذف نوع الرتبة؟')) return;
    await api.deleteRankType(id);
    load();
  }

  if (loading) return <div className="text-center p-3 text-muted-military">جاري التحميل...</div>;
  return (
    <div>
      <button onClick={() => setShowForm({})} className="btn btn-gold btn-sm mb-2">+ إضافة نوع رتبة</button>
      <div className="table-responsive">
        <table className="table table-sm table-hover border-military">
          <thead><tr className="text-gold small"><th>الاسم</th><th>اللون</th><th></th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td className="small">{i.name}</td>
                <td className="small"><span style={{ color: i.color }}>{i.color || '-'}</span></td>
                <td className="d-flex gap-1">
                  <button className="btn btn-sm btn-outline-gold py-0 px-1" onClick={() => setShowForm(i)} title="تعديل">✏️</button>
                  <button className="btn btn-sm btn-outline-danger py-0 px-1" onClick={() => handleDelete(i.id)} title="حذف">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm != null && (
        <ItemForm item={showForm} fields={[
          { key: 'name', label: 'الاسم', type: 'text' },
          { key: 'color', label: 'اللون (hex)', type: 'text' },
        ]}
          onSave={async (data) => {
            if (showForm.id) await api.updateRankType(showForm.id, data);
            else await api.createRankType(data);
          }}
          onClose={() => setShowForm(null)} onDone={load} />
      )}
    </div>
  );
}

/* ─── Generic Item Form ─── */
function ItemForm({ item, fields, onSave, onClose, onDone }) {
  const [form, setForm] = useState(() => {
    const init = {};
    fields.forEach(f => {
      if (f.key === 'weaponId' && item.weapon_id != null) init.weaponId = item.weapon_id;
      else init[f.key] = item[f.key] ?? (f.type === 'checkbox' ? true : '');
    });
    return init;
  });

  async function save() {
    try {
      await onSave(form);
      onDone();
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal onClose={onClose}>
      <h5 className="text-gold mb-3">{item.id ? 'تعديل' : 'إضافة'}</h5>
      {fields.map(f => (
        <div key={f.key} className="mb-2">
          {f.type === 'checkbox' ? (
            <div className="form-check">
              <input type="checkbox" checked={form[f.key]} onChange={e => setForm(fa => ({ ...fa, [f.key]: e.target.checked }))}
                className="form-check-input" id={`f-${f.key}`} />
              <label className="form-check-label text-light small" htmlFor={`f-${f.key}`}>{f.label}</label>
            </div>
          ) : f.type === 'textarea' ? (
            <>
              <label className="form-label small text-muted-military">{f.label}</label>
              <textarea value={form[f.key] || ''} onChange={e => setForm(fa => ({ ...fa, [f.key]: e.target.value }))}
                className="form-control bg-card text-light border-military" rows={3} />
            </>
          ) : f.type === 'select' ? (
            <>
              <label className="form-label small text-muted-military">{f.label}</label>
              <select value={form[f.key] || ''} onChange={e => setForm(fa => ({ ...fa, [f.key]: e.target.value }))}
                className="form-select bg-card text-light border-military">
                <option value="">— اختر —</option>
                {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </>
          ) : (
            <>
              <label className="form-label small text-muted-military">{f.label}</label>
              <input type="text" value={form[f.key] || ''} onChange={e => setForm(fa => ({ ...fa, [f.key]: e.target.value }))}
                className="form-control bg-card text-light border-military" />
            </>
          )}
        </div>
      ))}
      <div className="d-flex gap-2 mt-3">
        <button onClick={save} className="btn btn-gold flex-grow-1">حفظ</button>
        <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">إلغاء</button>
      </div>
    </Modal>
  );
}
