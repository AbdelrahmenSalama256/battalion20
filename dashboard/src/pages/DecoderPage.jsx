import { useState, useEffect } from 'react';
import { api } from '../api';
import { getDecoderData } from '../utils/cipher';

export default function DecoderPage({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDecoder().then(setData).catch(() => setData(getDecoderData())).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center p-5 text-muted-military">جاري التحميل...</div>;
  if (!data) return <div className="text-center p-5 text-muted-military">غير متاح</div>;

  const rows = data.mapping || [];

  return (
    <div>
      <h4 className="text-gold mb-3" style={{ fontSize: 14 }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--military-gold-bright)', marginLeft: 6 }} />
        {data.title || 'دليل فك التشفير'}
      </h4>

      <div className="card border-military p-4 mb-4" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="table-responsive">
          <table className="table table-sm table-borderless mb-0" style={{ color: '#e8e0d0' }}>
            <thead>
              <tr className="text-gold small">
                <th>الرمز</th>
                <th>يعني</th>
                <th>الرمز</th>
                <th>يعني</th>
              </tr>
            </thead>
            <tbody>
              {[0, 2, 4, 6, 8].map(i => (
                <tr key={i}>
                  <td style={{ fontSize: 28, fontFamily: 'monospace', padding: '8px 12px' }}>{rows[i]?.symbol}</td>
                  <td style={{ fontSize: 14, color: 'rgba(232,224,208,0.7)' }}>= الرقم {rows[i]?.digit}</td>
                  <td style={{ fontSize: 28, fontFamily: 'monospace', padding: '8px 12px' }}>{rows[i + 1]?.symbol}</td>
                  <td style={{ fontSize: 14, color: 'rgba(232,224,208,0.7)' }}>= الرقم {rows[i + 1]?.digit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 p-3" style={{ background: 'rgba(212,168,67,0.06)', borderRadius: 12, fontSize: 13, color: 'rgba(232,224,208,0.8)', lineHeight: 2 }}>
          <strong className="text-gold">كيفية الاستخدام:</strong><br />
          {data.note || "كل رقم يظهر في النظام يتم تحويله باستخدام هذا الجدول. استبدل كل رمز بالرقم المقابل له."}
        </div>
      </div>

      <div className="card border-military p-4" style={{ background: 'rgba(10,15,7,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}>
        <h6 className="text-gold mb-3" style={{ fontSize: 13 }}>أمثلة</h6>
        <div className="row g-2">
          {getDecoderData().examples.map((ex, i) => (
            <div key={i} className="col-6 col-md-3">
              <div className="p-2 text-center" style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontFamily: 'monospace' }}>{ex.encoded}</div>
                <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.4)' }}>= {ex.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}