import { useState, useRef } from 'react';
import { api } from '../api';

const TYPE_LABELS = {
  cabin: { name: 'الكبينة', icon: '🏠', color: '#C9A84C' },
  theory: { name: 'النظري', icon: '📝', color: '#4ECDC4' },
  fitness: { name: 'اللياقة', icon: '💪', color: '#45B7D1' },
};

export default function TestResultsUpload({ onDone }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
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

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!file) {
    return (
      <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-2" style={{ fontSize: 14 }}>📊 رفع نتائج الاختبارات (.xlsx)</h6>
        <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
          رفع ملف اختبارات الكبينة والنظري واللياقة البدنية. المطابقة بالاسم فقط.
        </p>
        <input type="file" ref={fileRef} accept=".xlsx" onChange={handleFile}
          className="form-control form-control-sm bg-dark text-light border-military mb-3" style={{ fontSize: 13, direction: 'ltr' }} />
        <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.35)', lineHeight: 2 }}>
          <div>📄 الأوراق المدعومة (يتم اكتشافها تلقائياً):</div>
          <div>• <strong>اختبارات الكبينة</strong> — المهمات والمتوسط لكل تاريخ</div>
          <div>• <strong>الاختبارات النظرية</strong> — الدرجة والملاحظات لكل تاريخ</div>
          <div>• <strong>اللياقة البدنية</strong> — الضغط، العقلة، البطن، ج.م</div>
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
            رفع وحفظ تلقائي
          </button>
          <button onClick={reset} className="btn btn-outline-secondary btn-sm">إلغاء</button>
        </div>
      )}

      {loading && (
        <div className="text-center py-4">
          <div className="spinner-border text-gold" style={{ width: 24, height: 24 }} />
          <div className="text-muted-military small mt-2">جاري التحليل والمطابقة والحفظ...</div>
        </div>
      )}

      {result && result.error && !result.summary && (
        <div className="mb-3 p-3" style={{ background: 'rgba(244,67,54,0.1)', borderRadius: 12, fontSize: 12, color: '#ff6b6b' }}>
          ❌ {result.error}
        </div>
      )}

      {result && result.success && (
        <>
          <div className="d-flex gap-2 mb-3 flex-wrap" style={{ fontSize: 12 }}>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#e8e0d0' }}>
              📋 إجمالي: <strong>{result.summary.totalParsed}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(76,175,80,0.1)', color: '#4CAF50' }}>
              ✅ محفوظ: <strong>{result.summary.saved}</strong>
            </div>
            <div className="px-2 py-1 rounded" style={{ background: 'rgba(244,67,54,0.1)', color: '#F44336' }}>
              ❌ متخطى: <strong>{result.summary.skipped}</strong>
            </div>
          </div>

          {result.summary.sessionsInserted > 0 && (
            <div style={{ fontSize: 12, color: '#4CAF50', marginBottom: 8 }}>
              📊 تم إنشاء {result.summary.sessionsInserted} جلسة — {result.summary.valuesInserted} قيمة محفوظة
            </div>
          )}

          {result.skippedList?.length > 0 && (
            <div className="mb-3">
              <div style={{ fontSize: 12, color: '#F44336', fontWeight: 600, marginBottom: 6 }}>
                الأسماء المتخطاة ({result.skippedList.length}):
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {result.skippedList.map((s, i) => (
                  <div key={i} className="d-flex justify-content-between align-items-center px-2 py-1 mb-1 rounded"
                    style={{ background: 'rgba(244,67,54,0.06)', fontSize: 12 }}>
                    <span style={{ color: '#e8e0d0' }}>{s.name}</span>
                    <span style={{ color: 'rgba(232,224,208,0.4)', fontSize: 11 }}>{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.warnings?.length > 0 && (
            <div style={{ fontSize: 11, color: '#F7DC6F', marginBottom: 8 }}>
              ⚠️ {result.warnings.join(' — ')}
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
