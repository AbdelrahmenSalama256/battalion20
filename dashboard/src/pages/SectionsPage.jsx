import { useNavigate } from 'react-router-dom';

const SECTION_META = {
  specialties: { icon: '🎯', color: 'var(--military-gold-bright)', desc: 'التخصصات وال荖 expertise' },
  general: { icon: '📋', color: '#4CAF50', desc: 'التمييزات العامة' },
  fitness: { icon: '💪', color: '#2196F3', desc: 'اللياقة البدنية' },
  shooting: { icon: '🔫', color: '#FF9800', desc: 'الرماية' },
  discipline: { icon: '🎖️', color: '#9C27B0', desc: 'الانضباط' },
};

export default function SectionsPage({ user, sections }) {
  const navigate = useNavigate();
  const canAccess = (key) => {
    if (user?.role === 'commander') return true;
    const allowed = user?.permissions?.sections;
    if (!allowed || !allowed.length) return true;
    return allowed.includes(key);
  };

  const visible = sections.filter(s => canAccess(s.key));

  return (
    <div>
      <h4 className="text-gold mb-4">الرئيسية</h4>
      <div className="row g-3">
        {visible.map(s => {
          const meta = SECTION_META[s.key] || {};
          return (
            <div key={s.id} className="col-12 col-md-6 col-lg-4">
              <div
                className="card border-military p-4 text-center soldier-card"
                style={{ cursor: 'pointer', minHeight: 160 }}
                onClick={() => navigate(`/sections/${s.key}`)}>
                <div className="fs-1 mb-2">{meta.icon || s.icon}</div>
                <h5 className="text-gold mb-1">{s.name}</h5>
                <div className="small text-muted-military">{meta.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
