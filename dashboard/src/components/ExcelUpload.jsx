import { useState, useRef } from 'react';
import { api } from '../api';
import * as XLSX from 'xlsx';

function detectSheet(rows) {
  if (!rows.length) return null;
  const cols = Object.keys(rows[0]);
  const joined = cols.join(' ');
  if (/الرقم العسكري|الاسم/.test(joined) && /الرتبة|السلاح/.test(joined)) return 'personnel';
  if (/التقييم العام|اللياقة البدنية/.test(joined)) return 'evaluations';
  if (/تمرين الجري|تمرين الضغط/.test(joined)) return 'fitness';
  if (/النوع|القسم|السبب/.test(joined)) return 'remarks';
  return null;
}

const SHEET_LABELS = {
  personnel: { name: 'الأفراد', icon: '👥', color: '#C9A84C' },
  evaluations: { name: 'التقييمات', icon: '📊', color: '#4ECDC4' },
  fitness: { name: 'اللياقة', icon: '💪', color: '#45B7D1' },
  remarks: { name: 'الملاحظات', icon: '📝', color: '#F7DC6F' },
};

export default function ExcelUpload({ onDone }) {
  const [sheets, setSheets] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const detected = {};
      for (const name of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
        if (!rows.length) continue;
        const type = detectSheet(rows);
        if (type) detected[type] = rows;
      }
      if (!detected.personnel) {
        alert('لم يتم التعرف على sheet الأفراد. تأكد من وجود أعمدة: الاسم، الرقم العسكري، الرتبة، السلاح');
        return;
      }
      setSheets(detected);
      setResult(null);
      setConfirmDelete(false);
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleUpload() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        personnel: sheets.personnel || [],
        evaluations: sheets.evaluations || [],
        fitness: sheets.fitness || [],
        remarks: sheets.remarks || [],
      };
      const res = await api.fullUpload(payload);
      setResult(res);
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  }

  function reset() {
    setSheets({});
    setResult(null);
    setConfirmDelete(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  const sheetTypes = Object.keys(sheets);

  if (!sheetTypes.length) {
    return (
      <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-2" style={{ fontSize: 14 }}>📥 رفع ملف Excel شامل</h6>
        <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', marginBottom: 12 }}>
          ارفع ملف Excel يحتوي على أوراق الأفراد + التقييمات + اللياقة + الملاحظات.
        </p>
        <input type="file" ref={fileRef} accept=".xlsx,.xls" onChange={handleFile}
          className="form-control form-control-sm bg-dark text-light border-military mb-3" style={{ fontSize: 13, direction: 'ltr' }} />
        <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.35)', lineHeight: 2 }}>
          <div>📄 الشيتات المدعومة:</div>
          <div>• <strong>الأفراد</strong> (الاسم، الرقم العسكري، الرتبة، السلاح، التخصص، الحالة)</div>
          <div>• <strong>التقييمات</strong> (الرقم العسكري، التقييم العام، اللياقة، الرماية، التخصص، الانضباط)</div>
          <div>• <strong>اللياقة</strong> (الرقم العسكري، تمرين الجري، الضغط، البطن، المعدية)</div>
          <div>• <strong>الملاحظات</strong> (الرقم العسكري، النوع، القسم، السبب، التاريخ)</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card border-military p-4 mb-3" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
      <h6 className="text-gold mb-3" style={{ fontSize: 14 }}>📋 بيانات مكتشفة من الملف</h6>

      {sheetTypes.map(type => {
        const info = SHEET_LABELS[type];
        const rows = sheets[type];
        return (
          <div key={type} className="mb-2 p-2" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span style={{ fontSize: 14 }}>{info.icon}</span>
              <span style={{ fontSize: 13, color: info.color, fontWeight: 600 }}>{info.name}</span>
              <span style={{ fontSize: 11, color: 'rgba(232,224,208,0.4)' }}>({rows.length} سطر)</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(232,224,208,0.3)' }}>
              {Object.keys(rows[0]).slice(0, 5).join(' | ')}
              {Object.keys(rows[0]).length > 5 && ` +${Object.keys(rows[0]).length - 5}`}
            </div>
          </div>
        );
      })}

      {result && (
        <div className="mb-3 mt-3 p-3" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, fontSize: 12 }}>
          {result.error ? (
            <div style={{ color: '#ff6b6b' }}>❌ {result.error}</div>
          ) : (
            <div style={{ color: '#e8e0d0', lineHeight: 2.2 }}>
              <div style={{ color: '#4ECDC4', fontWeight: 600, marginBottom: 4 }}>{result.message}</div>
              {result.soldiers > 0 && <div>👥 أفراد: {result.soldiers}</div>}
              {result.evaluations > 0 && <div>📊 تقييمات: {result.evaluations}</div>}
              {result.fitness > 0 && <div>💪 نتائج لياقة: {result.fitness}</div>}
              {result.distinctions > 0 && <div>⭐ تكريمات: {result.distinctions}</div>}
              {result.punishments > 0 && <div>⚠️ إنذارات: {result.punishments}</div>}
              {result.weapons > 0 && <div>🔫 أسلحة جديدة: {result.weapons}</div>}
              {result.specialties > 0 && <div>🎯 تخصصات جديدة: {result.specialties}</div>}
              {result.ranks > 0 && <div>🎖️ رتب جديدة: {result.ranks}</div>}
              {result.excelColumns && (
                <div style={{ fontSize: 10, color: 'rgba(232,224,208,0.4)' }}>
                  أعمدة الإكسيل: {result.excelColumns.join(' | ')}
                </div>
              )}
              {result.errors?.length > 0 && (
                <div className="mt-2" style={{ color: '#F7DC6F' }}>
                  ⚠️ {result.errors.length} أخطاء:
                  <ul style={{ margin: '4px 0', paddingRight: 16, fontSize: 11 }}>
                    {result.errors.slice(0, 5).map((er, i) => (
                      <li key={i}>{er.sheet}: {er.row} — {er.error}</li>
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
          {loading ? 'جاري الرفع...' : confirmDelete ? '⚠️ امسح كل القديم وارفع الجديد' : '✅ تحميل البيانات'}
        </button>
        <button onClick={reset} className="btn btn-outline-secondary btn-sm">إلغاء</button>
      </div>

      {confirmDelete && !result && (
        <p style={{ fontSize: 11, color: '#ff6b6b', marginTop: 8, textAlign: 'center' }}>
          سيتم حذف جميع الأفراد والتقييمات الموجودة حالياً واستبدالها بالبيانات الجديدة
        </p>
      )}

      {onDone && result && !result.error && (
        <button onClick={onDone} className="btn btn-outline-gold btn-sm w-100 mt-2">تم</button>
      )}
    </div>
  );
}
