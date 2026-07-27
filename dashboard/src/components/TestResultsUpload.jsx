import { useState, useRef } from 'react';
import { api } from '../api';

const MATCH_STATUS_LABELS = {
  existing: { label: 'مطابق للقاعدة', color: '#4CAF50', icon: '✅' },
  intra_run_merge: { label: 'نفس الشخص (تاريخ آخر)', color: '#2196F3', icon: '🔄' },
  new: { label: 'فرد جديد (temp_id)', color: '#FF9800', icon: '🆕' },
  fuzzy_flagged: { label: 'شبه متطابق — مراجعة', color: '#F44336', icon: '⚠️' },
  ambiguous: { label: 'عدة مطابقات', color: '#F44336', icon: '❓' },
  no_match: { label: 'لا يوجد مطابق', color: '#9E9E9E', icon: '❌' },
};

const SPECIALTY_COLORS = {
  'FFFF0000': '#FF0000',
  'FF00B050': '#00B050',
  'FF00B0F0': '#00B0F0',
  'FFFFFF00': '#FFFF00',
};

export default function TestResultsUpload({ onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [specialtyEdits, setSpecialtyEdits] = useState({});
  const [mergeDecisions, setMergeDecisions] = useState({});
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
    setResult(null);
    setSaveResult(null);
  }

  async function handleUpload() {
    setLoading(true);
    try {
      const res = await api.importTestResults(file);
      setResult(res);
    } catch (e) {
      setResult({ success: false, error: e.message });
    }
    setLoading(false);
  }

  async function handleConfirm() {
    setSaving(true);
    try {
      const results = result.results.map(r => {
        const specialty = specialtyEdits[r.name + r.test_date] ?? r.detected_specialty;
        return { ...r, detected_specialty: specialty };
      });
      const merges = result.results
        .filter(r => r.match_status === 'fuzzy_flagged' && mergeDecisions[r.name + r.test_date] === 'merge')
        .map(r => ({ source_name: r.name, target_temp_id: r.fuzzy_candidate.temp_id }));
      const specialty_confirmations = results
        .filter(r => r.detected_specialty)
        .map(r => ({ soldier_id: r.soldier_id, temp_id: r.temp_id, specialty: r.detected_specialty }));

      const res = await api.confirmTestResults({ results, merges, specialty_confirmations });
      setSaveResult(res);
    } catch (e) {
      setSaveResult({ success: false, error: e.message });
    }
    setSaving(false);
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setSaveResult(null);
    setSpecialtyEdits({});
    setMergeDecisions({});
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!file) {
    return (
      <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-2" style={{ fontSize: 14 }}>📊 رفع نتائج الاختبارات (.xlsx)</h6>
        <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
          رفع ملف اختبارات الكبينة والنظري واللياقة البدنية. مطابقة بالأسماء + إنشاء temp_id للأفراد الجدد.
        </p>
        <input type="file" ref={fileRef} accept=".xlsx" onChange={handleFile}
          className="form-control form-control-sm bg-dark text-light border-military mb-3" style={{ fontSize: 13, direction: 'ltr' }} />
        <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.35)', lineHeight: 2 }}>
          <div>📄 الأوراق المدعومة (يتم اكتشافها تلقائياً):</div>
          <div>• <strong>اختبارات الكبينة</strong> — المهمات والمتوسط لكل تاريخ</div>
          <div>• <strong>الاختبارات النظرية</strong> — الدرجة والملاحظات + استخراج التخصص من لون الخلية</div>
          <div>• <strong>اللياقة البدنية</strong> — الضغط، العقلة، البطن، ج.م + استخراج التخصص من لون الخلية</div>
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

      {!result && !loading && (
        <div className="d-flex gap-2">
          <button onClick={handleUpload} className="btn btn-sm flex-grow-1 btn-gold">
            تحليل الملف
          </button>
          <button onClick={reset} className="btn btn-outline-secondary btn-sm">إلغاء</button>
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-gold" style={{ width: 24, height: 24 }} />
          <div className="text-muted-military small mt-2">جاري التحليل واستخراج الألوان والمطابقة...</div>
        </div>
      )}

      {result && result.error && !result.summary && (
        <div className="mb-3 p-3" style={{ background: 'rgba(244,67,54,0.1)', borderRadius: 12, fontSize: 12, color: '#ff6b6b' }}>
          ❌ {result.error}
        </div>
      )}

      {result && result.success && !saveResult && (
        <>
          {/* Summary stats */}
          <div className="d-flex gap-2 mb-3 flex-wrap" style={{ fontSize: 11 }}>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#e8e0d0' }}>
              📋 إجمالي: <strong>{result.summary.matchedExisting + result.summary.intraRunMerged + result.summary.newTempIds + result.summary.fuzzyFlagged + result.summary.noMatch}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>
              ✅ مطابق: <strong>{result.summary.matchedExisting}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(33,150,243,0.1)', color: '#2196F3' }}>
              🔄 دمج: <strong>{result.summary.intraRunMerged}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(255,152,0,0.1)', color: '#FF9800' }}>
              🆕 جديد: <strong>{result.summary.newTempIds}</strong>
            </div>
            {result.summary.fuzzyFlagged > 0 && (
              <div className="px-2 py-1 rounded" style={{ background: 'rgba(244,67,54,0.1)', color: '#F44336' }}>
                ⚠️ شبه: <strong>{result.summary.fuzzyFlagged}</strong>
              </div>
            )}
            {result.summary.noMatch > 0 && (
              <div className="px-2 py-1 rounded" style={{ background: 'rgba(158,158,158,0.1)', color: '#9E9E9E' }}>
                ❌ بدون مطابق: <strong>{result.summary.noMatch}</strong>
              </div>
            )}
          </div>

          {/* Results table */}
          <div style={{ maxHeight: 400, overflowY: 'auto', fontSize: 11 }}>
            {result.results.map((r, i) => {
              const status = MATCH_STATUS_LABELS[r.match_status] || MATCH_STATUS_LABELS.no_match;
              const specialtyKey = r.name + r.test_date;
              const displaySpecialty = specialtyEdits[specialtyKey] ?? r.detected_specialty;
              const isFuzzy = r.match_status === 'fuzzy_flagged';

              return (
                <div key={i} className="d-flex align-items-center gap-1 px-2 py-1 mb-1 rounded"
                  style={{ background: isFuzzy ? 'rgba(244,67,54,0.08)' : 'rgba(255,255,255,0.02)' }}>
                  <span style={{ minWidth: 20 }}>{status.icon}</span>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="d-flex gap-1 align-items-center" style={{ fontSize: 12, color: '#e8e0d0' }}>
                      <span style={{ fontWeight: 600 }}>{r.name}</span>
                      <span style={{ color: 'rgba(232,224,208,0.4)' }}>({r.test_type === 'theory' ? 'نظري' : r.test_type === 'cabin' ? 'كبينة' : 'لياقة'})</span>
                      <span style={{ color: 'rgba(232,224,208,0.3)' }}>{r.test_date}</span>
                    </div>
                    <div className="d-flex gap-2 align-items-center" style={{ fontSize: 10, color: 'rgba(232,224,208,0.5)' }}>
                      {r.temp_id && <span style={{ fontFamily: 'monospace' }}>{r.temp_id}</span>}
                      {r.soldier_id && <span>DB:{r.soldier_name || r.soldier_id.slice(0,8)}</span>}
                      {r.detected_color_hex && (
                        <span className="d-flex align-items-center gap-1">
                          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: SPECIALTY_COLORS[r.detected_color_hex] || '#666', border: '1px solid rgba(255,255,255,0.2)' }} />
                          {displaySpecialty}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: status.color, whiteSpace: 'nowrap' }}>{status.label}</span>
                </div>
              );
            })}
          </div>

          {/* Fuzzy merge decisions */}
          {result.summary.fuzzyFlagged > 0 && (
            <div className="mt-3 p-2" style={{ background: 'rgba(244,67,54,0.05)', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#F44336', fontWeight: 600, marginBottom: 6 }}>
                مطابقات شبه متطابقة — اختر الدمج أو الفصل:
              </div>
              {result.results.filter(r => r.match_status === 'fuzzy_flagged').map((r, i) => (
                <div key={i} className="d-flex align-items-center gap-2 mb-1" style={{ fontSize: 11 }}>
                  <span style={{ color: '#e8e0d0' }}>"{r.name}" ≈ "{r.fuzzy_candidate.name}" ({r.fuzzy_candidate.similarity}%)</span>
                  <button className={`btn btn-sm ${mergeDecisions[r.name + r.test_date] === 'merge' ? 'btn-warning' : 'btn-outline-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setMergeDecisions(prev => ({ ...prev, [r.name + r.test_date]: 'merge' }))}>
                    دمج
                  </button>
                  <button className={`btn btn-sm ${mergeDecisions[r.name + r.test_date] === 'separate' ? 'btn-info' : 'btn-outline-secondary'}`}
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => setMergeDecisions(prev => ({ ...prev, [r.name + r.test_date]: 'separate' }))}>
                    فصل
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="d-flex gap-2 mt-3">
            <button onClick={handleConfirm} className="btn btn-gold btn-sm flex-grow-1" disabled={saving}>
              {saving ? 'جاري الحفظ...' : `حفظ (${result.summary.matchedExisting + result.summary.intraRunMerged + result.summary.newTempIds} سجل)`}
            </button>
            <button onClick={reset} className="btn btn-outline-secondary btn-sm">إلغاء</button>
          </div>

          {result.warnings?.length > 0 && (
            <div style={{ fontSize: 11, color: '#F7DC6F', marginTop: 8 }}>
              ⚠️ {result.warnings.join(' — ')}
            </div>
          )}
        </>
      )}

      {saveResult && (
        <>
          {saveResult.error && (
            <div className="mb-3 p-3" style={{ background: 'rgba(244,67,54,0.1)', borderRadius: 12, fontSize: 12, color: '#ff6b6b' }}>
              ❌ {saveResult.error}
            </div>
          )}
          {saveResult.success && (
            <div className="mb-3 p-3" style={{ background: 'rgba(76,175,80,0.1)', borderRadius: 12, fontSize: 12, color: '#4CAF50' }}>
              ✅ {saveResult.message}
              {saveResult.soldiersCreated > 0 && (
                <div style={{ marginTop: 4 }}>تم إنشاء {saveResult.soldiersCreated} فرد جديد بـ temp_id</div>
              )}
            </div>
          )}

          <div className="d-flex gap-2 mt-3">
            {onDone && (
              <button onClick={onDone} className="btn btn-gold btn-sm flex-grow-1">تم ✓</button>
            )}
            <button onClick={reset} className="btn btn-outline-secondary btn-sm flex-grow-1">رفع ملف آخر</button>
          </div>
        </>
      )}
    </div>
  );
}
