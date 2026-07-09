/**
 * SiPADU — Sistem Pelayanan Terpadu KPKNL Denpasar
 * Backend Google Apps Script
 *
 * Arsitektur: Browser (SPA) ⇄ Apps Script (API) ⇄ Google Sheets (Database)
 *
 * SETUP:
 * 1. Buka Google Sheet yang punya 2 sheet: "layanan" dan "pegawai"
 *    dengan kolom persis seperti di bawah (baris 1 = header).
 * 2. Ekstensi > Apps Script, lalu tempel semua file proyek ini.
 * 3. Jalankan setSpreadsheetId() SEKALI (isi ID spreadsheet Anda dahulu).
 * 4. Deploy > Kelola Deployment > Web app. Execute as: Me. Access: Anyone.
 *
 * STRUKTUR SHEET "layanan" (kolom A–O):
 *  A id | B nama | C no_hp | D email | E jumlah_pengunjung | F jenis_layanan
 *  G uraian_layanan | H tgl_submit_layanan | I nama_petugas | J status_pegawai
 *  K tindakan | L tgl_selesai | M rating | N ulasan | O waktu_login
 *
 * STRUKTUR SHEET "pegawai" (kolom A–G):
 *  A Nama | B NIP | C Jabatan | D Pangkat | E Password | F Status | G Keaktifan
 */

const SHEET_LAYANAN = 'layanan';
const SHEET_PEGAWAI = 'pegawai';

const LAYANAN_COLS = [
  'id', 'nama', 'no_hp', 'email', 'jumlah_pengunjung', 'jenis_layanan',
  'uraian_layanan', 'tgl_submit_layanan', 'nama_petugas', 'status_pegawai',
  'tindakan', 'tgl_selesai', 'rating', 'ulasan', 'waktu_login'
];

const PEGAWAI_COLS = [
  'Nama', 'NIP', 'Jabatan', 'Pangkat', 'Password', 'Status', 'Keaktifan'
];

const STATUS_MENUNGGU = 'Menunggu';
const STATUS_DIPROSES = 'Diproses';
const STATUS_SELESAI = 'Selesai';
const STATUS_DIBATALKAN = 'Dibatalkan';

const JENIS_LAYANAN_LIST = [
  'Kutipan Risalah Lelang',
  'Kuitansi Lelang',
  'Pendaftaran Lelang',
  'Penilaian Aset',
  'Piutang Negara',
  'Informasi Kekayaan Negara',
  'Pengaduan / Lainnya'
];

/** Simpan sekali lewat editor Apps Script (jalankan manual) jika Sheet
 *  tidak terikat langsung (container-bound). Jika script ini dibuat lewat
 *  Ekstensi > Apps Script dari dalam Sheet, baris ini tidak diperlukan. */
function setSpreadsheetId() {
  const SPREADSHEET_ID = 'TEMPEL_ID_SPREADSHEET_DI_SINI';
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', SPREADSHEET_ID);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" tidak ditemukan.');
  return sheet;
}

/** ============ ROUTING SPA ============ */

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
    .setTitle('SiPADU · KPKNL Denpasar')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** ============ UTIL ============ */

function sheetToObjects_(sheet, cols) {
  const range = sheet.getDataRange().getValues();
  const rows = range.slice(1);
  return rows
    .filter(r => r.some(c => c !== '' && c !== null))
    .map((r, idx) => {
      const obj = { _row: idx + 2 };
      cols.forEach((c, i) => obj[c] = r[i]);
      return obj;
    });
}

function todayStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function nowStamp_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function generateId_(sheet) {
  const data = sheet.getDataRange().getValues();
  const todayCompact = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  let countToday = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][0] || '');
    if (id.endsWith(todayCompact)) countToday++;
  }
  return (countToday + 1) + todayCompact; // contoh: 120260607
}

/** ============ AUTH PEGAWAI ============ */

function loginPegawai(nip, password) {
  const sheet = getSheet_(SHEET_PEGAWAI);
  const pegawai = sheetToObjects_(sheet, PEGAWAI_COLS);
  const found = pegawai.find(p => String(p.NIP) === String(nip));

  if (!found) return { ok: false, message: 'NIP tidak ditemukan.' };
  if (String(found.Keaktifan) !== '1') return { ok: false, message: 'Akun tidak aktif. Hubungi admin.' };
  if (String(found.Password) !== String(password)) return { ok: false, message: 'Password salah.' };

  return {
    ok: true,
    petugas: {
      nama: found.Nama, nip: found.NIP, jabatan: found.Jabatan,
      pangkat: found.Pangkat, status: found.Status
    }
  };
}

/** ============ HALAMAN: AMBIL ANTRIAN (PUBLIK) ============ */

function getJenisLayananList() {
  return JENIS_LAYANAN_LIST;
}

function submitAntrian(form) {
  const sheet = getSheet_(SHEET_LAYANAN);
  const id = generateId_(sheet);
  const row = [
    id,
    form.nama || '',
    form.no_hp || '',
    form.email || '',
    Number(form.jumlah_pengunjung) || 1,
    form.jenis_layanan || '',
    form.uraian_layanan || '',
    nowStamp_(),      // tgl_submit_layanan
    '',               // nama_petugas
    STATUS_MENUNGGU,  // status_pegawai
    '',               // tindakan
    '',               // tgl_selesai
    '',               // rating
    '',               // ulasan
    nowStamp_()       // waktu_login
  ];
  sheet.appendRow(row);
  return { ok: true, id: id };
}

/** ============ HALAMAN: DASHBOARD ============ */

function getDashboardData() {
  const sheet = getSheet_(SHEET_LAYANAN);
  const data = sheetToObjects_(sheet, LAYANAN_COLS);
  const today = todayStr_();

  const isToday = r => String(r.tgl_submit_layanan).slice(0, 10) === today;
  const todayRows = data.filter(isToday);

  const menunggu = todayRows.filter(r => r.status_pegawai === STATUS_MENUNGGU);
  const diproses = todayRows.filter(r => r.status_pegawai === STATUS_DIPROSES);
  const selesai = todayRows.filter(r => r.status_pegawai === STATUS_SELESAI);

  // nomor terakhir yang sedang dilayani (Diproses), diambil dari yang terbaru
  const sedangDilayani = diproses.length
    ? diproses[diproses.length - 1]
    : null;

  return {
    total: todayRows.length,
    menunggu: menunggu.length,
    diproses: diproses.length,
    selesai: selesai.length,
    sedangDilayani: sedangDilayani ? { id: sedangDilayani.id, nama: sedangDilayani.nama, petugas: sedangDilayani.nama_petugas } : null,
    antrianBerikutnya: menunggu.slice(0, 5).map(r => ({ id: r.id, nama: r.nama, jenis_layanan: r.jenis_layanan }))
  };
}

/** ============ HALAMAN: ANTRIAN ============ */

function getAntrianList(filter) {
  const sheet = getSheet_(SHEET_LAYANAN);
  let data = sheetToObjects_(sheet, LAYANAN_COLS);

  if (filter && filter.tanggal) {
    data = data.filter(r => String(r.tgl_submit_layanan).slice(0, 10) === filter.tanggal);
  }
  if (filter && filter.status && filter.status !== 'Semua') {
    data = data.filter(r => r.status_pegawai === filter.status);
  }
  // terbaru dulu
  return data.reverse();
}

function panggilAntrian(id, namaPetugas) {
  return updateStatusAntrian(id, STATUS_DIPROSES, namaPetugas, '');
}

function selesaikanAntrian(id, namaPetugas, tindakan) {
  return updateStatusAntrian(id, STATUS_SELESAI, namaPetugas, tindakan);
}

function batalkanAntrian(id, namaPetugas, tindakan) {
  return updateStatusAntrian(id, STATUS_DIBATALKAN, namaPetugas, tindakan);
}

function updateStatusAntrian(id, status, namaPetugas, tindakan) {
  const sheet = getSheet_(SHEET_LAYANAN);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 9).setValue(namaPetugas || data[i][8]);   // I nama_petugas
      sheet.getRange(rowNum, 10).setValue(status);                     // J status_pegawai
      if (tindakan) sheet.getRange(rowNum, 11).setValue(tindakan);      // K tindakan
      if (status === STATUS_SELESAI || status === STATUS_DIBATALKAN) {
        sheet.getRange(rowNum, 12).setValue(nowStamp_());               // L tgl_selesai
      }
      return { ok: true };
    }
  }
  return { ok: false, message: 'Nomor antrian tidak ditemukan.' };
}

function submitRating(id, rating, ulasan) {
  const sheet = getSheet_(SHEET_LAYANAN);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 13).setValue(rating); // M rating
      sheet.getRange(rowNum, 14).setValue(ulasan); // N ulasan
      return { ok: true };
    }
  }
  return { ok: false, message: 'Nomor antrian tidak ditemukan.' };
}

/** ============ HALAMAN: STATISTIK ============ */

function getStatistikData(range) {
  const sheet = getSheet_(SHEET_LAYANAN);
  const data = sheetToObjects_(sheet, LAYANAN_COLS);

  const days = (range && range.days) ? range.days : 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const filtered = data.filter(r => {
    const d = new Date(String(r.tgl_submit_layanan).replace(' ', 'T'));
    return !isNaN(d) && d >= cutoff;
  });

  // per jenis layanan
  const perJenis = {};
  filtered.forEach(r => {
    const key = r.jenis_layanan || 'Lainnya';
    perJenis[key] = (perJenis[key] || 0) + 1;
  });

  // per hari
  const perHari = {};
  filtered.forEach(r => {
    const key = String(r.tgl_submit_layanan).slice(0, 10);
    perHari[key] = (perHari[key] || 0) + 1;
  });

  // rata-rata rating
  const rated = filtered.filter(r => r.rating !== '' && r.rating !== null && !isNaN(Number(r.rating)));
  const avgRating = rated.length
    ? (rated.reduce((s, r) => s + Number(r.rating), 0) / rated.length)
    : null;

  // rata-rata durasi layanan (menit) dari submit ke selesai
  const durations = filtered
    .filter(r => r.tgl_selesai)
    .map(r => {
      const start = new Date(String(r.tgl_submit_layanan).replace(' ', 'T'));
      const end = new Date(String(r.tgl_selesai).replace(' ', 'T'));
      return (end - start) / 60000;
    })
    .filter(m => !isNaN(m) && m >= 0);
  const avgDurasi = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;

  return {
    totalLayanan: filtered.length,
    perJenis: perJenis,
    perHari: perHari,
    avgRating: avgRating,
    avgDurasiMenit: avgDurasi,
    selesai: filtered.filter(r => r.status_pegawai === STATUS_SELESAI).length,
    dibatalkan: filtered.filter(r => r.status_pegawai === STATUS_DIBATALKAN).length
  };
}

/** ============ HALAMAN: PEGAWAI (ADMIN) ============ */

function getPegawaiList() {
  const sheet = getSheet_(SHEET_PEGAWAI);
  return sheetToObjects_(sheet, PEGAWAI_COLS).map(p => ({
    nama: p.Nama, nip: p.NIP, jabatan: p.Jabatan, pangkat: p.Pangkat,
    status: p.Status, keaktifan: p.Keaktifan, row: p._row
  }));
}

function tambahPegawai(form) {
  const sheet = getSheet_(SHEET_PEGAWAI);
  sheet.appendRow([
    form.nama, form.nip, form.jabatan, form.pangkat,
    form.password || '12345', form.status || 'PNS', 1
  ]);
  return { ok: true };
}

function setKeaktifanPegawai(nip, keaktifan) {
  const sheet = getSheet_(SHEET_PEGAWAI);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(nip)) {
      sheet.getRange(i + 1, 7).setValue(keaktifan ? 1 : 0);
      return { ok: true };
    }
  }
  return { ok: false, message: 'NIP tidak ditemukan.' };
}
