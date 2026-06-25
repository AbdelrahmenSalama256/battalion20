import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../cubits/settings/settings_cubit.dart';
import '../../cubits/auth/auth_cubit.dart';
import '../../../core/network/api_service.dart';
import '../../../core/constants/app_constants.dart';
import '../../../data/repositories/api_repository.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => SettingsCubit(context.read<ApiService>()),
      child: _SettingsBody(),
    );
  }
}

class _SettingsBody extends StatefulWidget {
  @override
  State<_SettingsBody> createState() => _SettingsBodyState();
}

class _SettingsBodyState extends State<_SettingsBody> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  final _oldPwCtrl = TextEditingController();
  final _newPwCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscureOld = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    _oldPwCtrl.dispose();
    _newPwCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  void _changePassword() {
    if (_oldPwCtrl.text.isEmpty || _newPwCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(_snack('يرجى ملء جميع الحقول', const Color(AC.danger)));
      return;
    }
    if (_newPwCtrl.text.length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(_snack('كلمة المرور الجديدة قصيرة جداً', const Color(AC.danger)));
      return;
    }
    if (_newPwCtrl.text != _confirmCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(_snack('كلمتا المرور غير متطابقتين', const Color(AC.danger)));
      return;
    }
    context.read<SettingsCubit>().changePassword(_oldPwCtrl.text, _newPwCtrl.text);
  }

  SnackBar _snack(String msg, Color color) => SnackBar(
    content: Text(msg, style: TextStyle(fontSize: 14.sp)),
    backgroundColor: color,
    behavior: SnackBarBehavior.floating,
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
  );

  @override
  Widget build(BuildContext context) {
    final user = context.select((AuthCubit c) => c.state is AuthAuthenticated ? (c.state as AuthAuthenticated).user : null);
    final isCommander = user?.role == 'commander';

    return BlocListener<SettingsCubit, SettingsState>(
      listener: (ctx, state) {
        if (state is SettingsPasswordChanged) {
          ScaffoldMessenger.of(context).showSnackBar(_snack(state.message, const Color(AC.success)));
          _oldPwCtrl.clear();
          _newPwCtrl.clear();
          _confirmCtrl.clear();
        } else if (state is SettingsError) {
          ScaffoldMessenger.of(context).showSnackBar(_snack(state.message, const Color(AC.danger)));
        }
      },
      child: Column(
        children: [
          TabBar(
            controller: _tabCtrl,
            indicatorColor: const Color(AC.gold),
            labelColor: const Color(AC.gold),
            unselectedLabelColor: const Color(AC.textSecondary),
            labelStyle: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold),
            isScrollable: true,
            tabs: [
              const Tab(text: 'الحساب'),
              if (isCommander) const Tab(text: 'الأسلحة'),
              if (isCommander) const Tab(text: 'التخصصات'),
              if (isCommander) const Tab(text: 'الرتب'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabCtrl,
              children: [
                _buildAccountTab(),
                if (isCommander) _WeaponsTab(),
                if (isCommander) _SpecialtiesTab(),
                if (isCommander) _RanksTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountTab() {
    final user = context.select((AuthCubit c) => c.state is AuthAuthenticated ? (c.state as AuthAuthenticated).user : null);
    final isCommander = user?.role == 'commander';
    return SingleChildScrollView(
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(AC.card),
              borderRadius: BorderRadius.circular(12.r),
              border: Border.all(color: const Color(AC.cardBorder)),
            ),
            padding: EdgeInsets.all(16.w),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 32.r,
                  backgroundColor: const Color(AC.gold).withOpacity(0.15),
                  backgroundImage: user?.avatarUrl != null && user!.avatarUrl!.isNotEmpty ? NetworkImage(user.avatarUrl!) : null,
                  child: user?.avatarUrl == null || user!.avatarUrl!.isEmpty
                      ? Icon(Icons.shield, size: 32.r, color: const Color(AC.gold))
                      : null,
                ),
                SizedBox(height: 8.h),
                Text(user?.name ?? '', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
                Text('@${user?.username ?? ''}', style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary))),
                SizedBox(height: 4.h),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 3.h),
                  decoration: BoxDecoration(
                    color: const Color(AC.gold).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12.r),
                  ),
                  child: Text(
                    user?.role == 'commander' ? 'قائد' : user?.role == 'officer' ? 'ضابط' : 'ضابط صف',
                    style: TextStyle(fontSize: 12.sp, color: const Color(AC.gold), fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 24.h),
          Text('تغيير كلمة المرور', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
          SizedBox(height: 12.h),
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(AC.card),
              borderRadius: BorderRadius.circular(12.r),
              border: Border.all(color: const Color(AC.cardBorder)),
            ),
            padding: EdgeInsets.all(16.w),
            child: Column(
              children: [
                _passwordField(_oldPwCtrl, 'كلمة المرور القديمة', _obscureOld, () => setState(() => _obscureOld = !_obscureOld)),
                SizedBox(height: 12.h),
                _passwordField(_newPwCtrl, 'كلمة المرور الجديدة', _obscureNew, () => setState(() => _obscureNew = !_obscureNew)),
                SizedBox(height: 12.h),
                _passwordField(_confirmCtrl, 'تأكيد كلمة المرور', _obscureConfirm, () => setState(() => _obscureConfirm = !_obscureConfirm)),
                SizedBox(height: 16.h),
                BlocBuilder<SettingsCubit, SettingsState>(
                  builder: (ctx, state) {
                    if (state is SettingsLoading) {
                      return Center(child: CircularProgressIndicator(color: const Color(AC.gold)));
                    }
                    return SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _changePassword,
                        style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 14.h)),
                        child: Text('تغيير كلمة المرور', style: TextStyle(fontSize: 15.sp)),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
          SizedBox(height: 24.h),
          Text('حول التطبيق', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
          SizedBox(height: 12.h),
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(AC.card),
              borderRadius: BorderRadius.circular(12.r),
              border: Border.all(color: const Color(AC.cardBorder)),
            ),
            padding: EdgeInsets.all(16.w),
            child: Column(
              children: [
                _infoRow('التطبيق', 'كتيبة 20'),
                _infoRow('الإصدار', '2.0.0'),
                _infoRow('النظام', 'نظام التمييز العسكري'),
              ],
            ),
          ),
          if (isCommander) ...[
            SizedBox(height: 24.h),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  try {
                    final repo = ApiRepository(context.read<ApiService>());
                    await repo.seedDemoData();
                    ScaffoldMessenger.of(context).showSnackBar(_snack('✅ تم إضافة البيانات التجريبية', const Color(AC.success)));
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(_snack('فشل إضافة البيانات', const Color(AC.danger)));
                  }
                },
                icon: const Icon(Icons.eco, size: 18),
                label: Text('🌱 إضافة بيانات تجريبية', style: TextStyle(fontSize: 15.sp)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(AC.success).withOpacity(0.15),
                  foregroundColor: const Color(AC.success),
                  padding: EdgeInsets.symmetric(vertical: 14.h),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8.r),
                    side: BorderSide(color: const Color(AC.success).withOpacity(0.3)),
                  ),
                ),
              ),
            ),
          ],
          SizedBox(height: 24.h),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
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
              },
              icon: const Icon(Icons.logout, size: 18),
              label: Text('تسجيل الخروج', style: TextStyle(fontSize: 15.sp)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(AC.danger).withOpacity(0.15),
                foregroundColor: const Color(AC.danger),
                padding: EdgeInsets.symmetric(vertical: 14.h),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8.r),
                  side: BorderSide(color: const Color(AC.danger).withOpacity(0.3)),
                ),
              ),
            ),
          ),
          SizedBox(height: 32.h),
        ],
      ),
    );
  }

  Widget _passwordField(TextEditingController ctrl, String label, bool obscure, VoidCallback toggle) {
    return TextField(
      controller: ctrl,
      obscureText: obscure,
      decoration: InputDecoration(
        labelText: label,
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
        suffixIcon: IconButton(
          icon: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18.r, color: const Color(AC.textSecondary)),
          onPressed: toggle,
        ),
      ),
      style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary)),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.symmetric(vertical: 6.h),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))),
          Text(value, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
        ],
      ),
    );
  }
}

class _WeaponsTab extends StatefulWidget {
  @override
  State<_WeaponsTab> createState() => _WeaponsTabState();
}

class _WeaponsTabState extends State<_WeaponsTab> {
  List<Map<String, dynamic>> _weapons = [];
  final _nameCtrl = TextEditingController();
  final _iconCtrl = TextEditingController();
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final repo = ApiRepository(context.read<ApiService>());
      _weapons = await repo.getWeapons();
      if (mounted) setState(() => _loading = false);
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _add() async {
    if (_nameCtrl.text.isEmpty) return;
    try {
      final repo = ApiRepository(context.read<ApiService>());
      await repo.createWeapon({'name': _nameCtrl.text, 'icon': _iconCtrl.text.isNotEmpty ? _iconCtrl.text : null});
      _nameCtrl.clear(); _iconCtrl.clear();
      _load();
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('فشل الإضافة'), backgroundColor: const Color(AC.danger)));
    }
  }

  Future<void> _delete(String id) async {
    try {
      final repo = ApiRepository(context.read<ApiService>());
      await repo.deleteWeapon(id);
      _load();
    } catch (_) {}
  }

  @override
  void dispose() { _nameCtrl.dispose(); _iconCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator(color: Color(AC.gold)))
        : Column(
            children: [
              Padding(
                padding: EdgeInsets.all(12.w),
                child: Row(
                  children: [
                    Expanded(child: TextField(controller: _nameCtrl, decoration: InputDecoration(labelText: 'اسم السلاح', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)))),
                    SizedBox(width: 8.w),
                    SizedBox(width: 60.w, child: TextField(controller: _iconCtrl, decoration: InputDecoration(labelText: 'أيقونة', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)))),
                    SizedBox(width: 8.w),
                    ElevatedButton(onPressed: _add, style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 14.h)), child: const Text('إضافة')),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: EdgeInsets.symmetric(horizontal: 12.w),
                  itemCount: _weapons.length,
                  itemBuilder: (ctx, i) {
                    final w = _weapons[i];
                    return Container(
                      margin: EdgeInsets.only(bottom: 6.h),
                      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(8.r), border: Border.all(color: const Color(AC.cardBorder))),
                      child: ListTile(
                        leading: Text(w['icon'] ?? '⚔️', style: TextStyle(fontSize: 20.sp)),
                        title: Text(w['name'] ?? '', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
                        trailing: IconButton(icon: Icon(Icons.close, size: 16.r, color: const Color(AC.danger)), onPressed: () => _delete(w['id'])),
                      ),
                    );
                  },
                ),
              ),
            ],
          );
  }
}

class _SpecialtiesTab extends StatefulWidget {
  @override
  State<_SpecialtiesTab> createState() => _SpecialtiesTabState();
}

class _SpecialtiesTabState extends State<_SpecialtiesTab> {
  List<Map<String, dynamic>> _specialties = [];
  List<Map<String, dynamic>> _weapons = [];
  final _nameCtrl = TextEditingController();
  String? _weaponId;
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final repo = ApiRepository(context.read<ApiService>());
      _weapons = await repo.getWeapons();
      _specialties = await repo.getSpecialties();
      if (mounted) setState(() => _loading = false);
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _add() async {
    if (_nameCtrl.text.isEmpty || _weaponId == null) return;
    try {
      final repo = ApiRepository(context.read<ApiService>());
      await repo.createSpecialty({'name': _nameCtrl.text, 'weaponId': _weaponId});
      _nameCtrl.clear();
      _load();
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('فشل الإضافة'), backgroundColor: const Color(AC.danger)));
    }
  }

  Future<void> _delete(String id) async {
    try {
      final repo = ApiRepository(context.read<ApiService>());
      await repo.deleteSpecialty(id);
      _load();
    } catch (_) {}
  }

  @override
  void dispose() { _nameCtrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final filtered = _weaponId != null ? _specialties.where((s) => s['weapon_id'] == _weaponId).toList() : _specialties;
    return _loading
        ? const Center(child: CircularProgressIndicator(color: Color(AC.gold)))
        : Column(
            children: [
              Padding(
                padding: EdgeInsets.all(12.w),
                child: Row(
                  children: [
                    SizedBox(
                      width: 120.w,
                      child: DropdownButtonFormField<String>(
                        value: _weaponId,
                        decoration: InputDecoration(labelText: 'السلاح', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)),
                        dropdownColor: const Color(AC.card),
                        items: [DropdownMenuItem(value: null, child: Text('الكل', style: TextStyle(fontSize: 13.sp))), ..._weapons.map((w) => DropdownMenuItem(value: w['id'], child: Text(w['name'] ?? '', style: TextStyle(fontSize: 13.sp))))],
                        onChanged: (v) => setState(() => _weaponId = v),
                      ),
                    ),
                    SizedBox(width: 8.w),
                    Expanded(child: TextField(controller: _nameCtrl, decoration: InputDecoration(labelText: 'اسم التخصص', isDense: true, contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)))),
                    SizedBox(width: 8.w),
                    ElevatedButton(onPressed: _add, style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 14.h)), child: const Text('إضافة')),
                  ],
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: EdgeInsets.symmetric(horizontal: 12.w),
                  itemCount: filtered.length,
                  itemBuilder: (ctx, i) {
                    final s = filtered[i];
                    return Container(
                      margin: EdgeInsets.only(bottom: 6.h),
                      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(8.r), border: Border.all(color: const Color(AC.cardBorder))),
                      child: ListTile(
                        title: Text(s['name'] ?? '', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
                        subtitle: Text(_weapons.where((w) => w['id'] == s['weapon_id']).firstOrNull?['name'] ?? '', style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
                        trailing: IconButton(icon: Icon(Icons.close, size: 16.r, color: const Color(AC.danger)), onPressed: () => _delete(s['id'])),
                      ),
                    );
                  },
                ),
              ),
            ],
          );
  }
}

class _RanksTab extends StatefulWidget {
  @override
  State<_RanksTab> createState() => _RanksTabState();
}

class _RanksTabState extends State<_RanksTab> {
  List<Map<String, dynamic>> _rankTypes = [];
  List<Map<String, dynamic>> _ranks = [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final repo = ApiRepository(context.read<ApiService>());
      _rankTypes = await repo.getRankTypes();
      _ranks = await repo.getRanks();
      if (mounted) setState(() => _loading = false);
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Color _parseColor(dynamic c) {
    if (c == null) return const Color(AC.gold);
    final s = c.toString();
    if (s.isEmpty) return const Color(AC.gold);
    final hex = s.replaceFirst('#', '0xff');
    try {
      return Color(int.parse(hex));
    } catch (_) {
      return const Color(AC.gold);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _loading
        ? const Center(child: CircularProgressIndicator(color: Color(AC.gold)))
        : ListView(
            padding: EdgeInsets.all(12.w),
            children: [
              Container(
                decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('أنواع الرتب', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
                    SizedBox(height: 12.h),
                    ..._rankTypes.map((rt) => Padding(
                      padding: EdgeInsets.only(bottom: 8.h),
                      child: Row(
                        children: [
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                            decoration: BoxDecoration(
                              color: _parseColor(rt['color']).withOpacity(0.15),
                              borderRadius: BorderRadius.circular(6.r),
                            ),
                            child: Text(rt['name'] ?? '', style: TextStyle(fontSize: 13.sp, color: _parseColor(rt['color']))),
                          ),
                          SizedBox(width: 8.w),
                          Expanded(
                            child: Text(
                              _ranks.where((r) => r['type_id'] == rt['id']).map((r) => r['name']).join(' ← '),
                              style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary)),
                            ),
                          ),
                        ],
                      ),
                    )),
                  ],
                ),
              ),
              SizedBox(height: 16.h),
              Container(
                decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
                padding: EdgeInsets.all(16.w),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('جميع الرتب', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
                    SizedBox(height: 12.h),
                    ..._ranks.map((r) => Padding(
                      padding: EdgeInsets.symmetric(vertical: 4.h),
                      child: Row(
                        children: [
                          Text(r['name'] ?? '', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary))),
                          const Spacer(),
                          Text(
                            _rankTypes.where((rt) => rt['id'] == r['type_id']).firstOrNull?['name'] ?? '',
                            style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary)),
                          ),
                          SizedBox(width: 8.w),
                          Text('ترتيب ${r['sort_order'] ?? '-'}', style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary).withOpacity(0.6))),
                        ],
                      ),
                    )),
                  ],
                ),
              ),
            ],
          );
  }
}
