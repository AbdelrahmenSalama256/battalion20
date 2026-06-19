import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_service.dart';
import '../models/user_model.dart';
import '../models/dashboard_stats_model.dart';
import '../models/soldier_model.dart';
import '../models/exam_model.dart';
import '../models/result_model.dart';
import '../models/notification_model.dart';

class ApiRepository {
  final ApiService _api;

  ApiRepository(this._api);

  // ─── Auth ───
  Future<UserModel> login(String username, String password) async {
    final res = await _api.post('/auth/login', data: {
      'username': username,
      'password': password,
    });
    await _api.saveToken(res.data['token']);
    final user = UserModel.fromJson(res.data['user']);
    await _cacheUser(user);
    return user;
  }

  Future<void> logout() => _api.clearToken();

  Future<UserModel> getMe() async {
    try {
      final res = await _api.get('/auth/me');
      final user = UserModel.fromJson(res.data);
      await _cacheUser(user);
      return user;
    } catch (_) {
      final cached = await _getCachedUser();
      if (cached != null) return cached;
      rethrow;
    }
  }

  // ─── Dashboard ───
  Future<DashboardStats> getStats() async {
    final res = await _api.get('/results/stats');
    final stats = DashboardStats.fromJson(res.data);
    await _cacheStats(stats);
    return stats;
  }

  // ─── Soldiers ───
  Future<List<SoldierModel>> getSoldiers({
    String? search,
    String? weaponId,
    String? specialtyId,
  }) async {
    final params = <String, dynamic>{};
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (weaponId != null) params['weaponId'] = weaponId;
    if (specialtyId != null) params['specialtyId'] = specialtyId;
    final res = await _api.get('/soldiers', params: params);
    final soldiers =
        (res.data as List).map((e) => SoldierModel.fromJson(e)).toList();
    await _cacheSoldiers(soldiers);
    return soldiers;
  }

  Future<SoldierModel> getSoldier(String id) async {
    final res = await _api.get('/soldiers/$id');
    return SoldierModel.fromJson(res.data);
  }

  Future<void> createSoldier(Map<String, dynamic> data) async {
    await _api.post('/soldiers', data: data);
  }

  Future<void> updateSoldier(String id, Map<String, dynamic> data) async {
    await _api.put('/soldiers/$id', data: data);
  }

  Future<void> deleteSoldier(String id) async {
    await _api.delete('/soldiers/$id');
  }

  Future<List<Map<String, dynamic>>> getWeapons() async {
    final res = await _api.get('/weapons');
    return List<Map<String, dynamic>>.from(res.data);
  }

  Future<List<Map<String, dynamic>>> getSpecialties(
      {String? weaponId}) async {
    final params = <String, dynamic>{};
    if (weaponId != null) params['weaponId'] = weaponId;
    final res = await _api.get('/specialties', params: params);
    return List<Map<String, dynamic>>.from(res.data);
  }

  Future<List<Map<String, dynamic>>> getRanks({String? typeId}) async {
    final params = <String, dynamic>{};
    if (typeId != null) params['typeId'] = typeId;
    final res = await _api.get('/ranks', params: params);
    return List<Map<String, dynamic>>.from(res.data);
  }

  Future<List<Map<String, dynamic>>> getRankTypes() async {
    final res = await _api.get('/ranks/types');
    return List<Map<String, dynamic>>.from(res.data);
  }

  // ─── Exams ───
  Future<List<ExamModel>> getExams({String? type, String? weaponId}) async {
    final params = <String, dynamic>{};
    if (type != null) params['type'] = type;
    if (weaponId != null) params['weaponId'] = weaponId;
    final res = await _api.get('/exams', params: params);
    return (res.data as List).map((e) => ExamModel.fromJson(e)).toList();
  }

  Future<ExamModel> getExam(String id) async {
    final res = await _api.get('/exams/$id');
    return ExamModel.fromJson(res.data);
  }

  Future<void> createExam(Map<String, dynamic> data) async {
    await _api.post('/exams', data: data);
  }

  Future<void> updateExam(String id, Map<String, dynamic> data) async {
    await _api.put('/exams/$id', data: data);
  }

  Future<void> deleteExam(String id) async {
    await _api.delete('/exams/$id');
  }

  // ─── Results ───
  Future<Map<String, dynamic>> getResults({
    String? type,
    String? weaponId,
    String? soldierId,
    int page = 1,
    int limit = 100,
  }) async {
    final params = <String, dynamic>{'page': page, 'limit': limit};
    if (type != null) params['type'] = type;
    if (weaponId != null) params['weaponId'] = weaponId;
    if (soldierId != null) params['soldierId'] = soldierId;
    final res = await _api.get('/results', params: params);
    return res.data is Map<String, dynamic> ? res.data as Map<String, dynamic> : {'results': <dynamic>[], 'total': 0, 'page': page};
  }

  Future<List<ResultModel>> getResultsList({
    String? soldierId,
    int limit = 100,
  }) async {
    final data = await getResults(soldierId: soldierId, limit: limit);
    final list = (data['results'] as List? ?? []);
    return list.map((e) => ResultModel.fromJson(e)).toList();
  }

  Future<ResultModel> getResult(String id) async {
    final res = await _api.get('/results/$id');
    return ResultModel.fromJson(res.data);
  }

  Future<void> createResult(Map<String, dynamic> data) async {
    await _api.post('/results', data: data);
  }

  Future<void> deleteResult(String id) async {
    await _api.delete('/results/$id');
  }

  // ─── Evaluate (direct — no examId required) ───
  Future<void> evaluateSoldier({
    required String soldierId,
    required double fitnessScore,
    required double specialtyScore,
    required double disciplineScore,
    String? notes,
  }) async {
    await _api.post('/soldiers/$soldierId/evaluate', data: {
      'fitnessScore': fitnessScore,
      'specialtyScore': specialtyScore,
      'disciplineScore': disciplineScore,
      'notes': notes,
    });
  }

  // ─── Fitness ───
  Future<List<Map<String, dynamic>>> getFitnessExercises() async {
    final res = await _api.get('/fitness/exercises');
    return List<Map<String, dynamic>>.from(res.data);
  }

  Future<void> createFitnessResult(Map<String, dynamic> data) async {
    await _api.post('/fitness/results', data: data);
  }

  // ─── Announcements ───
  Future<List<Map<String, dynamic>>> getAnnouncements() async {
    final res = await _api.get('/announcements');
    return List<Map<String, dynamic>>.from(res.data);
  }

  Future<void> createAnnouncement(Map<String, dynamic> data) async {
    await _api.post('/announcements', data: data);
  }

  Future<void> deleteAnnouncement(String id) async {
    await _api.delete('/announcements/$id');
  }

  Future<void> changePassword(String oldPassword, String newPassword) async {
    await _api.patch('/auth/change-password', data: {
      'oldPassword': oldPassword,
      'newPassword': newPassword,
    });
  }

  // ─── Notifications ───
  Future<List<NotificationModel>> getNotifications() async {
    final res = await _api.get('/notifications');
    final list = (res.data is Map ? (res.data['notifications'] as List?) : res.data as List?) ?? [];
    final notifications =
        list.map((e) => NotificationModel.fromJson(e)).toList();
    await _cacheNotifications(notifications);
    return notifications;
  }

  Future<void> markNotificationRead(String id) async {
    await _api.patch('/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _api.patch('/notifications/read-all');
  }

  Future<int> getUnreadCount() async {
    final res = await _api.get('/notifications/unread-count');
    return (res.data['count'] as num?)?.toInt() ?? 0;
  }

  // ─── Users ───
  Future<List<UserModel>> getUsers() async {
    final res = await _api.get('/users');
    return (res.data as List).map((e) => UserModel.fromJson(e)).toList();
  }

  Future<void> createUser(Map<String, dynamic> data) async {
    await _api.post('/users', data: data);
  }

  Future<void> updateUserPassword(String id, String password) async {
    await _api.patch('/users/$id/password', data: {'password': password});
  }

  Future<void> toggleUser(String id) async {
    await _api.patch('/users/$id/toggle');
  }

  Future<void> deleteUser(String id) async {
    await _api.delete('/users/$id');
  }

  Future<void> updateUserPermissions(
      String id, Map<String, dynamic> permissions) async {
    await _api.patch('/users/$id/permissions',
        data: {'permissions': permissions});
  }

  // ─── Distinctions ───
  Future<void> distinguishSoldier(
      String id, String badge, String citation) async {
    await _api.post('/soldiers/$id/distinguish',
        data: {'badge': badge, 'citation': citation});
  }

  Future<void> removeDistinction(String id) async {
    await _api.delete('/soldiers/$id/distinguish');
  }

  // ─── Profile ───
  Future<UserModel> updateProfile(Map<String, dynamic> data) async {
    final res = await _api.patch('/auth/profile', data: data);
    return UserModel.fromJson(res.data);
  }

  // ─── Weapons / Specialties ───
  Future<void> createWeapon(Map<String, dynamic> data) async {
    await _api.post('/weapons', data: data);
  }

  Future<void> deleteWeapon(String id) async {
    await _api.delete('/weapons/$id');
  }

  Future<void> createSpecialty(Map<String, dynamic> data) async {
    await _api.post('/specialties', data: data);
  }

  Future<void> deleteSpecialty(String id) async {
    await _api.delete('/specialties/$id');
  }

  Future<void> seedDemoData() async {
    await _api.post('/admin/seed');
  }

  // ─── Sections ───
  Future<List<Map<String, dynamic>>> getSections() async {
    final res = await _api.get('/sections');
    return List<Map<String, dynamic>>.from(res.data);
  }

  Future<Map<String, dynamic>?> getSectionStats(String sectionKey, {String? specialtyId}) async {
    try {
      final params = <String, dynamic>{};
      if (specialtyId != null) params['specialtyId'] = specialtyId;
      final res = await _api.get('/evaluations/stats/$sectionKey', params: params);
      return res.data as Map<String, dynamic>?;
    } catch (_) {
      return null;
    }
  }

  // ─── Punishments ───
  Future<List<Map<String, dynamic>>> getPunishments(String soldierId) async {
    final res = await _api.get('/punishments/soldier/$soldierId');
    return List<Map<String, dynamic>>.from(res.data);
  }

  Future<void> createPunishment(Map<String, dynamic> data) async {
    await _api.post('/punishments', data: data);
  }

  // ─── Leaves / Personnel ───
  Future<Map<String, dynamic>> getLeavesDashboard() async {
    final res = await _api.get('/leaves/dashboard');
    return res.data as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getActiveLeaves() async {
    final res = await _api.get('/leaves/active');
    return List<Map<String, dynamic>>.from(res.data['leaves'] ?? []);
  }

  Future<List<Map<String, dynamic>>> getOverdueReturns() async {
    final res = await _api.get('/leaves/overdue-return');
    return List<Map<String, dynamic>>.from(res.data['leaves'] ?? []);
  }

  Future<List<Map<String, dynamic>>> getSoldiersNeedingLeave() async {
    final res = await _api.get('/leaves/needing-leave');
    return List<Map<String, dynamic>>.from(res.data['soldiers'] ?? []);
  }

  Future<Map<String, dynamic>> createLeave(Map<String, dynamic> data) async {
    final res = await _api.post('/leaves', data: data);
    return res.data as Map<String, dynamic>;
  }

  Future<void> confirmReturn(String leaveId) async {
    await _api.patch('/leaves/$leaveId/confirm-return');
  }

  Future<void> cancelLeave(String leaveId) async {
    await _api.patch('/leaves/$leaveId/cancel');
  }

  // ─── Distinctions ───
  Future<List<Map<String, dynamic>>> getDistinctions(String soldierId) async {
    try {
      final res = await _api.get('/distinctions/soldier/$soldierId');
      return List<Map<String, dynamic>>.from(res.data);
    } catch (_) {
      return [];
    }
  }

  Future<void> createDistinction(Map<String, dynamic> data) async {
    await _api.post('/distinctions', data: data);
  }

  // ─── Soldier Evaluations ───
  Future<List<Map<String, dynamic>>> getSoldierEvaluations(String soldierId, {String? sectionKey, String? specialtyId}) async {
    final params = <String, dynamic>{};
    if (sectionKey != null) params['section_key'] = sectionKey;
    if (specialtyId != null) params['specialty_id'] = specialtyId;
    final res = await _api.get('/evaluations/soldier/$soldierId', params: params);
    return List<Map<String, dynamic>>.from(res.data);
  }

  // ═══════════════════════════════════════════
  //  OFFLINE CACHE (SharedPreferences)
  // ═══════════════════════════════════════════
  Future<void> _cacheUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    prefs.setString('cached_user', jsonEncode(user.toJson()));
  }

  Future<UserModel?> _getCachedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('cached_user');
    if (raw == null) return null;
    return UserModel.fromJson(jsonDecode(raw));
  }

  Future<void> _cacheStats(DashboardStats stats) async {
    final prefs = await SharedPreferences.getInstance();
    prefs.setString('cached_stats', jsonEncode({
      'totalSoldiers': stats.totalSoldiers,
      'totalResults': stats.totalResults,
      'avgScore': stats.avgScore,
      'passRate': stats.passRate,
    }));
  }

  Future<void> _cacheSoldiers(List<SoldierModel> soldiers) async {
    final prefs = await SharedPreferences.getInstance();
    prefs.setString('cached_soldiers',
        jsonEncode(soldiers.map((s) => s.toJson()).toList()));
  }

  Future<void> _cacheNotifications(
      List<NotificationModel> notifications) async {
    final prefs = await SharedPreferences.getInstance();
    prefs.setString('cached_notifications', jsonEncode(
        notifications.map((n) => _notifToJson(n)).toList()));
  }

  Map<String, dynamic> _notifToJson(NotificationModel n) => {
    'id': n.id, 'type': n.type, 'message': n.message,
    'evaluated_name': n.evaluatedName,
    'evaluated_rank': n.evaluatedRank,
    'evaluated_id': n.evaluatedId,
    'fitness_score': n.fitnessScore,
    'specialty_score': n.specialtyScore,
    'discipline_score': n.disciplineScore,
    'total_score': n.totalScore,
    'is_read': n.isRead,
    'created_at': n.createdAt,
  };
}
