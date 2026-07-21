import { useState, useRef } from 'react';
import { api } from '../api';
import * as XLSX from 'xlsx';

export default function ExcelUpload({ onDone }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      setData(json);
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleUpload() {
    if (!data || !data.length) return;
    setLoading(true);
    try {
      const res = await api.bulkUpload(data);
      setResult(res);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>رفع ملف Excel</h6>
        <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
          الأعمدة المتوقعة: الاسم, الرقم العسكري, التخصص, السلاح
        </p>
        <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleFile} className="form-control form-control-sm bg-dark text-light border-military mb-2" style={{ fontSize: 13, direction: 'ltr' }} />
        {data && (
          <div style={{ fontSize: 12, color: 'rgba(232,224,208,0.6)', marginBottom: 8 }}>
            تم قراءة {data.length} سطر
          </div>
        )}
        <button onClick={handleUpload} disabled={!data || loading}
          className="btn btn-gold btn-sm w-100">
          {loading ? 'جاري الرفع...' : 'رفع وإضافة الكل'}
        </button>
      </div>

      {result && (
        <div className="card border-military p-3 mb-3" style={{ background: 'rgba(10,15,7,0.7)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
          {result.error ? (
            <div style={{ color: '#ff6b6b', fontSize: 13 }}>❌ {result.error}</div>
          ) : (
            <div style={{ fontSize: 13, color: '#e8e0d0' }}>
              ✅ تم إنشاء / تحديث {result.created} فرد<br />
              ⏭️ تم تخطي {result.skipped} فرد<br />
              {result.errors?.length > 0 && <span style={{ color: '#ff6b6b' }}>⚠️ {result.errors.length} خطأ</span>}
            </div>
          )}
          {onDone && <button onClick={onDone} className="btn btn-outline-gold btn-sm mt-2 w-100">تم</button>}
        </div>
      )}

      <div className="p-3" style={{ fontSize: 11, color: 'rgba(232,224,208,0.3)', lineHeight: 1.8 }}>
        <strong className="text-gold">تنسيق الملف:</strong><br />
        • الصف الأول: رؤوس الأعمدة (الاسم, الرقم العسكري, التخصص, السلاح)<br />
        • التخصصات والأسلحة الجديدة تُضاف تلقائيًا للقائمة<br />
        • الأفراد المكررون (بنفس الرقم العسكري) يتم تحديث بياناتهم
      </div>
    </div>
  );
}