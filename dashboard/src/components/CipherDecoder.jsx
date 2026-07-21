import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

export default function CipherDecoder() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'أنا مساعد فك التشفير. الصق أي نص يحتوي على رموز مشفرة وسأقوم بفكها.' }
  ]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function handleDecode() {
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);
    try {
      const data = await api.decodeCipher(userText);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: data.decoded,
        original: data.original,
        explanation: data.explanation
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'ai',
        text: `❌ خطأ في فك التشفير: ${e.response?.data?.error || e.message}`
      }]);
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      background: 'rgba(26,26,35,0.75)',
      backdropFilter: 'blur(16px)',
      borderRadius: 16,
      border: '1px solid rgba(212,168,67,0.2)',
      padding: 20,
      marginTop: 20
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #d4a843, #b8922e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 'bold', color: '#1a1a1a'
        }}>🔐</div>
        <div>
          <div style={{ color: '#e8e0d0', fontSize: 15, fontWeight: 600 }}>مساعد فك التشفير</div>
          <div style={{ color: 'rgba(232,224,208,0.4)', fontSize: 11 }}>للقيادة فقط — مشفر بالكامل</div>
        </div>
      </div>

      <div style={{
        maxHeight: 350, overflowY: 'auto', marginBottom: 12,
        display: 'flex', flexDirection: 'column', gap: 10
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '10px 14px',
              borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg, #d4a843, #b8922e)'
                : 'rgba(255,255,255,0.06)',
              color: msg.role === 'user' ? '#1a1a1a' : '#e8e0d0',
              fontSize: 13,
              lineHeight: 1.7,
              wordBreak: 'break-word'
            }}>
              {msg.role === 'ai' && msg.original && (
                <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.4)', marginBottom: 6 }}>
                  النص الأصلي: {msg.original}
                </div>
              )}
              <div style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{msg.text}</div>
              {msg.explanation && (
                <div style={{
                  fontSize: 11, color: 'rgba(232,224,208,0.5)',
                  marginTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: 6
                }}>
                  {msg.explanation}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#d4a843', animation: 'pulse 1s infinite'
            }} />
            <span style={{ color: 'rgba(232,224,208,0.5)', fontSize: 12 }}>جاري فك التشفير...</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDecode(); } }}
          placeholder="الصق النص المشفر هنا..."
          rows={2}
          style={{
            flex: 1,
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(212,168,67,0.2)',
            borderRadius: 10,
            padding: '10px 12px',
            color: '#e8e0d0',
            fontSize: 13,
            resize: 'none',
            outline: 'none',
            fontFamily: 'monospace'
          }}
        />
        <button
          onClick={handleDecode}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 18px',
            background: !input.trim() ? 'rgba(212,168,67,0.3)' : 'linear-gradient(135deg, #d4a843, #b8922e)',
            border: 'none',
            borderRadius: 10,
            color: '#1a1a1a',
            fontWeight: 600,
            fontSize: 13,
            cursor: !input.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          {loading ? '...' : 'فك'}
        </button>
      </div>
    </div>
  );
}
