const BASE = import.meta.env.VITE_API_URL || '/api';

async function req(method, path, body) {
  const token = localStorage.getItem('b20_token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...(body && { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username, password) => req('POST', '/auth/login', { username, password }),
  me: () => req('GET', '/auth/me'),
  changePassword: (oldPassword, newPassword) => req('PATCH', '/auth/change-password', { oldPassword, newPassword }),

  // Sections
  getSections: () => req('GET', '/sections'),

  // Specialties
  getSpecialties: () => req('GET', '/specialties'),
  getSpecialty: (id) => req('GET', `/specialties/${id}`),
  createSpecialty: (data) => req('POST', '/specialties', data),
  updateSpecialty: (id, data) => req('PUT', `/specialties/${id}`, data),
  deleteSpecialty: (id) => req('DELETE', `/specialties/${id}`),

  // Soldiers
  getSoldiers: (params) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.weaponId) q.set('weaponId', params.weaponId);
    if (params?.specialtyId) q.set('specialtyId', params.specialtyId);
    if (params?.status) q.set('status', params.status);
    if (params?.maxRankLevel) q.set('maxRankLevel', params.maxRankLevel);
    return req('GET', `/soldiers?${q.toString()}`);
  },
  getSoldier: (id) => req('GET', `/soldiers/${id}`),
  createSoldier: (data) => req('POST', '/soldiers', data),
  updateSoldier: (id, data) => req('PUT', `/soldiers/${id}`, data),
  deleteSoldier: (id) => req('DELETE', `/soldiers/${id}`),
  bulkDeleteSoldiers: (ids) => req('POST', '/soldiers/bulk-delete', { ids }),
  assignSpecialty: (soldierId, specialtyId) => req('POST', `/soldiers/${soldierId}/specialties`, { specialtyId }),
  removeSpecialty: (soldierId, specialtyId) => req('DELETE', `/soldiers/${soldierId}/specialties/${specialtyId}`),

  // Evaluations
  getEvaluations: (params) => {
    const q = new URLSearchParams();
    if (params?.section_key) q.set('section_key', params.section_key);
    if (params?.soldier_id) q.set('soldier_id', params.soldier_id);
    if (params?.page) q.set('page', params.page);
    if (params?.limit) q.set('limit', params.limit);
    return req('GET', `/evaluations?${q.toString()}`);
  },
  getSoldierEvaluations: (soldierId, params) => {
    const q = new URLSearchParams();
    if (params?.section_key) q.set('section_key', params.section_key);
    if (params?.specialty_id) q.set('specialty_id', params.specialty_id);
    return req('GET', `/evaluations/soldier/${soldierId}?${q.toString()}`);
  },
  createEvaluation: (data) => req('POST', '/evaluations', data),
  bulkDeleteEvaluations: (ids) => req('POST', '/evaluations/bulk-delete', { ids }),
  getSectionStats: (sectionKey, specialtyId) => {
    const q = new URLSearchParams();
    if (specialtyId) q.set('specialtyId', specialtyId);
    return req('GET', `/evaluations/stats/${sectionKey}?${q.toString()}`);
  },

  // Distinctions
  getDistinctions: (soldierId) => req('GET', `/distinctions/soldier/${soldierId}`),
  createDistinction: (data) => req('POST', '/distinctions', data),
  deleteDistinction: (id) => req('DELETE', `/distinctions/${id}`),

  // Punishments
  getPunishments: (soldierId) => req('GET', `/punishments/soldier/${soldierId}`),
  createPunishment: (data) => req('POST', '/punishments', data),
  deletePunishment: (id) => req('DELETE', `/punishments/${id}`),

  // Users
  getUsers: () => req('GET', '/users'),
  createUser: (data) => req('POST', '/users', data),
  updateUser: (id, data) => req('PATCH', `/users/${id}`, data),
  updateUserPassword: (id, password) => req('PATCH', `/users/${id}/password`, { password }),
  toggleUser: (id) => req('PATCH', `/users/${id}/toggle`),
  deleteUser: (id) => req('DELETE', `/users/${id}`),
  bulkDeleteUsers: (ids) => req('POST', '/users/bulk-delete', { ids }),

  // Notifications
  getNotifications: () => req('GET', '/notifications'),
  markNotificationRead: (id) => req('PATCH', `/notifications/${id}/read`),
  markAllNotificationsRead: () => req('PATCH', '/notifications/read-all'),

  // Ranks
  getRankTypes: () => req('GET', '/ranks/types'),
  getRanks: (typeId) => req('GET', `/ranks${typeId ? `?typeId=${typeId}` : ''}`),
  createRank: (data) => req('POST', '/ranks', data),
  updateRank: (id, data) => req('PUT', `/ranks/${id}`, data),
  deleteRank: (id) => req('DELETE', `/ranks/${id}`),
  createRankType: (data) => req('POST', '/ranks/types', data),
  updateRankType: (id, data) => req('PUT', `/ranks/types/${id}`, data),
  deleteRankType: (id) => req('DELETE', `/ranks/types/${id}`),

  // Weapons
  getWeapons: () => req('GET', '/weapons'),
  createWeapon: (data) => req('POST', '/weapons', data),
  updateWeapon: (id, data) => req('PUT', `/weapons/${id}`, data),
  deleteWeapon: (id) => req('DELETE', `/weapons/${id}`),

  // Exams
  getExams: (sectionKey) => req('GET', `/exams${sectionKey ? `?sectionKey=${sectionKey}` : ''}`),
  getExam: (id) => req('GET', `/exams/${id}`),
  createExam: (data) => req('POST', '/exams', data),
  updateExam: (id, data) => req('PUT', `/exams/${id}`, data),
  deleteExam: (id) => req('DELETE', `/exams/${id}`),
  bulkDeleteExams: (ids) => req('POST', '/exams/bulk-delete', { ids }),

  // Announcements
  getAnnouncements: () => req('GET', '/announcements'),
  getAnnouncement: (id) => req('GET', `/announcements/${id}`),
  createAnnouncement: (data) => req('POST', '/announcements', data),
  updateAnnouncement: (id, data) => req('PUT', `/announcements/${id}`, data),
  deleteAnnouncement: (id) => req('DELETE', `/announcements/${id}`),
  bulkDeleteAnnouncements: (ids) => req('POST', '/announcements/bulk-delete', { ids }),

  // Distinction confirmations
  confirmDistinction: (id) => req('POST', `/distinctions/${id}/confirm`),
  getDistinctionConfirmations: (id) => req('GET', `/distinctions/${id}/confirmations`),

  // Push subscriptions
  pushSubscribe: (endpoint, keys) => req('POST', '/push/subscribe', { endpoint, keys }),
  pushUnsubscribe: (endpoint) => req('POST', '/push/unsubscribe', { endpoint }),

  // Leaves / Personnel
  getLeaves: (params) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.soldier_id) q.set('soldier_id', params.soldier_id);
    return req('GET', `/leaves?${q.toString()}`);
  },
  getActiveLeaves: () => req('GET', '/leaves/active'),
  getOverdueReturns: () => req('GET', '/leaves/overdue-return'),
  getSoldiersNeedingLeave: () => req('GET', '/leaves/needing-leave'),
  createLeave: (data) => req('POST', '/leaves', data),
  confirmReturn: (id) => req('PATCH', `/leaves/${id}/confirm-return`),
  cancelLeave: (id) => req('PATCH', `/leaves/${id}/cancel`),
  getPersonnelDashboard: () => req('GET', '/leaves/dashboard'),

  // Results
  getResultsStats: () => req('GET', '/results/stats'),

  // Cipher
  getCipherMap: () => req('GET', '/cipher/map'),
  downloadDecoder: () => req('GET', '/cipher/download'),
  decodeCipher: (text) => req('POST', '/cipher/decode', { text }),

  // Bulk upload
  bulkUpload: (soldiers) => req('POST', '/soldiers/bulk-upload', { soldiers }),
  fullUpload: (data) => req('POST', '/admin/full-upload', data),
  confirmReturn: (id) => req('PATCH', `/soldiers/${id}/confirm-return`),

  // Admin
  seed: () => req('POST', '/admin/seed'),
  clearAll: () => req('POST', '/admin/clear-all'),
};
