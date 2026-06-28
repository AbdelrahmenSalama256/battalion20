import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMsgs(p => [...p, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.aiChat(text);
      setMsgs(p => [...p, { role: 'assistant', content: res.response || res.error, sql: res.sql, data: res.data }]);
    } catch (e) {
      setMsgs(p => [...p, { role: 'assistant', content: '❌ ' + e.message }]);
    }
    setLoading(false);
  }, [input, loading]);

  const token = typeof window !== 'undefined' && localStorage.getItem('b20_token');
  if (!token) return null;

  return (
    <>
      <button onClick={() => setOpen(p => !p)} style={{
        position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
        width: 54, height: 54, borderRadius: '50%', border: 'none',
        background: 'linear-gradient(135deg, #d4a843, #b8942e)',
        color: '#0a0f07', fontSize: 22, cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(212,168,67,0.35)',
        transition: 'transform 0.2s',
        transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
      }}>
        {open ? '✕' : '🤖'}
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 84, right: 20, zIndex: 9999,
          width: 380, maxHeight: 560, borderRadius: 16,
          background: 'rgba(10,15,7,0.96)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          direction: 'rtl',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#d4a843', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              🤖 المساعد الذكي
            </span>
            <div style={{ fontSize: 10, color: 'rgba(232,224,208,0.3)', display: 'flex', gap: 8 }}>
              <button onClick={() => setMsgs([])} style={{ background: 'none', border: 'none', color: 'rgba(232,224,208,0.3)', cursor: 'pointer', fontSize: 11 }}>
                مسح
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200 }}>
            {msgs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(232,224,208,0.35)', fontSize: 12, padding: '30px 10px', lineHeight: 2 }}>
                اسألني عن أي حاجة 🎯<br/>
                مثال: "كم عدد الأفراد في كل تخصص؟"<br/>
                مثال: "أضف جندي جديد اسمه محمد"<br/>
                مثال: "عرض آخر 5 تقييمات"
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i}>
                <div style={{
                  maxWidth: '88%', padding: '8px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  ...(m.role === 'user'
                    ? { background: 'rgba(212,168,67,0.12)', alignSelf: 'flex-end', borderBottomLeftRadius: 4, marginRight: 'auto' }
                    : { background: 'rgba(255,255,255,0.04)', alignSelf: 'flex-start', borderBottomRightRadius: 4, marginLeft: 'auto' }),
                }}>
                  {m.content}
                  {m.sql && (
                    <div style={{ marginTop: 6, padding: 6, background: 'rgba(0,0,0,0.35)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#4ecdc4', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                      {m.sql}
                    </div>
                  )}
                  {m.data && Array.isArray(m.data) && m.data.length > 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(232,224,208,0.5)' }}>
                      عدد النتائج: {m.data.length}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: 'rgba(232,224,208,0.4)', fontSize: 12, padding: '4px 8px', display: 'flex', gap: 4 }}>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>
                <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="اكتب سؤالك..." style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '8px 12px', color: '#e8e0d0', fontSize: 13, outline: 'none', direction: 'rtl',
              }} />
            <button onClick={send} disabled={loading || !input.trim()} style={{
              background: loading ? 'rgba(212,168,67,0.3)' : '#d4a843',
              border: 'none', borderRadius: 8, padding: '8px 14px', color: loading ? 'rgba(232,224,208,0.5)' : '#0a0f07',
              fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}>إرسال</button>
          </div>
        </div>
      )}
    </>
  );
}