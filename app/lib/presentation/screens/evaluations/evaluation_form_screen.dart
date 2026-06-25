import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import '../../../core/constants/app_constants.dart';
import '../../../core/network/api_service.dart';
import '../../../data/repositories/api_repository.dart';
import '../../../data/models/soldier_model.dart';
import '../../cubits/evaluation/evaluation_cubit.dart';

class EvaluationFormScreen extends StatefulWidget {
  const EvaluationFormScreen({super.key});

  @override
  State<EvaluationFormScreen> createState() => _EvaluationFormScreenState();
}

class _EvaluationFormScreenState extends State<EvaluationFormScreen> {
  List<SoldierModel> _soldiers = [];
  SoldierModel? _selected;
  bool _loadingSoldiers = true;
  bool _success = false;

  @override
  void initState() {
    super.initState();
    context.read<EvaluationCubit>().init();
    _loadSoldiers();
  }

  Future<void> _loadSoldiers() async {
    try {
      final repo = _repo();
      _soldiers = await repo.getSoldiers();
      if (mounted) setState(() => _loadingSoldiers = false);
    } catch (_) {
      if (mounted) setState(() => _loadingSoldiers = false);
    }
  }

  ApiRepository _repo() => ApiRepository(context.read<ApiService>());

  @override
  Widget build(BuildContext context) {
    if (_success) return _buildSuccess();
    return BlocListener<EvaluationCubit, EvaluationState>(
      listener: (ctx, state) {
        if (state is EvaluationSuccess) {
          setState(() => _success = true);
          Future.delayed(const Duration(seconds: 2), () {
            if (mounted) {
              context.read<EvaluationCubit>().init();
              setState(() { _success = false; _selected = null; _selected = null; });
            }
          });
        }
      },
      child: SingleChildScrollView(
        padding: EdgeInsets.all(16.w),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('تمييز فرد', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.bold, color: const Color(AC.gold))),
            SizedBox(height: 4.h),
            Text('اختر الفرد ثم حدد الدرجات', style: TextStyle(fontSize: 14.sp, color: const Color(AC.textSecondary))),
            SizedBox(height: 16.h),
            _buildSoldierSelector(),
            if (_selected != null) ...[
              SizedBox(height: 20.h),
              _buildScoreSlider('اللياقة البدنية', 'fitness', 0xFF4FC3F7),
              SizedBox(height: 16.h),
              _buildScoreSlider('التخصص', 'specialty', AC.gold),
              SizedBox(height: 16.h),
              _buildScoreSlider('الانضباط', 'discipline', 0xFF66BB6A),
              SizedBox(height: 16.h),
              _buildNotesField(),
              SizedBox(height: 20.h),
              _buildSubmitButton(),
            ],
            SizedBox(height: 24.h),
          ],
        ),
      ),
    );
  }

  Widget _buildSoldierSelector() {
    if (_loadingSoldiers) {
      return const Center(child: CircularProgressIndicator(color: Color(AC.gold)));
    }
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 16.w),
      decoration: BoxDecoration(
        color: const Color(AC.card),
        borderRadius: BorderRadius.circular(12.r),
        border: Border.all(color: const Color(AC.cardBorder)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<SoldierModel>(
          value: _selected,
          isExpanded: true,
          dropdownColor: const Color(AC.card),
          hint: Text('اختر فرداً...', style: TextStyle(color: const Color(AC.textSecondary), fontSize: 14.sp)),
          items: _soldiers.map((s) => DropdownMenuItem(
            value: s,
            child: Text('${s.rankName ?? ''} ${s.name}  ${s.weaponIcon ?? ''}', style: TextStyle(fontSize: 14.sp)),
          )).toList(),
          onChanged: (v) {
            setState(() => _selected = v);
            context.read<EvaluationCubit>().init();
          },
        ),
      ),
    );
  }

  Widget _buildScoreSlider(String label, String field, int color) {
    return BlocBuilder<EvaluationCubit, EvaluationState>(
      builder: (ctx, state) {
        if (state is! EvaluationReady) return const SizedBox();
        double val = field == 'fitness' ? state.fitnessScore
            : field == 'specialty' ? state.specialtyScore
            : state.disciplineScore;
        return Container(
          padding: EdgeInsets.all(16.w),
          decoration: BoxDecoration(
            color: const Color(AC.card),
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(color: Color(color).withOpacity(0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(label, style: TextStyle(fontSize: 15.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
                  Container(
                    padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 4.h),
                    decoration: BoxDecoration(
                      color: Color(color).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(8.r),
                    ),
                    child: Text('${val.toInt()}', style: TextStyle(fontSize: 18.sp, fontWeight: FontWeight.bold, color: Color(color))),
                  ),
                ],
              ),
              SizedBox(height: 8.h),
              SliderTheme(
                data: SliderTheme.of(context).copyWith(
                  activeTrackColor: Color(color),
                  inactiveTrackColor: Color(color).withOpacity(0.15),
                  thumbColor: Color(color),
                  overlayColor: Color(color).withOpacity(0.12),
                  trackHeight: 6.h,
                  thumbShape: RoundSliderThumbShape(enabledThumbRadius: 10.r),
                ),
                child: Slider(
                  value: val,
                  min: 0,
                  max: 100,
                  divisions: 100,
                  label: val.toInt().toString(),
                  onChanged: (v) {
                    if (field == 'fitness') context.read<EvaluationCubit>().updateFitness(v);
                    else if (field == 'specialty') context.read<EvaluationCubit>().updateSpecialty(v);
                    else context.read<EvaluationCubit>().updateDiscipline(v);
                  },
                ),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('0', style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
                  Text('100', style: TextStyle(fontSize: 11.sp, color: const Color(AC.textSecondary))),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildNotesField() {
    return BlocBuilder<EvaluationCubit, EvaluationState>(
      builder: (ctx, state) {
        if (state is! EvaluationReady) return const SizedBox();
        return TextField(
          decoration: InputDecoration(
            labelText: 'ملاحظات (اختياري)',
            contentPadding: EdgeInsets.symmetric(horizontal: 14.w, vertical: 12.h),
          ),
          style: TextStyle(fontSize: 14.sp, color: const Color(AC.textPrimary)),
          maxLines: 3,
          onChanged: (v) => context.read<EvaluationCubit>().updateNotes(v),
        );
      },
    );
  }

  Widget _buildSubmitButton() {
    return BlocBuilder<EvaluationCubit, EvaluationState>(
      builder: (ctx, state) {
        final submitting = state is EvaluationSubmitting;
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: submitting || _selected == null
                ? null
                : () => context.read<EvaluationCubit>().submit(_selected!.id),
            style: ElevatedButton.styleFrom(
              padding: EdgeInsets.symmetric(vertical: 16.h),
            ),
            child: submitting
                ? SizedBox(width: 20.r, height: 20.r, child: CircularProgressIndicator(strokeWidth: 2.r, color: const Color(AC.bg)))
                : Text('تسجيل التمييز', style: TextStyle(fontSize: 16.sp)),
          ),
        );
      },
    );
  }

  Widget _buildSuccess() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32.w),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline, size: 72.r, color: const Color(AC.success)),
            SizedBox(height: 16.h),
            Text('تم تسجيل التمييز بنجاح', style: TextStyle(fontSize: 20.sp, fontWeight: FontWeight.bold, color: const Color(AC.textPrimary))),
          ],
        ),
      ),
    );
  }
}
