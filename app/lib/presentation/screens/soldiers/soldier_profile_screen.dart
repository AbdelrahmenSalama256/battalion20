import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_service.dart';
import '../../../data/models/soldier_model.dart';
import '../../../data/models/result_model.dart';
import '../../../data/repositories/api_repository.dart';
import '../../widgets/score_badge.dart';

class SoldierProfileScreen extends StatefulWidget {
  final String soldierId;
  const SoldierProfileScreen({super.key, required this.soldierId});

  @override
  State<SoldierProfileScreen> createState() => _SoldierProfileScreenState();
}

class _SoldierProfileScreenState extends State<SoldierProfileScreen> {
  SoldierModel? _soldier;
  List<ResultModel> _results = [];
  bool _loading = true;
  String? _error;
  int _selectedPeriod = 0;

  static const _periodLabels = ['أسبوعي', 'شهري', 'سنوي', 'الإجمالي'];
  static const _periodDays = [7, 30, 365, null];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final repo = ApiRepository(context.read<ApiService>());
      final soldier = await repo.getSoldier(widget.soldierId);
      final results = await repo.getResultsList(soldierId: widget.soldierId, limit: 200);
      if (mounted) setState(() {
        _soldier = soldier;
        _results = results;
        _loading = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = 'فشل تحميل الملف الشخصي'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_soldier?.name ?? 'الملف الشخصي', style: TextStyle(fontSize: 18.sp)),
        actions: [
          if (_soldier != null)
            IconButton(
              icon: Icon(Icons.edit_outlined, color: const Color(AC.gold), size: 20.r),
              onPressed: () => Navigator.pop(context, 'edit'),
            ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: const Color(AC.gold)))
          : _error != null
              ? _buildError()
              : _buildContent(),
    );
  }

  Widget _buildError() => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(Icons.cloud_off, size: 64.r, color: const Color(AC.textSecondary)),
        SizedBox(height: 16.h),
        Text(_error!, style: TextStyle(fontSize: 16.sp, color: const Color(AC.textSecondary))),
        SizedBox(height: 24.h),
        ElevatedButton.icon(onPressed: _load, icon: const Icon(Icons.refresh), label: const Text('إعادة المحاولة')),
      ],
    ),
  );

  Widget _buildContent() {
    final s = _soldier!;
    final lr = s.lastResult;
    return RefreshIndicator(
      color: const Color(AC.gold),
      onRefresh: _load,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(s),
            SizedBox(height: 16.h),
            if (s.distinctionBadge != null) _buildDistinctionCard(s),
            if (s.distinctionBadge != null) SizedBox(height: 16.h),
            _buildInfoCard(s),
            SizedBox(height: 16.h),
            if (lr != null) _buildLastResultCard(lr),
            SizedBox(height: 16.h),
            _buildPeriodBreakdown(),
            SizedBox(height: 16.h),
            if (_results.length >= 2) _buildProgressChart(),
            if (_results.length >= 2) SizedBox(height: 16.h),
            _sectionHeader('التمييزات السابقة'),
            SizedBox(height: 8.h),
            if (_results.isEmpty)
              Container(
                width: double.infinity, padding: EdgeInsets.all(32.w),
                decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
                child: Center(child: Text('لا توجد تمييزات', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary)))),
              )
            else
              ..._results.map((r) => _resultCard(r)),
            SizedBox(height: 24.h),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(SoldierModel s) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(20.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(AC.card), const Color(AC.card).withOpacity(0.5)],
          begin: Alignment.topLeft, end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16.r),
        border: Border.all(color: const Color(AC.gold).withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 64.r, height: 64.r,
            decoration: BoxDecoration(
              color: const Color(AC.gold).withOpacity(0.15),
              borderRadius: BorderRadius.circular(16.r),
              border: Border.all(color: const Color(AC.gold).withOpacity(0.3)),
            ),
            child: Center(child: Text(s.weaponIcon ?? '👤', style: TextStyle(fontSize: 28.sp))),
          ),
          SizedBox(width: 16.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(s.name, style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
                SizedBox(height: 4.h),
                Text(s.rankName ?? '', style: TextStyle(fontSize: 15.sp, color: const Color(AC.gold))),
                SizedBox(height: 2.h),
                Text(s.militaryId ?? '', style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDistinctionCard(SoldierModel s) {
    final badgeEmoji = s.distinctionBadge == 'gold' ? '🥇' : s.distinctionBadge == 'silver' ? '🥈' : '🥉';
    final badgeLabel = s.distinctionBadge == 'gold' ? 'ذهبي' : s.distinctionBadge == 'silver' ? 'فضي' : 'برونزي';
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [const Color(AC.gold).withOpacity(0.12), const Color(AC.card)]),
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(color: const Color(AC.gold).withOpacity(0.4)),
      ),
      child: Row(
        children: [
          Text(badgeEmoji, style: TextStyle(fontSize: 28.sp)),
          SizedBox(width: 12.w),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('وسام $badgeLabel', style: TextStyle(fontSize: 16.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
                if (s.distinctionCitation != null && s.distinctionCitation!.isNotEmpty)
                  Text(s.distinctionCitation!, style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary))),
                if (s.distinguishedByName != null)
                  Text('بواسطة: ${s.distinguishedByName}', style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(SoldierModel s) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('معلومات الجندي'),
          SizedBox(height: 12.h),
          _infoRow2('السلاح', s.weaponName ?? '-'),
          _infoRow2('التخصص العام', s.specialtyName ?? '-'),
          _infoRow2('التخصص الدقيق', s.specificSpecialty ?? '-'),
          _infoRow2('ملاحظات', s.notes ?? '-'),
        ],
      ),
    );
  }

  Widget _buildLastResultCard(Map<String, dynamic> lr) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(
        color: const Color(AC.card),
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(color: const Color(AC.success).withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('آخر تمييز'),
          SizedBox(height: 12.h),
          Row(
            children: [
              _scoreBox('اللياقة', lr['fitness_score'], const Color(0xFF4FC3F7)),
              SizedBox(width: 8.w),
              _scoreBox('التخصص', lr['specialty_score'], const Color(AC.gold)),
              SizedBox(width: 8.w),
              _scoreBox('الانضباط', lr['discipline_score'], const Color(0xFF66BB6A)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodBreakdown() {
    final days = _periodDays[_selectedPeriod];
    final label = _periodLabels[_selectedPeriod];
    final filtered = days == null
        ? _results
        : _results.where((r) {
            final d = r.createdAt;
            if (d == null || d.length < 10) return false;
            try {
              final dt = DateTime.parse(d.substring(0, 10));
              return dt.isAfter(DateTime.now().subtract(Duration(days: days)));
            } catch (_) {
              return false;
            }
          }).toList();

    if (filtered.isEmpty) {
      return Container(
        width: double.infinity,
        padding: EdgeInsets.all(16.w),
        decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _sectionHeader('تحليل التمييزات - $label'),
            SizedBox(height: 12.h),
            _buildPeriodTabs(),
            SizedBox(height: 12.h),
            Center(child: Text('لا توجد تمييزات في هذه الفترة', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary)))),
          ],
        ),
      );
    }

    final total = filtered.length;
    final avgFit = filtered.fold(0.0, (s, r) => s + (r.fitnessScore ?? 0)) / total;
    final avgSpec = filtered.fold(0.0, (s, r) => s + (r.specialtyScore ?? 0)) / total;
    final avgDisc = filtered.fold(0.0, (s, r) => s + (r.disciplineScore ?? 0)) / total;
    final avgAll = filtered.fold(0.0, (s, r) => s + (r.totalScore ?? 0)) / total;

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('تحليل التمييزات - $label'),
          SizedBox(height: 8.h),
          _buildPeriodTabs(),
          SizedBox(height: 12.h),
          Row(
            children: [
              _miniStatCard('عدد التمييزات', '$total', const Color(AC.gold)),
              SizedBox(width: 8.w),
              _miniStatCard('المعدل العام', avgAll.toStringAsFixed(1), const Color(AC.textPrimary)),
            ],
          ),
          SizedBox(height: 12.h),
          Row(
            children: [
              _scoreBox('اللياقة', avgFit, const Color(0xFF4FC3F7)),
              SizedBox(width: 8.w),
              _scoreBox('التخصص', avgSpec, const Color(AC.gold)),
              SizedBox(width: 8.w),
              _scoreBox('الانضباط', avgDisc, const Color(0xFF66BB6A)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodTabs() {
    return Row(
      children: List.generate(_periodLabels.length, (i) {
        final isSelected = i == _selectedPeriod;
        return Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _selectedPeriod = i),
            child: Container(
              padding: EdgeInsets.symmetric(vertical: 8.h),
              margin: EdgeInsets.symmetric(horizontal: 2.w),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: isSelected ? const Color(AC.gold) : Colors.transparent,
                    width: 2.5,
                  ),
                ),
              ),
              child: Text(
                _periodLabels[i],
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13.sp,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? const Color(AC.gold) : const Color(AC.textSecondary),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  Widget _miniStatCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 10.h, horizontal: 8.w),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8.r),
          border: Border.all(color: color.withOpacity(0.15)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: color)),
            SizedBox(height: 2.h),
            Text(label, style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
          ],
        ),
      ),
    );
  }

  Widget _buildProgressChart() {
    final sorted = List<ResultModel>.from(_results)
      ..sort((a, b) => (a.createdAt ?? '').compareTo(b.createdAt ?? ''));
    final spotsFit = <FlSpot>[];
    final spotsSpec = <FlSpot>[];
    final spotsDisc = <FlSpot>[];
    int i = 0;
    final labels = <int, String>{};
    for (final r in sorted) {
      if (r.fitnessScore != null) spotsFit.add(FlSpot(i.toDouble(), r.fitnessScore!));
      if (r.specialtyScore != null) spotsSpec.add(FlSpot(i.toDouble(), r.specialtyScore!));
      if (r.disciplineScore != null) spotsDisc.add(FlSpot(i.toDouble(), r.disciplineScore!));
      final d = r.formattedDate;
      if (d.length >= 5) labels[i] = d.substring(d.length - 5);
      i++;
    }
    final maxY = [
      if (spotsFit.isNotEmpty) spotsFit.map((s) => s.y).reduce((a, b) => a > b ? a : b),
      if (spotsSpec.isNotEmpty) spotsSpec.map((s) => s.y).reduce((a, b) => a > b ? a : b),
      if (spotsDisc.isNotEmpty) spotsDisc.map((s) => s.y).reduce((a, b) => a > b ? a : b),
      100.0,
    ].reduce((a, b) => a > b ? a : b);
    final minY = [
      if (spotsFit.isNotEmpty) spotsFit.map((s) => s.y).reduce((a, b) => a < b ? a : b),
      if (spotsSpec.isNotEmpty) spotsSpec.map((s) => s.y).reduce((a, b) => a < b ? a : b),
      if (spotsDisc.isNotEmpty) spotsDisc.map((s) => s.y).reduce((a, b) => a < b ? a : b),
      0.0,
    ].reduce((a, b) => a < b ? a : b);
    final pad = ((maxY - minY) * 0.15).clamp(5, 30);
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16.w),
      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionHeader('الرسم البياني للتقدم'),
          SizedBox(height: 12.h),
          SizedBox(
            height: 200.h,
            child: LineChart(
              LineChartData(
                minX: 0,
                maxX: (sorted.length - 1).toDouble().clamp(0, double.infinity),
                minY: (minY - pad).clamp(0, 100),
                maxY: (maxY + pad).clamp(0, 100),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: 20,
                  getDrawingHorizontalLine: (v) => FlLine(color: const Color(AC.cardBorder), strokeWidth: 0.5),
                ),
                titlesData: FlTitlesData(
                  leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 32.w, getTitlesWidget: (v, _) => Text('${v.toInt()}', style: TextStyle(fontSize: 9.sp, color: const Color(AC.textSecondary))))),
                  bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: labels.length > 1, reservedSize: 28.h, interval: 1, getTitlesWidget: (v, _) {
                    final idx = v.toInt();
                    if (!labels.containsKey(idx)) return const SizedBox();
                    return Padding(padding: EdgeInsets.only(top: 4.h), child: Text(labels[idx]!, style: TextStyle(fontSize: 8.sp, color: const Color(AC.textSecondary))));
                  })),
                  topTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: AxisTitles(sideTitles: SideTitles(showTitles: false)),
                ),
                borderData: FlBorderData(show: false),
                lineBarsData: [
                  if (spotsFit.isNotEmpty)
                    LineChartBarData(spots: spotsFit, color: const Color(0xFF4FC3F7), barWidth: 2.5, dotData: FlDotData(show: true, getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(radius: 3, color: const Color(0xFF4FC3F7), strokeWidth: 0))),
                  if (spotsSpec.isNotEmpty)
                    LineChartBarData(spots: spotsSpec, color: const Color(AC.gold), barWidth: 2.5, dotData: FlDotData(show: true, getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(radius: 3, color: const Color(AC.gold), strokeWidth: 0))),
                  if (spotsDisc.isNotEmpty)
                    LineChartBarData(spots: spotsDisc, color: const Color(0xFF66BB6A), barWidth: 2.5, dotData: FlDotData(show: true, getDotPainter: (_, __, ___, ____) => FlDotCirclePainter(radius: 3, color: const Color(0xFF66BB6A), strokeWidth: 0))),
                ],
                lineTouchData: LineTouchData(
                  enabled: true,
                  touchTooltipData: LineTouchTooltipData(getTooltipItems: (spots) => spots.map((s) => LineTooltipItem('${s.y.toStringAsFixed(0)}', TextStyle(color: s.bar.color, fontSize: 12.sp, fontWeight: FontWeight.bold))).toList()),
                ),
              ),
            ),
          ),
          SizedBox(height: 8.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _legendDot(const Color(0xFF4FC3F7), 'اللياقة'),
              SizedBox(width: 16.w),
              _legendDot(const Color(AC.gold), 'التخصص'),
              SizedBox(width: 16.w),
              _legendDot(const Color(0xFF66BB6A), 'الانضباط'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 10.r, height: 10.r, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        SizedBox(width: 4.w),
        Text(label, style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
      ],
    );
  }

  Widget _sectionHeader(String title) => Row(
    children: [
      Container(width: 3.w, height: 16.h, color: const Color(AC.gold)),
      SizedBox(width: 8.w),
      Text(title, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
    ],
  );

  Widget _infoRow2(String label, String value) => Padding(
    padding: EdgeInsets.symmetric(vertical: 3.h),
    child: Row(
      children: [
        SizedBox(width: 90.w, child: Text(label, style: TextStyle(fontSize: 13.sp, color: const Color(AC.textSecondary)))),
        Expanded(child: Text(value, style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary), fontWeight: FontWeight.w500))),
      ],
    ),
  );

  Widget _scoreBox(String label, dynamic score, Color color) {
    final val = score is num ? score.toDouble() : null;
    return Expanded(
      child: Container(
        padding: EdgeInsets.all(12.w),
        decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(10.r), border: Border.all(color: color.withOpacity(0.2))),
        child: Column(
          children: [
            Text(val?.toStringAsFixed(0) ?? '—', style: TextStyle(fontSize: 22.sp, fontWeight: FontWeight.bold, color: color)),
            SizedBox(height: 4.h),
            Text(label, style: TextStyle(fontSize: 11.sp, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _resultCard(ResultModel r) {
    return Container(
      margin: EdgeInsets.only(bottom: 8.h),
      padding: EdgeInsets.all(14.w),
      decoration: BoxDecoration(color: const Color(AC.card), borderRadius: BorderRadius.circular(12.r), border: Border.all(color: const Color(AC.cardBorder))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(r.examTitle ?? 'تمييز', style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
              ),
              Text(r.formattedDate, style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
              SizedBox(width: 8.w),
              if (r.totalScore != null) ScoreBadge(score: r.totalScore!),
            ],
          ),
          SizedBox(height: 8.h),
          Row(
            children: [
              if (r.fitnessScore != null) _miniBadge('ل ${r.fitnessScore!.toInt()}', const Color(0xFF4FC3F7)),
              if (r.specialtyScore != null) _miniBadge('ت ${r.specialtyScore!.toInt()}', const Color(AC.gold)),
              if (r.disciplineScore != null) _miniBadge('د ${r.disciplineScore!.toInt()}', const Color(0xFF66BB6A)),
              if (r.enteredByName != null) ...[
                SizedBox(width: 8.w),
                Text(r.enteredByName!, style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
              ],
            ],
          ),
          if (r.notes != null && r.notes!.isNotEmpty) ...[
            SizedBox(height: 4.h),
            Text(r.notes!, style: TextStyle(fontSize: 12.sp, color: const Color(AC.textSecondary))),
          ],
        ],
      ),
    );
  }

  Widget _miniBadge(String text, Color color) => Container(
    margin: EdgeInsets.only(left: 4.w),
    padding: EdgeInsets.symmetric(horizontal: 6.w, vertical: 2.h),
    decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(4.r), border: Border.all(color: color.withOpacity(0.3))),
    child: Text(text, style: TextStyle(fontSize: 10.sp, color: color, fontWeight: FontWeight.w600)),
  );
}
