const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.join(__dirname, '..');
const source = readFileSync(path.join(root, 'supabase/functions/buytest-analyze/index.ts'), 'utf8');
const html = readFileSync(path.join(root, 'index.html'), 'utf8');
const runtime = source.slice(source.indexOf('const ALLOWED_ORIGIN'), source.indexOf('async function serviceRequest'));
const interpret = vm.runInNewContext(runtime + '\ninterpretSummaryText;', {
  Deno: { env: { get() { return ''; } } },
  Headers, console
});

// Transcribed source text, not the user's actual OCR output.
const cases = [
  {
    "name": "transcribed report",
    "input": "טופס סיכום אחיד של בדיקה כללית ללא מערכות אלקטרוניות ממוחשבות\nמס רכב: 86187501 תוצר: ניסאן דגם: X trail שנת יצור: 2020 קמ: 80940\nמנוע ✓\nמערכת הקירור ✓\nמערכת דלק ✓\nמערכת הצתה ✓\nמערכת גידוש המנוע ✓\nמערכת הנעה ✓\nמערכת הטעינה ✓\nמערכת הפליטה ומערכת למניעת זיהום אוויר ✓\nמערכת ההתנעה (כולל מצבר) × מצבר חלש\nמצמד ✓\nתיבת הילוכים ✓\nתיבת העברת הכוח ✓\nציריות/גל הינע ✓\nמערכת מתלה קדמי ✓\nמערכת מתלה אחורי ✓\nמערכת היגוי ✓\nמערכת הבלמים (ללא פירוק גלגלים) × רפידות בלם אחוריים שחוקות לפרק גלגלים ולבדוק בלמים\nצמיגים וחישוקים × צמיגים קדמיים שחוקים בחלקם הפנימי\nשלדת מרכב × משמעות נמוכה: בוצע תיקוני פח וצבע מסביב לרכב כולל פגושים עם מילוי חומר במרכב ושריטות קלות במרכב\nמערכת תאורה ✓\nהערות כלליות × אין אחריות על תיבת הילוכים אוטומטית, אין אחריות על מצבר ועוד",
    "type": "report"
  },
  {
    "name": "numbered normal emissions heading",
    "input": "מנוע ✓\n8 מערכת הפליטה ומערכת למניעת זיהום אוויר ✓\n9 מערכת ההתנעה (כולל מצבר) × מצבר חלש",
    "type": "battery"
  },
  {
    "name": "real engine noise",
    "input": "מנוע\nרעש חריג במנוע",
    "type": "engine"
  },
  {
    "name": "real emissions",
    "input": "מערכת הפליטה ומערכת למניעת זיהום אוויר\nco גבוה",
    "type": "emissions"
  },
  {
    "name": "inline real emissions",
    "input": "8 מערכת הפליטה ומערכת למניעת זיהום אוויר co גבוה",
    "type": "emissions"
  },
  {
    "name": "wrapped diagnosis",
    "input": "מנוע\nרעש חריג\nבמנוע",
    "type": "engine"
  },
  {
    "name": "normal heading only",
    "input": "מערכת הפליטה ומערכת למניעת זיהום אוויר ✓",
    "type": "empty"
  },
  {
    "name": "all system headings are labels only",
    "input": "1 מערכת דלק ✓\n2 מערכת הצתה ✓\n3 מערכת גידוש המנוע ✓\n4 מערכות הנעה ✓\n5 מערכת הטעינה ✓\n6 מערכת הפליטה ומערכות למניעת זיהום אוויר ✓\n7 מצמד ✓\n8 תיבת הילוכים ✓\n9 ציריות/גל הינע ✓\n10 מערכת מתלה קדמי ✓\n11 מערכת מתלה אחורי ✓\n12 מערכת הבלמים (ללא פירוק גלגלים) ✓\n13 צמיגים וחישוקים ✓\n14 מערכת תאורה ✓\n15 הערות כלליות ✓\n16 מנוע ✓\n17 מערכת הקירור ✓\n18 מערכת ההתנעה (כולל מצבר) ✓\n19 תיבת העברת הכוח ✓\n20 מערכת ההיגוי ✓\n21 שלדת מרכב ✓\n22 שלדה נפרדת ✓",
    "type": "empty"
  }
];
for (const fixture of cases) {
  test(fixture.name, () => {
    const result = interpret(fixture.input);
    const has = id => result.findings.some(item => item.id === id);
    if (fixture.type === 'empty') {
      assert.equal(result.findings.length, 0);
    } else if (fixture.type === 'emissions') {
      assert.ok(has('emissions'));
    } else if (fixture.type === 'engine') {
      assert.ok(result.findings.some(item => /מנוע/.test(item.category)));
    } else {
      assert.ok(!result.findings.some(item => /מנוע/.test(item.category)));
      assert.ok(has('expert-battery_condition'));
      if (fixture.type === 'report') assert.ok(has('expert-brake_pads_discs'));
    }
  });
}

function functionSource(text, name) {
  const start = text.indexOf('function ' + name + '(');
  const end = text.indexOf('\n}\n', start);
  assert.ok(start >= 0 && end >= 0);
  return text.slice(start, end + 3);
}
for (const name of ['normalizeReportSystemLabel', 'reportCategoryFromLine', 'stripReportScaffolding']) {
  test('frontend/backend parity: ' + name, () => {
    assert.equal(functionSource(html, name), functionSource(source, name));
  });
}
