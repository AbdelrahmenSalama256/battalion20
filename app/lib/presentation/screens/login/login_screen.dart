import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../cubits/auth/auth_cubit.dart';
import '../../../core/constants/app_constants.dart';
import '../dashboard/dashboard_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usernameCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscured = true;

  @override
  void dispose() {
    _usernameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  void _login() {
    if (_usernameCtrl.text.isEmpty || _passwordCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('من فضلك أدخل اسم المستخدم وكلمة المرور'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      );
      return;
    }
    context.read<AuthCubit>().login(_usernameCtrl.text, _passwordCtrl.text);
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: EdgeInsets.symmetric(horizontal: 32.w, vertical: 24.h),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (!isLandscape) SizedBox(height: 40.h),
              Container(
                width: isLandscape ? 60.r : 90.r,
                height: isLandscape ? 60.r : 90.r,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(AC.gold), width: 2.5.r),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(AC.gold).withOpacity(0.2),
                      blurRadius: 20.r,
                      spreadRadius: 2.r,
                    ),
                  ],
                ),
                child: Icon(
                  Icons.shield_moon_outlined,
                  size: isLandscape ? 30.r : 45.r,
                  color: const Color(AC.gold),
                ),
              ),
              SizedBox(height: 16.h),
              Text(
                'كتيبة ٢٠',
                style: TextStyle(
                  fontSize: isLandscape ? 20.sp : 28.sp,
                  fontWeight: FontWeight.bold,
                  color: const Color(AC.gold),
                  letterSpacing: 2,
                ),
              ),
              SizedBox(height: 6.h),
              Text(
                'نظام التمييز العسكري',
                style: TextStyle(
                  fontSize: isLandscape ? 12.sp : 14.sp,
                  color: const Color(AC.textSecondary),
                  letterSpacing: 1,
                ),
              ),
              SizedBox(height: isLandscape ? 24.h : 48.h),
              TextField(
                controller: _usernameCtrl,
                textInputAction: TextInputAction.next,
                decoration: InputDecoration(
                  labelText: 'اسم المستخدم',
                  hintText: 'أدخل اسم المستخدم',
                  prefixIcon: Icon(Icons.person_outline, color: const Color(AC.gold), size: 20.r),
                  contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
                ),
              ),
              SizedBox(height: 14.h),
              TextField(
                controller: _passwordCtrl,
                obscureText: _obscured,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => _login(),
                decoration: InputDecoration(
                  labelText: 'كلمة المرور',
                  hintText: 'أدخل كلمة المرور',
                  prefixIcon: Icon(Icons.lock_outline, color: const Color(AC.gold), size: 20.r),
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                      color: const Color(AC.textSecondary),
                      size: 20.r,
                    ),
                    onPressed: () => setState(() => _obscured = !_obscured),
                  ),
                  contentPadding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 14.h),
                ),
              ),
              SizedBox(height: 32.h),
              BlocConsumer<AuthCubit, AuthState>(
                listener: (ctx, state) {
                  if (state is AuthAuthenticated) {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(builder: (_) => const DashboardScreen()),
                    );
                  } else if (state is AuthError) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(state.message),
                        backgroundColor: const Color(AC.danger),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    );
                  }
                },
                builder: (ctx, state) {
                  if (state is AuthLoading) {
                    return SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: null,
                        style: ElevatedButton.styleFrom(
                          padding: EdgeInsets.symmetric(vertical: 14.h),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
                          backgroundColor: const Color(AC.gold).withOpacity(0.6),
                        ),
                        child: SizedBox(
                          height: 20.h,
                          width: 20.w,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.r,
                            color: const Color(AC.bg),
                          ),
                        ),
                      ),
                    );
                  }
                  return SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _login,
                      style: ElevatedButton.styleFrom(
                        padding: EdgeInsets.symmetric(vertical: 14.h),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
                        backgroundColor: const Color(AC.gold),
                        foregroundColor: const Color(AC.bg),
                        elevation: 2,
                        shadowColor: const Color(AC.gold).withOpacity(0.4),
                      ),
                      child: Text(
                        'تسجيل الدخول',
                        style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold),
                      ),
                    ),
                  );
                },
              ),
              SizedBox(height: 40.h),
            ],
          ),
        ),
      ),
    );
  }
}
