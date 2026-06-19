import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/app_constants.dart';

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: const Color(AC.bg),
      fontFamily: GoogleFonts.tajawal().fontFamily,
      useMaterial3: true,
      colorScheme: const ColorScheme.dark(
        primary: Color(AC.gold),
        secondary: Color(AC.success),
        surface: Color(AC.card),
        error: Color(AC.danger),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(AC.card),
        foregroundColor: Color(AC.textPrimary),
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: const Color(AC.card),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(AC.cardBorder)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF0D1508),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(AC.cardBorder)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(AC.cardBorder)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(AC.gold), width: 2),
        ),
        labelStyle: const TextStyle(color: Color(AC.textSecondary)),
        hintStyle: const TextStyle(color: Color(AC.textSecondary)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(AC.gold),
          foregroundColor: const Color(AC.bg),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: const Color(AC.gold)),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(AC.card),
        selectedItemColor: Color(AC.gold),
        unselectedItemColor: Color(AC.textSecondary),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: const Color(AC.card),
        indicatorColor: Color(AC.gold).withOpacity(0.15),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(color: Color(AC.gold), fontSize: 12, fontWeight: FontWeight.w600);
          }
          return const TextStyle(color: Color(AC.textSecondary), fontSize: 11);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: Color(AC.gold), size: 22);
          }
          return const IconThemeData(color: Color(AC.textSecondary), size: 22);
        }),
        height: 70,
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: const Color(AC.gold),
        inactiveTrackColor: const Color(AC.gold).withOpacity(0.15),
        thumbColor: const Color(AC.gold),
        overlayColor: const Color(AC.gold).withOpacity(0.12),
        trackHeight: 6,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
        valueIndicatorColor: const Color(AC.gold),
        valueIndicatorTextStyle: const TextStyle(color: Color(AC.bg), fontWeight: FontWeight.bold),
      ),
      dividerTheme: const DividerThemeData(color: Color(AC.cardBorder), thickness: 1),
      dialogTheme: DialogThemeData(
        backgroundColor: const Color(AC.card),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: Color(AC.gold),
        foregroundColor: Color(AC.bg),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return const Color(AC.gold);
          return const Color(AC.textSecondary);
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return const Color(AC.gold).withOpacity(0.3);
          return const Color(AC.cardBorder);
        }),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(color: Color(AC.textPrimary), fontWeight: FontWeight.bold),
        headlineMedium: TextStyle(color: Color(AC.textPrimary), fontWeight: FontWeight.bold),
        titleLarge: TextStyle(color: Color(AC.textPrimary), fontWeight: FontWeight.bold),
        titleMedium: TextStyle(color: Color(AC.textPrimary)),
        bodyLarge: TextStyle(color: Color(AC.textPrimary)),
        bodyMedium: TextStyle(color: Color(AC.textSecondary)),
        labelLarge: TextStyle(color: Color(AC.gold)),
      ),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(AC.bgLight),
      fontFamily: GoogleFonts.tajawal().fontFamily,
      useMaterial3: true,
      colorScheme: const ColorScheme.light(
        primary: Color(AC.gold),
        secondary: Color(AC.success),
        surface: Color(AC.cardLight),
        error: Color(AC.danger),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(AC.cardLight),
        foregroundColor: Color(AC.textPrimaryLight),
        elevation: 0,
        centerTitle: true,
      ),
      cardTheme: CardThemeData(
        color: const Color(AC.cardLight),
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: Color(AC.cardBorderLight)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFFF0F0F0),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(AC.cardBorderLight)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(AC.cardBorderLight)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: Color(AC.gold), width: 2),
        ),
        labelStyle: const TextStyle(color: Color(AC.textSecondaryLight)),
        hintStyle: const TextStyle(color: Color(AC.textSecondaryLight)),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(AC.gold),
          foregroundColor: const Color(AC.bgLight),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(foregroundColor: const Color(AC.gold)),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Color(AC.cardLight),
        selectedItemColor: Color(AC.gold),
        unselectedItemColor: Color(AC.textSecondaryLight),
        type: BottomNavigationBarType.fixed,
        elevation: 0,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: const Color(AC.cardLight),
        indicatorColor: Color(AC.gold).withOpacity(0.15),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(color: Color(AC.gold), fontSize: 12, fontWeight: FontWeight.w600);
          }
          return const TextStyle(color: Color(AC.textSecondaryLight), fontSize: 11);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: Color(AC.gold), size: 22);
          }
          return const IconThemeData(color: Color(AC.textSecondaryLight), size: 22);
        }),
        height: 70,
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: const Color(AC.gold),
        inactiveTrackColor: const Color(AC.gold).withOpacity(0.15),
        thumbColor: const Color(AC.gold),
        overlayColor: const Color(AC.gold).withOpacity(0.12),
        trackHeight: 6,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10),
        valueIndicatorColor: const Color(AC.gold),
        valueIndicatorTextStyle: const TextStyle(color: Color(AC.bgLight), fontWeight: FontWeight.bold),
      ),
      dividerTheme: const DividerThemeData(color: Color(AC.cardBorderLight), thickness: 1),
      dialogTheme: DialogThemeData(
        backgroundColor: const Color(AC.cardLight),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: Color(AC.gold),
        foregroundColor: Color(AC.bgLight),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return const Color(AC.gold);
          return const Color(AC.textSecondaryLight);
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) return const Color(AC.gold).withOpacity(0.3);
          return const Color(AC.cardBorderLight);
        }),
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(color: Color(AC.textPrimaryLight), fontWeight: FontWeight.bold),
        headlineMedium: TextStyle(color: Color(AC.textPrimaryLight), fontWeight: FontWeight.bold),
        titleLarge: TextStyle(color: Color(AC.textPrimaryLight), fontWeight: FontWeight.bold),
        titleMedium: TextStyle(color: Color(AC.textPrimaryLight)),
        bodyLarge: TextStyle(color: Color(AC.textPrimaryLight)),
        bodyMedium: TextStyle(color: Color(AC.textSecondaryLight)),
        labelLarge: TextStyle(color: Color(AC.gold)),
      ),
    );
  }
}
