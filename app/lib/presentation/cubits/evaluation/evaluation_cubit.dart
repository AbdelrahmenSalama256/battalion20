import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import '../../../core/network/api_service.dart';
import '../../../data/repositories/api_repository.dart';

sealed class EvaluationState extends Equatable {
  const EvaluationState();
  @override
  List<Object?> get props => [];
}

final class EvaluationInitial extends EvaluationState {
  const EvaluationInitial();
}

final class EvaluationReady extends EvaluationState {
  final double fitnessScore;
  final double specialtyScore;
  final double disciplineScore;
  final String notes;

  const EvaluationReady({
    this.fitnessScore = 50,
    this.specialtyScore = 50,
    this.disciplineScore = 50,
    this.notes = '',
  });

  EvaluationReady copyWith({
    double? fitnessScore,
    double? specialtyScore,
    double? disciplineScore,
    String? notes,
  }) =>
      EvaluationReady(
        fitnessScore: fitnessScore ?? this.fitnessScore,
        specialtyScore: specialtyScore ?? this.specialtyScore,
        disciplineScore: disciplineScore ?? this.disciplineScore,
        notes: notes ?? this.notes,
      );

  @override
  List<Object?> get props => [fitnessScore, specialtyScore, disciplineScore, notes];
}

final class EvaluationSubmitting extends EvaluationState {
  const EvaluationSubmitting();
}

final class EvaluationSuccess extends EvaluationState {
  const EvaluationSuccess();
}

final class EvaluationError extends EvaluationState {
  final String message;
  const EvaluationError(this.message);
  @override
  List<Object?> get props => [message];
}

class EvaluationCubit extends Cubit<EvaluationState> {
  final ApiRepository _repo;

  EvaluationCubit(ApiService api)
      : _repo = ApiRepository(api),
        super(EvaluationInitial());

  void init() => emit(const EvaluationReady());

  void updateFitness(double v) =>
      emit(_safeReady().copyWith(fitnessScore: v));
  void updateSpecialty(double v) =>
      emit(_safeReady().copyWith(specialtyScore: v));
  void updateDiscipline(double v) =>
      emit(_safeReady().copyWith(disciplineScore: v));
  void updateNotes(String v) =>
      emit(_safeReady().copyWith(notes: v));

  EvaluationReady _safeReady() =>
      state is EvaluationReady ? state as EvaluationReady : const EvaluationReady();

  Future<void> submit(String soldierId) async {
    final s = _safeReady();
    emit(const EvaluationSubmitting());
    try {
      await _repo.evaluateSoldier(
        soldierId: soldierId,
        fitnessScore: s.fitnessScore,
        specialtyScore: s.specialtyScore,
        disciplineScore: s.disciplineScore,
        notes: s.notes.isEmpty ? null : s.notes,
      );
      emit(const EvaluationSuccess());
    } catch (e) {
      emit(EvaluationError('فشل تسجيل التمييز'));
    }
  }

  void reset() => emit(const EvaluationInitial());
}
