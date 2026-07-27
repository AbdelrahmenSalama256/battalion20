import { useState, useRef } from 'react';
import { api } from '../api';

const TYPE_LABELS = {
  cabin: { name: 'اختبارات الكبينة', icon: '🏠', color: '#C9A84C' },
  theory: { name: 'الاختبارات النظرية', icon: '📝', color: '#4ECDC4' },
  fitness: { name: 'اللياقة البدنية', icon: '💪', color: '#45B7D1' },
};

export default function ExcelUpload({ onDone }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [preview, setPreview] = useState(null);
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
    setConfirmDelete(false);
  }

  async function handleUpload() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      const res = await api.uploadWorkbook(file);
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
    setConfirmDelete(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!file) {
    return (
      <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-2" style={{ fontSize: 14 }}>📥 رفع ملف اختبارات (.xlsx)</h6>
        <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
          ارفع ملف Excel يحتوي على أوراق اختبارات الكبينة والنظرية واللياقة البدنية.
        </p>
        <input type="file" ref={fileRef} accept=".xlsx" onChange={handleFile}
          className="form-control form-control-sm bg-dark text-light border-military mb-3" style={{ fontSize: 13, direction: 'ltr' }} />
        <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.35)', lineHeight: 2 }}>
          <div>📄 الأوراق المدعومة (يتم اكتشافها تلقائياً):</div>
          <div>• <strong>اختبارات الكبينة</strong> (المسلسل، الرتبة، الاسم، المهمات، المتوسط)</div>
          <div>• <strong>الاختبارات النظرية</strong> (المسلسل، الرتبة، الاسم، الدرجة، الملاحظات)</div>
          <div>• <strong>اللياقة البدنية</strong> (المسلسل، الرتبة، الاسم، الضغط، الجري، البطن، المعدية)</div>
          <div style={{ marginTop: 6, color: 'rgba(232,224,208,0.25)' }}>
            • يجب أن تحتوي على خلايا مدمجة (merged cells) تمثل تواريخ الاختبارات
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
      <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>📋 ملف محدد</h6>

      <div className="mb-3 p-2" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
        <div className="d-flex align-items-center gap-2">
          <span style={{ fontSize: 18 }}>📄</span>
          <div>
            <div style={{ fontSize: 13, color: '#e8e0d0', fontWeight: 600 }}>{preview.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.4)' }}>{preview.size}</div>
          </div>
        </div>
      </div>

      {result && (
        <div className="mb-3 mt-3 p-3" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, fontSize: 12 }}>
          {result.error ? (
            <div style={{ color: '#ff6b6b' }}>❌ {result.error}</div>
          ) : (
            <div style={{ color: '#e8e0d0', lineHeight: 2.2 }}>
              {result.success ? (
                <div style={{ color: '#4ECDC4', fontWeight: 600, marginBottom: 4 }}>{result.message}</div>
              ) : (
                <div style={{ color: '#ff6b6b', fontWeight: 600, marginBottom: 4 }}>❌ فشل الاستيراد</div>
              )}
              {result.employeesDetected > 0 && <div>👥 أفراد مكتشفون: {result.employeesDetected}</div>}
              {result.sessionsInserted > 0 && <div>📊 جلسات جديدة: {result.sessionsInserted}</div>}
              {result.sessionsUpdated > 0 && <div>🔄 جلسات محدثة: {result.sessionsUpdated}</div>}
              {result.dateGroupsDetected > 0 && <div>📅 مجموعات تواريخ: {result.dateGroupsDetected}</div>}
              {result.worksheetsDetected > 0 && <div>📑 أوراق عمل: {result.worksheetsDetected}</div>}
              {result.employeesInserted > 0 && <div>🆕 أفراد جدد: {result.employeesInserted}</div>}
              {result.ranks > 0 && <div>🎖️ رتب جديدة: {result.ranks}</div>}
              {result.processingTime > 0 && <div>⏱️ وقت المعالجة: {(result.processingTime / 1000).toFixed(1)} ثانية</div>}
              {result.warnings?.length > 0 && (
                <div className="mt-2" style={{ color: '#F7DC6F' }}>
                  ⚠️ {result.warnings.length} تحذيرات:
                  <ul style={{ margin: '4px 0', paddingRight: 16, fontSize: 11 }}>
                    {result.warnings.slice(0, 5).map((w, i) => (
                      <li key={i}>{w.worksheet ? `${w.worksheet}: ` : ''}{w.message}</li>
                    ))}
                    {result.warnings.length > 5 && <li>...و{result.warnings.length - 5} تحذيرات أخرى</li>}
                  </ul>
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-2" style={{ color: '#ff6b6b' }}>
                  ❌ {result.errors.length} أخطاء:
                  <ul style={{ margin: '4px 0', paddingRight: 16, fontSize: 11 }}>
                    {result.errors.slice(0, 5).map((er, i) => (
                      <li key={i}>{er.worksheet ? `${er.worksheet}: ` : ''}{er.description || er.error}</li>
                    ))}
                    {result.errors.length > 5 && <li>...و{result.errors.length - 5} أخطاء أخرى</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="d-flex gap-2">
        <button onClick={handleUpload} disabled={loading}
          className={`btn btn-sm flex-grow-1 ${confirmDelete ? 'btn-danger' : 'btn-gold'}`}>
          {loading ? 'جاري الرفع والتحليل...' : confirmDelete ? '⚠️ ارفع وحلل الملف' : '✅ تحليل الملف'}
        </button>
        <button onClick={reset} className="btn btn-outline-secondary btn-sm">إلغاء</button>
      </div>

      {confirmDelete && !result && (
        <p style={{ fontSize: 11, color: '#F7DC6F', marginTop: 8, textAlign: 'center' }}>
          سيتم إرسال الملف للخادم لتحليله واستيراد البيانات
        </p>
      )}

      {onDone && result && result.success && (
        <button onClick={onDone} className="btn btn-outline-gold btn-sm w-100 mt-2">تم</button>
      )}
    </div>
  );
}
