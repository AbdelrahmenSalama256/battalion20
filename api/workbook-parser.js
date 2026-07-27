/**
 * Workbook Parser — Production-grade Excel Import Engine
 *
 * Parses hierarchical Excel workbooks with merged cells.
 * Discovers structure dynamically (no hardcoded rows/columns/indices).
 *
 * ASSUMPTIONS (documented per spec requirement):
 *   - Workbook contains 3 worksheet types: Cabin Tests, Theory Tests, Physical Fitness Tests
 *   - Each worksheet has identity columns: Serial Number, Rank, Employee Name
 *   - Date groups are represented by merged cells in the header rows
 *   - Employee data rows begin after the last header row
 *   - Reading continues until the first completely empty row
 *   - Worksheet detection uses BOTH name AND header structure
 *
 * Hierarchy:
 *   Workbook → Worksheet → [Header Discovery] → [Date Groups] → [Employee Rows] → [Values]
 *
 * Dependencies: exceljs (server-side Excel parsing with merged cell support)
 */

const ExcelJS = require("exceljs");

// ============================================================
// CONSTANTS — detected dynamically, these are fallback patterns
// ============================================================

const IDENTITY_PATTERNS = {
  serial: [/مسلسل/, /رقم/, /الرقم/, /serial/i, /sequence/i],
  rank: [/رتب/, /الرتبة/, /rank/i],
  name: [/اسم/, /الاسم/, /name/i, /employee/i],
};

const SHEET_TYPE_DETECTORS = {
  cabin: {
    namePatterns: [/كبين/, /cabin/i, /اختبا.*كبين/i],
    columnPatterns: [/مهمة/, /task/i, /متوسط/, /average/i],
  },
  theory: {
    namePatterns: [/نظري/i, /theory/i, /اختبار.*نظري/i],
    columnPatterns: [/درجة/, /score/i, /ملاحظ/i, /note/i],
  },
  fitness: {
    namePatterns: [/لياق/, /fitness/i, /بدني/i, /physical/i],
    columnPatterns: [/ضغط/, /push/i, /جari/i, /run/i, /بطن/i, /sit/i, /معد/i, /pull/i],
  },
};

// ============================================================
// WORKBOOK ANALYZER
// ============================================================

class WorkbookAnalyzer {
  constructor() {
    this.workbook = null;
    this.worksheets = [];
    this.mergedCells = {};
    this.results = {
      worksheets: [],
      employees: [],
      dateGroups: [],
      sessions: [],
      errors: [],
      warnings: [],
    };
  }

  /**
   * Analyze an uploaded Excel file buffer
   * @param {Buffer} buffer - Raw Excel file content
   * @returns {Object} Parsed workbook structure
   */
  async analyze(buffer) {
    this.workbook = new ExcelJS.Workbook();
    await this.workbook.xlsx.load(buffer);

    this.worksheets = this.workbook.worksheets.filter(
      (ws) => ws.state !== "hidden"
    );

    if (!this.worksheets.length) {
      this.results.errors.push({
        category: "VALIDATION",
        description: "لا توجد أوراق عمل في الملف",
      });
      return this.results;
    }

    for (const ws of this.worksheets) {
      try {
        const wsResult = await this.analyzeWorksheet(ws);
        this.results.worksheets.push(wsResult);
      } catch (e) {
        this.results.errors.push({
          category: "PARSING",
          description: `خطأ في تحليل الورقة "${ws.name}": ${e.message}`,
          worksheet: ws.name,
        });
      }
    }

    return this.results;
  }

  /**
   * Analyze a single worksheet
   */
  async analyzeWorksheet(ws) {
    const wsResult = {
      name: ws.name,
      type: null,
      typeDetectedBy: null,
      headerRows: [],
      headerDepth: 0,
      identityColumns: {},
      dateGroups: [],
      employeeRows: [],
      totalRows: 0,
      totalCols: 0,
      dataRows: [],
    };

    if (ws.rowCount < 2) {
      wsResult.isEmpty = true;
      return wsResult;
    }

    // Step 1: Discover merged cell regions
    const mergedRanges = this.getMergedCells(ws);

    // Step 2: Discover header rows
    const headerInfo = this.discoverHeaders(ws, mergedRanges);
    wsResult.headerRows = headerInfo.rows;
    wsResult.headerDepth = headerInfo.depth;
    wsResult.identityColumns = headerInfo.identityColumns;

    if (headerInfo.depth === 0) {
      this.results.warnings.push({
        worksheet: ws.name,
        message: "لم يتم اكتشاف صفوف العناوين",
      });
    }

    // Step 3: Detect sheet type
    const typeInfo = this.detectSheetType(ws, headerInfo);
    wsResult.type = typeInfo.type;
    wsResult.typeDetectedBy = typeInfo.detectedBy;

    // Step 4: Discover date groups from merged cells
    wsResult.dateGroups = this.discoverDateGroups(
      ws,
      mergedRanges,
      headerInfo
    );

    // Step 5: Detect employee rows
    const empInfo = this.discoverEmployeeRows(ws, headerInfo, wsResult.type);
    wsResult.employeeRows = empInfo.rows;
    wsResult.totalRows = ws.rowCount;
    wsResult.totalCols = ws.columnCount;

    // Step 6: Parse data rows
    wsResult.dataRows = this.parseDataRows(
      ws,
      headerInfo,
      wsResult.dateGroups,
      wsResult.type
    );

    return wsResult;
  }

  // ============================================================
  // MERGED CELL DETECTION
  // ============================================================

  getMergedCells(ws) {
    const ranges = [];
    ws.mergeCells.forEach((range) => {
      const model =
        typeof range === "string"
          ? this.parseRange(range)
          : range;
      if (model) {
        ranges.push({
          top: model.top,
          left: model.left,
          bottom: model.bottom,
          right: model.right,
          value: ws.getCell(model.top, model.left).value,
        });
      }
    });
    return ranges;
  }

  parseRange(rangeStr) {
    // ExcelJS merge ranges look like "A1:B2" or {top,left,bottom,right}
    if (typeof rangeStr === "object" && rangeStr.top) return rangeStr;
    if (typeof rangeStr !== "string") return null;

    const match = rangeStr.match(
      /([A-Z]+)(\d+):([A-Z]+)(\d+)/i
    );
    if (!match) return null;

    const colToNum = (s) => {
      let n = 0;
      for (let i = 0; i < s.length; i++) {
        n = n * 26 + (s.charCodeAt(i) - 64);
      }
      return n;
    };

    return {
      top: parseInt(match[2]),
      left: colToNum(match[1]),
      bottom: parseInt(match[4]),
      right: colToNum(match[3]),
    };
  }

  // ============================================================
  // HEADER DISCOVERY
  // ============================================================

  /**
   * Discover header rows dynamically by looking for identity columns
   * and analyzing row structure.
   *
   * ASSUMPTION: Identity columns (Serial, Rank, Name) appear in the
   * first few rows. Merged date headers appear in the same or adjacent rows.
   */
  discoverHeaders(ws, mergedRanges) {
    const result = {
      rows: [],
      depth: 0,
      identityColumns: {},
      firstDataRow: 0,
    };

    // Scan first 10 rows to find headers
    const maxScan = Math.min(ws.rowCount, 10);
    let identityRow = -1;
    let headerEndRow = -1;

    for (let rowNum = 1; rowNum <= maxScan; rowNum++) {
      const row = ws.getRow(rowNum);
      const values = [];
      let nonEmptyCount = 0;

      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        const val = this.getCellValue(cell);
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          nonEmptyCount++;
        }
        values.push({ col: colNum, value: val });
      });

      // Check if this row contains identity columns
      const identityCheck = this.checkIdentityColumns(values);
      if (identityCheck.found) {
        identityRow = rowNum;
        result.identityColumns = identityCheck.columns;
        result.rows.push(rowNum);
        headerEndRow = rowNum;
      } else if (identityRow >= 0 && rowNum === identityRow + 1) {
        // Check if next row has sub-headers (for multi-level headers)
        const hasMergedDateHeaders = mergedRanges.some(
          (m) => m.top === rowNum || m.top === identityRow
        );
        if (hasMergedDateHeaders || this.rowHasData(row)) {
          headerEndRow = rowNum;
          result.rows.push(rowNum);
        }
      } else if (
        identityRow < 0 &&
        nonEmptyCount >= 2 &&
        this.rowLooksLikeHeader(values)
      ) {
        // Could be header row without standard identity names
        result.rows.push(rowNum);
        headerEndRow = rowNum;
      }
    }

    // Check if merged cells span multiple header rows
    if (mergedRanges.length > 0) {
      const maxMergedRow = Math.max(...mergedRanges.map((m) => m.top));
      if (maxMergedRow > headerEndRow) {
        for (let r = headerEndRow + 1; r <= maxMergedRow; r++) {
          if (!result.rows.includes(r)) {
            result.rows.push(r);
          }
        }
        headerEndRow = maxMergedRow;
      }
    }

    result.depth = result.rows.length;
    result.firstDataRow = headerEndRow + 1;

    return result;
  }

  checkIdentityColumns(values) {
    const columns = {};
    let found = 0;

    for (const { col, value } of values) {
      if (value === null || value === undefined) continue;
      const str = String(value).trim();

      for (const [key, patterns] of Object.entries(IDENTITY_PATTERNS)) {
        if (patterns.some((p) => p.test(str))) {
          columns[key] = col;
          found++;
          break;
        }
      }
    }

    return { found, columns };
  }

  rowLooksLikeHeader(values) {
    // A row looks like a header if it has mostly text values
    // and they match known patterns
    let textCount = 0;
    for (const { value } of values) {
      if (value === null || value === undefined) continue;
      const str = String(value).trim();
      if (str.length > 0) {
        textCount++;
      }
    }
    return textCount >= 3;
  }

  rowHasData(row) {
    let count = 0;
    row.eachCell({ includeEmpty: false }, () => count++);
    return count >= 3;
  }

  // ============================================================
  // SHEET TYPE DETECTION
  // ============================================================

  /**
   * Detect worksheet type using BOTH name AND column structure.
   * This follows the spec: "Determine worksheet type using BOTH Worksheet Name AND Header Structure"
   */
  detectSheetType(ws, headerInfo) {
    const wsName = ws.name.toLowerCase();
    const allHeaders = this.getAllHeaderValues(ws, headerInfo);
    const headerStr = allHeaders.join(" ").toLowerCase();

    let bestMatch = { type: "unknown", score: 0, detectedBy: "none" };

    for (const [type, detector] of Object.entries(SHEET_TYPE_DETECTORS)) {
      let score = 0;

      // Name match (higher weight)
      if (detector.namePatterns.some((p) => p.test(wsName))) {
        score += 10;
      }

      // Column pattern match
      for (const pattern of detector.columnPatterns) {
        if (headerStr.includes(pattern.source.toLowerCase())) {
          score += 3;
        }
      }

      // Also check individual header values
      for (const header of allHeaders) {
        for (const pattern of detector.columnPatterns) {
          if (pattern.test(header.toLowerCase())) {
            score += 1;
          }
        }
      }

      if (score > bestMatch.score) {
        bestMatch = {
          type,
          score,
          detectedBy: score >= 10 ? "name+structure" : score >= 3 ? "structure" : "name",
        };
      }
    }

    // Minimum threshold
    if (bestMatch.score < 1) {
      bestMatch = { type: "unknown", score: 0, detectedBy: "none" };
    }

    return bestMatch;
  }

  getAllHeaderValues(ws, headerInfo) {
    const values = [];
    for (const rowNum of headerInfo.rows) {
      const row = ws.getRow(rowNum);
      row.eachCell({ includeEmpty: false }, (cell) => {
        const val = this.getCellValue(cell);
        if (val !== null && val !== undefined) {
          values.push(String(val));
        }
      });
    }
    return values;
  }

  // ============================================================
  // DATE GROUP DISCOVERY
  // ============================================================

  /**
   * Discover date groups from merged cells in header rows.
   * ASSUMPTION: Dates are merged across columns in the header rows.
   * Each merged region spanning multiple columns = one date group.
   *
   * The parser discovers date groups dynamically:
   * - No fixed column numbers
   * - No fixed number of dates
   * - Supports reordering
   */
  discoverDateGroups(ws, mergedRanges, headerInfo) {
    const dateGroups = [];

    if (!headerInfo.rows.length || !headerInfo.identityColumns.name) {
      return dateGroups;
    }

    const nameCol = headerInfo.identityColumns.name;
    const identityEndCol = nameCol; // Identity columns end at name

    // Find merged regions that span multiple columns after identity columns
    // These represent date groups
    for (const merge of mergedRanges) {
      // Date groups span from after identity columns to the right
      if (merge.left > identityEndCol && merge.right > merge.left) {
        const span = merge.right - merge.left + 1;
        if (span >= 2) {
          // Date groups span at least 2 columns
          const dateValue = this.getCellValue(
            ws.getCell(merge.top, merge.left)
          );

          // Read child column headers (the row below the merged date header)
          const childHeaders = [];
          const childRow = merge.top + 1 <= headerInfo.firstDataRow
            ? merge.top + 1
            : merge.top;

          for (let col = merge.left; col <= merge.right; col++) {
            const cellVal = this.getCellValue(
              ws.getCell(childRow, col)
            );
            childHeaders.push({
              col,
              label: cellVal ? String(cellVal).trim() : `col_${col}`,
            });
          }

          dateGroups.push({
            date: dateValue,
            dateLabel: dateValue
              ? String(dateValue)
              : `مجموعة_${dateGroups.length + 1}`,
            startCol: merge.left,
            endCol: merge.right,
            row: merge.top,
            span,
            childHeaders,
            values: {},
          });
        }
      }
    }

    // Sort by column position
    dateGroups.sort((a, b) => a.startCol - b.startCol);

    return dateGroups;
  }

  // ============================================================
  // EMPLOYEE ROW DETECTION
  // ============================================================

  /**
   * Discover employee data rows.
   * ASSUMPTION: Data rows start after the last header row and contain
   * identity column values (serial number, name).
   *
   * Reading continues until the first completely empty row.
   */
  discoverEmployeeRows(ws, headerInfo, sheetType) {
    const result = { rows: [], count: 0 };

    if (!headerInfo.identityColumns.name) {
      return result;
    }

    const nameCol = headerInfo.identityColumns.name;
    const serialCol = headerInfo.identityColumns.serial;
    const startRow = headerInfo.firstDataRow || 2;

    for (let rowNum = startRow; rowNum <= ws.rowCount; rowNum++) {
      const row = ws.getRow(rowNum);

      // Check if row is completely empty → stop
      let hasAnyValue = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        const val = this.getCellValue(cell);
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          hasAnyValue = true;
        }
      });

      if (!hasAnyValue) break;

      // Check if this row has an employee name
      const nameCell = ws.getRow(rowNum).getCell(nameCol);
      const nameVal = this.getCellValue(nameCell);

      if (nameVal !== null && nameVal !== undefined && String(nameVal).trim() !== "") {
        const serialVal = serialCol
          ? this.getCellValue(ws.getRow(rowNum).getCell(serialCol))
          : null;

        result.rows.push({
          row: rowNum,
          name: String(nameVal).trim(),
          serial: serialVal ? String(serialVal).trim() : null,
        });
        result.count++;
      }
    }

    return result;
  }

  // ============================================================
  // DATA ROW PARSING
  // ============================================================

  /**
   * Parse data rows into structured objects.
   * Maps identity columns and date group values.
   */
  parseDataRows(ws, headerInfo, dateGroups, sheetType) {
    const rows = [];

    if (!headerInfo.identityColumns.name || !dateGroups.length) {
      return rows;
    }

    const { serial: serialCol, rank: rankCol, name: nameCol } =
      headerInfo.identityColumns;
    const startRow = headerInfo.firstDataRow || 2;

    for (let rowNum = startRow; rowNum <= ws.rowCount; rowNum++) {
      const row = ws.getRow(rowNum);

      // Check if row is completely empty
      let hasAnyValue = false;
      row.eachCell({ includeEmpty: false }, (cell) => {
        const val = this.getCellValue(cell);
        if (val !== null && val !== undefined && String(val).trim() !== "") {
          hasAnyValue = true;
        }
      });
      if (!hasAnyValue) break;

      const nameVal = this.getCellValue(row.getCell(nameCol));
      if (!nameVal || String(nameVal).trim() === "") continue;

      const employee = {
        row: rowNum,
        serial: serialCol
          ? String(this.getCellValue(row.getCell(serialCol)) || "").trim()
          : null,
        rank: rankCol
          ? String(this.getCellValue(row.getCell(rankCol)) || "").trim()
          : null,
        name: String(nameVal).trim(),
        dateGroupValues: {},
      };

      // Read values for each date group
      for (const dg of dateGroups) {
        const groupValues = {};
        for (const child of dg.childHeaders) {
          const cellVal = this.getCellValue(row.getCell(child.col));
          groupValues[child.label] = cellVal;
        }
        employee.dateGroupValues[dg.dateLabel] = groupValues;
      }

      rows.push(employee);
    }

    return rows;
  }

  // ============================================================
  // WORKSHEET-SPECIFIC PARSERS
  // ============================================================

  /**
   * Parse Cabin Tests worksheet.
   * Each date group contains: Task1, Task2, Task3, Average
   * Average must be imported exactly as stored (never recalculated).
   */
  parseCabinTests(wsResult) {
    const sessions = [];

    for (const emp of wsResult.dataRows) {
      for (const dg of wsResult.dateGroups) {
        const values = emp.dateGroupValues[dg.dateLabel] || {};
        const childLabels = dg.childHeaders.map((c) => c.label);

        // Detect task columns vs average column
        let avgLabel = null;
        const taskLabels = [];
        for (const label of childLabels) {
          if (/متوسط|average|avg/i.test(label)) {
            avgLabel = label;
          } else {
            taskLabels.push(label);
          }
        }

        const fields = {};
        let hasData = false;

        for (const label of taskLabels) {
          const val = this.parseNumericOrText(values[label]);
          fields[label] = val;
          if (val !== null) hasData = true;
        }

        if (avgLabel) {
          fields["_average"] = this.parseNumericOrText(values[avgLabel]);
          if (fields["_average"] !== null) hasData = true;
        }

        if (hasData) {
          sessions.push({
            employeeName: emp.name,
            employeeSerial: emp.serial,
            employeeRank: emp.rank,
            date: dg.dateLabel,
            type: "cabin",
            fields,
            average: avgLabel ? fields["_average"] : null,
            worksheetName: wsResult.name,
          });
        }
      }
    }

    return sessions;
  }

  /**
   * Parse Theory Tests worksheet.
   * Each date group contains: Score, Notes
   */
  parseTheoryTests(wsResult) {
    const sessions = [];

    for (const emp of wsResult.dataRows) {
      for (const dg of wsResult.dateGroups) {
        const values = emp.dateGroupValues[dg.dateLabel] || {};
        const childLabels = dg.childHeaders.map((c) => c.label);

        const fields = {};
        let hasData = false;

        for (const label of childLabels) {
          const val = this.parseNumericOrText(values[label]);
          fields[label] = val;
          if (val !== null) hasData = true;
        }

        if (hasData) {
          sessions.push({
            employeeName: emp.name,
            employeeSerial: emp.serial,
            employeeRank: emp.rank,
            date: dg.dateLabel,
            type: "theory",
            fields,
            worksheetName: wsResult.name,
          });
        }
      }
    }

    return sessions;
  }

  /**
   * Parse Physical Fitness Tests worksheet.
   * Each date group contains: Push-ups, Pull-ups, Sit-ups, Running
   */
  parseFitnessTests(wsResult) {
    const sessions = [];

    for (const emp of wsResult.dataRows) {
      for (const dg of wsResult.dateGroups) {
        const values = emp.dateGroupValues[dg.dateLabel] || {};
        const childLabels = dg.childHeaders.map((c) => c.label);

        const fields = {};
        let hasData = false;

        for (const label of childLabels) {
          const val = this.parseNumericOrText(values[label]);
          fields[label] = val;
          if (val !== null) hasData = true;
        }

        if (hasData) {
          sessions.push({
            employeeName: emp.name,
            employeeSerial: emp.serial,
            employeeRank: emp.rank,
            date: dg.dateLabel,
            type: "fitness",
            fields,
            worksheetName: wsResult.name,
          });
        }
      }
    }

    return sessions;
  }

  // ============================================================
  // UTILITY
  // ============================================================

  getCellValue(cell) {
    if (!cell) return null;
    if (cell.value === null || cell.value === undefined) return null;
    if (cell.value && cell.value.result !== undefined) return cell.value.result;
    if (cell.value && cell.value.text !== undefined) return cell.value.text;
    return cell.value;
  }

  parseNumericOrText(val) {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str === "") return null;
    const num = Number(str);
    if (!isNaN(num) && str !== "") return num;
    return str;
  }
}

// ============================================================
// VALIDATOR
// ============================================================

class ImportValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validateWorkbook(analysisResult) {
    this.errors = [...analysisResult.errors];
    this.warnings = [...analysisResult.warnings];

    for (const ws of analysisResult.worksheets) {
      this.validateWorksheet(ws);
    }

    return {
      valid: this.errors.filter((e) => e.category === "VALIDATION").length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  validateWorksheet(ws) {
    if (ws.isEmpty) {
      this.warnings.push({
        worksheet: ws.name,
        message: "الورقة فارغة",
      });
      return;
    }

    if (!ws.identityColumns.name) {
      this.errors.push({
        category: "VALIDATION",
        description: `لم يتم اكتشاف عمود اسم الموظف في الورقة "${ws.name}"`,
        worksheet: ws.name,
      });
    }

    if (!ws.type || ws.type === "unknown") {
      this.errors.push({
        category: "VALIDATION",
        description: `لم يتم تحديد نوع الورقة "${ws.name}". يجب أن تحتوي على عناوين تطابق أحد الأنواع المدعومة`,
        worksheet: ws.name,
      });
    }

    if (!ws.dateGroups.length) {
      this.warnings.push({
        worksheet: ws.name,
        message: "لم يتم اكتشاف مجموعات تاريخ. تأكد من وجود خلايا مدمجة في صفوف العناوين",
      });
    }

    if (!ws.dataRows.length) {
      this.warnings.push({
        worksheet: ws.name,
        message: "لم يتم العثور على بيانات أفراد",
      });
    }

    // Check for duplicate employees in same worksheet
    const names = ws.dataRows.map((r) => r.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupes.length > 0) {
      this.warnings.push({
        worksheet: ws.name,
        message: `موظفون مكررون: ${[...new Set(dupes)].join(", ")}`,
      });
    }
  }

  validateSession(session) {
    if (!session.employeeName) {
      this.errors.push({
        category: "VALIDATION",
        description: "اسم الموظف مفقود",
      });
      return false;
    }

    if (!session.date) {
      this.errors.push({
        category: "VALIDATION",
        description: `تاريخ مفقود للموظف ${session.employeeName}`,
      });
      return false;
    }

    return true;
  }
}

// ============================================================
// MAIN IMPORT ORCHESTRATOR
// ============================================================

class WorkbookImportEngine {
  /**
   * Parse an Excel workbook buffer and return structured sessions.
   *
   * @param {Buffer} buffer - Raw .xlsx file content
   * @param {string} filename - Original filename for audit
   * @returns {Object} { sessions, analysis, validation, errors }
   */
  async parse(buffer, filename = "unknown.xlsx") {
    const startTime = Date.now();

    // Step 1: Analyze workbook
    const analyzer = new WorkbookAnalyzer();
    const analysis = await analyzer.analyze(buffer);

    // Step 2: Validate structure
    const validator = new ImportValidator();
    const validation = validator.validateWorkbook(analysis);

    if (!validation.valid) {
      return {
        sessions: [],
        analysis,
        validation,
        errors: validation.errors,
        processingTime: Date.now() - startTime,
      };
    }

    // Step 3: Parse sessions from each worksheet
    const allSessions = [];
    const parseErrors = [];

    for (const ws of analysis.worksheets) {
      try {
        let sessions = [];

        switch (ws.type) {
          case "cabin":
            sessions = analyzer.parseCabinTests(ws);
            break;
          case "theory":
            sessions = analyzer.parseTheoryTests(ws);
            break;
          case "fitness":
            sessions = analyzer.parseFitnessTests(ws);
            break;
          default:
            parseErrors.push({
              category: "PARSING",
              description: `نوع غير معروف: ${ws.type}`,
              worksheet: ws.name,
            });
            continue;
        }

        // Validate each session
        for (const session of sessions) {
          if (validator.validateSession(session)) {
            allSessions.push(session);
          }
        }
      } catch (e) {
        parseErrors.push({
          category: "PARSING",
          description: `خطأ في تحليل الورقة "${ws.name}": ${e.message}`,
          worksheet: ws.name,
        });
      }
    }

    return {
      sessions: allSessions,
      analysis,
      validation: {
        ...validation,
        errors: [...validation.errors, ...parseErrors],
      },
      errors: [...validation.errors, ...parseErrors],
      processingTime: Date.now() - startTime,
    };
  }
}

module.exports = {
  WorkbookAnalyzer,
  ImportValidator,
  WorkbookImportEngine,
};
