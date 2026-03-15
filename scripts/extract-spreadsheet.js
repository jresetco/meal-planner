/**
 * Extract meal plan data from the Excel spreadsheet into training JSON.
 * Skips: templates, blank tabs, GI Prep.
 */
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const SKIP_SHEETS = [
  'Monthly Template',
  'Weekly Templates',
  'James - GI Prep',
  ' Apr 22 (dont copy this version', // typo in sheet name
];

function isBlankRow(row) {
  return !row || row.every(cell => cell === '' || cell === null || cell === undefined);
}

function isTemplateOrBlank(sheetName) {
  const lower = sheetName.toLowerCase();
  if (SKIP_SHEETS.some(s => sheetName.includes(s) || s.includes(sheetName))) return true;
  if (lower.includes('template')) return true;
  if (lower.includes('gi prep')) return true;
  return false;
}

function parseRegularMealIdeas(data) {
  const meals = { breakfast: [], lunch: [], dinnerMains: [], dinnerSides: [] };
  const headers = data[0] || [];
  const colMap = { 0: 'breakfast', 1: 'lunch', 2: 'dinnerMains', 3: 'dinnerSides' };

  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    for (let c = 0; c < 4 && c < (row?.length || 0); c++) {
      const val = row[c];
      if (val && String(val).trim()) {
        const key = colMap[c];
        if (key && !meals[key].includes(val.trim())) {
          meals[key].push(val.trim());
        }
      }
    }
  }
  return meals;
}

function parseCurrentGoals(data) {
  const goals = [];
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const val = row && row[0];
    if (val && String(val).trim()) {
      goals.push({ goal: String(val).trim(), note: (row[1] && String(row[1]).trim()) || null });
    }
  }
  return goals;
}

// Parse month/year from sheet name or monthYear string. Returns { year, month } or null.
const MONTH_MAP = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sept: 9, sep: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

function parseMonthYear(sheetName, monthYearStr) {
  const sources = [monthYearStr, sheetName].filter(Boolean);
  for (const s of sources) {
    const lower = String(s).toLowerCase().trim();
    // Match "December 2023", "Dec 23", "Dec21", "November 21"
    let fullMatch = lower.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\s*['']?(\d{2,4})/);
    if (!fullMatch) {
      fullMatch = lower.match(/(dec|nov|oct|sept|aug|jul|jun|may|apr|mar|feb|jan)(\d{2,4})/);
    }
    if (fullMatch) {
      const month = MONTH_MAP[fullMatch[1]] ?? MONTH_MAP[fullMatch[1].slice(0, 3)];
      if (!month) continue;
      let year = parseInt(fullMatch[2], 10);
      if (year < 100) year += year < 50 ? 2000 : 1900;
      if (year >= 1900 && year <= 2100) return { year, month };
    }
    // Match "June 2024" or "2024" with month elsewhere
    const yearMatch = lower.match(/\b(20\d{2}|19\d{2})\b/);
    const monthMatch = lower.match(/(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)/);
    if (yearMatch && monthMatch) {
      const month = MONTH_MAP[monthMatch[1]] ?? MONTH_MAP[monthMatch[1].slice(0, 3)];
      if (month) return { year: parseInt(yearMatch[1], 10), month };
    }
  }
  return null;
}

// Resolve full date and dayOfWeek. Returns { dateStr, dayOfWeek } or {} when unknown.
function resolveDateAndDay(year, month, dateNum) {
  if (year == null || month == null || dateNum == null) return {};
  const d = parseInt(dateNum, 10);
  if (isNaN(d) || d < 1 || d > 31) return {};

  const date = new Date(year, month - 1, d);
  if (isNaN(date.getTime()) || date.getDate() !== d) return {};
  const dateStr = date.toISOString().split('T')[0];
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
  return { dateStr, dayOfWeek };
}

function parseCalendarSheet(sheetName, data) {
  // Structure: row 0 = month header, row 1 = day names, then blocks of 5-7 rows per week
  // Block: dates row, B, L, D, (notes)
  const weeks = [];
  let monthYear = '';
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (data[0] && data[0][0]) monthYear = String(data[0][0]).trim();
  const headerRow = data[1] || [];
  const dayIndices = dayNames.map(d => headerRow.findIndex(c => String(c).trim() === d)).filter(i => i >= 0);
  if (dayIndices.length === 0) {
    // Try alternate: Sun, Mon, etc
    const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let c = 0; c < 7; c++) {
      const v = data[1] && data[1][c] ? String(data[1][c]).trim() : '';
      if (short.some(s => v.startsWith(s) || v === s)) dayIndices.push(c);
    }
  }
  if (dayIndices.length === 0) dayIndices.push(0, 1, 2, 3, 4, 5, 6);

  let row = 2;
  while (row < data.length) {
    const datesRow = data[row];
    if (!datesRow || datesRow.every(c => c === '' || c == null)) {
      row++;
      continue;
    }
    const dates = datesRow.map(c => (c != null && c !== '' ? Number(c) || String(c) : null));
    const hasDates = dates.some(d => d !== null && d !== '');
    if (!hasDates) {
      row++;
      continue;
    }

    const bRow = data[row + 1] || [];
    const lRow = data[row + 2] || [];
    const dRow = data[row + 3] || [];

    const weekMeals = [];
    for (let col = 0; col < 7; col++) {
      const dateVal = dates[col];
      const b = (bRow[col] && String(bRow[col]).trim()) || '';
      const l = (lRow[col] && String(lRow[col]).trim()) || '';
      const d = (dRow[col] && String(dRow[col]).trim()) || '';
      if (b || l || d) {
        weekMeals.push({
          dayIndex: col,
          date: dateVal,
          breakfast: b || null,
          lunch: l || null,
          dinner: d || null,
        });
      }
    }
    if (weekMeals.length > 0) {
      weeks.push({ dates, meals: weekMeals });
    }
    row += 5; // skip to next week block (dates, B, L, D, notes)
  }

  // Resolve dateStr and dayOfWeek for each meal when we can infer month/year
  const parsed = parseMonthYear(sheetName, monthYear);
  if (parsed) {
    let { year, month } = parsed;
    for (const week of weeks) {
      let prevDateNum = null;
      for (const meal of week.meals) {
        const dateVal = meal.date;
        const d = dateVal != null && dateVal !== '' ? parseInt(dateVal, 10) : null;
        // Week spanning months: e.g. 30, 1, 2 -> 1 and 2 are next month
        if (prevDateNum != null && d != null && d < prevDateNum && d <= 7) {
          month += 1;
          if (month > 12) {
            month = 1;
            year += 1;
          }
        }
        const resolved = resolveDateAndDay(year, month, dateVal);
        if (resolved.dateStr) {
          meal.dateStr = resolved.dateStr;
          meal.dayOfWeek = resolved.dayOfWeek;
        }
        if (d != null) prevDateNum = d;
      }
    }
  }

  return { sheetName, monthYear, weeks };
}

function main() {
  const filePath = process.argv[2] || path.join(__dirname, '../meal-planner-resources/Meal Plan History Snapshot - 3-15-26.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const result = {
    _meta: {
      source: 'Meal Plan History Snapshot - 3-15-26.xlsx',
      extracted: new Date().toISOString().split('T')[0],
      description: 'Extracted from spreadsheet: Regular Meal Ideas, Current Goals, calendar tabs',
      note: 'Calendar meals include dateStr (ISO) and dayOfWeek when inferable from tab name/monthYear; omitted when unknown',
    },
    regularMealIdeas: null,
    currentGoals: null,
    calendarPlans: [],
    recipeCandidates: [],
  };

  for (const sheetName of workbook.SheetNames) {
    if (isTemplateOrBlank(sheetName)) continue;
    if (sheetName.includes('dont copy')) continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (sheetName === 'Regular Meal Ideas') {
      result.regularMealIdeas = parseRegularMealIdeas(data);
      // Flatten for recipe candidates (unique meal names)
      const all = [
        ...(result.regularMealIdeas.breakfast || []),
        ...(result.regularMealIdeas.lunch || []),
        ...(result.regularMealIdeas.dinnerMains || []),
        ...(result.regularMealIdeas.dinnerSides || []),
      ];
      result.recipeCandidates = [...new Set(all)].filter(Boolean).sort();
    } else if (sheetName === 'Current Goals') {
      result.currentGoals = parseCurrentGoals(data);
    } else {
      // Calendar tab
      const parsed = parseCalendarSheet(sheetName, data);
      if (parsed.weeks.length > 0) {
        result.calendarPlans.push(parsed);
      }
    }
  }

  const outPath = path.join(__dirname, '../docs/training-data/spreadsheet-meal-plans.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('Wrote', outPath);
  console.log('Summary:');
  console.log('- Regular Meal Ideas:', result.recipeCandidates?.length || 0, 'unique items');
  console.log('- Current Goals:', result.currentGoals?.length || 0);
  console.log('- Calendar plans:', result.calendarPlans?.length || 0, 'tabs');
}

main();
