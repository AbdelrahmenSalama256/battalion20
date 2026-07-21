import { useState, useRef } from 'react';
import { api } from '../api';
import * as XLSX from 'xlsx';

const FIELDS = [
  { key: 'name', label: 'الاسم', required: true },
  { key: 'military_id', label: 'الرقم العسكري', required: true },
  { key: 'specialty', label: 'التخصص', required: false },
  { key: 'weapon', label: 'السلاح', required: false },
  { key: 'rank', label: 'الرتبة', required: false },
  { key: 'status', label: 'الحالة', required: false },
];

export default function ExcelUpload({ onDone }) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
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
      if (!json.length) { alert('الملف فارغ'); return; }
      const cols = Object.keys(json[0]);
      setHeaders(cols);
      setRows(json);
      // auto-map
      const auto = {};
      cols.forEach(c => {
        const clean = c.trim();
        if (/اسم/i.test(clean)) auto.name = c;
        else if (/رقم|عسكري|مilitary|رقم_عسكري|military_id/i.test(clean)) auto.military_id = c;
        else if (/تخصص|specialty/i.test(clean)) auto.specialty = c;
        else if (/سلاح|weapon|ساح/i.test(clean)) auto.weapon = c;
        else if (/رتب|rank/i.test(clean)) auto.rank = c;
        else if (/حالة|status/i.test(clean)) auto.status = c;
      });
      setMapping(auto);
      setResult(null);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleUpload() {
    const nameCol = mapping.name;
    const milCol = mapping.military_id;
    if (!nameCol || !milCol) { alert('يرجى تحديد عمود الاسم والرقم العسكري'); return; }
    setLoading(true);
    try {
      const soldiers = rows.map(r => ({
        name: r[nameCol],
        military_id: String(r[milCol]).trim(),
        specialty: mapping.specialty ? r[mapping.specialty] : '',
        weapon: mapping.weapon ? r[mapping.weapon] : '',
        rank: mapping.rank ? r[mapping.rank] : '',
        status: mapping.status ? r[mapping.status] : '',
      })).filter(r => r.name && r.military_id);
      const res = await api.bulkUpload(soldiers);
      setResult(res);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  function reset() {
    setHeaders([]); setRows([]); setMapping({}); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  // Step 1: No file loaded
  if (!headers.length) {
    return (
      <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>📥 رفع ملف Excel</h6>
        <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
          ارفع شيت Excel. بعدها هتختار كل عمود بيمثل إيه.
        </p>
        <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" onChange={handleFile} className="form-control form-control-sm bg-dark text-light border-military mb-2" style={{ fontSize: 13, direction: 'ltr' }} />
        <p style={{ fontSize: 11, color: 'rgba(232,224,208,0.3)' }}>أعمدة متوقعة: الاسم, الرقم العسكري, التخصص, السلاح</p>
      </div>
    );
  }

  // Step 2: Column mapping
  return (
    <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
      <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>📋 توزيع الأعمدة</h6>
      <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
        اختر كل عمود من الشيت بيمثل إيه في النظام ({rows.length} سطر)
      </p>

      <div className="table-responsive mb-3">
        <table className="table table-sm table-borderless mb-0" style={{ color: '#e8e0d0', fontSize: 12 }}>
          <thead><tr className="text-gold small">
            <th>الحقل في النظام</th>
            <th>العمود في الملف</th>
            <th>عينة من البيانات</th>
          </tr></thead>
          <tbody>
            {FIELDS.map(f => (
              <tr key={f.key}>
                <td style={{ padding: '6px 8px' }}>
                  {f.required && <span style={{ color: '#ff6b6b', marginLeft: 4 }}>*</span>}
                  {f.label}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <select value={mapping[f.key] || ''} onChange={e => setMapping(p => ({ ...p, [f.key]: e.target.value }))}
                    className="form-select form-select-sm bg-dark text-light border-military" style={{ fontSize: 11 }}>
                    <option value="">— اختر العمود —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </td>
                <td style={{ padding: '6px 8px', color: 'rgba(232,224,208,0.4)', fontSize: 11 }}>
                  {mapping[f.key] ? String(rows[0]?.[mapping[f.key]] || '').substring(0, 30) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result && (
        <div className="mb-3 p-3" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, fontSize: 13 }}>
          {result.error ? (
            <div style={{ color: '#ff6b6b' }}>❌ {result.error}</div>
          ) : (
            <div style={{ color: '#e8e0d0', lineHeight: 2 }}>
              ✅ تم إنشاء / تحديث <strong>{result.created}</strong> فرد
              {result.skipped > 0 && <><br/>⏭️ تم تخطي {result.skipped} فرد</>}
              {result.errors?.length > 0 && <><br/>⚠️ {result.errors.length} خطأ</>}
            </div>
          )}
        </div>
      )}

      <div className="d-flex gap-2">
        <button onClick={handleUpload} disabled={loading || !mapping.name || !mapping.military_id}
          className="btn btn-gold btn-sm flex-grow-1">
          {loading ? 'جاري الرفع...' : '✅ تحميل البيانات'}
        </button>
        <button onClick={reset} className="btn btn-outline-secondary btn-sm">إلغاء</button>
      </div>

      {onDone && result && !result.error && (
        <button onClick={onDone} className="btn btn-outline-gold btn-sm w-100 mt-2">تم</button>
      )}
    </div>
  );
}