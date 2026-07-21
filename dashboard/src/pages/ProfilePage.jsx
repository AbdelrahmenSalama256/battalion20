import { useState, useEffect } from 'react';
import { api } from '../api';

export default function ProfilePage({ user, onUpdate }) {
  const [name, setName] = useState(user?.name || '');
  const [rankId, setRankId] = useState(user?.rankId || '');
  const [ranks, setRanks] = useState([]);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getRanks().then(setRanks).catch(() => {});
    setName(user?.name || '');
    setRankId(user?.rankId || '');
  }, [user]);

  async function saveProfile() {
    if (!name.trim()) return;
    setSaving(true);
    setMsg('');
    try {
      await api.updateUser(user?.id, { name, rankId });
      const me = await api.me();
      onUpdate(me);
      setMsg('✅ تم حفظ التعديلات');
    } catch (e) {
      setMsg('❌ ' + e.message);
    }
    setSaving(false);
  }

  async function changePassword() {
    if (!oldPass || !newPass) return;
    setLoading(true);
    setMsg('');
    try {
      await api.changePassword(oldPass, newPass);
      setMsg('✅ تم تغيير كلمة المرور');
      setOldPass('');
      setNewPass('');
    } catch (e) {
      setMsg('❌ ' + e.message);
    }
    setLoading(false);
  }

  return (
    <div>
      <h4 className="text-gold mb-4" style={{ fontSize: 14 }}>حسابي</h4>

      <div className="card border-military p-4 mb-3" style={{ maxWidth: 450, background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-3" style={{ fontSize: 13 }}>تعديل البيانات</h6>

        <div className="mb-2">
          <label className="form-label small text-muted-military">الاسم</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="form-control form-control-sm bg-dark text-light border-military" />
        </div>

        <div className="mb-2">
          <label className="form-label small text-muted-military">اسم المستخدم</label>
          <div className="form-control form-control-sm bg-dark text-light border-military" style={{ opacity: 0.6 }}>{user?.username}</div>
        </div>

        <div className="mb-2">
          <label className="form-label small text-muted-military">الرتبة</label>
          <select value={rankId} onChange={e => setRankId(e.target.value)}
            className="form-select form-select-sm bg-dark text-light border-military">
            <option value="">اختر الرتبة</option>
            {ranks.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        <div className="mb-2">
          <label className="form-label small text-muted-military">الدور</label>
          <div className="form-control form-control-sm bg-dark text-light border-military" style={{ opacity: 0.6 }}>
            {user?.role === 'commander' ? 'قائد' : user?.role === 'officer' ? 'ضابط' : 'صف ضابط'}
          </div>
        </div>

        {msg && <div className={`small mb-2 ${msg.includes('✅') ? 'text-success' : 'text-danger'}`}>{msg}</div>}
        <button onClick={saveProfile} disabled={saving || !name.trim()}
          className="btn btn-gold btn-sm w-100">
          {saving ? 'جاري الحفظ...' : '💾 حفظ التعديلات'}
        </button>
      </div>

      <div className="card border-military p-4" style={{ maxWidth: 450, background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-3" style={{ fontSize: 13 }}>تغيير كلمة المرور</h6>
        <input type="password" placeholder="كلمة المرور القديمة" value={oldPass} onChange={e => setOldPass(e.target.value)}
          className="form-control form-control-sm bg-dark text-light border-military mb-2" />
        <input type="password" placeholder="كلمة المرور الجديدة" value={newPass} onChange={e => setNewPass(e.target.value)}
          className="form-control form-control-sm bg-dark text-light border-military mb-2" />
        <button onClick={changePassword} disabled={loading || !oldPass || !newPass}
          className="btn btn-gold btn-sm w-100">
          {loading ? 'جاري...' : '🔑 تغيير كلمة المرور'}
        </button>
      </div>
    </div>
  );
}