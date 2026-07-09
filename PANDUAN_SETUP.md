# Panduan Setup SiPADU KPKNL Denpasar

Login demo (data contoh, ada di `demo.html`):
- NIP `196902241989`, Password `12345` (I Ketut Arim — Kepala KPKNL)
- NIP `197403191996`, Password `12345` (Wasis Winar — Pelelang Ahli)
- NIP `197511151999`, Password `12345` (Novan Prihe — Kepala Seksi)

## 1. Coba dulu (opsional)
Buka `demo.html` langsung di browser. Semua data disimulasikan di memori
(bukan Google Sheets sungguhan) — cukup untuk melihat alur Dashboard,
Antrian, Statistik, dan Pegawai sebelum deploy ke produksi.

## 2. Siapkan Google Sheet
Buat Spreadsheet baru dengan 2 sheet, header di baris 1:

**Sheet `layanan`** (kolom A–O):
```
id | nama | no_hp | email | jumlah_pengunjung | jenis_layanan | uraian_layanan |
tgl_submit_layanan | nama_petugas | status_pegawai | tindakan | tgl_selesai |
rating | ulasan | waktu_login
```

**Sheet `pegawai`** (kolom A–G):
```
Nama | NIP | Jabatan | Pangkat | Password | Status | Keaktifan
```
Isi baris pegawai awal (Keaktifan = 1 berarti aktif).

## 3. Buat proyek Apps Script
1. Di Spreadsheet: **Ekstensi > Apps Script**.
2. Hapus isi `Code.gs` bawaan, tempel file `Code.gs` dari paket ini.
3. Buat file baru bertipe **Script** *tidak diperlukan* lainnya — cukup buat
   file **HTML** baru untuk masing-masing: `index`, `Stylesheet`,
   `JavaScript`, `Dashboard`, `Antrian`, `Statistik`, `Pegawai` — tempel isi
   file yang namanya sama dari paket ini (nama file di Apps Script harus
   persis sama, tanpa ekstensi `.html`).

## 4. Deploy sebagai Web App
1. **Deploy > Kelola Deployment > Deployment baru**.
2. Jenis: **Web app**.
3. Execute as: **Me**. Who has access: **Anyone** (atau sesuai kebutuhan
   instansi, mis. hanya domain organisasi).
4. Klik **Deploy**, salin URL yang diberikan — itulah alamat SiPADU Anda.

Karena Spreadsheet dan Script dibuat dari **Ekstensi > Apps Script** (bound
script), `SpreadsheetApp.getActiveSpreadsheet()` di `Code.gs` otomatis
mengarah ke Sheet ini — **tidak perlu** menjalankan `setSpreadsheetId()`.
Fungsi itu hanya diperlukan jika Anda memisahkan proyek script dari sheet.

## 5. Halaman yang tersedia
| Halaman | Akses | Fungsi |
|---|---|---|
| Ambil Antrian | Publik (tanpa login) | Pemohon mengisi data & jenis layanan, mendapat nomor antrian otomatis |
| Login Petugas | Petugas | Masuk pakai NIP + Password dari sheet `pegawai` |
| Dashboard | Petugas | Ringkasan antrian hari ini + papan "Sedang Dilayani" |
| Antrian | Petugas | Filter tanggal/status, panggil, selesaikan, atau batalkan antrian |
| Statistik | Petugas | Grafik antrian per hari & per jenis layanan, rata-rata rating & durasi (Chart.js) |
| Pegawai | Petugas | Lihat daftar pegawai, tambah pegawai baru, aktif/nonaktifkan akun |

## Catatan pengembangan lanjutan
- Nomor antrian dibuat otomatis dengan format `{urutan-hari-ini}{yyyyMMdd}`,
  sesuai contoh data Anda (`120260607`, `220260607`).
- Kolom `status_pegawai` dipakai sebagai status tiket: `Menunggu` →
  `Diproses` → `Selesai` / `Dibatalkan`. Ganti label ini di `Code.gs` jika
  maksud kolom tersebut berbeda dari asumsi ini.
- Password disimpan polos di sheet untuk kesederhanaan; untuk produksi,
  pertimbangkan hashing atau autentikasi lewat Google Workspace SSO.
- Tambahkan pengiriman notifikasi WhatsApp/Email panggilan antrian dengan
  `UrlFetchApp` atau `MailApp` di `Code.gs` bila diperlukan.
