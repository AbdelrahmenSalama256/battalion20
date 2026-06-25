import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../cubits/users/users_cubit.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_service.dart';
import '../../../data/models/user_model.dart';
import '../../../data/repositories/api_repository.dart';
import '../../widgets/toast_helper.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  final _nameCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  String _selectedRole = 'officer';
  String? _selectedRankId;
  List<String> _allowedPages = [];
  List<Map<String, dynamic>> _ranks = [];
  bool _formLoading = false;

  static const _allPages = [
    'dashboard', 'soldiers', 'evaluation', 'exams', 'results',
    'notifications', 'announcements', 'users', 'settings',
  ];
  static const _pageLabels = {
    'dashboard': 'الرئيسية', 'soldiers': 'الأفراد', 'evaluation': 'التمييز',
    'exams': 'الامتحانات', 'results': 'النتائج', 'notifications': 'الإشعارات',
    'announcements': 'الإعلانات', 'users': 'المستخدمين', 'settings': 'الإعدادات',
  };

  @override
  void initState() {
    super.initState();
    _allowedPages = List.from(_allPages)..removeWhere((p) => ['users', 'settings'].contains(p));
    _loadRanks();
  }

  void _loadRanks() async {
    try {
      final repo = ApiRepository(context.read<ApiService>());
      _ranks = await repo.getRanks();
      if (mounted) setState(() {});
    } catch (_) {}
  }

  void _showForm() {
    _nameCtrl.clear();
    _usernameCtrl.clear();
    _passwordCtrl.clear();
    _selectedRole = 'officer';
    _selectedRankId = null;
    _allowedPages = List.from(_allPages)..removeWhere((p) => ['users', 'settings'].contains(p));
    _showFormSheet();
  }

  void _showFormSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(AC.card),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) => Padding(
          padding: EdgeInsets.fromLTRB(20.w, 16.w, 20.w, MediaQuery.of(ctx).viewInsets.bottom + 16.h),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(child: Container(width: 48.w, height: 4.h, decoration: BoxDecoration(color: const Color(AC.cardBorder), borderRadius: BorderRadius.circular(2.r)))),
                SizedBox(height: 16.h),
                Text('إضافة مستخدم', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
                SizedBox(height: 16.h),
                TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'الاسم')),
                SizedBox(height: 12.h),
                TextField(controller: _usernameCtrl, decoration: const InputDecoration(labelText: 'اسم المستخدم')),
                SizedBox(height: 12.h),
                TextField(controller: _passwordCtrl, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور')),
                SizedBox(height: 12.h),
                DropdownButtonFormField<String>(
                  value: _selectedRole,
                  decoration: const InputDecoration(labelText: 'الدور'),
                  dropdownColor: const Color(AC.card),
                  items: const [
                    DropdownMenuItem(value: 'commander', child: Text('قائد')),
                    DropdownMenuItem(value: 'officer', child: Text('ضابط')),
                    DropdownMenuItem(value: 'nco', child: Text('صف ضابط')),
                  ],
                  onChanged: (v) => setSheetState(() => _selectedRole = v!),
                ),
                SizedBox(height: 12.h),
                DropdownButtonFormField<String>(
                  value: _selectedRankId,
                  decoration: const InputDecoration(labelText: 'الرتبة (اختياري)'),
                  dropdownColor: const Color(AC.card),
                  items: [const DropdownMenuItem(value: null, child: Text('بدون رتبة')), ..._ranks.map((r) => DropdownMenuItem(value: r['id'], child: Text(r['name'] ?? '')))],
                  onChanged: (v) => setSheetState(() => _selectedRankId = v),
                ),
                SizedBox(height: 12.h),
                Text('الصفحات المسموح بها:', style: TextStyle(fontSize: 13.sp, color: const Color(AC.gold))),
                SizedBox(height: 4.h),
                Wrap(
                  spacing: 8.w, runSpacing: 4.h,
                  children: _allPages.where((p) => p != 'profile').map((p) => FilterChip(
                    label: Text(_pageLabels[p]!, style: TextStyle(fontSize: 11.sp)),
                    selected: _allowedPages.contains(p),
                    onSelected: (v) => setSheetState(() => v ? _allowedPages.add(p) : _allowedPages.remove(p)),
                    selectedColor: const Color(AC.gold).withOpacity(0.2),
                    checkmarkColor: const Color(AC.gold),
                    backgroundColor: const Color(AC.cardBorder),
                    labelStyle: TextStyle(color: _allowedPages.contains(p) ? const Color(AC.gold) : const Color(AC.textSecondary), fontSize: 11.sp),
                    visualDensity: VisualDensity.compact,
                    side: BorderSide.none,
                  )).toList(),
                ),
                SizedBox(height: 20.h),
                ElevatedButton(
                  onPressed: _formLoading ? null : () async {
                    if (_nameCtrl.text.isEmpty || _usernameCtrl.text.isEmpty || _passwordCtrl.text.isEmpty) {
                      showToast(context, 'يرجى إدخال جميع البيانات', isError: true);
                      return;
                    }
                    setSheetState(() => _formLoading = true);
                    try {
                      await context.read<UsersCubit>().createUser({
                        'name': _nameCtrl.text,
                        'username': _usernameCtrl.text,
                        'password': _passwordCtrl.text,
                        'role': _selectedRole,
                        'rankId': _selectedRankId,
                        'permissions': {'pages': _allowedPages},
                      });
                      if (ctx.mounted) Navigator.pop(ctx);
                      showToast(context, 'تم إنشاء المستخدم', isSuccess: true);
                    } catch (e) {
                      if (ctx.mounted) setSheetState(() => _formLoading = false);
                      showToast(context, 'فشل إنشاء المستخدم', isError: true);
                    }
                  },
                  style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 14.h)),
                  child: _formLoading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : Text('إنشاء', style: TextStyle(fontSize: 15.sp)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showPasswordDialog(UserModel user) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(AC.card),
        title: Text('تغيير كلمة المرور - ${user.name}', style: TextStyle(fontSize: 16.sp, color: const Color(AC.gold))),
        content: TextField(controller: ctrl, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور الجديدة')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('إلغاء')),
          ElevatedButton(onPressed: () async {
            if (ctrl.text.isEmpty) return;
            try {
              await context.read<UsersCubit>().updatePassword(user.id, ctrl.text);
              if (ctx.mounted) Navigator.pop(ctx);
              showToast(context, 'تم تغيير كلمة المرور', isSuccess: true);
            } catch (_) {
              showToast(context, 'فشل تغيير كلمة المرور', isError: true);
            }
          }, child: const Text('تغيير')),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: EdgeInsets.all(12.w),
          child: Row(
            children: [
              Text('المستخدمين', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
              const Spacer(),
              Container(
                decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.15), borderRadius: BorderRadius.circular(12.r)),
                child: IconButton(icon: Icon(Icons.add, color: const Color(AC.gold), size: 22.r), onPressed: _showForm),
              ),
            ],
          ),
        ),
        Expanded(
          child: BlocBuilder<UsersCubit, UsersState>(
            builder: (ctx, state) {
              if (state is UsersLoading) return const Center(child: CircularProgressIndicator(color: Color(AC.gold)));
              if (state is UsersError) return Center(child: Text(state.message, style: TextStyle(fontSize: 14.sp, color: const Color(AC.danger))));
              if (state is! UsersLoaded) return const SizedBox();
              final users = state.users;
              if (users.isEmpty) return Center(child: Text('لا يوجد مستخدمين', style: TextStyle(fontSize: 16.sp, color: const Color(AC.textSecondary))));
              return RefreshIndicator(
                color: const Color(AC.gold),
                onRefresh: () => context.read<UsersCubit>().loadUsers(),
                child: ListView.builder(
                  padding: EdgeInsets.symmetric(horizontal: 12.w),
                  itemCount: users.length,
                  itemBuilder: (ctx, i) {
                    final u = users[i];
                    return Container(
                      margin: EdgeInsets.only(bottom: 8.h),
                      decoration: BoxDecoration(
                        color: const Color(AC.card),
                        borderRadius: BorderRadius.circular(12.r),
                        border: Border.all(color: u.isActive ? const Color(AC.cardBorder) : const Color(AC.danger).withOpacity(0.3)),
                      ),
                      child: Padding(
                        padding: EdgeInsets.all(12.w),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                CircleAvatar(
                                  radius: 18.r,
                                  backgroundColor: const Color(AC.gold).withOpacity(0.15),
                                  child: Text(u.name[0].toUpperCase(), style: TextStyle(color: const Color(AC.gold), fontWeight: FontWeight.bold, fontSize: 14.sp)),
                                ),
                                SizedBox(width: 10.w),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(u.name, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
                                      Text('@${u.username}', style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                                  decoration: BoxDecoration(
                                    color: const Color(AC.gold).withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(12.r),
                                  ),
                                  child: Text(u.roleLabel, style: TextStyle(fontSize: 10.sp, color: const Color(AC.gold))),
                                ),
                              ],
                            ),
                            SizedBox(height: 8.h),
                            Row(
                              children: [
                                Icon(Icons.star_outline, size: 14.r, color: const Color(AC.textSecondary)),
                                SizedBox(width: 4.w),
                                Text(u.rankName ?? 'بدون رتبة', style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
                                const Spacer(),
                                Icon(Icons.circle, size: 8.r, color: u.isActive ? const Color(AC.success) : const Color(AC.danger)),
                                SizedBox(width: 4.w),
                                Text(u.isActive ? 'نشط' : 'معطل', style: TextStyle(fontSize: 11.sp, color: u.isActive ? const Color(AC.success) : const Color(AC.danger))),
                              ],
                            ),
                            SizedBox(height: 8.h),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                _actionBtn(Icons.lock_outline, 'تغيير كلمة المرور', () => _showPasswordDialog(u)),
                                SizedBox(width: 8.w),
                                _actionBtn(u.isActive ? Icons.block : Icons.check_circle_outline, u.isActive ? 'تعطيل' : 'تفعيل', () async {
                                  try {
                                    await context.read<UsersCubit>().toggleUser(u.id);
                                    showToast(context, u.isActive ? 'تم التعطيل' : 'تم التفعيل', isSuccess: true);
                                  } catch (_) {
                                    showToast(context, 'فشل', isError: true);
                                  }
                                }),
                                SizedBox(width: 8.w),
                                _actionBtn(Icons.delete_outline, 'حذف', () async {
                                  final confirm = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
                                    backgroundColor: const Color(AC.card),
                                    title: const Text('تأكيد الحذف'),
                                    content: Text('حذف ${u.name}؟'),
                                    actions: [
                                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('إلغاء')),
                                      ElevatedButton(onPressed: () => Navigator.pop(ctx, true), style: ElevatedButton.styleFrom(backgroundColor: const Color(AC.danger)), child: const Text('حذف')),
                                    ],
                                  ));
                                  if (confirm == true) {
                                    try {
                                      await context.read<UsersCubit>().deleteUser(u.id);
                                      showToast(context, 'تم الحذف', isSuccess: true);
                                    } catch (_) {
                                      showToast(context, 'فشل الحذف', isError: true);
                                    }
                                  }
                                }),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _actionBtn(IconData icon, String label, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8.r),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 6.h),
        decoration: BoxDecoration(
          color: const Color(AC.cardBorder).withOpacity(0.5),
          borderRadius: BorderRadius.circular(8.r),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14.r, color: const Color(AC.textSecondary)),
            SizedBox(width: 4.w),
            Text(label, style: TextStyle(fontSize: 10.sp, color: const Color(AC.textSecondary))),
          ],
        ),
      ),
    );
  }
}
