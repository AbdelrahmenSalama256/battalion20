import { useState, useEffect } from 'react';
import { api } from '../api';
import { smartMatch } from '../utils/translit';
import Modal from '../components/Modal';
import BulkDeleteBar from '../components/BulkDeleteBar';

const SECTION_NAMES = { general: 'عام', fitness: 'لياقة', shooting: 'رماية', discipline: 'انضباط', specialties: 'تخصص' };

export default function ExamsPage({ user, specialties }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSection, setFilterSection] = useState('');
  const [showForm, setShowForm] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => { loadExams(); }, []);

  async function loadExams() {
    setLoading(true);
    try {
      const data = await api.getExams(filterSection);
      setExams(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadExams(); }, [filterSection]);

  const canManage = user?.role === 'commander';

  const filteredExams = exams.filter(ex =>
    !search || ex.title?.includes(search) || ex.specialty_name?.includes(search)
  );

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredExams.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredExams.map(e => e.id)));
  }

  async function handleBulkDelete(ids) {
    await api.bulkDeleteExams(ids);
    setSelectedIds(new Set());
    loadExams();
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="text-gold mb-0">الامتحانات</h4>
        {canManage && (
          <button onClick={() => setShowForm({})} className="btn btn-gold btn-sm">+ إضافة امتحان</button>
        )}
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
          className="form-select bg-card text-light border-military" style={{ maxWidth: 180 }}>
          <option value="">كل السيكشنات</option>
          {Object.entries(SECTION_NAMES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {canManage && exams.length > 0 && (
          <div className="d-flex align-items-center gap-2">
            <label className="d-flex align-items-center gap-1 small text-muted-military" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={selectedIds.size === filteredExams.length && filteredExams.length > 0}
                onChange={toggleSelectAll} style={{ accentColor: 'var(--military-gold-bright)' }} />
              تحديد الكل
            </label>
          </div>
        )}
        <input placeholder="بحث في الامتحانات..." value={search} onChange={e => setSearch(e.target.value)}
          className="form-control form-control-sm bg-dark text-light border-military" style={{ maxWidth: 200, fontSize: 12 }} />
      </div>

      {loading ? (
        <div className="text-center p-4 text-muted-military">جاري التحميل...</div>
      ) : filteredExams.length === 0 ? (
        <div className="text-center p-4 text-muted-military">{search ? 'لا توجد نتائج' : 'لا توجد امتحانات'}</div>
      ) : (
        <div className="row g-2">
          {filteredExams.map(ex => (
            <div key={ex.id} className="col-12 col-md-6">
              <div className={`card border-military p-3 ${selectedIds.has(ex.id) ? 'border-gold' : ''}`}>
                <div className="d-flex justify-content-between align-items-start">
                  <div className="d-flex gap-2">
                    {canManage && (
                      <input type="checkbox" checked={selectedIds.has(ex.id)} onChange={() => toggleSelect(ex.id)}
                        style={{ accentColor: 'var(--military-gold-bright)', marginTop: 4 }} />
                    )}
                    <div>
                    <h6 className="text-gold mb-1">{ex.title}</h6>
                    <div className="small text-muted-military mb-1">
                      <span className="badge bg-dark border border-military me-1">
                        {SECTION_NAMES[ex.section_key] || ex.section_key}
                      </span>
                      {ex.specialty_name && (
                        <span className="badge bg-dark border border-military me-1">{ex.specialty_name}</span>
                      )}
                      <span className="me-2">الدرجة العظمى: {ex.max_score}</span>
                    </div>
                    {ex.focus_points?.length > 0 && (
                      <div className="mt-2">
                        <div className="small text-muted-military mb-1">نقاط التركيز:</div>
                        <ul className="small mb-0" style={{ paddingRight: 16 }}>
                          {ex.focus_points.map((fp, i) => (
                            <li key={i} className="text-muted-military">{fp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ex.notes && (
                      <div className="small text-muted-military mt-1">ملاحظات: {ex.notes}</div>
                    )}
                    <div className="small text-muted-military mt-1">
                      بواسطة: {ex.created_by_name || '-'} | {new Date(ex.created_at).toLocaleDateString('ar-EG')}
                    </div>
                  </div>
                    {canManage && (
                      <div className="d-flex gap-1">
                        <button className="btn btn-sm btn-outline-gold py-0 px-1"
                          onClick={() => setShowForm(ex)} title="تعديل">✏️</button>
                        <button className="btn btn-sm btn-outline-danger py-0 px-1"
                          onClick={async () => { if (confirm('حذف الامتحان?')) { await api.deleteExam(ex.id); loadExams(); } }} title="حذف">🗑️</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm != null && (
        <ExamForm exam={showForm} specialties={specialties}
          onClose={() => setShowForm(null)} onSaved={loadExams} />
      )}

      <BulkDeleteBar selectedIds={selectedIds} onDelete={handleBulkDelete} label="امتحان" />
    </div>
  );
}

function ExamForm({ exam, specialties, onClose, onSaved }) {
  const [title, setTitle] = useState(exam.title || '');
  const [sectionKey, setSectionKey] = useState(exam.section_key || 'general');
  const [specialtyId, setSpecialtyId] = useState(exam.specialty_id || '');
  const [focusPoints, setFocusPoints] = useState(exam.focus_points?.join('\n') || '');
  const [notes, setNotes] = useState(exam.notes || '');
  const [maxScore, setMaxScore] = useState(exam.max_score || 100);

  async function save() {
    try {
      const data = {
        title, sectionKey,
        specialtyId: specialtyId || null,
        focusPoints: focusPoints.split('\n').filter(Boolean),
        notes, maxScore: Number(maxScore),
      };
      if (exam.id) {
        await api.updateExam(exam.id, data);
      } else {
        await api.createExam(data);
      }
      onSaved();
      onClose();
    } catch (e) { alert(e.message); }
  }

  return (
    <Modal onClose={onClose}>
      <h5 className="text-gold mb-3">{exam.id ? 'تعديل امتحان' : 'إضافة امتحان'}</h5>
      <input placeholder="عنوان الامتحان" value={title} onChange={e => setTitle(e.target.value)}
        className="form-control bg-card text-light border-military mb-2" />
      <select value={sectionKey} onChange={e => setSectionKey(e.target.value)}
        className="form-select bg-card text-light border-military mb-2">
        {Object.entries(SECTION_NAMES).map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
      {sectionKey === 'specialties' && (
        <select value={specialtyId} onChange={e => setSpecialtyId(e.target.value)}
          className="form-select bg-card text-light border-military mb-2">
          <option value="">كل التخصصات</option>
          {specialties.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
        </select>
      )}
      <div className="mb-1">
        <label className="form-label small text-muted-military">نقاط التركيز (واحدة لكل سطر)</label>
        <textarea value={focusPoints} onChange={e => setFocusPoints(e.target.value)}
          className="form-control bg-card text-light border-military" rows={4}
          placeholder="سرعة التنفيذ&#10;الدقة في التصويب&#10;الالتزام بالزي" />
      </div>
      <textarea placeholder="ملاحظات إضافية" value={notes} onChange={e => setNotes(e.target.value)}
        className="form-control bg-card text-light border-military mb-2" rows={2} />
      <input type="number" placeholder="الدرجة العظمى" value={maxScore} onChange={e => setMaxScore(e.target.value)}
        className="form-control bg-card text-light border-military mb-3" />
      <div className="d-flex gap-2">
        <button onClick={save} disabled={!title} className="btn btn-gold flex-grow-1">حفظ</button>
        <button onClick={onClose} className="btn btn-outline-secondary flex-grow-1">إلغاء</button>
      </div>
    </Modal>
  );
}
