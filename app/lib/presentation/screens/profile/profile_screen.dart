import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_service.dart';
import '../../../data/models/user_model.dart';
import '../../../data/repositories/api_repository.dart';
import '../../cubits/auth/auth_cubit.dart';
import '../../widgets/toast_helper.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _nameCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _avatarCtrl = TextEditingController();
  final _oldPwdCtrl = TextEditingController();
  final _newPwdCtrl = TextEditingController();
  bool _editing = false;
  bool _saving = false;
  bool _showPwd = false;
  bool _pwdSaving = false;
  bool _obscureOld = true;
  bool _obscureNew = true;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _usernameCtrl.dispose();
    _avatarCtrl.dispose();
    _oldPwdCtrl.dispose();
    _newPwdCtrl.dispose();
    super.dispose();
  }

  void _startEdit(UserModel user) {
    _nameCtrl.text = user.name;
    _usernameCtrl.text = user.username;
    _avatarCtrl.text = user.avatarUrl ?? '';
    setState(() => _editing = true);
  }

  Future<void> _save(UserModel user) async {
    if (_nameCtrl.text.isEmpty) return;
    setState(() => _saving = true);
    try {
      final repo = ApiRepository(context.read<ApiService>());
      final updated = await repo.updateProfile({
        'name': _nameCtrl.text,
        if (_usernameCtrl.text != user.username) 'username': _usernameCtrl.text,
        if (_avatarCtrl.text != (user.avatarUrl ?? '')) 'avatarUrl': _avatarCtrl.text.isNotEmpty ? _avatarCtrl.text : null,
      });
      context.read<AuthCubit>().updateUser(updated);
      showToast(context, 'تم التحديث', isSuccess: true);
      setState(() => _editing = false);
    } catch (e) {
      showToast(context, 'فشل التحديث', isError: true);
    }
    setState(() => _saving = false);
  }

  Future<void> _changePassword() async {
    if (_oldPwdCtrl.text.isEmpty || _newPwdCtrl.text.isEmpty) {
      showToast(context, 'يرجى ملء جميع الحقول', isError: true);
      return;
    }
    if (_newPwdCtrl.text.length < 6) {
      showToast(context, 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', isError: true);
      return;
    }
    setState(() => _pwdSaving = true);
    try {
      final repo = ApiRepository(context.read<ApiService>());
      await repo.changePassword(_oldPwdCtrl.text, _newPwdCtrl.text);
      showToast(context, 'تم تغيير كلمة المرور', isSuccess: true);
      setState(() { _showPwd = false; _oldPwdCtrl.clear(); _newPwdCtrl.clear(); });
    } catch (e) {
      showToast(context, 'فشل تغيير كلمة المرور', isError: true);
    }
    setState(() => _pwdSaving = false);
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (ctx, state) {
        if (state is! AuthAuthenticated) return const SizedBox();
        final user = state.user;

        return SingleChildScrollView(
          padding: EdgeInsets.all(16.w),
          child: Column(
            children: [
              SizedBox(height: 20.h),
              Stack(
                children: [
                  CircleAvatar(
                    radius: 48.r,
                    backgroundColor: const Color(AC.gold).withOpacity(0.15),
                    backgroundImage: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                        ? NetworkImage(user.avatarUrl!)
                        : null,
                    child: user.avatarUrl == null || user.avatarUrl!.isEmpty
                        ? Icon(Icons.shield, size: 48.r, color: const Color(AC.gold))
                        : null,
                  ),
                ],
              ),
              SizedBox(height: 8.h),
              Text(user.name, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
              Text('@${user.username}', style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary))),
              SizedBox(height: 4.h),
              Container(
                padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 3.h),
                decoration: BoxDecoration(
                  color: const Color(AC.gold).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12.r),
                ),
                child: Text(user.roleLabel, style: TextStyle(fontSize: 12.sp, color: const Color(AC.gold), fontWeight: FontWeight.w600)),
              ),
              SizedBox(height: 24.h),

              // Profile info / edit card
              Card(
                color: const Color(AC.card),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r), side: const BorderSide(color: Color(AC.cardBorder))),
                child: Padding(
                  padding: EdgeInsets.all(16.w),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.person_outline, size: 18.r, color: const Color(AC.gold)),
                          SizedBox(width: 8.w),
                          Text('البيانات الشخصية', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
                          const Spacer(),
                          if (!_editing)
                            IconButton(
                              icon: Icon(Icons.edit, size: 18.r, color: const Color(AC.gold)),
                              onPressed: () => _startEdit(user),
                            ),
                        ],
                      ),
                      SizedBox(height: 12.h),
                      if (_editing) ...[
                        TextField(controller: _avatarCtrl, decoration: const InputDecoration(labelText: 'رابط الصورة الشخصية'), style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
                        SizedBox(height: 12.h),
                        TextField(controller: _nameCtrl, decoration: const InputDecoration(labelText: 'الاسم'), style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
                        SizedBox(height: 12.h),
                        TextField(controller: _usernameCtrl, decoration: const InputDecoration(labelText: 'اسم المستخدم'), style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
                        SizedBox(height: 16.h),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: _saving ? null : () => _save(user),
                                style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 12.h)),
                                child: _saving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('حفظ'),
                              ),
                            ),
                            SizedBox(width: 12.w),
                            Expanded(
                              child: TextButton(
                                onPressed: () => setState(() => _editing = false),
                                child: const Text('إلغاء'),
                              ),
                            ),
                          ],
                        ),
                      ] else ...[
                        _infoRow('الاسم', user.name),
                        _infoRow('اسم المستخدم', user.username),
                        _infoRow('الدور', user.roleLabel),
                        _infoRow('الرتبة', user.rankName ?? 'غير محدد'),
                      ],
                    ],
                  ),
                ),
              ),
              SizedBox(height: 16.h),

              // Password change
              if (!_showPwd)
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _showPwd = true),
                    icon: Icon(Icons.lock_outline, size: 16.r, color: const Color(AC.gold)),
                    label: Text('تغيير كلمة المرور', style: TextStyle(fontSize: 14.sp, color: const Color(AC.gold))),
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: const Color(AC.cardBorder)),
                      padding: EdgeInsets.symmetric(vertical: 14.h),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
                    ),
                  ),
                )
              else
                Card(
                  color: const Color(AC.card),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r), side: const BorderSide(color: Color(AC.cardBorder))),
                  child: Padding(
                    padding: EdgeInsets.all(16.w),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.lock_outline, size: 18.r, color: const Color(AC.gold)),
                            SizedBox(width: 8.w),
                            Text('تغيير كلمة المرور', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
                          ],
                        ),
                        SizedBox(height: 16.h),
                        TextField(
                          controller: _oldPwdCtrl,
                          obscureText: _obscureOld,
                          decoration: InputDecoration(
                            labelText: 'كلمة المرور القديمة',
                            suffixIcon: IconButton(
                              icon: Icon(_obscureOld ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18.r),
                              onPressed: () => setState(() => _obscureOld = !_obscureOld),
                            ),
                          ),
                          style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary)),
                        ),
                        SizedBox(height: 12.h),
                        TextField(
                          controller: _newPwdCtrl,
                          obscureText: _obscureNew,
                          decoration: InputDecoration(
                            labelText: 'كلمة المرور الجديدة',
                            suffixIcon: IconButton(
                              icon: Icon(_obscureNew ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18.r),
                              onPressed: () => setState(() => _obscureNew = !_obscureNew),
                            ),
                          ),
                          style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary)),
                        ),
                        SizedBox(height: 16.h),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton(
                                onPressed: _pwdSaving ? null : _changePassword,
                                style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 12.h)),
                                child: _pwdSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('تأكيد'),
                              ),
                            ),
                            SizedBox(width: 12.w),
                            Expanded(
                              child: TextButton(
                                onPressed: () { setState(() { _showPwd = false; _oldPwdCtrl.clear(); _newPwdCtrl.clear(); }); },
                                child: const Text('إلغاء'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              SizedBox(height: 16.h),

              // About card
              Card(
                color: const Color(AC.card),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r), side: const BorderSide(color: Color(AC.cardBorder))),
                child: Padding(
                  padding: EdgeInsets.all(16.w),
                  child: Column(
                    children: [
                      Center(
                        child: Column(
                          children: [
                            Text('🛡️ كتيبة 20', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
                            SizedBox(height: 4.h),
                            Text('نظام التمييز العسكري', style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary))),
                            SizedBox(height: 8.h),
                            Text('الإصدار 2.0.0', style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary).withOpacity(0.6))),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: 24.h),
            ],
          ),
        );
      },
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: 12.h),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80.w,
            child: Text(label, style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary))),
          ),
          Expanded(child: Text(value, style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary), fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }
}
