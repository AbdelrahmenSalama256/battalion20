import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_service.dart';
import '../../../data/models/soldier_model.dart';
import '../../../data/repositories/api_repository.dart';

class PersonnelOfficeScreen extends StatefulWidget {
  const PersonnelOfficeScreen({super.key});

  @override
  State<PersonnelOfficeScreen> createState() => _PersonnelOfficeScreenState();
}

class _PersonnelOfficeScreenState extends State<PersonnelOfficeScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();

  late TabController _tabCtrl;

  bool _loading = true;
  String? _error;

  int _totalSoldiers = 0;
  int _onLeave = 0;
  int _needingLeave = 0;
  int _returningToday = 0;

  List<Map<String, dynamic>> _activeLeaves = [];
  List<Map<String, dynamic>> _overdueReturns = [];
  List<Map<String, dynamic>> _needingLeaveList = [];
  List<Map<String, dynamic>> _upcomingReturns = [];

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 4, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final dashboard = await _api.get('/leaves/dashboard');
      final d = dashboard.data as Map<String, dynamic>;
      _totalSoldiers = (d['total'] as num?)?.toInt() ?? 0;
      _onLeave = (d['onLeave'] as num?)?.toInt() ?? 0;
      _needingLeave = (d['needingLeave'] as num?)?.toInt() ?? 0;
      _returningToday = (d['returningToday'] as num?)?.toInt() ?? 0;
      _upcomingReturns = (d['upcomingReturns'] as List?)?.cast<Map<String, dynamic>>() ?? [];

      final active = await _api.get('/leaves/active');
      _activeLeaves = (active.data['leaves'] as List?)?.cast<Map<String, dynamic>>() ?? [];

      final overdue = await _api.get('/leaves/overdue-return');
      _overdueReturns = (overdue.data['leaves'] as List?)?.cast<Map<String, dynamic>>() ?? [];

      final needing = await _api.get('/leaves/needing-leave');
      _needingLeaveList = (needing.data['soldiers'] as List?)?.cast<Map<String, dynamic>>() ?? [];

      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _createLeave(Map<String, dynamic> data) async {
    try {
      await _api.post('/leaves', data: data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('تم إنشاء الإجازة', style: TextStyle(fontSize: 14.sp)),
          backgroundColor: const Color(AC.success),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
        ));
        _load();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('فشل إنشاء الإجازة', style: TextStyle(fontSize: 14.sp)),
          backgroundColor: const Color(AC.danger),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
        ));
      }
    }
  }

  Future<void> _confirmReturn(String id) async {
    try {
      await _api.patch('/leaves/$id/confirm-return');
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('فشل تأكيد العودة', style: TextStyle(fontSize: 14.sp)),
          backgroundColor: const Color(AC.danger),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
        ));
      }
    }
  }

  Future<void> _cancelLeave(String id) async {
    try {
      await _api.patch('/leaves/$id/cancel');
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('فشل إلغاء الإجازة', style: TextStyle(fontSize: 14.sp)),
          backgroundColor: const Color(AC.danger),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
        ));
      }
    }
  }

  void _showCreateLeaveSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(AC.card),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (ctx) => _CreateLeaveSheet(api: _api, onCreate: _createLeave),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('مكتب الأفراد', style: TextStyle(fontSize: 18.sp)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.add, color: const Color(AC.gold), size: 22.r),
            onPressed: _showCreateLeaveSheet,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(AC.gold)))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 48.r, color: const Color(AC.danger)),
                      SizedBox(height: 8.h),
                      Text('فشل التحميل', style: TextStyle(fontSize: 14.sp, color: const Color(AC.danger))),
                      SizedBox(height: 16.h),
                      ElevatedButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
                    ],
                  ),
                )
              : RefreshIndicator(
                  color: const Color(AC.gold),
                  onRefresh: _load,
                  child: NestedScrollView(
                    headerSliverBuilder: (ctx, inner) => [
                      SliverToBoxAdapter(child: _buildStatsCards()),
                      SliverToBoxAdapter(child: SizedBox(height: 8.h)),
                      SliverPersistentHeader(
                        pinned: true,
                        delegate: _TabBarDelegate(
                          TabBar(
                            controller: _tabCtrl,
                            isScrollable: true,
                            labelColor: const Color(AC.gold),
                            unselectedLabelColor: const Color(AC.textSecondary),
                            indicatorColor: const Color(AC.gold),
                            labelStyle: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.w600),
                            tabs: const [
                              Tab(text: 'مستحقين الإجازة'),
                              Tab(text: 'إجازات نشطة'),
                              Tab(text: 'متأخرين عن العودة'),
                              Tab(text: 'عائدون قريباً'),
                            ],
                          ),
                        ),
                      ),
                    ],
                    body: TabBarView(
                      controller: _tabCtrl,
                      children: [
                        _buildNeedingLeave(),
                        _buildActiveLeaves(),
                        _buildOverdueReturns(),
                        _buildUpcomingReturns(),
                      ],
                    ),
                  ),
                ),
    );
  }

  Widget _buildStatsCards() {
    final cards = [
      {'label': 'إجمالي الأفراد', 'value': '$_totalSoldiers', 'color': const Color(AC.gold)},
      {'label': 'في إجازة', 'value': '$_onLeave', 'color': const Color(AC.warning)},
      {'label': 'مستحقين إجازة', 'value': '$_needingLeave', 'color': const Color(AC.danger)},
      {'label': 'عائدون اليوم', 'value': '$_returningToday', 'color': const Color(AC.success)},
    ];
    return Padding(
      padding: EdgeInsets.all(12.w),
      child: GridView.count(
        crossAxisCount: 4,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 8.w,
        crossAxisSpacing: 8.w,
        childAspectRatio: 0.8,
        children: cards.map((c) => Container(
          decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
          padding: EdgeInsets.all(8.w),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(c['value'] as String, style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.bold, color: c['color'] as Color)),
              SizedBox(height: 2.h),
              Text(c['label'] as String, style: TextStyle(fontSize: 9.sp, color: const Color(AC.textSecondary)), textAlign: TextAlign.center, maxLines: 2),
            ],
          ),
        )).toList(),
      ),
    );
  }

  Widget _buildNeedingLeave() {
    if (_needingLeaveList.isEmpty) {
      return Center(child: Text('لا يوجد جنود مستحقين إجازة', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))));
    }
    return ListView.builder(
      padding: EdgeInsets.all(12.w),
      itemCount: _needingLeaveList.length,
      itemBuilder: (ctx, i) {
        final s = _needingLeaveList[i];
        return Container(
          margin: EdgeInsets.only(bottom: 8.h),
          decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
          child: ListTile(
            leading: Container(
              width: 44.r, height: 44.r,
              decoration: BoxDecoration(color: const Color(AC.danger).withOpacity(0.1), borderRadius: BorderRadius.circular(12.r)),
              child: Center(child: Text(s['rank_icon'] ?? '👤', style: TextStyle(fontSize: 22.sp))),
            ),
            title: Text(s['name'] ?? '', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
            subtitle: Text('${s['days_since_last'] ?? 0} يوم بدون إجازة', style: TextStyle(fontSize: 12.sp, color: const Color(AC.danger))),
            trailing: IconButton(
              icon: Icon(Icons.add_circle_outline, color: const Color(AC.gold), size: 22.r),
              onPressed: () {},
            ),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
          ),
        );
      },
    );
  }

  Widget _buildActiveLeaves() {
    if (_activeLeaves.isEmpty) {
      return Center(child: Text('لا توجد إجازات نشطة', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))));
    }
    return ListView.builder(
      padding: EdgeInsets.all(12.w),
      itemCount: _activeLeaves.length,
      itemBuilder: (ctx, i) {
        final l = _activeLeaves[i];
        final id = l['id'] as String? ?? '';
        return Container(
          margin: EdgeInsets.only(bottom: 8.h),
          decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
          padding: EdgeInsets.all(12.w),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(child: Text(l['soldier_name'] ?? '', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary)))),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                    decoration: BoxDecoration(color: const Color(AC.success).withOpacity(0.15), borderRadius: BorderRadius.circular(6.r)),
                    child: Text('نشطة', style: TextStyle(fontSize: 11.sp, color: const Color(AC.success))),
                  ),
                ],
              ),
              SizedBox(height: 4.h),
              Text('من ${l['start_date'] ?? '-'} إلى ${l['end_date'] ?? '-'}', style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
              if (l['notes'] != null && (l['notes'] as String).isNotEmpty) ...[
                SizedBox(height: 2.h),
                Text(l['notes'], style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
              ],
              SizedBox(height: 8.h),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 32.h,
                      child: ElevatedButton(
                        onPressed: () => _confirmReturn(id),
                        style: ElevatedButton.styleFrom(padding: EdgeInsets.zero, backgroundColor: const Color(AC.success).withOpacity(0.15)),
                        child: Text('تأكيد العودة', style: TextStyle(fontSize: 12.sp, color: const Color(AC.success))),
                      ),
                    ),
                  ),
                  SizedBox(width: 8.w),
                  Expanded(
                    child: SizedBox(
                      height: 32.h,
                      child: ElevatedButton(
                        onPressed: () => _cancelLeave(id),
                        style: ElevatedButton.styleFrom(padding: EdgeInsets.zero, backgroundColor: const Color(AC.danger).withOpacity(0.15)),
                        child: Text('إلغاء', style: TextStyle(fontSize: 12.sp, color: const Color(AC.danger))),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildOverdueReturns() {
    if (_overdueReturns.isEmpty) {
      return Center(child: Text('لا يوجد متأخرين', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))));
    }
    return ListView.builder(
      padding: EdgeInsets.all(12.w),
      itemCount: _overdueReturns.length,
      itemBuilder: (ctx, i) {
        final l = _overdueReturns[i];
        final id = l['id'] as String? ?? '';
        return Container(
          margin: EdgeInsets.only(bottom: 8.h),
          decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.danger).withOpacity(0.3))),
          padding: EdgeInsets.all(12.w),
          child: Row(
            children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(l['soldier_name'] ?? '', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
                Text('متأخر ${l['days_overdue'] ?? 0} يوم', style: TextStyle(fontSize: 12.sp, color: const Color(AC.danger))),
              ])),
              ElevatedButton(
                onPressed: () => _confirmReturn(id),
                style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(horizontal: 12.w), backgroundColor: const Color(AC.gold).withOpacity(0.15)),
                child: Text('تأكيد العودة', style: TextStyle(fontSize: 12.sp, color: const Color(AC.gold))),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildUpcomingReturns() {
    if (_upcomingReturns.isEmpty) {
      return Center(child: Text('لا توجد عائدات قريبة', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))));
    }
    return ListView.builder(
      padding: EdgeInsets.all(12.w),
      itemCount: _upcomingReturns.length,
      itemBuilder: (ctx, i) {
        final l = _upcomingReturns[i];
        return Container(
          margin: EdgeInsets.only(bottom: 8.h),
          decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
          child: ListTile(
            leading: Container(
              width: 44.r, height: 44.r,
              decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.1), borderRadius: BorderRadius.circular(12.r)),
              child: Center(child: Text('📅', style: TextStyle(fontSize: 22.sp))),
            ),
            title: Text(l['soldier_name'] ?? '', style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
            subtitle: Text('عودة في ${l['return_date'] ?? '-'}', style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
          ),
        );
      },
    );
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  _TabBarDelegate(this.tabBar);

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(color: const Color(AC.bg), child: tabBar);
  }

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  bool shouldRebuild(_TabBarDelegate old) => false;
}

class _CreateLeaveSheet extends StatefulWidget {
  final ApiService api;
  final Function(Map<String, dynamic>) onCreate;
  const _CreateLeaveSheet({required this.api, required this.onCreate});

  @override
  State<_CreateLeaveSheet> createState() => _CreateLeaveSheetState();
}

class _CreateLeaveSheetState extends State<_CreateLeaveSheet> {
  final _repo = ApiRepository(ApiService());
  List<SoldierModel> _soldiers = [];
  bool _loadingSoldiers = true;

  String? _selectedSoldierId;
  final _startCtrl = TextEditingController();
  final _endCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadSoldiers();
  }

  Future<void> _loadSoldiers() async {
    try {
      _soldiers = await _repo.getSoldiers();
      if (mounted) setState(() => _loadingSoldiers = false);
    } catch (_) {
      if (mounted) setState(() => _loadingSoldiers = false);
    }
  }

  void _submit() {
    if (_selectedSoldierId == null || _startCtrl.text.isEmpty || _endCtrl.text.isEmpty) return;
    widget.onCreate({
      'soldier_id': _selectedSoldierId,
      'start_date': _startCtrl.text,
      'end_date': _endCtrl.text,
      'notes': _notesCtrl.text.isNotEmpty ? _notesCtrl.text : null,
    });
    Navigator.pop(context);
  }

  @override
  void dispose() {
    _startCtrl.dispose();
    _endCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20.w, 16.w, 20.w, bottomInset + 16.h),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: Container(width: 48.w, height: 4.h, decoration: BoxDecoration(color: const Color(AC.cardBorder), borderRadius: BorderRadius.circular(2.r)))),
            SizedBox(height: 16.h),
            Text('إنشاء إجازة', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
            SizedBox(height: 16.h),
            if (_loadingSoldiers)
              const Center(child: CircularProgressIndicator(color: Color(AC.gold)))
            else
              DropdownButtonFormField<String>(
                value: _selectedSoldierId,
                decoration: InputDecoration(labelText: 'الجندي', contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)),
                dropdownColor: const Color(AC.card),
                items: _soldiers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name, style: TextStyle(fontSize: 14.sp)))).toList(),
                onChanged: (v) => setState(() => _selectedSoldierId = v),
              ),
            SizedBox(height: 12.h),
            TextField(controller: _startCtrl, decoration: InputDecoration(labelText: 'تاريخ البداية', contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h))),
            SizedBox(height: 12.h),
            TextField(controller: _endCtrl, decoration: InputDecoration(labelText: 'تاريخ النهاية', contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h))),
            SizedBox(height: 12.h),
            TextField(controller: _notesCtrl, decoration: InputDecoration(labelText: 'ملاحظات', contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)), maxLines: 3),
            SizedBox(height: 20.h),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submit,
                    style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 14.h)),
                    child: Text('إنشاء', style: TextStyle(fontSize: 15.sp)),
                  ),
                ),
                SizedBox(width: 12.w),
                Expanded(
                  child: TextButton(
                    onPressed: () => Navigator.pop(context),
                    style: TextButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 14.h), foregroundColor: const Color(AC.textSecondary)),
                    child: Text('إلغاء', style: TextStyle(fontSize: 15.sp)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
