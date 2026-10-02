/**
 * SkillTrack-365 — Sales queue Apps Script
 *
 * Paste this into the Apps Script project bound to your Sales queue Google Sheet
 * (Extensions → Apps Script), then Deploy → Manage deployments → Edit →
 * New version → Deploy. Keep the same deployment so the existing /exec URL
 * stays valid for the public "Book a free call" form.
 *
 * Row 1 must be a header row with these columns (any order):
 * timestamp | name | email | phone | certs | timing | utm_source | utm_medium |
 * utm_campaign | hear_about | notes | Status
 *
 * Optional: set a shared secret so only the app can read/update.
 *   File → Project Settings → Script Properties → add SALES_SHEET_TOKEN.
 *   Add the same value in Lovable under Project Settings → Secrets.
 */

var SHEET_NAME = 'Leads'; // change if your tab is named differently

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function checkToken_(e) {
  var expected = PropertiesService.getScriptProperties().getProperty('SALES_SHEET_TOKEN');
  if (!expected) return true; // no token configured = open
  return (e.parameter.token || '') === expected;
}

/** Read rows, or update a Status cell. */
function doGet(e) {
  try {
    if (!checkToken_(e)) return json_({ ok: false, error: 'Unauthorized' });
    var action = e.parameter.action || 'read';
    var sh = sheet_();
    var values = sh.getDataRange().getValues();
    if (values.length < 1) return json_({ ok: true, rows: [] });
    var headers = values[0].map(function (h) { return String(h).trim(); });

    if (action === 'updateStatus') {
      var rowIndex = parseInt(e.parameter.row, 10);
      if (!rowIndex || rowIndex < 2) return json_({ ok: false, error: 'Invalid row' });
      var statusCol = headers.indexOf('Status');
      if (statusCol === -1) return json_({ ok: false, error: 'No Status column' });
      sh.getRange(rowIndex, statusCol + 1).setValue(e.parameter.status || 'New');
      if (e.parameter.notes) {
        var notesCol = headers.indexOf('notes');
        if (notesCol !== -1) sh.getRange(rowIndex, notesCol + 1).setValue(e.parameter.notes);
      }
      return json_({ ok: true });
    }

    var rows = [];
    for (var r = 1; r < values.length; r++) {
      var obj = { row: r + 1 };
      var empty = true;
      for (var c = 0; c < headers.length; c++) {
        var v = values[r][c];
        if (v instanceof Date) v = v.toISOString();
        obj[headers[c]] = v === null || v === undefined ? '' : String(v);
        if (obj[headers[c]] !== '') empty = false;
      }
      if (!empty) rows.push(obj);
    }
    return json_({ ok: true, rows: rows });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** Existing lead intake from the public "Book a free call" form. */
function doPost(e) {
  try {
    var sh = sheet_();
    var headers = sh.getDataRange().getValues()[0].map(function (h) { return String(h).trim(); });
    var p = e.parameter || {};
    if (!p.timestamp) p.timestamp = new Date().toISOString();
    if (!p.Status) p.Status = 'New';
    var row = headers.map(function (h) { return p[h] !== undefined ? p[h] : ''; });
    sh.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
