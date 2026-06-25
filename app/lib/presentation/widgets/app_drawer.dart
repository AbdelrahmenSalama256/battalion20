import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../core/constants/app_constants.dart';
import '../../core/network/api_service.dart';
import '../../data/repositories/api_repository.dart';
import '../cubits/auth/auth_cubit.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/users/users_screen.dart';
import '../screens/notifications/notifications_screen.dart';

class AppDrawer extends StatefulWidget {
  const AppDrawer({super.key});

  @override
  State<AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends State<AppDrawer> {
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _loadUnread();
  }

  void _loadUnread() async {
    try {
      final repo = ApiRepository(context.read<ApiService>());
      final count = await repo.getUnreadCount();
      if (mounted) setState(() => _unreadCount = count);
    } catch (_) {}
  }

  void _navigate(Widget screen) {
    Navigator.of(context).pop();
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(AC.card),
      width: 280.w,
      child: BlocBuilder<AuthCubit, AuthState>(
        builder: (ctx, state) {
          if (state is! AuthAuthenticated) return const SizedBox();
          final user = state.user;
          final isCommander = user.role == 'commander';
          return Column(
            children: [
              Container(
                padding: EdgeInsets.fromLTRB(20.w, 48.h, 20.w, 20.h),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: const Color(AC.cardBorder), width: 0.5)),
                ),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 36.r,
                      backgroundColor: const Color(AC.gold).withOpacity(0.15),
                      child: Icon(Icons.shield, size: 36.r, color: const Color(AC.gold)),
                    ),
                    SizedBox(height: 12.h),
                    Text(user.name, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
                    SizedBox(height: 4.h),
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 4.h),
                      decoration: BoxDecoration(
                        color: const Color(AC.gold).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(20.r),
                      ),
                      child: Text(
                        user.roleLabel,
                        style: TextStyle(fontSize: 12.sp, color: const Color(AC.gold), fontWeight: FontWeight.w600),
                      ),
                    ),
                    if (user.rankName != null) ...[
                      SizedBox(height: 4.h),
                      Text(user.rankName!, style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
                    ],
                  ],
                ),
              ),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.only(top: 8.h),
                  children: [
                    _drawerItem(Icons.person_outline, 'حسابي', () => _navigate(const ProfileScreen())),
                    _drawerItem(Icons.notifications_outlined, 'الإشعارات', () => _navigate(const NotificationsScreen()), badge: _unreadCount),
                    if (isCommander)
                      _drawerItem(Icons.people_outline, 'المستخدمين', () => _navigate(const UsersScreen())),
                    Divider(color: const Color(AC.cardBorder), height: 24.h),
                    _drawerItem(Icons.info_outline, 'حول التطبيق', () {
                      Navigator.of(context).pop();
                      showDialog(
                        context: context,
                        builder: (ctx) => AlertDialog(
                          backgroundColor: const Color(AC.card),
                          title: Text('🛡️ كتيبة 20', style: TextStyle(color: const Color(AC.gold), fontSize: 18.sp)),
                          content: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('نظام التمييز العسكري', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))),
                              SizedBox(height: 8.h),
                              Text('الإصدار 2.0.0', style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary).withOpacity(0.6))),
                            ],
                          ),
                          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('حسناً'))],
                        ),
                      );
                    }),
                  ],
                ),
              ),
              Container(
                padding: EdgeInsets.all(16.w),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: const Color(AC.cardBorder), width: 0.5)),
                ),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      context.read<AuthCubit>().logout();
                      Navigator.of(context).pop();
                    },
                    icon: const Icon(Icons.logout, size: 18),
                    label: Text('تسجيل الخروج', style: TextStyle(fontSize: 14.sp)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(AC.danger).withOpacity(0.15),
                      foregroundColor: const Color(AC.danger),
                      padding: EdgeInsets.symmetric(vertical: 12.h),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8.r),
                        side: BorderSide(color: const Color(AC.danger).withOpacity(0.3)),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _drawerItem(IconData icon, String label, VoidCallback onTap, {int badge = 0}) {
    return ListTile(
      leading: Icon(icon, color: const Color(AC.gold), size: 22.r),
      title: Text(label, style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
      trailing: badge > 0
          ? Container(
              padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
              decoration: BoxDecoration(
                color: const Color(AC.danger),
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Text('$badge', style: TextStyle(fontSize: 11.sp, color: Colors.white, fontWeight: FontWeight.bold)),
            )
          : null,
      onTap: onTap,
    );
  }
}
