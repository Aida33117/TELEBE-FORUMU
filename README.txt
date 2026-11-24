TTİF 2026 — veb-sayt (v3)

QOVLUQ
  index.html              — saytın özü (bütün bölmələr, menyu, qeydiyyat)
  assets/data.js          — XƏBƏRLƏR və QALEREYA (yeniləmək üçün yalnız bu faylı redaktə edin)
  assets/img/             — şəkillər, loqo, video
  google-apps-script/Code.gs — qeydiyyat formasının server hissəsi

HOSTİNQƏ YÜKLƏMƏ
  index.html və assets qovluğunu serverin kök qovluğuna yükləyin. Server tələb olunmur (statik sayt).

QEYDİYYAT (Google Apps Script)
  Forma məlumatları JSON şəklində bu ünvana göndərir (index.html, ENDPOINT sətri):
  https://script.google.com/macros/s/AKfycbw6pvLuOtXqHZ4BU5jkWxI4s2Mueqo_AyQ_8BiNgJQcH0m6mrB4enxWtoaK2QKynqBg/exec
  1. script.google.com-da həmin layihəni açın.
  2. Code.gs-dəki funksiyaları əlavə edin (mövcud doGet-ə toxunmayın; köhnə doPost varsa silin).
  3. qurasdir() funksiyasını bir dəfə işə salın, icazələri təsdiqləyin.
  4. Yerləşdir → Yerləşdirmələri idarə et → Redaktə → "Yeni versiya" → Giriş: Hər kəs. (/exec ünvanı dəyişmir)
  Nəticə: müraciətlər Google Sheets cədvəlinə düşür, fayllar Drive qovluğuna yazılır,
  iştirakçıya təsdiq məktubu, koordinatora bildiriş gedir. Cədvəldə Status-u
  "Qəbul edildi / Düzəliş tələb olunur / Rədd edildi" edəndə iştirakçıya avtomatik məktub gedir.

XƏBƏR ƏLAVƏ ETMƏK
  assets/data.js faylında TTIF_NEWS siyahısının əvvəlinə yeni blok yazın. Şəkli assets/img-ə qoyun.
