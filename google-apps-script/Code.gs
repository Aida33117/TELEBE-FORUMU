/**
 * TTİF 2026 — Qeydiyyat qəbulu (Google Apps Script)
 * ------------------------------------------------------------
 * Bu kod saytdakı qeydiyyat formasından gələn müraciətləri:
 *   1) Google Sheets cədvəlinə yazır (müraciətlərin idarə edilməsi);
 *   2) yüklənən tezis və təqdimat fayllarını Google Drive qovluğuna saxlayır;
 *   3) iştirakçıya müraciət nömrəsi ilə təsdiq məktubu göndərir;
 *   4) koordinatora yeni müraciət barədə bildiriş göndərir;
 *   5) cədvəldə "Status" dəyişəndə iştirakçıya avtomatik məktub göndərir.
 *
 * QURAŞDIRMA
 *   • Mövcud skript layihənizdə doGet artıq varsa, ona toxunmayın.
 *     Bu fayldakı funksiyaları (doPost və digərləri) layihəyə əlavə edin.
 *     Layihədə başqa doPost varsa, əvvəlcə onu silin və ya adını dəyişin.
 *   • CONFIG bölməsində ADMIN_EMAIL-i yoxlayın.
 *   • "Yerləşdir" → "Yerləşdirmələri idarə et" → mövcud yerləşdirməni redaktə edin →
 *     "Yeni versiya" seçin. Giriş: "Hər kəs" (Anyone). Beləliklə /exec ünvanı dəyişmir.
 *   • Bir dəfə qurasdir() funksiyasını əl ilə işə salın və icazələri təsdiqləyin.
 */

const CONFIG = {
  SHEET_ID: '',                         // Boş qalarsa, cədvəl avtomatik yaradılır
  SHEET_NAME: 'Müraciətlər',
  FOLDER_NAME: 'TTİF 2026 — Müraciət faylları',
  ADMIN_EMAIL: 'aida.mustafayeva@mdu.edu.az',
  FORUM: 'I Tələbə Tədqiqatları və İnnovasiyalar Forumu',
  DATE: '27 noyabr 2026, saat 15:00',
  PLACE: 'Mingəçevir Dövlət Universiteti, D. Əliyeva küçəsi 21',
  MAX_FILE_MB: 10
};

const HEADERS = ['Tarix', 'Müraciət №', 'Status', 'Növ', 'Ad soyad', 'E-poçt', 'Telefon',
  'Universitet', 'Fakültə / ixtisas', 'Kurs', 'Mentor', 'Komanda',
  'Komanda üzvləri', 'İştirak formatı', 'Elmi istiqamət', 'Başlıq', 'Annotasiya',
  'Əlavə qeyd', 'Tezis faylı', 'Təqdimat faylı', 'Admin qeydi'];
const STATUSES = ['Yeni', 'Baxılır', 'Qəbul edildi', 'Düzəliş tələb olunur', 'Rədd edildi'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const d = JSON.parse(e.postData.contents);
    if (!d.ad || !d.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) {
      return json_({ ok: false, error: 'Ad və düzgün e-poçt tələb olunur' });
    }
    const sh = sheet_();
    const id = 'TTIF-' + String(sh.getLastRow()).padStart(4, '0');

    const links = { 'Tezis': '', 'Təqdimat': '' };
    if (Array.isArray(d.fayllar) && d.fayllar.length) {
      const folder = folder_().createFolder(id + ' — ' + clean_(d.ad));
      d.fayllar.forEach(function (f) {
        const bytes = Utilities.base64Decode(f.data);
        if (bytes.length > CONFIG.MAX_FILE_MB * 1024 * 1024) throw new Error('Fayl çox böyükdür');
        const file = folder.createFile(Utilities.newBlob(bytes, f.mime, clean_(f.ad)));
        links[f.tip] = file.getUrl();
      });
    }

    const members = (d.uzvler || []).map(function (m) {
      return [m.ad, m.universitet, m.email].filter(String).join(' · ');
    }).join('\n');

    sh.appendRow([new Date(), id, 'Yeni', d.tip, d.ad, d.email, d.telefon, d.universitet,
      d.fakulte, d.pille, d.rehber, d.komanda, members, (d.format || []).join(', '),
      d.istiqamet, d.basliq, d.annotasiya, d.qeyd, links['Tezis'], links['Təqdimat'], '']);

    confirmMail_(d, id);
    MailApp.sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      subject: 'TTİF 2026: yeni müraciət ' + id + ' — ' + d.ad,
      htmlBody: '<p><b>' + esc_(d.ad) + '</b> (' + esc_(d.universitet) + ') qeydiyyatdan keçdi.</p>' +
        '<p>Növ: ' + esc_(d.tip) + '<br>Format: ' + esc_((d.format || []).join(', ')) +
        '<br>İstiqamət: ' + esc_(d.istiqamet) + '</p><p><a href="' + sh.getParent().getUrl() + '">Cədvəli aç</a></p>'
    });
    return json_({ ok: true, id: id });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Bir dəfə əl ilə işə salın: cədvəli, qovluğu və status triggerini hazırlayır. */
function qurasdir() {
  const sh = sheet_();
  folder_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'statusDeyisdi') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('statusDeyisdi').forSpreadsheet(sh.getParent()).onEdit().create();
  Logger.log('Hazırdır. Cədvəl: ' + sh.getParent().getUrl());
}

/** Cədvəldə Status sütunu dəyişəndə iştirakçıya məktub göndərir. */
function statusDeyisdi(e) {
  const r = e.range, sh = r.getSheet();
  if (sh.getName() !== CONFIG.SHEET_NAME || r.getColumn() !== 3 || r.getRow() < 2) return;
  const st = String(e.value || '');
  if (['Qəbul edildi', 'Düzəliş tələb olunur', 'Rədd edildi'].indexOf(st) < 0) return;
  const row = sh.getRange(r.getRow(), 1, 1, HEADERS.length).getValues()[0];
  const id = row[1], ad = row[4], email = row[5], note = row[20];
  const txt = {
    'Qəbul edildi': 'Təbrik edirik! Müraciətiniz qəbul edildi. Sizi ' + CONFIG.DATE + ' tarixində ' + CONFIG.PLACE + ' ünvanında gözləyirik.',
    'Düzəliş tələb olunur': 'Müraciətinizə baxıldı və bəzi düzəlişlər tələb olunur. Zəhmət olmasa, aşağıdakı qeydə əsasən koordinatorla əlaqə saxlayın.',
    'Rədd edildi': 'Təəssüf ki, bu dəfə müraciətiniz seçilmədi. Forumda dinləyici kimi iştirak etməyə dəvət edirik.'
  }[st];
  MailApp.sendEmail({
    to: email,
    subject: 'TTİF 2026: müraciət ' + id + ' — ' + st,
    htmlBody: wrap_('Hörmətli ' + esc_(ad) + ',', '<p>' + txt + '</p>' + (note ? '<p><b>Qeyd:</b> ' + esc_(note) + '</p>' : ''), id)
  });
}

/* ---------- köməkçi funksiyalar ---------- */
function confirmMail_(d, id) {
  const body = '<p>' + CONFIG.FORUM + ' üçün müraciətiniz uğurla qeydə alındı.</p>' +
    '<table style="border-collapse:collapse;font-size:14px">' +
    row_('Müraciət №', id) + row_('Növ', d.tip) + (d.komanda ? row_('Komanda', d.komanda) : '') +
    row_('Universitet', d.universitet) + row_('Format', (d.format || []).join(', ')) +
    row_('İstiqamət', d.istiqamet) + (d.basliq ? row_('Başlıq', d.basliq) : '') +
    row_('Tarix və məkan', CONFIG.DATE + ' · ' + CONFIG.PLACE) + '</table>' +
    '<p>Müraciətinizə baxıldıqdan sonra nəticə barədə əlavə məktub alacaqsınız.</p>';
  MailApp.sendEmail({ to: d.email, subject: 'TTİF 2026: müraciətiniz qəbul edildi (' + id + ')', htmlBody: wrap_('Hörmətli ' + esc_(d.ad) + ',', body, id), replyTo: CONFIG.ADMIN_EMAIL });
}
function wrap_(hi, body, id) {
  return '<div style="font-family:Arial,sans-serif;max-width:600px;color:#0d2150">' +
    '<div style="background:linear-gradient(110deg,#0b2b7a,#1f5fd8);color:#fff;padding:20px 24px;border-radius:14px 14px 0 0">' +
    '<b style="font-size:18px">TTİF 2026</b><br><span style="font-size:13px">' + CONFIG.FORUM + '</span></div>' +
    '<div style="border:1px solid #d7e3f5;border-top:0;padding:22px 24px;border-radius:0 0 14px 14px">' +
    '<p>' + hi + '</p>' + body + '<p style="color:#4d5f80;font-size:13px">Suallar üçün: ' + CONFIG.ADMIN_EMAIL + ' · +994 50 730 79 08</p></div></div>';
}
function row_(k, v) { return '<tr><td style="padding:4px 12px 4px 0;color:#4d5f80">' + k + '</td><td style="padding:4px 0"><b>' + esc_(v) + '</b></td></tr>'; }
function sheet_() {
  const p = PropertiesService.getScriptProperties();
  let ss;
  const id = CONFIG.SHEET_ID || p.getProperty('SHEET_ID');
  if (id) ss = SpreadsheetApp.openById(id);
  else { ss = SpreadsheetApp.create('TTİF 2026 — Müraciətlər'); p.setProperty('SHEET_ID', ss.getId()); }
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0b2b7a').setFontColor('#ffffff');
    sh.getRange('C2:C').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build());
    const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Vərəq1');
    if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  }
  return sh;
}
function folder_() {
  const it = DriveApp.getFoldersByName(CONFIG.FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.FOLDER_NAME);
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
function clean_(s) { return String(s || 'fayl').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120); }
