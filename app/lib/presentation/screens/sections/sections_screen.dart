import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/constants/app_constants.dart';
import 'section_detail_screen.dart';

class SectionsScreen extends StatelessWidget {
  const SectionsScreen({super.key});

  static const _sections = [
    {'key': 'specialties', 'name': 'التخصصات', 'icon': Icons.track_changes, 'emoji': '🎯'},
    {'key': 'general', 'name': 'العام', 'icon': Icons.assignment, 'emoji': '📋'},
    {'key': 'fitness', 'name': 'اللياقة', 'icon': Icons.fitness_center, 'emoji': '💪'},
    {'key': 'shooting', 'name': 'الرماية', 'icon': Icons.sports_martial_arts, 'emoji': '🔫'},
    {'key': 'discipline', 'name': 'الانضباط', 'icon': Icons.gavel, 'emoji': '🎖️'},
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(16.w),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('الأقسام', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
          SizedBox(height: 4.h),
          Text('اختر قسم لعرض التفاصيل', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))),
          SizedBox(height: 16.h),
          Expanded(
            child: GridView.count(
              crossAxisCount: 2,
              mainAxisSpacing: 12.h,
              crossAxisSpacing: 12.w,
              childAspectRatio: 0.9,
              children: _sections.map((s) => _SectionCard(
                key: ValueKey(s['key']),
                sectionKey: s['key'] as String,
                name: s['name'] as String,
                icon: s['icon'] as IconData,
                emoji: s['emoji'] as String,
              )).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  final String sectionKey;
  final String name;
  final IconData icon;
  final String emoji;

  const _SectionCard({
    super.key,
    required this.sectionKey,
    required this.name,
    required this.icon,
    required this.emoji,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SectionDetailScreen(sectionKey: sectionKey))),
      borderRadius: BorderRadius.circular(12.r),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(AC.card),
          borderRadius: BorderRadius.circular(12.r),
          border: Border.all(color: const Color(AC.cardBorder)),
        ),
        padding: EdgeInsets.all(16.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 56.r,
              height: 56.r,
              decoration: BoxDecoration(
                color: const Color(AC.gold).withOpacity(0.1),
                borderRadius: BorderRadius.circular(16.r),
              ),
              child: Center(child: Text(emoji, style: TextStyle(fontSize: 28.sp))),
            ),
            SizedBox(height: 12.h),
            Text(name, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.w600, color: const Color(AC.textPrimary))),
            SizedBox(height: 4.h),
            Icon(icon, color: const Color(AC.gold), size: 18.r),
          ],
        ),
      ),
    );
  }
}
