import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../cubits/auth/auth_cubit.dart';
import '../../cubits/dashboard/dashboard_cubit.dart';
import '../../cubits/soldiers/soldiers_cubit.dart';
import '../../cubits/users/users_cubit.dart';
import '../../cubits/notifications/notifications_cubit.dart';
import '../../cubits/theme/theme_cubit.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/theme/route_transitions.dart';
import '../../../data/models/dashboard_stats_model.dart';
import '../../widgets/score_badge.dart';
import '../soldiers/soldiers_screen.dart';
import '../exams/exams_screen.dart';
import '../results/results_screen.dart';
import '../announcements/announcements_screen.dart';
import '../users/users_screen.dart';
import '../settings/settings_screen.dart';
import '../profile/profile_screen.dart';
import '../evaluations/evaluation_form_screen.dart';
import '../notifications/notifications_screen.dart';
import '../sections/section_detail_screen.dart';
import '../personnel/personnel_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    context.read<DashboardCubit>().loadStats();
    context.read<SoldiersCubit>().loadSoldiers();
    context.read<NotificationsCubit>().startPolling();
  }

  @override
  void dispose() {
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.select((AuthCubit c) => c.state is AuthAuthenticated ? (c.state as AuthAuthenticated).user : null);
    final isCommander = user?.role == 'commander';
    final perms = user?.permissions;
    final allowedPages = (perms != null ? perms['pages'] : null) as List<dynamic>?;
    final hasPagePerms = allowedPages != null && allowedPages.isNotEmpty;

    bool pageAllowed(String id) {
      if (id == 'notifications' || id == 'profile') return true;
      if (isCommander) return true;
      if (!hasPagePerms) return !['users', 'settings'].contains(id);
      return allowedPages.contains(id);
    }

    final allTabs = <_TabItem>[
      _TabItem('الرئيسية', Icons.dashboard_outlined, Icons.dashboard, 'dashboard'),
      _TabItem('الأفراد', Icons.people_outline, Icons.people, 'soldiers'),
      _TabItem('الإشعارات', Icons.notifications_outlined, Icons.notifications, 'notifications'),
      _TabItem('المستخدمين', Icons.manage_accounts_outlined, Icons.manage_accounts, 'users'),
      _TabItem('حسابي', Icons.person_outline, Icons.person, 'profile'),
    ];

    final tabs = allTabs.where((t) => pageAllowed(t.id)).toList();
    final screens = tabs.map((t) => _screenForId(t.id)).toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(tabs[_currentIndex].label, style: TextStyle(fontSize: 18.sp)),
        centerTitle: true,
        actions: [
          BlocBuilder<NotificationsCubit, NotificationsState>(
            builder: (ctx, state) {
              final unread = state is NotificationsLoaded ? state.unreadCount : 0;
              return Stack(
                clipBehavior: Clip.none,
                children: [
                  IconButton(
                    icon: Icon(Icons.notifications_outlined, color: const Color(AC.textSecondary), size: 22.r),
                    onPressed: () => _jumpToTab('notifications', tabs),
                  ),
                  if (unread > 0)
                    Positioned(
                      top: 6.h, left: 6.w,
                      child: Container(
                        padding: EdgeInsets.all(4.r),
                        decoration: const BoxDecoration(color: Color(AC.danger), shape: BoxShape.circle),
                        child: Text('$unread', style: TextStyle(fontSize: 9.sp, color: Colors.white, fontWeight: FontWeight.bold)),
                      ),
                    ),
                ],
              );
            },
          ),
          if (_currentIndex == 0)
            IconButton(
              icon: Icon(Icons.tune, color: const Color(AC.textSecondary), size: 20.r),
              onPressed: () => _showQuickActions(context, pageAllowed),
            ),
          if (_currentIndex == tabs.length - 1)
            IconButton(
              icon: Icon(Icons.logout, color: const Color(AC.danger), size: 20.r),
              tooltip: 'تسجيل الخروج',
              onPressed: () => _confirmLogout(),
            ),
          if (_currentIndex == tabs.length - 1)
            IconButton(
              icon: Icon(Icons.settings_outlined, color: const Color(AC.textSecondary), size: 20.r),
              onPressed: () => pageAllowed('settings') ? _pushWithAppBar(const SettingsScreen(), 'الإعدادات') : null,
            ),
        ],
      ),
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: IndexedStack(key: ValueKey(_currentIndex), index: _currentIndex, children: screens),
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: const Color(AC.cardBorder), width: 0.5)),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: (i) {
            setState(() => _currentIndex = i);
            if (i.isFinite && i < tabs.length) {
              final id = tabs[i].id;
              if (id == 'dashboard') context.read<DashboardCubit>().loadStats();
              if (id == 'soldiers') context.read<SoldiersCubit>().loadSoldiers();
              if (id == 'users') context.read<UsersCubit>().loadUsers();
            }
          },
          backgroundColor: const Color(AC.card),
          indicatorColor: const Color(AC.gold).withOpacity(0.15),
          height: 70.h,
          labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
          destinations: tabs.map((t) => NavigationDestination(
            icon: Icon(t.icon, color: const Color(AC.textSecondary), size: 22.r),
            selectedIcon: Icon(t.selectedIcon, color: const Color(AC.gold), size: 22.r),
            label: t.label,
          )).toList(),
        ),
      ),
    );
  }

  Widget _screenForId(String id) {
    switch (id) {
      case 'dashboard': return _buildDashboardTab();
      case 'soldiers': return const SoldiersScreen();
      case 'users': return const UsersScreen();
      case 'notifications': return const NotificationsScreen();
      case 'profile': return _buildProfileTab();
      default: return const SizedBox();
    }
  }

  Widget _buildProfileTab() {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        const ProfileScreen(),
        const Divider(height: 1),
        BlocBuilder<ThemeCubit, ThemeMode>(
          builder: (ctx, mode) => SwitchListTile(
            title: Text(
              mode == ThemeMode.dark ? 'الوضع النهاري' : 'الوضع الليلي',
              style: TextStyle(fontSize: 15.sp, color: const Color(AC.textPrimary)),
            ),
            secondary: Icon(
              mode == ThemeMode.dark ? Icons.light_mode : Icons.dark_mode,
              color: const Color(AC.gold),
            ),
            value: mode == ThemeMode.dark,
            onChanged: (_) => ctx.read<ThemeCubit>().toggle(),
          ),
        ),
      ],
    );
  }

  void _jumpToTab(String id, List<_TabItem> tabsList) {
    final idx = tabsList.indexWhere((t) => t.id == id);
    if (idx >= 0) setState(() => _currentIndex = idx);
  }

  void _confirmLogout() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(AC.card),
        title: Text('تسجيل الخروج', style: TextStyle(fontSize: 18.sp, color: const Color(AC.gold))),
        content: Text('هل أنت متأكد؟', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          ElevatedButton(
            onPressed: () { Navigator.pop(ctx); context.read<AuthCubit>().logout(); },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(AC.danger)),
            child: const Text('تسجيل الخروج'),
          ),
        ],
      ),
    );
  }

  void _showQuickActions(BuildContext context, bool Function(String) pageAllowed) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(AC.card),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.all(20.w),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(child: Container(width: 48.w, height: 4.h, decoration: BoxDecoration(color: const Color(AC.cardBorder), borderRadius: BorderRadius.circular(2.r)))),
            SizedBox(height: 16.h),
            Text('الوصول السريع', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
            SizedBox(height: 16.h),
            if (pageAllowed('exams')) _quickActionItem(ctx, 'الامتحانات', Icons.assignment_outlined, () => _pushWithAppBar(const ExamsScreen(), 'الامتحانات')),
            if (pageAllowed('results')) _quickActionItem(ctx, 'النتائج', Icons.grading_outlined, () => _pushWithAppBar(const ResultsScreen(), 'النتائج')),
            if (pageAllowed('announcements')) _quickActionItem(ctx, 'الإعلانات', Icons.campaign_outlined, () => _pushWithAppBar(const AnnouncementsScreen(), 'الإعلانات')),
            _quickActionItem(ctx, 'مكتب الأفراد', Icons.business_outlined, () => _pushWithAppBar(const PersonnelOfficeScreen(), 'مكتب الأفراد')),
            _quickActionItem(ctx, 'تقييم سريع', Icons.assignment_turned_in_outlined, () => _pushWithAppBar(const EvaluationFormScreen(), 'تقييم سريع')),
            if (pageAllowed('users')) _quickActionItem(ctx, 'المستخدمين', Icons.manage_accounts_outlined, () => _pushWithAppBar(const UsersScreen(), 'المستخدمين')),
            if (pageAllowed('settings')) _quickActionItem(ctx, 'الإعدادات', Icons.settings_outlined, () => _pushWithAppBar(const SettingsScreen(), 'الإعدادات')),
            SizedBox(height: 8.h),
          ],
        ),
      ),
    );
  }

  void _pushWithAppBar(Widget body, String title) {
    Navigator.pop(context);
    Navigator.push(context, fadeSlideRoute(Scaffold(
      appBar: AppBar(title: Text(title, style: TextStyle(fontSize: 18.sp)), centerTitle: true),
      body: body,
    )));
  }

  Widget _quickActionItem(BuildContext ctx, String label, IconData icon, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: const Color(AC.gold)),
      title: Text(label, style: TextStyle(fontSize: 15.sp, color: const Color(AC.textPrimary))),
      trailing: Icon(Icons.chevron_left, color: const Color(AC.textSecondary)),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
    );
  }

  Widget _buildSectionsGrid() {
    const sections = [
      {'key': 'specialties', 'name': 'التخصصات', 'icon': Icons.track_changes},
      {'key': 'general', 'name': 'العام', 'icon': Icons.assignment},
      {'key': 'fitness', 'name': 'اللياقة', 'icon': Icons.fitness_center},
      {'key': 'shooting', 'name': 'الرماية', 'icon': Icons.sports_martial_arts},
      {'key': 'discipline', 'name': 'الانضباط', 'icon': Icons.gavel},
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('الأقسام', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
        SizedBox(height: 8.h),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: 10.h,
            crossAxisSpacing: 10.w,
            childAspectRatio: 1.5,
          ),
          itemCount: sections.length,
          itemBuilder: (ctx, idx) {
            final s = sections[idx];
            return _DashboardSectionCard(
              keyKey: s['key'] as String,
              name: s['name'] as String,
              icon: s['icon'] as IconData,
            );
          },
        ),
      ],
    );
  }

  // ─── Dashboard Tab ──────────────────────────────────
  Widget _buildDashboardTab() {
    return BlocBuilder<DashboardCubit, DashboardState>(
      builder: (ctx, state) {
        if (state is DashboardLoading) {
          return Center(child: CircularProgressIndicator(color: const Color(AC.gold)));
        }
        if (state is DashboardError) {
          return _buildError('فشل تحميل البيانات', () => context.read<DashboardCubit>().loadStats());
        }
        if (state is! DashboardLoaded) return const SizedBox();
        final stats = state.stats;
        return RefreshIndicator(
          color: const Color(AC.gold),
          onRefresh: () => context.read<DashboardCubit>().loadStats(),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.all(16.w),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSummaryGrid(stats),
                SizedBox(height: 16.h),
                _buildSectionsGrid(),
                SizedBox(height: 16.h),
                _buildDistributionCard(stats.distribution),
                SizedBox(height: 16.h),
                _buildWeaponCard(stats.byWeapon),
                SizedBox(height: 16.h),
                _buildRecentCard(stats.recentResults),
                SizedBox(height: 24.h),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildError(String msg, VoidCallback onRetry) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.cloud_off, size: 64.r, color: const Color(AC.textSecondary)),
            SizedBox(height: 16.h),
            Text(msg, style: TextStyle(fontSize: 16.sp, color: const Color(AC.textSecondary)), textAlign: TextAlign.center),
            SizedBox(height: 24.h),
            ElevatedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryGrid(DashboardStats stats) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 10.h,
      crossAxisSpacing: 10.w,
      childAspectRatio: 1.6,
      children: [
        _summaryCard('الأفراد', stats.totalSoldiers.toString(), Icons.people_outline, const Color(AC.gold)),
        _summaryCard('النتائج', stats.totalResults.toString(), Icons.grading_outlined, const Color(AC.success)),
        _summaryCard('المعدل', '${stats.avgScore}%', Icons.trending_up, const Color(0xFF4FC3F7)),
        _summaryCard('النجاح', '${stats.passRate}%', Icons.check_circle_outline, const Color(0xFF66BB6A)),
      ],
    );
  }

  Widget _summaryCard(String label, String value, IconData icon, Color color) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(AC.card),
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(color: const Color(AC.cardBorder)),
      ),
      padding: EdgeInsets.all(14.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 22.r),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
                decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6.r)),
                child: Text(value, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: color)),
              ),
            ],
          ),
          SizedBox(height: 4.h),
          Text(label, style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary))),
        ],
      ),
    );
  }

  Widget _buildDistributionCard(ScoreDistribution dist) {
    final total = dist.excellent + dist.veryGood + dist.good + dist.acceptable + dist.fail;
    final items = [
      _DistItem('ممتاز', dist.excellent, total, const Color(0xFF1B8A2E)),
      _DistItem('جيد جداً', dist.veryGood, total, const Color(0xFF2D6A4F)),
      _DistItem('جيد', dist.good, total, const Color(AC.gold)),
      _DistItem('مقبول', dist.acceptable, total, const Color(AC.warning)),
      _DistItem('راسب', dist.fail, total, const Color(AC.danger)),
    ];
    return Container(
      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('توزيع الدرجات', Icons.pie_chart_outline),
          SizedBox(height: 16.h),
          if (total > 0)
            ...items.map((i) => Padding(
              padding: EdgeInsets.only(bottom: 8.h),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(width: 10.r, height: 10.r, decoration: BoxDecoration(color: i.color, shape: BoxShape.circle)),
                          SizedBox(width: 8.w),
                          Text(i.label, style: TextStyle(fontSize: 13.sp, color: const Color(AC.textPrimary))),
                        ],
                      ),
                      Text('${i.count} (${i.percent.toStringAsFixed(1)}%)', style: TextStyle(fontSize: 13.sp, color: i.color, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  SizedBox(height: 4.h),
                  ClipRRect(borderRadius: BorderRadius.circular(4.r), child: LinearProgressIndicator(value: i.fraction, backgroundColor: const Color(AC.cardBorder), color: i.color, minHeight: 6.h)),
                ],
              ),
            ))
          else
            Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 24.h), child: Text('لا توجد نتائج بعد', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))))),
        ],
      ),
    );
  }

  Widget _buildWeaponCard(List<WeaponStat> byWeapon) {
    return Container(
      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('حسب السلاح', Icons.sports_martial_arts),
          SizedBox(height: 12.h),
          if (byWeapon.isEmpty)
            Padding(padding: EdgeInsets.symmetric(vertical: 16.h), child: Center(child: Text('لا توجد بيانات', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary)))))
          else
            ...byWeapon.map((w) => Padding(
              padding: EdgeInsets.only(bottom: 8.h),
              child: Row(
                children: [
                  Container(width: 40.r, height: 40.r, decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.1), borderRadius: BorderRadius.circular(10.r)), child: Center(child: Text(w.weaponIcon, style: TextStyle(fontSize: 20.sp)))),
                  SizedBox(width: 12.w),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(w.weaponName, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
                    Text('${w.count} فرد', style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
                  ])),
                  ScoreBadge(score: w.avg),
                ],
              ),
            )),
        ],
      ),
    );
  }

  Widget _buildRecentCard(List<RecentResult> recent) {
    return Container(
      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('آخر النتائج', Icons.history),
          SizedBox(height: 12.h),
          if (recent.isEmpty)
            Padding(padding: EdgeInsets.symmetric(vertical: 16.h), child: Center(child: Text('لا توجد نتائج', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary)))))
          else
            ...recent.map((r) => Padding(
              padding: EdgeInsets.symmetric(vertical: 6.h),
              child: Row(
                children: [
                  Container(width: 36.r, height: 36.r, decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.1), borderRadius: BorderRadius.circular(8.r)), child: Center(child: Icon(Icons.person, color: const Color(AC.gold), size: 18.r))),
                  SizedBox(width: 12.w),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r.soldierName, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w500, color: const Color(AC.textPrimary))),
                    if (r.examTitle != null) Text(r.examTitle!, style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
                  ])),
                  ScoreBadge(score: r.totalScore),
                ],
              ),
            )),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, color: const Color(AC.gold), size: 18.r),
        SizedBox(width: 8.w),
        Text(title, style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
      ],
    );
  }

}

class _DashboardSectionCard extends StatelessWidget {
  final String keyKey;
  final String name;
  final IconData icon;
  const _DashboardSectionCard({super.key, required this.keyKey, required this.name, required this.icon});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SectionDetailScreen(sectionKey: keyKey))),
      borderRadius: BorderRadius.circular(12.r),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(AC.card),
          borderRadius: BorderRadius.circular(12.r),
          border: Border.all(color: const Color(AC.cardBorder)),
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: const Color(AC.gold), size: 28.r),
              SizedBox(height: 6.h),
              Text(name, style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary), fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabItem {
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final String id;
  _TabItem(this.label, this.icon, this.selectedIcon, this.id);
}

class _DistItem {
  final String label;
  final int count;
  final int total;
  final Color color;
  _DistItem(this.label, this.count, this.total, this.color);
  double get fraction => total > 0 ? count / total : 0;
  double get percent => total > 0 ? (count / total) * 100 : 0;
}
