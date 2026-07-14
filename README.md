# ATL Soft Skill Assessment

ATL Soft Skill Assessment adalah aplikasi penilaian soft skill berbasis ATL (Approaches to Learning) dengan backend Django dan frontend React/Vite. Sistem ini mendukung input penilaian detail maupun batch, manajemen siswa dan kelas, manajemen kriteria ATL, pembobotan Fuzzy-AHP, dashboard role-based, report siswa, export Excel, serta dokumentasi evidence untuk blackbox testing.

## Struktur Project

```text
atl/
├─ manage.py
├─ db.sqlite3
├─ atlBackend/
│  ├─ settings.py
│  ├─ urls.py
│  ├─ views.py
│  ├─ models.py
│  ├─ seed_data.py
│  ├─ services/
│  ├─ tests.py
│  └─ tests/
├─ atl-framework/
│  ├─ package.json
│  ├─ vite.config.js
│  ├─ playwright.config.js
│  ├─ src/
│  └─ tests/
├─ Blackbox Testing/
└─ Document Output/
   ├─ playwright-report/
   ├─ screenshots/
   ├─ terminal-output/
   ├─ defect-log.xlsx
   └─ rekap-blackbox-testing.xlsx
```

`Document Output/` dipakai untuk hasil export Excel dan evidence blackbox testing. File export tetap terdownload di browser user, dan salinannya juga diarsipkan di folder ini oleh backend.

## Requirements

Versi yang disarankan:

- Python 3.11 atau lebih baru
- Node.js 20 LTS atau lebih baru
- npm 10 atau lebih baru
- Browser Chromium untuk Playwright

Package backend minimal:

```powershell
pip install django openpyxl pytest pytest-django
```

Package frontend mengikuti `atl-framework/package.json`.

## Setup Backend Django

Jalankan dari root project `atl/`.

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install django openpyxl pytest pytest-django
python manage.py migrate
python manage.py seed_atl
python manage.py check
python manage.py runserver
```

Backend berjalan di:

```text
http://127.0.0.1:8000
```

Jika memakai PowerShell dan path project mengandung spasi atau tanda kurung, selalu bungkus path dengan tanda kutip atau aktifkan virtual environment dulu. Contoh:

```powershell
& "D:\path dengan spasi\ATLweb\atl\.venv\Scripts\python.exe" manage.py check
```

## Setup Frontend Vite

Jalankan dari folder `atl-framework/`.

```powershell
cd atl-framework
npm install
npm run dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

Pastikan backend Django aktif sebelum membuka frontend agar request `/api/...` tidak gagal.

## Akun Seed Valid

Jalankan `python manage.py seed_atl` untuk memastikan akun seed tersedia.

| Username | Password | Nama | Role |
| --- | --- | --- | --- |
| `admin` | `admin12345` | Afrizal Haykal | Admin |
| `rionaldus` | `rionaldus123` | Rionaldus S | ATL Expert |
| `akademik` | `akademik123` | Maria Ulfa Rahmawati | Akademik |
| `wali3a` | `wali12345` | Megawati Putri | Guru Wali Kelas |
| `ipa` | `ipa12345` | Joko Wiryanto | PJ Mapel - IPA |
| `math` | `math12345` | Andi Prasetyo | PJ Mapel - Math |

Semua user aktif tetap bisa mengakses halaman utama sistem. Perbedaan role terutama terlihat pada panel akses, dashboard, dan konteks data yang dianalisis.

## Menjalankan Aplikasi

Terminal 1, backend:

```powershell
cd atl
.\.venv\Scripts\activate
python manage.py runserver
```

Terminal 2, frontend:

```powershell
cd atl\atl-framework
npm run dev
```

Buka:

```text
http://localhost:5173
```

## Testing dan Build

Backend:

```powershell
python manage.py check
python manage.py test
```

Frontend:

```powershell
cd atl-framework
npm run lint
npm run build
```

Playwright blackbox:

```powershell
cd atl-framework
npm run test:e2e
```

Jika Playwright belum pernah menyiapkan browser:

```powershell
npx playwright install
```

Command untuk menyimpan output terminal Playwright:

```powershell
cmd /c npm run test:e2e > "..\Document Output\terminal-output\playwright-e2e-output.txt" 2>&1
```

Command untuk menyimpan output terminal Django test:

```powershell
cmd /c python manage.py test > "Document Output\terminal-output\django-test-output.txt" 2>&1
```

## Evidence Blackbox Testing

Evidence utama disimpan di `atl/Document Output/`, bukan di folder `Blackbox Testing/`.

```text
atl/Document Output/
├─ playwright-report/
├─ screenshots/
├─ terminal-output/
├─ defect-log.xlsx
└─ rekap-blackbox-testing.xlsx
```

Yang perlu dikumpulkan:

- Screenshot Playwright HTML report ke `Document Output/screenshots/`.
- Screenshot terminal `npm run test:e2e` ke `Document Output/screenshots/`.
- Screenshot terminal `python manage.py test` ke `Document Output/screenshots/`.
- Screenshot halaman saat test gagal dari Playwright atau manual bila perlu.
- Video/trace test gagal dari Playwright report.
- Rekap Pass/Fail di `Document Output/rekap-blackbox-testing.xlsx`.
- Defect log di `Document Output/defect-log.xlsx`.
- Output teks terminal di `Document Output/terminal-output/`.

Script helper evidence berada di:

```text
Blackbox Testing/05_Results/update_playwright_evidence.py
```

## Endpoint Sensitif

Endpoint berikut membutuhkan user aktif dan role evaluator/admin yang valid:

- `GET /api/reports/`
- `POST /api/reports/export/`
- `POST /api/assessments/preview/`

Jika belum login, endpoint tersebut akan mengembalikan `401` atau `403`. Ini menjaga data report, preview assessment, dan export dokumen tidak bisa diakses sebagai guest.

## Export Excel

Export report dilakukan melalui:

```text
POST /api/reports/export/
```

Saat export sukses:

1. Browser user tetap mendapat download `.xlsx`.
2. Backend menyimpan salinan ke `Document Output/`.
3. Jika nama file sama, backend menambahkan timestamp agar arsip lama tidak tertimpa.

Jika arsip server gagal, download user tetap diprioritaskan dan backend hanya mencatat warning.

## Troubleshooting

### Backend `ECONNREFUSED 127.0.0.1:8000`

Artinya frontend Vite mencoba proxy ke backend, tetapi Django belum berjalan. Jalankan:

```powershell
python manage.py runserver
```

### `playwright is not recognized`

Artinya dependency frontend belum terinstall atau command tidak dijalankan dari `atl-framework/`.

```powershell
cd atl-framework
npm install
npx playwright install
npm run test:e2e
```

### Path PowerShell dengan spasi gagal

Gunakan tanda `&` dan kutip path executable:

```powershell
& "D:\folder dengan spasi\atl\.venv\Scripts\python.exe" -m pip install pytest pytest-django
```

### Login gagal padahal username/password benar

Coba seed ulang:

```powershell
python manage.py seed_atl
```

Pastikan juga browser tidak menyimpan session lama. Logout, refresh, atau bersihkan localStorage jika perlu.

### Ngrok masih bermasalah session/login

Project ini masih dikonfigurasi sebagai mode development. Jika memakai ngrok:

- Pastikan domain ngrok masuk `ALLOWED_HOSTS` dan origin frontend masuk daftar CORS/CSRF trusted origin.
- Jalankan backend dan frontend lokal sebelum expose URL.
- Jangan mengaktifkan `SESSION_COOKIE_SECURE=True` jika masih memakai HTTP lokal.

### Database terasa tidak sinkron

Gunakan seed dan migrasi ulang secara aman:

```powershell
python manage.py migrate
python manage.py seed_atl
python manage.py check
```

Jangan hapus `db.sqlite3` jika masih butuh data input assessment terbaru.

## Catatan Development dan Deployment

Konfigurasi saat ini diprioritaskan untuk development, presentasi lokal, dan blackbox testing:

- `DEBUG=True`
- `SESSION_COOKIE_SECURE=False`
- SQLite lokal
- CORS dan host disiapkan untuk local/ngrok development

Untuk production, ubah konfigurasi keamanan sebelum deploy:

- Set `DEBUG=False`.
- Gunakan `SECRET_KEY` dari environment variable.
- Batasi `ALLOWED_HOSTS`.
- Aktifkan cookie secure jika memakai HTTPS.
- Gunakan database production.
- Audit ulang CORS/CSRF origin.

## Status Stabilitas

Flow utama yang perlu dijaga sebelum push:

- Login dan role access.
- Dashboard dengan data sementara dan tombol `Update Data`.
- Input ATL detailed dan batch.
- Report dengan export Excel.
- Academic Management dan CRUD siswa.
- Criteria Management dan Weight Management.
- Backend test, frontend lint, dan frontend build.
