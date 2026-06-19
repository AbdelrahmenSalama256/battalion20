import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_service.dart';
import '../../../data/models/soldier_model.dart';
import '../../../data/repositories/api_repository.dart';

class PunishmentsScreen extends StatefulWidget {
  final String? soldierId;
  const PunishmentsScreen({super.key, this.soldierId});

  @override
  State<PunishmentsScreen> createState() => _PunishmentsScreenState();
}

class _PunishmentsScreenState extends State<PunishmentsScreen> {
  final _api = ApiService();
  late final ApiRepository _repo;

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _punishments = [];
  String? _selectedSoldierId;
  List<SoldierModel> _soldiers = [];

  @override
  void initState() {
    super.initState();
    _selectedSoldierId = widget.soldierId;
    _repo = ApiRepository(_api);
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _soldiers = await _repo.getSoldiers();
      if (_selectedSoldierId != null) {
        final res = await _api.get('/punishments/soldier/$_selectedSoldierId');
        _punishments = List<Map<String, dynamic>>.from(res.data is List ? res.data : []);
      }
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _loadPunishments() async {
    if (_selectedSoldierId == null) return;
    try {
      final res = await _api.get('/punishments/soldier/$_selectedSoldierId');
      if (mounted) setState(() => _punishments = List<Map<String, dynamic>>.from(res.data is List ? res.data : []));
    } catch (_) {}
  }

  Future<void> _addPunishment(Map<String, dynamic> data) async {
    try {
      await _api.post('/punishments', data: data);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('تم إضافة العقوبة', style: TextStyle(fontSize: 14.sp)),
          backgroundColor: const Color(AC.success),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
        ));
        _loadPunishments();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('فشل إضافة العقوبة', style: TextStyle(fontSize: 14.sp)),
          backgroundColor: const Color(AC.danger),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
        ));
      }
    }
  }

  void _showAddSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(AC.card),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20.r))),
      builder: (ctx) => _AddPunishmentSheet(
        soldiers: _soldiers,
        selectedSoldierId: _selectedSoldierId,
        onSubmit: _addPunishment,
      ),
    );
  }

  Color _colorForPunishment(String color) {
    switch (color) {
      case 'red': return const Color(AC.danger);
      case 'orange': return const Color(0xFFFF8C00);
      case 'yellow': return const Color(AC.warning);
      default: return const Color(AC.textSecondary);
    }
  }

  String _labelForColor(String color) {
    switch (color) {
      case 'red': return 'أحمر';
      case 'orange': return 'برتقالي';
      case 'yellow': return 'أصفر';
      default: return color;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('العقوبات', style: TextStyle(fontSize: 18.sp)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: Icon(Icons.add, color: const Color(AC.gold), size: 22.r),
            onPressed: _showAddSheet,
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
              : Column(
                  children: [
                    Padding(
                      padding: EdgeInsets.all(12.w),
                      child: DropdownButtonFormField<String>(
                        value: _selectedSoldierId,
                        decoration: InputDecoration(labelText: 'الجندي', contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)),
                        dropdownColor: const Color(AC.card),
                        items: _soldiers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name, style: TextStyle(fontSize: 14.sp)))).toList(),
                        onChanged: (v) {
                          setState(() => _selectedSoldierId = v);
                          _loadPunishments();
                        },
                      ),
                    ),
                    Expanded(
                      child: _punishments.isEmpty
                          ? Center(child: Text('لا توجد عقوبات', style: TextStyle(fontSize: 16.sp, color: const Color(AC.textSecondary))))
                          : RefreshIndicator(
                              color: const Color(AC.gold),
                              onRefresh: _loadPunishments,
                              child: ListView.builder(
                                padding: EdgeInsets.symmetric(horizontal: 12.w),
                                itemCount: _punishments.length,
                                itemBuilder: (ctx, i) {
                                  final p = _punishments[i];
                                  final colorStr = p['color'] as String? ?? 'yellow';
                                  final c = _colorForPunishment(colorStr);
                                  return Container(
                                    margin: EdgeInsets.only(bottom: 8.h),
                                    decoration: BoxDecoration(
                                      color: const Color(AC.card),
                                      borderRadius: BorderRadius.circular(12.r),
                                      border: Border.all(color: c.withOpacity(0.4)),
                                    ),
                                    padding: EdgeInsets.all(12.w),
                                    child: Row(
                                      children: [
                                        Container(
                                          width: 8.r,
                                          height: 48.r,
                                          decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(4.r)),
                                        ),
                                        SizedBox(width: 12.w),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(p['reason'] ?? '', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
                                              SizedBox(height: 4.h),
                                              Container(
                                                padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
                                                decoration: BoxDecoration(color: c.withOpacity(0.15), borderRadius: BorderRadius.circular(6.r)),
                                                child: Text(_labelForColor(colorStr), style: TextStyle(fontSize: 11.sp, color: c, fontWeight: FontWeight.w600)),
                                              ),
                                            ],
                                          ),
                                        ),
                                        if (p['created_at'] != null)
                                          Text(p['created_at'], style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                    ),
                  ],
                ),
    );
  }
}

class _AddPunishmentSheet extends StatefulWidget {
  final List<SoldierModel> soldiers;
  final String? selectedSoldierId;
  final Function(Map<String, dynamic>) onSubmit;
  const _AddPunishmentSheet({required this.soldiers, this.selectedSoldierId, required this.onSubmit});

  @override
  State<_AddPunishmentSheet> createState() => _AddPunishmentSheetState();
}

class _AddPunishmentSheetState extends State<_AddPunishmentSheet> {
  String? _soldierId;
  String _color = 'yellow';
  final _reasonCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _soldierId = widget.selectedSoldierId;
  }

  void _submit() {
    if (_soldierId == null || _reasonCtrl.text.isEmpty) return;
    widget.onSubmit({
      'soldier_id': _soldierId,
      'reason': _reasonCtrl.text,
      'color': _color,
    });
    Navigator.pop(context);
  }

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final colors = [
      {'key': 'red', 'label': 'أحمر', 'color': const Color(AC.danger)},
      {'key': 'orange', 'label': 'برتقالي', 'color': const Color(0xFFFF8C00)},
      {'key': 'yellow', 'label': 'أصفر', 'color': const Color(AC.warning)},
    ];
    return Padding(
      padding: EdgeInsets.fromLTRB(20.w, 16.w, 20.w, bottomInset + 16.h),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: Container(width: 48.w, height: 4.h, decoration: BoxDecoration(color: const Color(AC.cardBorder), borderRadius: BorderRadius.circular(2.r)))),
            SizedBox(height: 16.h),
            Text('إضافة عقوبة', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
            SizedBox(height: 16.h),
            DropdownButtonFormField<String>(
              value: _soldierId,
              decoration: InputDecoration(labelText: 'الجندي', contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)),
              dropdownColor: const Color(AC.card),
              items: widget.soldiers.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name, style: TextStyle(fontSize: 14.sp)))).toList(),
              onChanged: (v) => setState(() => _soldierId = v),
            ),
            SizedBox(height: 12.h),
            TextField(
              controller: _reasonCtrl,
              decoration: InputDecoration(labelText: 'السبب', contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h)),
              maxLines: 3,
            ),
            SizedBox(height: 16.h),
            Text('الدرجة:', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
            SizedBox(height: 8.h),
            Row(
              children: colors.map((c) {
                final selected = _color == c['key'];
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 4.w),
                    child: GestureDetector(
                      onTap: () => setState(() => _color = c['key'] as String),
                      child: Container(
                        padding: EdgeInsets.symmetric(vertical: 10.h),
                        decoration: BoxDecoration(
                          color: selected ? (c['color'] as Color).withOpacity(0.2) : const Color(AC.card),
                          borderRadius: BorderRadius.circular(10.r),
                          border: Border.all(color: selected ? c['color'] as Color : const Color(AC.cardBorder), width: selected ? 2 : 1),
                        ),
                        child: Column(
                          children: [
                            Container(
                              width: 28.r, height: 28.r,
                              decoration: BoxDecoration(color: c['color'] as Color, borderRadius: BorderRadius.circular(8.r)),
                            ),
                            SizedBox(height: 4.h),
                            Text(c['label'] as String, style: TextStyle(fontSize: 12.sp, color: selected ? c['color'] as Color : const Color(AC.textSecondary), fontWeight: selected ? FontWeight.w600 : FontWeight.normal)),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            SizedBox(height: 20.h),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submit,
                    style: ElevatedButton.styleFrom(padding: EdgeInsets.symmetric(vertical: 14.h)),
                    child: Text('إضافة', style: TextStyle(fontSize: 15.sp)),
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
