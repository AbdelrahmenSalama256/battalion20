import { useNavigate } from 'react-router-dom';

export default function NotificationsPage({ notifications, onMarkRead, onMarkAll }) {
  const navigate = useNavigate();

  function handleClick(n) {
    if (!n.is_read) onMarkRead(n.id);
    if (n.evaluated_id) navigate(`/soldiers/${n.evaluated_id}`);
    else if (n.type === 'announcement') navigate('/');
    else if (n.evaluator_id) navigate('/');
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4 className="text-gold mb-0">الإشعارات</h4>
        <button onClick={onMarkAll} className="btn btn-outline-gold btn-sm">قراءة الكل</button>
      </div>
      <div className="list-group">
        {notifications.map(n => (
          <div key={n.id}
            className={`list-group-item list-group-item-action notif-item d-flex gap-2 align-items-start ${n.is_read ? '' : 'unread'}`}
            onClick={() => handleClick(n)}>
            <div className="fs-5">
              {n.type === 'evaluation' ? '📋' : n.type === 'distinction' ? '⭐' : n.type === 'punishment' ? '⚠️' : '📢'}
            </div>
            <div className="flex-grow-1">
              <div className="small">{n.message}</div>
              <div className="notif-time mt-1">{n.created_at?.substring(0, 16) || ''}</div>
            </div>
            {!n.is_read && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--military-gold-bright)', flexShrink: 0 }} />
            )}
          </div>
        ))}
        {notifications.length === 0 && (
          <div className="text-center text-muted-military p-4">لا توجد إشعارات</div>
        )}
      </div>
    </div>
  );
}
