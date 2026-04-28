/**
 * Borealis Design — Quote Form Handler (Google Apps Script)
 * ─────────────────────────────────────────────────────────────────────────
 * Receives POST submissions from the contact form on borealisdesign.org
 * and emails them to RECIPIENT_EMAIL. Optionally logs each submission to
 * a Google Sheet so there's a permanent record outside Gmail.
 *
 * SETUP STEPS
 * ───────────
 *  1. Go to https://script.google.com → "New project"
 *  2. Replace the default code with the contents of THIS file, save
 *     (give the project a name like "Borealis Quote Form")
 *  3. Click "Deploy" → "New deployment"
 *       Type:           Web app
 *       Execute as:     Me (your-google-account)
 *       Who has access: Anyone
 *  4. Click "Deploy" — Google will ask you to authorize the script.
 *     Allow access to MailApp (and SpreadsheetApp if you set SHEET_ID).
 *  5. Copy the resulting "Web app URL" (ends in /exec)
 *  6. Paste that URL into APPS_SCRIPT_URL inside index.html (top of <script>)
 *
 * RE-DEPLOYING AFTER CHANGES
 * ──────────────────────────
 *  After editing this script, click "Deploy" → "Manage deployments" →
 *  pencil icon → Version: "New version" → "Deploy". The URL stays the
 *  same; the script behavior updates.
 *
 * OPTIONAL: SHEET LOGGING
 * ───────────────────────
 *  Create a Google Sheet, copy the ID from its URL (the long token between
 *  /d/ and /edit), and paste it into SHEET_ID below. Each submission
 *  will append a row with timestamp + every field.
 */

const RECIPIENT_EMAIL = 'openclaudeconsulting@gmail.com';

// Optional — leave empty string to disable sheet logging.
const SHEET_ID = '';

// Human-readable labels for the email body and sheet headers.
const FIELD_LABELS = {
  name:                 'Name',
  email:                'Email',
  phone:                'Phone',
  company:              'Company',
  business_status:      'Business status',
  business_description: 'Business description',
  existing_website:     'Existing website',
  services:             'Services needed',
  brand_assets:         'Brand assets',
  timeline:             'Target completion',
  budget:               'Budget',
  hard_deadline:        'Hard deadline',
  vision:               'Vision',
  additional_notes:     'Additional notes',
};

function doPost(e) {
  try {
    const params  = e.parameter   || {};
    const arrays  = e.parameters  || {};

    // Resolve each known field, joining multi-value (checkbox) fields with commas.
    const resolve = (key) => {
      const arr = arrays[key];
      if (arr && arr.length > 1) return arr.join(', ');
      return params[key] || '';
    };

    // Build a readable email body.
    const sep = '─'.repeat(60);
    let body = 'New quote inquiry from borealisdesign.org\n\n' + sep + '\n\n';

    Object.keys(FIELD_LABELS).forEach((key) => {
      const value = resolve(key);
      if (!value) return;
      body += FIELD_LABELS[key] + '\n' + value + '\n\n';
    });

    body += sep + '\n';
    body += 'Submitted: ' + new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });

    const subject =
      params._subject ||
      ('New quote inquiry — ' + (params.name || 'Unknown') +
        (params.company ? ' / ' + params.company : ''));

    MailApp.sendEmail({
      to:      RECIPIENT_EMAIL,
      subject: subject,
      body:    body,
      replyTo: params.email || undefined,
    });

    // Optional: log to Sheet
    if (SHEET_ID) {
      try {
        const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
        const headerKeys = Object.keys(FIELD_LABELS);

        // Write header row if the sheet is empty.
        if (sheet.getLastRow() === 0) {
          const headerRow = ['Timestamp'].concat(
            headerKeys.map((k) => FIELD_LABELS[k])
          );
          sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
        }

        const row = [new Date()].concat(headerKeys.map(resolve));
        sheet.appendRow(row);
      } catch (sheetErr) {
        // Logging failure shouldn't fail the whole submission.
        console.error('Sheet logging failed:', sheetErr);
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helps verify the deployment URL in a browser.
function doGet() {
  return ContentService
    .createTextOutput('Borealis Design quote form handler — POST only.')
    .setMimeType(ContentService.MimeType.TEXT);
}
