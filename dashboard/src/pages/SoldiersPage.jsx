import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import Modal from '../components/Modal';
import ScoreBadge from '../components/ScoreBadge';
import ExcelUpload from '../components/ExcelUpload';
import BulkDeleteBar from '../components/BulkDeleteBar';

const STATUS_OPTIONS = [
  { value: 'active', label: 'نشط' },
  { value: 'leave', label: 'إجازة' },
  { value: 'mission', label: 'مأمورية' },
  { value: 'other', label: 'أخرى' },
];

const ACTION_COLORS = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  green: '#4CAF50',
  red: '#F44336',
  orange: '#FF9800',
  yellow: '#FFEB3B',
};

export default function SoldiersPage({ soldiers, weapons, specialties, ranks, user, onRefresh }) {
  const [search, setSearch] = useState('');
  const [weaponFilter, setWeaponFilter] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editSoldier, setEditSoldier] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const navigate = useNavigate();

  const filtered = soldiers.filter(s => {
    if (search && !s.name.includes(search) && !s.military_id?.includes(search)) return false;
    if (weaponFilter && s.weapon_id !== weaponFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    if (specialtyFilter) {
      // Check if soldier has this specialty (would need specialty data from soldier)
      // For now, skip this filter
    }
    return true;
  });

  function canGiveAction() {
    if (user?.role === 'commander') return true;
    return user?.permissions?.canDistinguish || user?.permissions?.canPunish;
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  }

  async function handleBulkDelete(ids) {
    await api.bulkDeleteSoldiers(ids);
    setSelectedIds(new Set());
    onRefresh?.();
  }

  async function handleConfirmReturn(soldier) {
    if (!window.confirm(`تأكيد عودة ${soldier.name} من الإجازة؟`)) return;
    try {
      await api.confirmReturn(soldier.id);
      onRefresh?.();
    } catch (e) {
      alert('خطأ: ' + e.message);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h4 className="text-gold mb-0">الأفراد</h4>
        <div className="d-flex gap-2">
          {user?.role === 'commander' && <button onClick={() => setShowUpload(p => !p)} className="btn btn-outline-gold btn-sm">📥 رفع Excel</button>}
          <button onClick={() => setEditSoldier({})} className="btn btn-gold btn-sm">+ إضافة فرد</button>
        </div>
      </div>
      {showUpload && (
        <div className="mb-4">
          <ExcelUpload onDone={() => { setShowUpload(false); onRefresh?.(); }} />
        </div>
      )}

      {/* Filters */}
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input placeholder="بحث بالاسم أو الرقم..." value={search} onChange={e => setSearch(e.target.value)}
          className="form-control bg-card text-light border-military" style={{ maxWidth: 300 }} />
        <select value={weaponFilter} onChange={e => setWeaponFilter(e.target.value)}
          className="form-select bg-card text-light border-military" style={{ maxWidth: 160 }}>
          <option value="">كل الأسلحة</option>
          {weapons.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
        </select>
        <select value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}
          className="form-select bg-card text-light border-military" style={{ maxWidth: 160 }}>
          <option value="">كل التخصصات</option>
          {specialties.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="form-select bg-card text-light border-military" style={{ maxWidth: 160 }}>
          <option value="">كل الحالات</option>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Desktop table */}
      <div className="table-responsive d-none d-md-block">
        <table className="table table-sm table-hover border-military">
          <thead>
            <tr className="text-gold small">
              {user?.role === 'commander' && <th style={{ width: 30 }}>
                <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={toggleSelectAll} style={{ accentColor: 'var(--military-gold-bright)' }} />
              </th>}
              <th>الرتبة</th>
              <th>الاسم</th>
              <th>السلاح</th>
              <th>الحالة</th>
              <th>متوسط الدرجة</th>
              <th>التمييزات</th>
              <th>الجزاءات</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/soldiers/${s.id}`)}>
                {user?.role === 'commander' && <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)}
                    style={{ accentColor: 'var(--military-gold-bright)' }} />
                </td>}
                <td>
                  <span className="badge bg-dark border border-military px-2 py-1" style={{ fontSize: '0.65rem' }}>
                    {s.rank_name || '-'}
                  </span>
                </td>
                <td className="small">{s.name}</td>
                <td className="small">{s.weapon_icon || ''} {s.weapon_name || '-'}</td>
                <td>
                  <span className={`badge ${s.status === 'active' ? 'bg-success' : s.status === 'leave' ? 'bg-warning' : 'bg-info'}`}>
                    {STATUS_OPTIONS.find(o => o.value === s.status)?.label || s.status || 'نشط'}
                  </span>
                  {s.status === 'leave' && canGiveAction() && (
                    <button className="btn btn-sm btn-outline-success py-0 px-1 ms-1" style={{ fontSize: '0.6rem' }}
                      title="تأكيد العودة" onClick={e => { e.stopPropagation(); handleConfirmReturn(s); }}>↩</button>
                  )}
                </td>
                <td>{s.avg_score != null ? <ScoreBadge score={s.avg_score} /> : '-'}</td>
                <td className="small">{s.distinction_count || 0}</td>
                <td className="small">{s.punishment_count || 0}</td>
                <td className="d-flex gap-1" onClick={e => e.stopPropagation()}>
                  {canGiveAction() && (
                    <>
                      <button className="btn btn-sm btn-outline-gold py-0 px-1" style={{ fontSize: '0.65rem' }}
                        onClick={() => setActionModal({ soldier: s, type: 'distinction' })} title="تمييز">⭐</button>
                      <button className="btn btn-sm btn-outline-danger py-0 px-1" style={{ fontSize: '0.65rem' }}
                        onClick={() => setActionModal({ soldier: s, type: 'punishment' })} title="جزاء">⚠️</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center text-muted-military small py-3">لا توجد نتائج</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="row g-2 d-md-none">
        {filtered.map(s => (
          <div key={s.id} className="col-6">
            <div className="card border-military p-2 text-center soldier-card" onClick={() => navigate(`/soldiers/${s.id}`)}>
              <div className="small text-gold fw-bold">{s.rank_name || 'جندي'}</div>
              <div className="small fw-bold text-truncate">{s.name}</div>
              <div className="small text-muted-military" style={{ fontSize: '0.7rem' }}>{s.weapon_icon || '👤'} {s.weapon_name || ''}</div>
              <div className="mt-1">
                <span className={`badge ${s.status === 'active' ? 'bg-success' : s.status === 'leave' ? 'bg-warning' : 'bg-info'}`} style={{ fontSize: '0.6rem' }}>
                  {STATUS_OPTIONS.find(o => o.value === s.status)?.label || 'نشط'}
                </span>
                {s.status === 'leave' && canGiveAction() && (
                  <button className="btn btn-sm btn-outline-success py-0" style={{ fontSize: '0.6rem' }}
                    title="تأكيد العودة" onClick={e => { e.stopPropagation(); handleConfirmReturn(s); }}>↩</button>
                )}
              </div>
              {canGiveAction() && (
                <div className="d-flex gap-1 justify-content-center mt-1" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-sm btn-outline-gold py-0" style={{ fontSize: '0.6rem' }}
                    onClick={() => setActionModal({ soldier: s, type: 'distinction' })}>⭐</button>
                  <button className="btn btn-sm btn-outline-danger py-0" style={{ fontSize: '0.6rem' }}
                    onClick={() => setActionModal({ soldier: s, type: 'punishment' })}>⚠️</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Soldier Form */}
      {editSoldier != null && (
        <SoldierForm soldier={editSoldier} weapons={weapons} specialties={specialties} ranks={ranks}
          onClose={() => { setEditSoldier(null); onRefresh(); }} />
      )}

      {/* Distinction/Punishment Modal */}
      {actionModal && (
        <ActionModal
          soldier={actionModal.soldier}
          type={actionModal.type}
          specialties={specialties}
          onClose={() => setActionModal(null)}
          onDone={() => { setActionModal(null); onRefresh(); }}
        />
      )}

      <BulkDeleteBar selectedIds={selectedIds} onDelete={handleBulkDelete} label="فرد" />
    </div>
  );
}

function ActionModal({ soldier, type, specialties, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [color, setColor] = useState(type === 'distinction' ? 'gold' : 'red');
  const [sectionKey, setSectionKey] = useState('general');
  const [specialtyId, setSpecialtyId] = useState('');
  const [loading, setLoading] = useState(false);

  const isDistinction = type === 'distinction';
  const title = isDistinction ? 'تمييز' : 'جزاء';
  const colors = isDistinction
    ? ['gold', 'silver', 'bronze', 'green']
    : ['red', 'orange', 'yellow'];

  async function submit() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const data = {
        soldierId: soldier.id,
        sectionKey,
        specialtyId: specialtyId || null,
        reason: reason.trim(),
        color,
      };
      if (isDistinction) {
        await api.createDistinction(data);
      } else {
        await api.createPunishment(data);
      }
      onDone();
    } catch (e) {
      alert(e.message);
    }
    setLoading(false);
  }

  return (
    <Modal onClose={onClose}>
      <h5 className="text-gold mb-3">{title}: {soldier.name}</h5>

      <div className="mb-2">
        <label className="form-label small text-muted-military">السيكشن</label>
        <select value={sectionKey} onChange={e => setSectionKey(e.target.value)}
          className="form-select bg-card text-light border-military">
          <option value="general">عام</option>
          <option value="fitness">لياقة</option>
          <option value="shooting">رماية</option>
          <option value="discipline">انضباط</option>
          <option value="specialties">تخصص</option>
        </select>
      </div>

      {sectionKey === 'specialties' && (
        <div className="mb-2">
          <label className="form-label small text-muted-military">التخصص</label>
          <select value={specialtyId} onChange={e => setSpecialtyId(e.target.value)}
            className="form-select bg-card text-light border-military">
            <option value="">اختر التخصص</option>
            {specialties.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
          </select>
        </div>
      )}

      <div className="mb-2">
        <label className="form-label small text-muted-military">السبب / التفاصيل</label>
        <textarea value={reason} onChange={e => setReason(e.target.value)}
          className="form-control bg-card text-light border-military" rows={3}
          placeholder={isDistinction ? 'مثال: تمييز في التدريب' : 'مثال: خصم يوم - تأخر عن الدوام'} />
      </div>

      <div className="mb-3">
        <label className="form-label small text-muted-military">اللون</label>
        <div className="d-flex gap-2">
          {colors.map(c => (
            <button key={c} onClick={() => setColor(c)}
              className="btn btn-sm rounded-circle"
              style={{
                width: 32, height: 32, background: ACTION_COLORS[c],
                border: color === c ? '3px solid white' : '2px solid gray',
              }} />
          ))}
        </div>
      </div>

      <div className="d-flex gap-2">
        <button onClick={submit} disabled={loading || !reason.trim()}
          className={`btn flex-grow-1 ${isDistinction ? 'btn-gold' : 'btn-danger'}`}>
          {loading ? 'جاري...' : title}
        </button>
        <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">إلغاء</button>
      </div>
    </Modal>
  );
}

function SoldierForm({ soldier, weapons, specialties, ranks, onClose }) {
  const [name, setName] = useState(soldier.name || '');
  const [mId, setMId] = useState(soldier.military_id || '');
  const [wId, setWId] = useState(soldier.weapon_id || '');
  const [rId, setRId] = useState(soldier.rank_id || '');
  const [specId, setSpecId] = useState(soldier.specialty_id || '');
  const [status, setStatus] = useState(soldier.status || 'active');
  const [statusNotes, setStatusNotes] = useState(soldier.status_notes || '');
  const [notes, setNotes] = useState(soldier.notes || '');

  async function save() {
    try {
      const payload = { name, militaryId: mId, rankId: rId, weaponId: wId, specialtyId: specId || null, status, statusNotes, notes };
      if (soldier.id) {
        await api.updateSoldier(soldier.id, payload);
      } else {
        await api.createSoldier(payload);
      }
      onClose();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h5 className="text-gold mb-3">{soldier.id ? 'تعديل فرد' : 'إضافة فرد'}</h5>
      <input placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} className="form-control bg-card text-light border-military mb-2" />
      <input placeholder="الرقم العسكري" value={mId} onChange={e => setMId(e.target.value)} className="form-control bg-card text-light border-military mb-2" />
      <select value={wId} onChange={e => setWId(e.target.value)} className="form-select bg-card text-light border-military mb-2">
        <option value="">اختر السلاح</option>
        {weapons.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
      </select>
      <select value={rId} onChange={e => setRId(e.target.value)} className="form-select bg-card text-light border-military mb-2">
        <option value="">اختر الرتبة</option>
        {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <select value={specId} onChange={e => setSpecId(e.target.value)} className="form-select bg-card text-light border-military mb-2">
        <option value="">اختر التخصص</option>
        {specialties.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
      </select>
      <select value={status} onChange={e => setStatus(e.target.value)} className="form-select bg-card text-light border-military mb-2">
        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {status !== 'active' && (
        <input placeholder="تفاصيل الحالة (مثال: إجازة مرضية)" value={statusNotes} onChange={e => setStatusNotes(e.target.value)}
          className="form-control bg-card text-light border-military mb-2" />
      )}
      <textarea placeholder="ملاحظات" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="form-control bg-card text-light border-military mb-3" />
      <div className="d-flex gap-2">
        <button onClick={save} className="btn btn-gold flex-grow-1">حفظ</button>
        <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">إلغاء</button>
      </div>
    </Modal>
  );
}
