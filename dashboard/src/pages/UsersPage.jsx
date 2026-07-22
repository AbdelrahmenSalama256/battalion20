import { useState } from 'react';
import { api } from '../api';
import Modal from '../components/Modal';
import BulkDeleteBar from '../components/BulkDeleteBar';

const ROLE_LABELS = { commander: 'قائد', officer: 'ضابط', nco: 'صف ضابط' };

const SECTION_LABELS = {
  specialties: 'التخصصات',
  general: 'العام',
  fitness: 'اللياقة',
  shooting: 'الرماية',
  discipline: 'الانضباط',
};

const PAGE_LABELS = {
  dashboard: 'الرئيسية',
  soldiers: 'الأفراد',
  notifications: 'الإشعارات',
  users: 'المستخدمين',
  profile: 'حسابي',
};

export default function UsersPage({ users, ranks, onRefresh, user }) {
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map(u => u.id)));
  }

  async function handleBulkDelete(ids) {
    await api.bulkDeleteUsers(ids);
    setSelectedIds(new Set());
    onRefresh?.();
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="text-gold mb-0">المستخدمين</h4>
        <button onClick={() => setShowForm(true)} className="btn btn-gold btn-sm">+ إضافة مستخدم</button>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-hover border-military">
          <thead>
            <tr className="text-gold small">
              {user?.role === 'commander' && <th style={{ width: 30 }}>
                <input type="checkbox" checked={users.length > 0 && selectedIds.size === users.length}
                  onChange={toggleSelectAll} style={{ accentColor: 'var(--military-gold-bright)' }} />
              </th>}
              <th>#</th>
              <th>الاسم</th>
              <th>اسم المستخدم</th>
              <th>الدور</th>
              <th>الرتبة</th>
              <th>الحالة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={u.is_active ? '' : 'opacity-50'}>
                {user?.role === 'commander' && <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleSelect(u.id)}
                    style={{ accentColor: 'var(--military-gold-bright)' }} />
                </td>}
                <td className="small">{i + 1}</td>
                <td className="small">{u.name}</td>
                <td className="small">{u.username}</td>
                <td className="small">
                  <span className="badge bg-dark border border-military">{ROLE_LABELS[u.role] || u.role}</span>
                </td>
                <td className="small">{u.rank_name || '-'}</td>
                <td className="small">{u.is_active ? '🟢 نشط' : '🔴 معطل'}</td>
                <td className="small">
                  {user?.role === 'commander' && (
                    <div className="d-flex gap-1">
                      <button onClick={() => setEditUser(u)} className="btn btn-sm btn-outline-gold py-0" style={{ fontSize: '0.65rem' }} title="تعديل">✏️</button>
                      <button onClick={() => { const p = prompt('كلمة المرور الجديدة'); if (p) api.updateUserPassword(u.id, p).then(() => onRefresh()).catch(e => alert(e.message)); }} className="btn btn-sm btn-outline-gold py-0" style={{ fontSize: '0.65rem' }} title="تغيير كلمة المرور">🔑</button>
                      <button onClick={() => api.toggleUser(u.id).then(() => onRefresh()).catch(e => alert(e.message))} className="btn btn-sm btn-outline-secondary py-0" style={{ fontSize: '0.65rem' }} title={u.is_active ? 'تعطيل' : 'تفعيل'}>{u.is_active ? '🔒' : '🔓'}</button>
                      <button onClick={() => { if (confirm('حذف المستخدم؟')) api.deleteUser(u.id).then(() => onRefresh()).catch(e => alert(e.message)); }} className="btn btn-sm btn-outline-danger py-0" style={{ fontSize: '0.65rem' }} title="حذف">✕</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={8} className="text-center text-muted-military small py-3">لا توجد نتائج</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && <UserForm ranks={ranks} onClose={() => { setShowForm(false); onRefresh(); }} />}
      {editUser && <UserForm user={editUser} ranks={ranks} onClose={() => { setEditUser(null); onRefresh(); }} />}
      <BulkDeleteBar selectedIds={selectedIds} onDelete={handleBulkDelete} label="مستخدم" />
    </div>
  );
}

function UserForm({ user: editUser, ranks, onClose }) {
  const isEdit = !!editUser;
  const [name, setName] = useState(editUser?.name || '');
  const [username, setUsername] = useState(editUser?.username || '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(editUser?.role || 'officer');
  const [rankId, setRankId] = useState(editUser?.rank_id || '');

  // Permissions state
  const defaultSections = Object.keys(SECTION_LABELS);
  const [sections, setSections] = useState(editUser?.permissions?.sections || defaultSections);
  const [canEvaluate, setCanEvaluate] = useState(editUser?.permissions?.canEvaluate !== false);
  const [canDistinguish, setCanDistinguish] = useState(editUser?.permissions?.canDistinguish !== false);
  const [canPunish, setCanPunish] = useState(editUser?.permissions?.canPunish !== false);

  function toggleSection(key) {
    setSections(p => p.includes(key) ? p.filter(x => x !== key) : [...p, key]);
  }

  async function save() {
    try {
      const permissions = { sections, canEvaluate, canDistinguish, canPunish };
      if (isEdit) {
        await api.updateUser(editUser.id, { name, role, rankId: rankId || null, permissions });
      } else {
        if (!name || !username || !password) return;
        await api.createUser({ name, username, password, role, rankId: rankId || null, permissions });
      }
      onClose();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h5 className="text-gold mb-3">{isEdit ? 'تعديل مستخدم' : 'إضافة مستخدم'}</h5>

      <input placeholder="الاسم" value={name} onChange={e => setName(e.target.value)} className="form-control bg-card text-light border-military mb-2" />
      {!isEdit && <input placeholder="اسم المستخدم" value={username} onChange={e => setUsername(e.target.value)} className="form-control bg-card text-light border-military mb-2" />}
      {!isEdit && <input type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} className="form-control bg-card text-light border-military mb-2" />}

      <select value={role} onChange={e => setRole(e.target.value)} className="form-select bg-card text-light border-military mb-2">
        {['commander', 'officer', 'nco'].map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>

      <select value={rankId} onChange={e => setRankId(e.target.value)} className="form-select bg-card text-light border-military mb-2">
        <option value="">اختر الرتبة (اختياري)</option>
        {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>

      {/* Permissions */}
      <div className="card border-military p-2 mb-2">
        <h6 className="text-gold small mb-2" style={{ fontSize: '0.75rem' }}>📄 السيكشنات المتاحة</h6>
        <div className="d-flex flex-wrap gap-2">
          {Object.entries(SECTION_LABELS).map(([k, v]) => (
            <label key={k} className="d-flex align-items-center gap-1 small" style={{ fontSize: '0.7rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={sections.includes(k)} onChange={() => toggleSection(k)}
                style={{ accentColor: 'var(--military-gold-bright)' }} />
              {v}
            </label>
          ))}
        </div>
      </div>

      <div className="card border-military p-2 mb-3">
        <h6 className="text-gold small mb-2" style={{ fontSize: '0.75rem' }}>🔒 الصلاحيات</h6>
        <div className="d-flex flex-wrap gap-3">
          <label className="d-flex align-items-center gap-1 small" style={{ fontSize: '0.7rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={canEvaluate} onChange={() => setCanEvaluate(p => !p)}
              style={{ accentColor: 'var(--military-gold-bright)' }} />
            تمييز
          </label>
          <label className="d-flex align-items-center gap-1 small" style={{ fontSize: '0.7rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={canDistinguish} onChange={() => setCanDistinguish(p => !p)}
              style={{ accentColor: 'var(--military-gold-bright)' }} />
            تمييز
          </label>
          <label className="d-flex align-items-center gap-1 small" style={{ fontSize: '0.7rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={canPunish} onChange={() => setCanPunish(p => !p)}
              style={{ accentColor: 'var(--military-gold-bright)' }} />
            جزاء
          </label>
        </div>
      </div>

      <div className="d-flex gap-2">
        <button onClick={save} className="btn btn-gold flex-grow-1">{isEdit ? 'حفظ' : 'إنشاء'}</button>
        <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">إلغاء</button>
      </div>
    </Modal>
  );
}
