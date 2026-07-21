import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { api } from './api';
import { requestNotifPermission, showBrowserNotif, playNotifSound } from './utils/notifications';
import { registerPush } from './utils/push';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SectionDetailPage from './pages/SectionDetailPage';
import SpecialtyDetailPage from './pages/SpecialtyDetailPage';
import SoldiersPage from './pages/SoldiersPage';
import SoldierProfilePage from './pages/SoldierProfilePage';
import NotificationsPage from './pages/NotificationsPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import ExamsPage from './pages/ExamsPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import ManagePage from './pages/ManagePage';
import PersonnelPage from './pages/PersonnelPage';
import DecoderPage from './pages/DecoderPage';

function SectionDetailGuard({ user, specialties, soldiers }) {
  const { key } = useParams();
  const allowed = user?.role === 'commander' ? true : (user?.permissions?.sections?.includes(key) ?? true);
  if (!allowed) return <Navigate to="/" />;
  return <SectionDetailPage user={user} specialties={specialties} soldiers={soldiers} />;
}

export default function App() {
  const [u, setU] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('b20_token'));
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState({
    sections: [],
    soldiers: [],
    specialties: [],
    ranks: [],
    weapons: [],
    users: [],
    notifications: [],
  });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sections, sold, sp, rk, wp, us, notif] = await Promise.all([
        api.getSections().catch(() => []),
        api.getSoldiers({}).catch(() => []),
        api.getSpecialties().catch(() => []),
        api.getRanks().catch(() => []),
        api.getWeapons().catch(() => []),
        api.getUsers().catch(() => []),
        api.getNotifications().catch(() => ({ notifications: [] })),
      ]);
      setData({
        sections,
        soldiers: sold,
        specialties: sp,
        ranks: rk,
        weapons: wp,
        users: us,
        notifications: notif.notifications || [],
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token) {
      loadUser();
      load();
    }
  }, [token]);

  // Poll notifications every 10s
  useEffect(() => {
    if (!authed) return;
    let prev = 0;
    const iv = setInterval(async () => {
      try {
        const n = await api.getNotifications();
        const list = n.notifications || [];
        setData(d => ({ ...d, notifications: list }));
        if (list.length > prev) {
          const latest = list[0];
          if (latest && !latest.is_read) {
            showBrowserNotif('إشعار جديد', latest.message || '', latest.type === 'evaluation' ? '📋' : latest.type === 'distinction' ? '⭐' : '📢');
            playNotifSound();
          }
        }
        prev = list.length;
      } catch (e) { /* ignore */ }
    }, 10000);
    return () => clearInterval(iv);
  }, [authed]);

  function loadUser() {
    requestNotifPermission();
    registerPush();
    api.me()
      .then(u2 => { setU(u2); setAuthed(true); })
      .catch(() => {
        localStorage.removeItem('b20_token');
        setToken(null);
        setU(null);
        setAuthed(false);
      });
  }

  function handleLogin(username, password) {
    api.login(username, password)
      .then(({ token: t, user: u2 }) => {
        localStorage.setItem('b20_token', t);
        setToken(t);
        setU(u2);
        setAuthed(true);
      })
      .catch(e => alert(e.message));
  }

  function handleLogout() {
    localStorage.removeItem('b20_token');
    setToken(null);
    setU(null);
    setAuthed(false);
  }

  async function markRead(id) {
    await api.markNotificationRead(id);
    setData(d => ({
      ...d,
      notifications: d.notifications.map(n => n.id === id ? { ...n, is_read: true } : n),
    }));
  }

  async function markAllRead() {
    await api.markAllNotificationsRead();
    setData(d => ({
      ...d,
      notifications: d.notifications.map(n => ({ ...n, is_read: true })),
    }));
  }

  if (!authed) return <LoginPage onLogin={handleLogin} />;

  const canAccess = (section) => {
    if (u?.role === 'commander') return true;
    const allowed = u?.permissions?.sections;
    if (!allowed || !allowed.length) return true;
    return allowed.includes(section);
  };

  return (
    <Layout user={u} onLogout={handleLogout} data={data} onMarkRead={markRead} onMarkAll={markAllRead}>
      <Routes>
        <Route path="/" element={<DashboardPage user={u} sections={data.sections} notifications={data.notifications} onMarkRead={markRead} />} />
        <Route path="/sections/:key" element={
          <SectionDetailGuard user={u} specialties={data.specialties} soldiers={data.soldiers} />
        } />
        <Route path="/sections/specialties/:id" element={
          <SpecialtyDetailPage user={u} />
        } />
        <Route path="/soldiers" element={
          <SoldiersPage
            soldiers={data.soldiers}
            weapons={data.weapons}
            specialties={data.specialties}
            ranks={data.ranks}
            user={u}
            onRefresh={load}
          />
        } />
        <Route path="/soldiers/:id" element={
          <SoldierProfilePage user={u} onRefresh={load} />
        } />
        <Route path="/notifications" element={
          <NotificationsPage
            notifications={data.notifications}
            onMarkRead={markRead}
            onMarkAll={markAllRead}
          />
        } />
        <Route path="/users" element={
          u?.role === 'commander' ? (
            <UsersPage users={data.users} ranks={data.ranks} onRefresh={load} user={u} />
          ) : <Navigate to="/" />
        } />
        <Route path="/profile" element={
          <ProfilePage user={u} onUpdate={setU} />
        } />
        <Route path="/exams" element={
          <ExamsPage user={u} specialties={data.specialties} />
        } />
        <Route path="/announcements" element={
          <AnnouncementsPage user={u} />
        } />
        <Route path="/manage" element={
          u?.role === 'commander' ? <ManagePage user={u} /> : <Navigate to="/" />
        } />
        <Route path="/personnel" element={
          <PersonnelPage user={u} soldiers={data.soldiers} />
        } />
        <Route path="/cipher" element={
          u?.role === 'commander' ? <DecoderPage user={u} /> : <Navigate to="/" />
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
}
