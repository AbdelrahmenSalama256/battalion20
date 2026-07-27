import { useState, useRef } from 'react';
import { api } from '../api';

const TYPE_LABELS = {
  cabin: { name: 'الكبينة', icon: '🏠', color: '#C9A84C' },
  theory: { name: 'النظري', icon: '📝', color: '#4ECDC4' },
  fitness: { name: 'اللياقة', icon: '💪', color: '#45B7D1' },
};

const STATUS_LABELS = {
  confirmed: { label: 'مطابق تلقائي', color: '#4CAF50', bg: 'rgba(76,175,80,0.12)' },
  needs_review: { label: 'يحتاج مراجعة', color: '#FF9800', bg: 'rgba(255,152,0,0.12)' },
  no_match: { label: 'لا يوجد مطابق', color: '#F44336', bg: 'rgba(244,67,54,0.12)' },
};

export default function TestResultsUpload({ soldiers = [], onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [skipIds, setSkipIds] = useState(new Set());
  const [tab, setTab] = useState('needs_review');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef(null);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.endsWith('.xlsx')) {
      alert('يجب رفع ملف .xlsx فقط');
      return;
    }
    setFile(f);
    setPreview({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' });
    setParseResult(null);
    setSaveResult(null);
    setConfirmDelete(false);
    setOverrides({});
    setSkipIds(new Set());
  }

  async function handleParse() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      const res = await api.importTestResults(file);
      setParseResult(res);
      setTab(res.needsReview.length > 0 ? 'needs_review' : 'confirmed');
    } catch (e) {
      setParseResult({ success: false, error: e.message });
    }
    setLoading(false);
  }

  function toggleSkip(index) {
    setSkipIds(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function setOverride(index, soldierId) {
    setOverrides(prev => ({ ...prev, [index]: soldierId }));
  }

  async function handleSave() {
    setLoading(true);
    try {
      const toSave = [];

      for (const r of parseResult.confirmed) {
        toSave.push({
          soldier_id: r.candidates[0]?.id,
          test_date: r.test_date,
          test_type: r.test_type,
          score_details: r.score_details,
          rank_from_file: r.rank_from_file,
        });
      }

      parseResult.needsReview.forEach((r, i) => {
        const overrideId = overrides[i];
        if (overrideId) {
          toSave.push({
            soldier_id: overrideId,
            test_date: r.test_date,
            test_type: r.test_type,
            score_details: r.score_details,
            rank_from_file: r.rank_from_file,
          });
        }
      });

      if (toSave.length === 0) {
        setSaveResult({ success: false, error: 'لم تتم اختيار أي نتيجة للحفظ' });
        setLoading(false);
        return;
      }

      const res = await api.confirmTestResults(toSave);
      setSaveResult(res);
    } catch (e) {
      setSaveResult({ success: false, error: e.message });
    }
    setLoading(false);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setParseResult(null);
    setSaveResult(null);
    setOverrides({});
    setSkipIds(new Set());
    setConfirmDelete(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!file) {
    return (
      <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-2" style={{ fontSize: 14 }}>📊 رفع نتائج الاختبارات (.xlsx)</h6>
        <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
          رفع ملف اختبارات الكبينة والنظري واللياقة البدنية. يتم المطابقة بالاسم فقط (لا رقم عسكري).
        </p>
        <input type="file" ref={fileRef} accept=".xlsx" onChange={handleFile}
          className="form-control form-control-sm bg-dark text-light border-military mb-3" style={{ fontSize: 13, direction: 'ltr' }} />
        <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.35)', lineHeight: 2 }}>
          <div>📄 الأوراق المدعومة:</div>
          <div>• <strong>اختبارات الكبينة</strong> — المهمات والمتوسط لكل تاريخ</div>
          <div>• <strong>الاختبارات النظرية</strong> — الدرجة والملاحظات لكل تاريخ</div>
          <div>• <strong>اللياقة البدنية</strong> — الضغط، العقلة، البطن، ج.م</div>
          <div style={{ marginTop: 6, color: 'rgba(232,224,208,0.25)' }}>
            • يُنصح بمراجعة المطابقات التلقائية قبل الحفظ
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
      <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>📊 رفع نتائج الاختبارات</h6>

      <div className="mb-3 p-2" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: 18 }}>📄</span>
          <div>
            <div style={{ fontSize: 13, color: '#e8e0d0', fontWeight: 600 }}>{preview.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.4)' }}>{preview.size}</div>
          </div>
        </div>
      </div>

      {!parseResult && !loading && (
        <div className="d-flex gap-2">
          <button onClick={handleParse} className={`btn btn-sm flex-grow-1 ${confirmDelete ? 'btn-warning' : 'btn-gold'}`}>
            {confirmDelete ? '⚠️ تحليل الملف وتطابق الأسماء' : '🔍 تحليل الملف'}
          </button>
          <button onClick={reset} className="btn btn-outline-secondary btn-sm">إلغاء</button>
        </div>
      )}

      {confirmDelete && !parseResult && !loading && (
        <p style={{ fontSize: 11, color: '#FF9800', marginTop: 8, textAlign: 'center' }}>
          سيتم تحليل الملف وتطابق الأسماء مع قائمة الأفرادexisting
        </p>
      )}

      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-gold" style={{ width: 24, height: 24 }} />
          <div className="text-muted-military small mt-2">جاري التحليل والمطابقة...</div>
        </div>
      )}

      {parseResult && parseResult.error && (
        <div className="mb-3 p-3" style={{ background: 'rgba(244,67,54,0.1)', borderRadius: 12, fontSize: 12, color: '#ff6b6b' }}>
          ❌ {parseResult.error}
          {parseResult.errors?.length > 0 && (
            <ul style={{ margin: '4px 0', paddingRight: 16, fontSize: 11 }}>
              {parseResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {parseResult && parseResult.success && !saveResult && (
        <>
          <div className="d-flex gap-2 mb-3 flex-wrap" style={{ fontSize: 12 }}>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#e8e0d0' }}>
              📋 إجمالي: <strong>{parseResult.summary.totalParsed}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>
              ✅ مطابق: <strong>{parseResult.summary.confirmed}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(255,152,0,0.1)', color: '#FF9800' }}>
              ⚠️ مراجعة: <strong>{parseResult.summary.needsReview}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(244,67,54,0.1)', color: '#F44336' }}>
              ❌ لا يوجد: <strong>{parseResult.summary.noMatch}</strong>
            </div>
          </div>

          <ul className="nav nav-tabs mb-3" style={{ fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {parseResult.confirmed.length > 0 && (
              <li className="nav-item">
                <button className={`nav-link ${tab === 'confirmed' ? 'active' : ''}`}
                  style={{ color: tab === 'confirmed' ? '#4CAF50' : 'rgba(232,224,208,0.5)', fontSize: 12, borderBottom: tab === 'confirmed' ? '2px solid #4CAF50' : 'none', background: 'none', border: 'none' }}
                  onClick={() => setTab('confirmed')}>
                  ✅ مطابق ({parseResult.confirmed.length})
                </button>
              </li>
            )}
            {parseResult.needsReview.length > 0 && (
              <li className="nav-item">
                <button className={`nav-link ${tab === 'needs_review' ? 'active' : ''}`}
                  style={{ color: tab === 'needs_review' ? '#FF9800' : 'rgba(232,224,208,0.5)', fontSize: 12, borderBottom: tab === 'needs_review' ? '2px solid #FF9800' : 'none', background: 'none', border: 'none' }}
                  onClick={() => setTab('needs_review')}>
                  ⚠️ مراجعة ({parseResult.needsReview.length})
                </button>
              </li>
            )}
            {parseResult.noMatch.length > 0 && (
              <li className="nav-item">
                <button className={`nav-link ${tab === 'no_match' ? 'active' : ''}`}
                  style={{ color: tab === 'no_match' ? '#F44336' : 'rgba(232,224,208,0.5)', fontSize: 12, borderBottom: tab === 'no_match' ? '2px solid #F44336' : 'none', background: 'none', border: 'none' }}
                  onClick={() => setTab('no_match')}>
                  ❌ لا يوجد ({parseResult.noMatch.length})
                </button>
              </li>
            )}
          </ul>

          {tab === 'needs_review' && (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {parseResult.needsReview.map((r, i) => (
                <div key={i} className="p-2 mb-2 rounded" style={{ background: STATUS_LABELS.needs_review.bg, border: '1px solid rgba(255,152,0,0.2)' }}>
                  <div className="d-flex justify-content-between align-items-start gap-2" style={{ fontSize: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#FF9800', fontWeight: 600 }}>{r.name}</div>
                      <div style={{ color: 'rgba(232,224,208,0.5)', fontSize: 11 }}>
                        {TYPE_LABELS[r.test_type]?.icon} {TYPE_LABELS[r.test_type]?.name} — {r.test_date || 'بدون تاريخ'}
                        {r.best_similarity < 1 && <span style={{ marginLeft: 6, color: 'rgba(232,224,208,0.35)' }}>تطابق: {Math.round(r.best_similarity * 100)}%</span>}
                      </div>
                      {r.rank_from_file && <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.35)' }}>رتبة الملف: {r.rank_from_file}</div>}
                      {r.rank_warning && <div style={{ fontSize: 11, color: '#F7DC6F' }}>⚠️ {r.rank_warning}</div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {Object.entries(r.score_details).map(([k, v]) => (
                          <span key={k} className="badge bg-dark border border-military" style={{ fontSize: 10 }}>{k}: {v}</span>
                        ))}
                      </div>
                    </div>
                    <div className="d-flex gap-1 flex-column align-items-end" style={{ minWidth: 130 }}>
                      <select
                        value={overrides[i] || ''}
                        onChange={e => setOverride(i, e.target.value)}
                        className="form-select form-select-sm bg-dark text-light border-military"
                        style={{ fontSize: 11 }}>
                        <option value="">— اختر فرداً —</option>
                        {r.candidates.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({Math.round(c.similarity * 100)}%)</option>
                        ))}
                        {soldiers.filter(s => !r.candidates.some(c => c.id === s.id)).slice(0, 10).map(s => (
                          <option key={s.id} value={s.id}>...{s.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => toggleSkip(i)}
                        className={`btn btn-sm py-0 ${skipIds.has(i) ? 'btn-danger' : 'btn-outline-secondary'}`}
                        style={{ fontSize: 10 }}>
                        {skipIds.has(i) ? '⏭️ تم التخطي' : '⏭️ تخطي'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'confirmed' && (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {parseResult.confirmed.map((r, i) => (
                <div key={i} className="p-2 mb-2 rounded" style={{ background: STATUS_LABELS.confirmed.bg, border: '1px solid rgba(76,175,80,0.2)' }}>
                  <div className="d-flex justify-content-between align-items-start" style={{ fontSize: 12 }}>
                    <div>
                      <div style={{ color: '#4CAF50', fontWeight: 600 }}>{r.name}</div>
                      <div style={{ color: 'rgba(232,224,208,0.5)', fontSize: 11 }}>
                        → {r.candidates[0]?.name}
                        {TYPE_LABELS[r.test_type] && <span style={{ marginLeft: 6 }}>{TYPE_LABELS[r.test_type]?.icon} {TYPE_LABELS[r.test_type]?.name}</span>}
                        {r.test_date && <span style={{ marginLeft: 6 }}>{r.test_date}</span>}
                      </div>
                      {r.rank_warning && <div style={{ fontSize: 11, color: '#F7DC6F' }}>⚠️ {r.rank_warning}</div>}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {Object.entries(r.score_details).map(([k, v]) => (
                          <span key={k} className="badge bg-dark border border-military" style={{ fontSize: 10 }}>{k}: {v}</span>
                        ))}
                      </div>
                    </div>
                    <span style={{ color: 'rgba(232,224,208,0.3)', fontSize: 11 }}>تطابق: {Math.round(r.best_similarity * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'no_match' && (
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {parseResult.noMatch.map((r, i) => (
                <div key={i} className="p-2 mb-2 rounded" style={{ background: STATUS_LABELS.no_match.bg, border: '1px solid rgba(244,67,54,0.2)' }}>
                  <div style={{ fontSize: 12 }}>
                    <div style={{ color: '#F44336', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: 'rgba(232,224,208,0.5)', fontSize: 11 }}>
                      {TYPE_LABELS[r.test_type]?.icon} {TYPE_LABELS[r.test_type]?.name} — {r.test_date || 'بدون تاريخ'}
                      {r.rank_from_file && <span style={{ marginLeft: 6, color: 'rgba(232,224,208,0.35)' }}>رتبة: {r.rank_from_file}</span>}
                    </div>
                    {r.candidates.length > 0 && (
                      <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.35)', marginTop: 2 }}>
                        أقرب مطابق: {r.candidates[0]?.name} ({Math.round(r.candidates[0]?.similarity * 100)}%)
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="d-flex gap-2 mt-3">
            <button onClick={handleSave} disabled={loading}
              className="btn btn-sm flex-grow-1 btn-gold">
              {loading ? 'جاري الحفظ...' : `💾 حفظ ${parseResult.confirmed.length + parseResult.needsReview.filter((_, i) => overrides[i] && !skipIds.has(i)).length} نتيجة`}
            </button>
            <button onClick={reset} className="btn btn-outline-secondary btn-sm">ملف جديد</button>
          </div>
        </>
      )}

      {saveResult && (
        <div className="p-3 rounded" style={{ background: saveResult.success ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)', fontSize: 12 }}>
          {saveResult.success ? (
            <>
              <div style={{ color: '#4CAF50', fontWeight: 600, marginBottom: 4 }}>✅ {saveResult.message}</div>
              {saveResult.sessionsInserted > 0 && <div style={{ color: '#e8e0d0' }}>📊 جلسات جديدة: {saveResult.sessionsInserted}</div>}
              {saveResult.sessionsUpdated > 0 && <div style={{ color: '#e8e0d0' }}>🔄 جلسات محدثة: {saveResult.sessionsUpdated}</div>}
              {saveResult.valuesInserted > 0 && <div style={{ color: '#e8e0d0' }}>📈 قيم محفوظة: {saveResult.valuesInserted}</div>}
              {saveResult.errors?.length > 0 && (
                <div style={{ color: '#F7DC6F', marginTop: 4 }}>
                  ⚠️ {saveResult.errors.length} أخطاء:
                  {saveResult.errors.slice(0, 3).map((e, i) => <div key={i} style={{ fontSize: 11 }}>{e.error}</div>)}
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#ff6b6b' }}>❌ {saveResult.error}</div>
          )}
          <div className="d-flex gap-2 mt-3">
            {saveResult.success && onDone && (
              <button onClick={onDone} className="btn btn-gold btn-sm flex-grow-1">تم ✓</button>
            )}
            <button onClick={reset} className="btn btn-outline-secondary btn-sm flex-grow-1">رفع ملف آخر</button>
          </div>
        </div>
      )}
    </div>
  );
}
