import {useState} from 'react';
export default function LoginPage({onLogin}){
  const[u,setU]=useState('');const[p,setP]=useState('');const[ld,setLd]=useState(false);
  async function h(e){e.preventDefault();setLd(true);try{await onLogin(u,p)}catch{}setLd(false)}
  return(<div className="vh-100 d-flex align-items-center justify-content-center bg-military">
    <div className="card border-military p-4" style={{maxWidth:360,width:'100%'}}>
      <div className="text-center mb-3"><span className="fs-1">🛡️</span><h2 className="text-gold mt-2">كتيبة 20</h2><p className="text-muted-military small">نظام التمييز العسكري</p></div>
      <form onSubmit={h}>
        <input className="form-control bg-card text-light border-military mb-2" placeholder="اسم المستخدم" value={u} onChange={e=>setU(e.target.value)}/>
        <input type="password" className="form-control bg-card text-light border-military mb-3" placeholder="كلمة المرور" value={p} onChange={e=>setP(e.target.value)}/>
        <button type="submit" disabled={ld} className="btn btn-gold w-100">{ld?'جاري...':'تسجيل الدخول'}</button>
      </form>
    </div>
  </div>);
}
