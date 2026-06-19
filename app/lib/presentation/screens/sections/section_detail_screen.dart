import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_service.dart';
import '../../../data/models/soldier_model.dart';
import '../../../data/repositories/api_repository.dart';
import '../../widgets/score_badge.dart';

class SectionDetailScreen extends StatefulWidget {
  final String sectionKey;
  const SectionDetailScreen({super.key, required this.sectionKey});

  @override
  State<SectionDetailScreen> createState() => _SectionDetailScreenState();
}

class _SectionDetailScreenState extends State<SectionDetailScreen> {
  final _repo = ApiRepository(ApiService());

  List<Map<String, dynamic>> _specialties = [];
  List<Map<String, dynamic>> _stats = [];
  List<SoldierModel> _soldiers = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      if (widget.sectionKey == 'specialties') {
        _specialties = await _repo.getSpecialties();
      } else {
        final results = await Future.wait([
          _repo.getSoldiers(),
          _repo.getStats(),
        ]);
        _soldiers = results[0] as List<SoldierModel>;
        _stats = [
          {'label': 'متوسط الدرجات', 'value': '${(results[1] as dynamic).avgScore ?? '-'}', 'icon': Icons.trending_up, 'color': const Color(AC.gold)},
          {'label': 'إجمالي الأفراد', 'value': '${(results[1] as dynamic).totalSoldiers ?? '-'}', 'icon': Icons.people_outline, 'color': const Color(AC.success)},
          {'label': 'عدد التقييمات', 'value': '${(results[1] as dynamic).totalResults ?? '-'}', 'icon': Icons.assignment_turned_in_outlined, 'color': const Color(0xFF4FC3F7)},
        ];
      }
      if (mounted) setState(() => _loading = false);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  String get _title {
    switch (widget.sectionKey) {
      case 'specialties': return 'التخصصات';
      case 'general': return 'العام';
      case 'fitness': return 'اللياقة';
      case 'shooting': return 'الرماية';
      case 'discipline': return 'الانضباط';
      default: return widget.sectionKey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_title, style: TextStyle(fontSize: 18.sp)),
        centerTitle: true,
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
              : widget.sectionKey == 'specialties'
                  ? _buildSpecialtiesList()
                  : _buildSectionsContent(),
    );
  }

  Widget _buildSpecialtiesList() {
    if (_specialties.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.track_changes, size: 64.r, color: const Color(AC.textSecondary)),
            SizedBox(height: 12.h),
            Text('لا توجد تخصصات', style: TextStyle(fontSize: 16.sp, color: const Color(AC.textSecondary))),
          ],
        ),
      );
    }
    return RefreshIndicator(
      color: const Color(AC.gold),
      onRefresh: _load,
      child: ListView.builder(
        padding: EdgeInsets.all(16.w),
        itemCount: _specialties.length,
        itemBuilder: (ctx, i) {
          final s = _specialties[i];
          final name = s['name'] as String? ?? '';
          final count = (s['soldier_count'] as num?)?.toInt() ?? 0;
          return Container(
            margin: EdgeInsets.only(bottom: 8.h),
            decoration: BoxDecoration(
              color: const Color(AC.card),
              borderRadius: BorderRadius.circular(12.r),
              border: Border.all(color: const Color(AC.cardBorder)),
            ),
            child: ListTile(
              leading: Container(
                width: 44.r, height: 44.r,
                decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.1), borderRadius: BorderRadius.circular(12.r)),
                child: Center(child: Text(s['icon'] ?? '📌', style: TextStyle(fontSize: 22.sp))),
              ),
              title: Text(name, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 4.h),
                    decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.1), borderRadius: BorderRadius.circular(8.r)),
                    child: Text('$count فرد', style: TextStyle(fontSize: 12.sp, color: const Color(AC.gold))),
                  ),
                  SizedBox(width: 4.w),
                  Icon(Icons.chevron_left, color: const Color(AC.textSecondary), size: 16.r),
                ],
              ),
              onTap: () {
                Navigator.push(context, MaterialPageRoute(builder: (_) => _SpecialtyDetailScreen(specialty: s)));
              },
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12.r)),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSectionsContent() {
    return RefreshIndicator(
      color: const Color(AC.gold),
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            GridView.count(
              crossAxisCount: 3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 10.h,
              crossAxisSpacing: 10.w,
              childAspectRatio: 1.1,
              children: _stats.map((s) => Container(
                decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
                padding: EdgeInsets.all(12.w),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(s['icon'] as IconData, color: s['color'] as Color, size: 24.r),
                    SizedBox(height: 6.h),
                    Text(s['value'] as String, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
                    SizedBox(height: 2.h),
                    Text(s['label'] as String, style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary)), textAlign: TextAlign.center),
                  ],
                ),
              )).toList(),
            ),
            SizedBox(height: 16.h),
            Text('الأفراد', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
            SizedBox(height: 8.h),
            if (_soldiers.isEmpty)
              Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 24.h),
                  child: Text('لا يوجد أفراد', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))),
                ),
              )
            else
              ..._soldiers.map((s) => Container(
                margin: EdgeInsets.only(bottom: 6.h),
                decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(10.r), border: Border.all(color: const Color(AC.cardBorder))),
                padding: EdgeInsets.all(12.w),
                child: Row(
                  children: [
                    Container(
                      width: 40.r, height: 40.r,
                      decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.1), borderRadius: BorderRadius.circular(10.r)),
                      child: Center(child: Text(s.weaponIcon ?? '👤', style: TextStyle(fontSize: 20.sp))),
                    ),
                    SizedBox(width: 10.w),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(s.name, style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
                      Text([s.rankName, s.specialtyName].where((x) => x != null).join(' • '), style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
                    ])),
                    if (s.lastResult != null && s.lastResult!['total_score'] != null)
                      ScoreBadge(score: (s.lastResult!['total_score'] as num).toDouble()),
                  ],
                ),
              )),
          ],
        ),
      ),
    );
  }
}

class _SpecialtyDetailScreen extends StatelessWidget {
  final Map<String, dynamic> specialty;
  const _SpecialtyDetailScreen({required this.specialty});

  @override
  Widget build(BuildContext context) {
    final name = specialty['name'] as String? ?? '';
    final count = (specialty['soldier_count'] as num?)?.toInt() ?? 0;
    final icon = specialty['icon'] as String? ?? '📌';
    return Scaffold(
      appBar: AppBar(
        title: Text(icon == '📌' ? name : '$icon $name', style: TextStyle(fontSize: 18.sp)),
        centerTitle: true,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 80.r, height: 80.r,
              decoration: BoxDecoration(color: const Color(AC.gold).withOpacity(0.1), borderRadius: BorderRadius.circular(20.r)),
              child: Center(child: Text(icon, style: TextStyle(fontSize: 36.sp))),
            ),
            SizedBox(height: 16.h),
            Text(name, style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
            SizedBox(height: 8.h),
            Text('$count فرد', style: TextStyle(fontSize: 16.sp, color: const Color(AC.gold))),
          ],
        ),
      ),
    );
  }
}
