/**
 * Test Results Parser — Parses the battalion's actual test-results Excel file.
 *
 * 3 independent parsers, one per sheet type.
 * Date groups discovered dynamically from merged cells (never hardcoded).
 *
 * File structure per sheet:
 *   - Row 1: merged title (skipped)
 *   - Row 3: merged date cells spanning date-blocks
 *   - Row 4 (+5 for cabin): sub-headers per block
 *   - Col A: serial (م) — ignored for matching (file has no military_id)
 *   - Col B: rank (labeled "درجة" but contains ranks like عريف, رقيب أ)
 *   - Col C: person name
 *   - Remaining cols: date-blocks with scores
 *
 * Dependencies: exceljs
 */

const ExcelJS = require("exceljs");

// ============================================================
// COLOR → SPECIALTY MAPPING (per sheet, separate legends)
// ============================================================

const SPECIALTY_COLORS = {
  theory: {
    "FFFF0000": "موجهين",
    "FF00B050": "مركبات",
    "FF00B0F0": "إشارة",
    "FFFFFF00": "إستطلاع",
  },
  fitness: {
    "FFFF0000": "عمال توجيه",
    "FFFFC000": "إستطلاع",
    "FF00B0F0": "إشارة",
    "FF00B050": "سائقين",
  },
};

/**
 * Extract fill color from a cell and map to specialty.
 * Returns { specialty, colorHex, unknown }
 */
function extractSpecialtyFromCell(cell, sheetType) {
  const colorMap = SPECIALTY_COLORS[sheetType];
  if (!colorMap) return { specialty: null, colorHex: null, unknown: false };

  const fill = cell && cell.fill;
  if (!fill || fill.type !== "pattern") {
    if (sheetType === "theory") return { specialty: "تخصصات أخرى", colorHex: null, unknown: false };
    return { specialty: null, colorHex: null, unknown: false };
  }

  const fgColor = fill.fgColor;
  if (!fgColor || !fgColor.argb) {
    if (sheetType === "theory") return { specialty: "تخصصات أخرى", colorHex: null, unknown: false };
    return { specialty: null, colorHex: null, unknown: false };
  }

  const color = fgColor.argb.toUpperCase();
  if (colorMap[color]) return { specialty: colorMap[color], colorHex: color, unknown: false };
  return { specialty: null, colorHex: color, unknown: true };
}

// ============================================================
// HELPERS
// ============================================================

/** Get the raw value from an ExcelJS cell, resolving formulas/hyperlinks */
function cellVal(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return null;
  if (cell.value && typeof cell.value === "object") {
    if (cell.value.result !== undefined) return cell.value.result;
    if (cell.value.text !== undefined) return cell.value.text;
  }
  return cell.value;
}

/** Convert cell value to a number, or null if not numeric */
function toNum(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

/** Convert cell value to trimmed string */
function toStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

/** Parse an Excel serial date number to YYYY-MM-DD */
function excelDateToISO(serial) {
  if (typeof serial !== "number" || serial < 30000 || serial > 60000) return null;
  const d = new Date((serial - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/** Parse any date value to YYYY-MM-DD */
function parseDate(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return excelDateToISO(v);
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s) return null;
  // Try Excel serial as string
  const asNum = Number(s);
  if (!isNaN(asNum) && asNum > 30000 && asNum < 60000) return excelDateToISO(asNum);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Discover merged-cell date groups in a given row.
 * Returns array of { dateLabel, dateValue, startCol, endCol, span }
 * sorted by startCol.
 */
function discoverDateGroups(worksheet, headerRow) {
  const groups = [];
  const row = worksheet.getRow(headerRow);

  // Build list of merged ranges that start on this row
  for (const mergeRef of Object.keys(worksheet._merges || {})) {
    const range = worksheet._merges[mergeRef];
    if (!range || range.top !== headerRow) continue;
    // Only consider blocks that span 2+ columns (date groups, not identity headers)
    if (range.right - range.left < 2) continue;
    const rawDate = cellVal(worksheet.getCell(headerRow, range.left));
    groups.push({
      dateLabel: toStr(rawDate),
      dateValue: parseDate(rawDate),
      startCol: range.left,
      endCol: range.right,
      span: range.right - range.left + 1,
    });
  }

  // Also check row 3 for non-merged date cells if no merges found
  if (groups.length === 0) {
    let currentBlock = null;
    for (let col = 4; col <= worksheet.columnCount; col++) {
      const v = cellVal(worksheet.getCell(headerRow, col));
      if (v !== null && v !== undefined && toStr(v) !== "") {
        // This cell has content — might be a date header
        if (!currentBlock || col > currentBlock.endCol + 1) {
          if (currentBlock) groups.push(currentBlock);
          currentBlock = {
            dateLabel: toStr(v),
            dateValue: parseDate(v),
            startCol: col,
            endCol: col,
            span: 1,
          };
        } else {
          currentBlock.endCol = col;
          currentBlock.span++;
        }
      }
    }
    if (currentBlock) groups.push(currentBlock);
  }

  groups.sort((a, b) => a.startCol - b.startCol);
  return groups;
}

/**
 * Find the first row that contains identity columns (serial, rank, name).
 * Looks for row where columns A-C have content, or where header-like text is found.
 */
function findHeaderRow(worksheet) {
  // The spec says row 3 is the date header row, rows 3-4/5 are compound headers.
  // Data starts after the last header row. We'll search rows 1-6 for the identity pattern.
  for (let r = 1; r <= Math.min(8, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    const a = toStr(cellVal(worksheet.getCell(r, 1)));
    const b = toStr(cellVal(worksheet.getCell(r, 2)));
    const c = toStr(cellVal(worksheet.getCell(r, 3)));
    // Check if this looks like a header row (has Arabic text in A-C or labels)
    if (/م|مسلسل|رقم|تسلسل/.test(a) || /رتب|درجة/.test(b) || /اسم|الاسم/.test(c)) {
      return r;
    }
  }
  return null;
}

/**
 * Find where data rows start: the first row after headerRow where column C (name) has content
 * and column A has a numeric serial.
 */
function findDataStart(worksheet, headerRow) {
  for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
    const name = toStr(cellVal(worksheet.getCell(r, 3)));
    const serial = toNum(cellVal(worksheet.getCell(r, 1)));
    if (name && serial !== null) return r;
  }
  // Fallback: 2 rows after the header row found (accounting for sub-headers)
  return headerRow + 2;
}

/**
 * Check if a row is a data row (has a name in column C and a number in column A).
 */
function isDataRow(worksheet, rowNum) {
  const name = toStr(cellVal(worksheet.getCell(rowNum, 3)));
  const serial = toNum(cellVal(worksheet.getCell(rowNum, 1)));
  return name !== "" && serial !== null;
}

/**
 * Check if a row is empty (all cells from col 1 to colCount are empty).
 */
function isRowEmpty(worksheet, rowNum) {
  const row = worksheet.getRow(rowNum);
  let hasValue = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cellVal(cell) !== null && cellVal(cell) !== undefined && toStr(cellVal(cell)) !== "") {
      hasValue = true;
    }
  });
  return !hasValue;
}

// ============================================================
// SHEET 1: CABIN TESTS (كابينه)
// ============================================================

/**
 * Parse the cabin tests sheet.
 *
 * Header structure:
 *   Row 3: merged date cells spanning 4 cols each (tasks 1-3 + average)
 *   Row 4: sub-headers: "عدد المهام" spanning 3 cols, then "المتوسط"
 *   Row 5 (if exists): "1", "2", "3" under "عدد المهام"
 *
 * Returns: array of { name, rank_from_file, test_date, test_type: "cabin", score_details }
 */
function parseCabinSheet(worksheet) {
  const results = [];

  // Find the header area
  const identityRow = findHeaderRow(worksheet) || 3;
  // Date headers are typically in row 3
  const dateRow = 3;
  const dateGroups = discoverDateGroups(worksheet, dateRow);

  if (dateGroups.length === 0) return results;

  // Sub-header rows (for task numbering)
  // The sub-headers are in rows 4-5 typically. We need to figure out the sub-header
  // structure to know which columns are tasks vs average.
  // Strategy: In each date block, the last column is "المتوسط" (average),
  // and the columns before it are individual tasks.

  // Find data start
  let dataStart = dateRow + 1;
  for (let r = dateRow + 1; r <= Math.min(dateRow + 5, worksheet.rowCount); r++) {
    if (isDataRow(worksheet, r)) {
      dataStart = r;
      break;
    }
    // Check sub-headers to find the last header row
    const vals = [];
    for (let c = 1; c <= Math.min(worksheet.columnCount, 20); c++) {
      vals.push(toStr(cellVal(worksheet.getCell(r, c))));
    }
    if (vals.some(v => v === "المتوسط" || /\d/.test(v))) {
      dataStart = r + 1;
    }
  }

  // Parse data rows
  for (let r = dataStart; r <= worksheet.rowCount; r++) {
    if (isRowEmpty(worksheet, r)) break;
    const serial = toNum(cellVal(worksheet.getCell(r, 1)));
    const rankRaw = toStr(cellVal(worksheet.getCell(r, 2)));
    const name = toStr(cellVal(worksheet.getCell(r, 3)));
    if (!name) continue;

    for (const dg of dateGroups) {
      const tasks = [];
      let avg = null;

      // In a block of span=4: cols are [task1, task2, task3, average]
      // In a block of span=3: cols are [task1, task2, task3] (no explicit average)
      const blockCols = [];
      for (let c = dg.startCol; c <= dg.endCol; c++) {
        blockCols.push(toNum(cellVal(worksheet.getCell(r, c))));
      }

      if (blockCols.length >= 4) {
        tasks.push(blockCols[0], blockCols[1], blockCols[2]);
        avg = blockCols[3]; // "المتوسط" — imported exactly as stored
      } else if (blockCols.length === 3) {
        tasks.push(blockCols[0], blockCols[1], blockCols[2]);
        // No explicit average column; compute from the 3 tasks
        const validTasks = tasks.filter(t => t !== null);
        avg = validTasks.length > 0 ? validTasks.reduce((a, b) => a + b, 0) / validTasks.length : null;
      } else if (blockCols.length >= 1) {
        tasks.push(...blockCols);
      }

      const hasData = tasks.some(t => t !== null) || avg !== null;
      if (!hasData) continue;

      const scoreDetails = {};
      tasks.forEach((t, i) => { if (t !== null) scoreDetails[`مهمة_${i + 1}`] = t; });
      if (avg !== null) scoreDetails["المتوسط"] = Math.round(avg * 100) / 100;

      results.push({
        name,
        rank_from_file: rankRaw,
        test_date: dg.dateValue,
        test_date_raw: dg.dateLabel,
        test_type: "cabin",
        score_details: scoreDetails,
        _serial: serial,
      });
    }
  }

  return results;
}

// ============================================================
// SHEET 2: THEORY TESTS (نظري)
// ============================================================

/**
 * Parse the theory tests sheet.
 *
 * Header structure:
 *   Row 3: merged date cells spanning 2 cols each (score + notes)
 *   Row 4: "درجة" and "ملاحظات" under each date
 *
 * Returns: array of { name, rank_from_file, test_date, test_type: "theory", score_details }
 */
function parseTheorySheet(worksheet) {
  const results = [];
  const dateRow = 3;
  const dateGroups = discoverDateGroups(worksheet, dateRow);

  if (dateGroups.length === 0) return results;

  // Find data start
  let dataStart = dateRow + 1;
  for (let r = dateRow + 1; r <= Math.min(dateRow + 4, worksheet.rowCount); r++) {
    if (isDataRow(worksheet, r)) {
      dataStart = r;
      break;
    }
    dataStart = r + 1;
  }

  // Parse data rows
  for (let r = dataStart; r <= worksheet.rowCount; r++) {
    if (isRowEmpty(worksheet, r)) break;
    const serial = toNum(cellVal(worksheet.getCell(r, 1)));
    const rankRaw = toStr(cellVal(worksheet.getCell(r, 2)));
    const name = toStr(cellVal(worksheet.getCell(r, 3)));
    if (!name) continue;

    // Extract specialty from cell fill color (name cell col C, fallback rank cell col B)
    const nameColor = extractSpecialtyFromCell(worksheet.getCell(r, 3), "theory");
    const rankColor = extractSpecialtyFromCell(worksheet.getCell(r, 2), "theory");
    const colorInfo = nameColor.colorHex ? nameColor : rankColor;

    for (const dg of dateGroups) {
      const scoreRaw = toNum(cellVal(worksheet.getCell(r, dg.startCol)));
      const notesRaw = cellVal(worksheet.getCell(r, dg.startCol + 1));
      const notes = notesRaw !== null && notesRaw !== undefined ? toStr(notesRaw) : null;

      if (scoreRaw === null && !notes) continue;

      const scoreDetails = {};
      if (scoreRaw !== null) scoreDetails["الدرجة"] = scoreRaw;
      if (notes) scoreDetails["ملاحظات"] = notes;

      results.push({
        name,
        rank_from_file: rankRaw,
        test_date: dg.dateValue,
        test_date_raw: dg.dateLabel,
        test_type: "theory",
        score_details: scoreDetails,
        detected_specialty: colorInfo.specialty,
        detected_color_hex: colorInfo.colorHex,
        _serial: serial,
      });
    }
  }

  return results;
}

// ============================================================
// SHEET 3: FITNESS TESTS (ورقة3)
// ============================================================

/**
 * Parse the fitness tests sheet.
 *
 * Header structure:
 *   Row 3: merged date cells spanning 4 cols each
 *   Row 4: "ضغط", "عقلة", "بطن", "ج.م" under each date
 *
 * Near the end (~rows 172-175): summary/notes blocks — excluded from import.
 *
 * Returns: array of { name, rank_from_file, test_date, test_type: "fitness", score_details }
 */
function parseFitnessSheet(worksheet) {
  const results = [];
  const dateRow = 3;
  const dateGroups = discoverDateGroups(worksheet, dateRow);

  if (dateGroups.length === 0) return results;

  // Find data start
  let dataStart = dateRow + 1;
  for (let r = dateRow + 1; r <= Math.min(dateRow + 4, worksheet.rowCount); r++) {
    if (isDataRow(worksheet, r)) {
      dataStart = r;
      break;
    }
    dataStart = r + 1;
  }

  // Find where data ends (before summary/notes blocks at bottom)
  // Look for the last row with a serial number in column A
  let dataEnd = worksheet.rowCount;
  for (let r = worksheet.rowCount; r >= dataStart; r--) {
    if (isDataRow(worksheet, r)) {
      dataEnd = r;
      break;
    }
  }

  const FITNESS_LABELS = ["ضغط", "عقلة", "بطن", "ج.م"];

  // Parse data rows
  for (let r = dataStart; r <= dataEnd; r++) {
    if (isRowEmpty(worksheet, r)) continue;
    const serial = toNum(cellVal(worksheet.getCell(r, 1)));
    const rankRaw = toStr(cellVal(worksheet.getCell(r, 2)));
    const name = toStr(cellVal(worksheet.getCell(r, 3)));
    if (!name) continue;

    // Extract specialty from cell fill color (name cell col C, fallback rank cell col B)
    const nameColor = extractSpecialtyFromCell(worksheet.getCell(r, 3), "fitness");
    const rankColor = extractSpecialtyFromCell(worksheet.getCell(r, 2), "fitness");
    const colorInfo = nameColor.colorHex ? nameColor : rankColor;

    for (const dg of dateGroups) {
      const blockValues = [];
      for (let c = dg.startCol; c <= dg.endCol; c++) {
        blockValues.push(toNum(cellVal(worksheet.getCell(r, c))));
      }

      const hasData = blockValues.some(v => v !== null);
      if (!hasData) continue;

      const scoreDetails = {};
      blockValues.forEach((v, i) => {
        if (v !== null && i < FITNESS_LABELS.length) {
          scoreDetails[FITNESS_LABELS[i]] = v;
        }
      });

      results.push({
        name,
        rank_from_file: rankRaw,
        test_date: dg.dateValue,
        test_date_raw: dg.dateLabel,
        test_type: "fitness",
        score_details: scoreDetails,
        detected_specialty: colorInfo.specialty,
        detected_color_hex: colorInfo.colorHex,
        _serial: serial,
      });
    }
  }

  return results;
}

// ============================================================
// SHEET TYPE DETECTION
// ============================================================

/**
 * Detect sheet type by name AND structure.
 * Returns: "cabin" | "theory" | "fitness" | null
 */
function detectSheetType(worksheet) {
  const name = worksheet.name.toLowerCase();

  // Name-based detection (primary)
  if (/كبين|cabin/.test(name)) return "cabin";
  if (/نظري|theory/.test(name)) return "theory";
  if (/لياق|fitness|ورقة/.test(name)) return "fitness";

  // Structure-based detection (fallback): check sub-headers in rows 3-5
  const headerTexts = [];
  for (let r = 3; r <= Math.min(5, worksheet.rowCount); r++) {
    for (let c = 1; c <= Math.min(worksheet.columnCount, 20); c++) {
      const v = toStr(cellVal(worksheet.getCell(r, c)));
      if (v) headerTexts.push(v);
    }
  }
  const joined = headerTexts.join(" ");

  if (/مهمة|المتوسط/.test(joined)) return "cabin";
  if (/ملاحظات/.test(joined) && /درجة/.test(joined)) return "theory";
  if (/ضغط|عقلة|بطن|ج\.م/.test(joined)) return "fitness";

  return null;
}

// ============================================================
// MAIN PARSER
// ============================================================

/**
 * Parse an uploaded Excel buffer.
 * Returns: { sheets: [...], results: [...], errors: [...], warnings: [...] }
 */
async function parseTestResults(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = [];
  const allResults = [];
  const errors = [];
  const warnings = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.state === "hidden") continue;

    const sheetInfo = {
      name: worksheet.name,
      type: detectSheetType(worksheet),
      rows: worksheet.rowCount,
      cols: worksheet.columnCount,
      resultsCount: 0,
    };

    if (!sheetInfo.type) {
      warnings.push(`الورقة "${worksheet.name}" — لم يتم التعرف على النوع. تم تخطيها.`);
      sheets.push(sheetInfo);
      continue;
    }

    let parsed = [];
    try {
      switch (sheetInfo.type) {
        case "cabin":
          parsed = parseCabinSheet(worksheet);
          break;
        case "theory":
          parsed = parseTheorySheet(worksheet);
          break;
        case "fitness":
          parsed = parseFitnessSheet(worksheet);
          break;
      }
    } catch (e) {
      errors.push(`خطأ في تحليل الورقة "${worksheet.name}": ${e.message}`);
    }

    sheetInfo.resultsCount = parsed.length;
    allResults.push(...parsed);
    sheets.push(sheetInfo);
  }

  // Deduplicate: same name + same date + same type = keep one
  const seen = new Set();
  const deduped = [];
  for (const r of allResults) {
    const key = `${r.name}|${r.test_date}|${r.test_type}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  if (allResults.length !== deduped.length) {
    warnings.push(`تم إزالة ${allResults.length - deduped.length} سجل مكرر`);
  }

  return {
    sheets,
    results: deduped,
    totalCount: deduped.length,
    errors,
    warnings,
  };
}

module.exports = { parseTestResults, detectSheetType, SPECIALTY_COLORS, extractSpecialtyFromCell };
