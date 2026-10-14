# Spesifikasi Aplikasi Web Tata Kelola & Monev PT Comtelindo

**Versi:** 1.0 — rancangan untuk validasi kebutuhan dan implementasi awal  
**Tanggal:** 7 Oktober 2026  
**Nama kerja:** Comtelindo Governance Hub  
**Platform:** Aplikasi web mandiri dengan database dan pengaturan akses sendiri  
**Bahasa antarmuka:** Bahasa Indonesia

> Dokumen ini adalah spesifikasi pembangunan, bukan aplikasi yang sudah berjalan. Aturan pengesahan, struktur organisasi, penomoran, dan retensi harus disetujui perusahaan sebelum produksi. Contoh data tidak boleh dianggap sebagai bukti kepatuhan atau pengesahan resmi.

## 1. Tujuan dan batasan

Menyatukan register tata kelola, proses bisnis, SOP/XSOP, instruksi kerja, form/template, progres pengesahan, dan monitoring implementasi yang sekarang tersebar pada dua workbook Excel.

Hasil yang diharapkan:
- Satu pintu pencarian dokumen resmi dan versi yang berlaku.
- Hubungan yang dapat ditelusuri antara tata kelola, proses bisnis, SOP, IK, dan form.
- Alur penyusunan, pemeriksaan, pengesahan, penerbitan, sosialisasi, dan review.
- Pemisahan progres administrasi dokumen dari hasil implementasi/kepatuhan.
- Evaluasi berkala dengan bukti, temuan, tindak lanjut, dan verifikasi.
- Riwayat perubahan dan aktivitas yang dapat diaudit.

### 1.1 Dalam lingkup MVP

1. Login, pengguna, unit, peran, dan akses berbasis cakupan.
2. Master tata kelola dan proses bisnis.
3. Register dokumen dengan versi, file atau link sumber, dan hubungan antardokumen.
4. Workflow pengesahan internal dan penerbitan terkontrol.
5. Monitoring, temuan, tindak lanjut, dan verifikasi.
6. Pencarian, dashboard dasar, pengingat dalam aplikasi.
7. Import Excel melalui staging dan rekonsiliasi.
8. Audit log, ekspor terotorisasi, backup, dan restore.

### 1.2 Bukan lingkup MVP

- Portal publik atau salinan tampilan BPK secara persis.
- Penetapan otomatis bahwa suatu regulasi berlaku bagi perusahaan.
- Sinkronisasi otomatis Google Drive/BPK atau scraping peraturan.
- Tanda tangan elektronik tersertifikasi.
- OCR, AI pemberi keputusan kepatuhan, mobile native, atau microservices.
- SSO, integrasi ERP, dan koneksi email perusahaan sebelum kebutuhan dikonfirmasi.

Referensi BPK digunakan untuk pola halaman detail: metadata, ringkasan, status, file, dan keterkaitan dokumen. Situs referensi bukan bukti bahwa peraturan pada contoh berlaku untuk PT Comtelindo.

## 2. Sumber dan temuan pemeriksaan awal

### 2.1 Sumber

| Sumber | Struktur yang diperiksa | Pemanfaatan |
|---|---|---|
| `Monev Tata Kelola 2026 (4).xlsx` | SKD, Tata Kelola, Bisnis Proses, petunjuk pengisian, XSOP per divisi | Domain, proses, daftar dokumen, versi, milestone, master dan execution pack |
| `5.1 Monitoring Progress Tata Kelola  (2).xlsx` | Dashboard, Bisnis Proses, XSOP, IK, Form, Master List | Tahapan persetujuan, progress, implementasi, kendala dan tindak lanjut |
| https://peraturan.bpk.go.id/Details/103888/pp-no-12-tahun-2019 | Halaman detail peraturan | Referensi struktur informasi |

Pemeriksaan dilakukan pada struktur workbook, contoh baris, hyperlink, dan formula. Isi file Google Drive/Docs belum diverifikasi. Daftar konflik di bawah bukan hasil rekonsiliasi menyeluruh.

### 2.2 Isu yang harus ditangani saat migrasi

- Kolom kode pada sheet XSOP file progress memakai `XSOP-PROC-003` untuk Pencarian Vendor/Supplier, Pembelian Barang Jasa, dan Pembuatan SPK/PKS. Nama file pada dua baris terakhir mengarah ke PROC-004 dan PROC-005. Jangan koreksi otomatis tanpa persetujuan pemilik data.
- Bentuk `TO-002` dan `XSOP-TO-002` memerlukan tabel pemetaan kode; belum boleh dianggap identik hanya karena suffix sama.
- Nama unit seperti BOS dan Business Operations Support memerlukan alias yang disahkan.
- Header berbeda, misalnya `Nomor SOP` vs `Kode XSOP`, serta typo pada `Execution` dan `Master`.
- Banyak baris kosong/formula/format sampai ratusan baris. Jumlah baris worksheet bukan jumlah dokumen.
- Sheet SKD pada pemeriksaan awal belum berisi record dokumen dan mempunyai hasil formula pembagian nol. Jangan impor hasil formula ini sebagai dokumen atau KPI.
- Hyperlink sering tersimpan di properti sel, bukan pada teks tampilan. Ambil URL asli.
- `Status Master = Selesai` tidak identik dengan disahkan, diterbitkan, atau diterapkan.
- Kolom review berisi nilai dengan makna berbeda, termasuk penanda teks seperti `OK`. Jangan ubah menjadi tanggal tanpa konfirmasi.
- Daftar SOP terkait pada sel bisnis proses berupa teks multiline dan sebagian kode belum lengkap. Simpan sebagai relasi belum terselesaikan sampai validasi.

## 3. Arsitektur dan pilihan teknologi

### 3.1 Rekomendasi utama: Laravel modular monolith

Pilihan awal untuk aplikasi administratif dengan workflow dan kontrol akses:

| Lapisan | Rekomendasi |
|---|---|
| Backend | Laravel versi stabil yang masih didukung saat implementasi; PHP kompatibel |
| Frontend | Inertia.js + React + TypeScript + Tailwind CSS |
| Database | PostgreSQL versi yang masih didukung |
| Penyimpanan | Private S3-compatible object storage; disk private dapat dipakai untuk development |
| Queue/cache | Redis dan Laravel queue worker |
| Scheduler | Laravel scheduler untuk pengingat dan tugas berkala |
| Pencarian awal | PostgreSQL full-text search + filter terstruktur |
| Deployment | Container atau VM terkelola, reverse proxy HTTPS, database private |
| Pengujian | PHPUnit/Pest, pengujian komponen, dan Playwright E2E |

Alasan: satu backend otoritatif untuk otorisasi, transaksi, versioning, approval, audit, dan pekerjaan latar belakang. Hindari dua backend yang menduplikasi aturan bisnis pada MVP.

```text
Browser pengguna
    -> HTTPS / reverse proxy
    -> Laravel + Inertia React
        -> PostgreSQL
        -> private object storage
        -> Redis / queue worker
        -> scheduler / notification jobs
```

### 3.2 Alternatif: Next.js full-stack

Jika tim lebih kuat pada TypeScript, gunakan Next.js versi didukung + PostgreSQL + Prisma/Drizzle + library autentikasi yang dipelihara + private object storage + worker/scheduler terpisah.

- Terapkan otorisasi pada seluruh server action/API dan pengunduhan file.
- Jangan menjalankan job panjang/import pada request atau mengandalkan lifecycle serverless.
- Aturan workflow tetap terpusat dalam service layer dengan transaksi database.
- Jangan memasangkan Laravel dan Next.js sebagai dua backend kecuali ada kebutuhan jelas; Next.js sebagai frontend Laravel adalah opsi lanjutan, bukan keharusan.

**Default spesifikasi implementasi ini: Laravel + Inertia React + PostgreSQL.** Pemilihan final menunggu kemampuan tim, hosting, dan kebijakan IT.

## 4. Peran dan hak akses

| Peran | Kewenangan utama | Batasan |
|---|---|---|
| Administrator Sistem | Akun, role, konfigurasi teknis | Tidak otomatis menjadi pengesah atau berhak membaca semua dokumen rahasia |
| Pengelola GCG | Register, pemetaan proses, koordinasi review, penerbitan sesuai mandat | Tidak menggantikan kewenangan direksi/pengesah |
| Pemilik Proses/Dokumen | Menyusun, mengajukan, menjawab kendala, menindaklanjuti | Tidak boleh menyetujui pengajuan sendiri |
| Pemeriksa | Review isi dan meminta perbaikan | Tidak mengubah file yang sudah disahkan |
| Pengesah | Menyetujui/menolak sesuai matriks kewenangan | Hanya dokumen dalam mandatnya |
| Internal Auditor | Membaca sesuai penugasan, mencatat evaluasi/temuan, memverifikasi perbaikan | Tidak otomatis menjadi pemilik kontrol atau pengesah dokumen |
| Pembaca | Melihat dokumen terbit dalam cakupan akses | Tidak melihat draft, bukti audit, atau file terbatas tanpa izin |

Satu pengguna dapat memiliki beberapa role, tetapi larangan konflik berlaku berdasarkan identitas pengguna, bukan nama role. Jika struktur kecil membutuhkan pengecualian, gunakan persetujuan pengecualian terdokumentasi; jangan memberikan bypass tersembunyi.

Akses = permission aksi + cakupan unit/penugasan + klasifikasi + state dokumen. Filter UI bukan kontrol keamanan. Tolak akses secara default dan evaluasi di server untuk list, detail, pencarian, ekspor, dan file.

## 5. Model data dan relasi

### 5.1 Prinsip

- Gunakan UUID sebagai primary key; kode bisnis bukan primary key.
- Satu `documents` adalah identitas dokumen; perubahan substansial menjadi `document_versions` baru.
- Proses bisnis adalah objek proses, bukan otomatis file dokumen. File peta proses dapat ditautkan ke register dokumen.
- Satu SOP dapat mendukung beberapa proses bisnis.
- Hubungan domain ke proses dapat banyak-ke-banyak untuk mengakomodasi proses lintas domain.
- Approval dan file melekat pada versi, bukan sekadar judul dokumen.
- Simpan datetime di UTC; tampilkan berdasarkan timezone perusahaan yang dikonfirmasi. Tanggal berlaku/review disimpan sebagai DATE.

### 5.2 Tabel inti

| Tabel | Field utama dan fungsi |
|---|---|
| `users` | id, name, email unik, password_hash, active, last_login_at |
| `units` | id, code unik, name, parent_id nullable, active |
| `roles`, `permissions` | Katalog akses; pivot user-role dan role-permission; scope unit/penugasan tersendiri |
| `governance_domains` | id, code unik, name, scope_description, owner_user_id nullable, owner_unit_id, active |
| `business_processes` | id, code unik, name, description, workflow_description, focus, owner_unit_id, owner_user_id nullable, active |
| `domain_process` | domain_id, process_id; unique pasangan |
| `process_participants` | process_id, unit_id, responsibility |
| `process_kpis` | id, process_id, name, definition, unit_of_measure; target opsional jika sudah disepakati |
| `document_types` | id, code, name, workflow_template_id; Kebijakan/SKD, Peta Proses, XSOP/SOP, IK, Form, Regulasi Eksternal |
| `documents` | id, canonical_code unik, title, type_id, owner_unit_id, owner_user_id nullable, confidentiality, origin internal/external, current_published_version_id nullable, active |
| `document_versions` | id, document_id, version_label, summary, scope, change_summary, workflow_state, effective_date, review_due_date, published_at, created_by, row_version |
| `document_process` | document_id, process_id; unique pasangan |
| `document_domain` | document_id, domain_id; opsional untuk kebijakan level domain |
| `document_relationships` | source_document_id, target_document_id, relationship_type, note; dasar, turunan, mendukung, menggantikan, referensi |
| `attachments` | id, version_id nullable, evaluation_id nullable, finding_id nullable, action_id nullable, category, storage_key atau external_url, original_name, mime_type, size_bytes, sha256, scan_status, uploaded_by |
| `workflow_templates`, `workflow_template_steps` | Jenis dokumen, urutan, peran wajib, kebijakan konflik, versi konfigurasi |
| `approval_requests` | id, version_id, round_number, state, submitted_by, submitted_at; snapshot aturan saat pengajuan |
| `approval_steps` | request_id, sequence, approver_user_id, decision, comment, decided_at; snapshot pengesah |
| `publications` | id, version_id, published_by, published_at, effective_date, supersedes_version_id nullable |
| `document_lifecycle_events` | version_id, event_type, event_date, actor_id, note, evidence_attachment_id nullable; sosialisasi/review/pencabutan |
| `evaluation_items` | id, process_id nullable, document_id nullable, title, requirement_reference, test_method, frequency, owner_unit_id, active |
| `evaluations` | id, evaluation_item_id, reference_version_id nullable, period_start, period_end, evaluator_id, assessed_at, result, notes, state |
| `findings` | id, evaluation_id nullable, title, condition, criteria, cause nullable, impact, risk_level, owner_unit_id, state |
| `corrective_actions` | id, finding_id, description, assignee_user_id, due_date, state, submitted_at, verified_by nullable, verified_at nullable, verification_note |
| `notifications` | recipient_id, type, entity_type/id, read_at, deduplication_key |
| `audit_logs` | actor_id, action, entity_type/id, before/after yang disaring, timestamp, request_id, ip sesuai kebijakan |
| `import_batches`, `import_rows` | Sumber, checksum file, sheet/baris, raw payload, normalisasi, konflik, keputusan, target_id, status |
| `document_aliases`, `unit_aliases` | Alias asli, sumber, target kanonis, status validasi, verified_by |

`attachments` harus memiliki tepat satu parent (versi/evaluasi/temuan/tindakan), ditegakkan melalui constraint atau validasi setara. Jangan memakai polymorphic parent tanpa strategi integritas dan otorisasi yang jelas.

Tambahkan created_at/updated_at pada tabel operasional. Gunakan FK, index pada kode, judul pencarian, unit, state, due_date, serta unique `(document_id, version_label)`. Dokumen terbit/riwayat audit tidak boleh dihapus keras melalui UI; data master yang sudah digunakan dinonaktifkan.

### 5.3 Model hubungan ringkas

```text
Domain <-> Proses Bisnis <-> Dokumen
Dokumen -> banyak Versi
Dokumen <-> Dokumen (dasar/turunan/referensi/menggantikan)
Versi -> File / Link / Execution Pack
Versi -> Pengajuan -> Tahap Approval -> Penerbitan
Kontrol Evaluasi -> Evaluasi Periode -> Temuan -> Tindakan -> Verifikasi
```

Relasi `menggantikan` tidak boleh membentuk siklus. Penggantian versi dalam dokumen yang sama menggunakan riwayat versi; penggantian antaridentitas dokumen menggunakan relasi dokumen dan tindakan pencabutan yang eksplisit.

## 6. Logika dokumen dan workflow

### 6.1 Pisahkan tiga dimensi status

1. **Workflow versi:** Draft, Diajukan, Dalam Review, Perlu Revisi, Menunggu Pengesahan, Disahkan, Terbit, Ditolak.
2. **Keberlakuan:** Belum Efektif, Berlaku, Digantikan, Dicabut. Sebagian diturunkan dari tanggal dan event lifecycle.
3. **Implementasi evaluasi:** Belum Dinilai, Sesuai, Sebagian Sesuai, Tidak Sesuai, Tidak Berlaku.

Master Document dan Execution Pack juga boleh memiliki status kesiapan sendiri. Jangan memakai satu status `Selesai` untuk semua dimensi.

### 6.2 Alur versi internal

```text
Draft -> Diajukan -> Dalam Review
                       -> Perlu Revisi -> Draft (pengajuan putaran baru)
                       -> Menunggu Pengesahan -> Disahkan -> Terbit
                       -> Ditolak (riwayat tetap disimpan)
```

- Field wajib sebelum diajukan: kode kanonis, judul, jenis, unit pemilik, versi, file/link kandidat resmi, dan pengesah sesuai workflow.
- Validasi code/version unik dan kelengkapan pemetaan yang diwajibkan jenis dokumen.
- Pada pengajuan, simpan snapshot file hash, metadata relevan, urutan approval, dan identitas pengesah.
- Setelah diajukan, isi substansial dan file terkunci. Perubahan mengharuskan pengembalian ke draft dan approval putaran baru.
- Tahap berikutnya hanya dibuka setelah tahap wajib sebelumnya disetujui.
- Penolakan/pengembalian membutuhkan komentar. Review lama tidak dihapus.
- Pengesah tidak boleh sama dengan pengaju/penyusun sesuai matriks konflik.
- Penerbitan hanya oleh pengguna berwenang setelah seluruh tahap wajib sah dan bukti sesuai kebijakan lengkap.
- Versi disahkan/terbit bersifat immutable. Perubahan isi menghasilkan versi baru.
- Jika berlaku di masa depan, versi ditampilkan `Belum Efektif`; versi lama tetap berlaku sampai cutover.
- Perubahan versi berlaku dilakukan atomik dengan transaksi dan locking agar tidak ada dua versi aktif bersamaan.
- Pencabutan/penggantian membutuhkan alasan, kewenangan, tanggal, dan riwayat. Tampilkan banner pada versi lama.
- Sosialisasi mencatat waktu, peserta/cakupan, dan bukti; bukan konsekuensi otomatis penerbitan.
- Jadwal review tidak otomatis mencabut dokumen yang terlambat direview.

### 6.3 Approval internal bukan TTE tersertifikasi

Checkbox TTD dari Excel adalah catatan administrasi, bukan validasi kriptografis dan bukan tanda tangan elektronik tersertifikasi.

MVP menyimpan persetujuan pengguna terautentikasi beserta waktu, komentar, versi, dan hash file. Jika perusahaan mensyaratkan file bertanda tangan, bukti file wajib dilampirkan sebelum penerbitan. Status migrasi tidak boleh menciptakan keputusan approval digital seolah-olah dilakukan oleh pengguna sekarang.

TTE tersertifikasi memerlukan keputusan tersendiri, penyedia yang sesuai, verifikasi hasil, dan kebijakan legal perusahaan.

### 6.4 Dokumen sumber eksternal

- Pisahkan approval legal perusahaan dari status peraturan sumber.
- Field tambahan: institusi penerbit, nomor, tahun, URL sumber resmi, status sumber, tanggal pemeriksaan sumber, applicability `Belum Dinilai/Relevan/Tidak Relevan`, alasan, dan penilai.
- Gunakan tabel `external_regulation_details` dengan FK document_id jika modul ini diaktifkan.
- Jangan menyimpulkan relevansi hanya dari judul atau status `Berlaku` di website sumber.
- Regulasi dapat dihubungkan ke kebijakan internal setelah dinilai oleh fungsi yang berwenang.

## 7. Perhitungan progress dan KPI

### 7.1 Progress pengesahan

```text
Progress pengesahan = jumlah tahap wajib yang disetujui pada putaran aktif
                      / jumlah tahap wajib yang berlaku x 100%
```

- SOP pada pola Excel menggunakan tiga penanda: disusun, diperiksa, disetujui.
- IK dan form pada pola Excel menggunakan dua penanda: disusun dan disetujui.
- Ini adalah pemetaan awal, bukan penetapan permanen matriks kewenangan.
- Tahap penyusunan di web dapat berupa konfirmasi penyusun; tahap pemeriksa/pengesah berupa keputusan workflow.
- Putaran dikembalikan/ditolak tidak boleh tampil seolah-olah masih mencapai progress penuh pada putaran aktif.
- Denominator nol menghasilkan `Belum Dikonfigurasi`, bukan 0% atau 100%.
- 100% approval belum berarti terbit, sudah disosialisasikan, atau patuh.

### 7.2 KPI dashboard MVP

| KPI | Definisi |
|---|---|
| Dokumen berlaku | Identitas dokumen yang mempunyai versi terbit dan efektif, tidak dicabut |
| Menunggu keputusan | Tahap approval aktif yang belum diputuskan |
| Review terlambat | Versi berlaku dengan review_due_date sebelum hari ini dan belum direview untuk siklus tersebut |
| Evaluasi selesai | Evaluasi berstatus Final pada periode dan cakupan terpilih |
| Temuan terbuka | Temuan yang belum ditutup melalui verifikasi |
| Tindakan terlambat | due_date lewat dan tindakan belum Terverifikasi |

Jangan tampilkan skor kepatuhan perusahaan pada MVP tanpa definisi kontrol dan cakupan yang disepakati. Jika persentase dibutuhkan: denominator hanya evaluasi final yang berlaku, kecualikan Tidak Berlaku, dan tampilkan jumlah Belum Dinilai serta periode. Nol evaluasi berarti `Belum ada penilaian`.

## 8. Logika monitoring dan tindak lanjut

1. GCG/auditor berwenang mendefinisikan kontrol/kewajiban, referensi, metode uji, frekuensi, dan unit pemilik.
2. Buat evaluasi untuk periode tertentu; simpan referensi versi yang diperiksa agar perubahan SOP tidak mengubah sejarah.
3. Unit melampirkan bukti; evaluator menilai bukti dan merekam hasil.
4. Finalisasi evaluasi mengunci hasil; koreksi melalui amendment beralasan dengan riwayat, bukan overwrite tanpa jejak.
5. Tidak Berlaku memerlukan alasan dan peninjauan sesuai kebijakan.
6. Ketidaksesuaian dapat menghasilkan temuan. Untuk hasil Tidak Sesuai, wajib temuan atau alasan terdokumentasi mengapa tidak dibuat.
7. Temuan memiliki kriteria, kondisi, dampak, tingkat risiko, dan unit penanggung jawab. Matriks risiko dikonfirmasi perusahaan.
8. Tindakan mempunyai PIC dan tenggat.
9. PIC mengubah state: Terbuka -> Dalam Pengerjaan -> Diajukan untuk Verifikasi.
10. Verifikator menerima -> Terverifikasi, atau mengembalikan -> Perlu Perbaikan. PIC tidak memverifikasi tindakannya sendiri.
11. Temuan hanya dapat Ditutup jika tindakan wajib terverifikasi dan pihak berwenang menyatakan bukti memadai. Penerimaan risiko memerlukan keputusan pejabat yang berwenang dan dicatat terpisah, bukan penutupan otomatis.

Tampilan keterlambatan dihitung berdasarkan tenggat dan state; tidak perlu mengubah state menjadi `Terlambat`. Perubahan deadline memerlukan alasan, kewenangan, dan audit log.

## 9. Desain informasi dan antarmuka

### 9.1 Prinsip desain

- Tampilan profesional, tenang, dan berorientasi kerja; bukan website pemasaran.
- Warna dasar navy, putih, abu-abu; hijau untuk berlaku/terverifikasi, amber untuk pending, merah untuk overdue/tidak sesuai.
- Selalu gunakan teks/icon selain warna untuk menyatakan status.
- Font sans-serif; ukuran isi minimal 14px, fokus keyboard terlihat, kontras WCAG AA.
- Desktop untuk tabel kerja; tablet/mobile untuk pencarian dan membaca detail.
- Responsive table menggunakan horizontal scroll atau kartu ringkas, bukan mengecilkan teks.
- Tanggal antarmuka `dd MMM yyyy`; kode dokumen konsisten; label status tidak ambigu.
- Tombol aksi mengikuti hak akses dan state; server tetap memvalidasi seluruh aksi.

### 9.2 Navigasi

```text
Dashboard
Tata Kelola
Bisnis Proses
Dokumen
Persetujuan Saya
Monitoring & Evaluasi
Temuan & Tindak Lanjut
Laporan / Ekspor
Administrasi (sesuai role)
```

### 9.3 Dashboard

- Filter unit, jenis dokumen, periode evaluasi.
- Kartu KPI yang dapat diklik ke daftar terfilter.
- Daftar approval saya, review segera jatuh tempo, tindak lanjut terlambat.
- Ringkasan status per unit dapat ditambahkan setelah KPI direkonsiliasi.
- Semua angka mengikuti cakupan akses; jangan bocorkan jumlah dokumen terbatas.

### 9.4 Katalog dokumen

Pencarian berdasarkan kode/judul/ringkasan; filter jenis, unit, status keberlakuan, dan tahun. Default pembaca hanya versi berlaku yang diizinkan.

Kolom: kode, judul, jenis, unit, versi berlaku, keberlakuan, tanggal efektif, review berikutnya. Filter workflow tersedia bagi pengelola.

Gunakan pagination server-side. Tombol: detail, unduh, ajukan revisi jika berwenang. Draft tanpa versi berlaku tidak muncul sebagai dokumen resmi bagi pembaca umum.

### 9.5 Detail dokumen: adaptasi pola BPK

```text
Breadcrumb: Dokumen / XSOP / [kode]
[judul] [badge keberlakuan] [klasifikasi]
[Unduh versi berlaku] [Lihat riwayat] [Aksi berwenang]

Ringkasan dan tujuan
Metadata: kode, jenis, unit, owner, versi, tanggal berlaku/review
Tab:
  Isi & File
  Proses / Dokumen Terkait
  Approval & Pengesahan
  Sosialisasi & Review
  Riwayat Versi
  Monitoring (akses terbatas)
```

Label versi lama dan watermark/banner `Tidak berlaku` pada pratinjau jika memungkinkan. Unduh versi historis harus menampilkan informasi versi yang jelas tanpa mengubah file asli.

### 9.6 Form dokumen

Bagian: Identitas, Ruang Lingkup, Relasi, File/Link, Jadwal Review, Workflow.

- Dropdown proses/dokumen mencari dengan kode dan judul.
- Simpan draft terpisah dari Ajukan.
- Validasi per field; jangan menghapus input saat error.
- Unggah file menampilkan batas ukuran, format, scan pending, dan checksum.
- Warning kemungkinan duplikat tidak menggantikan constraint kode unik.

### 9.7 Approval

Daftar tugas saya dengan dokumen, versi, pengaju, tahap, tanggal, dan SLA bila disepakati. Detail menampilkan snapshot versi dan file yang disetujui. Aksi Setujui, Minta Revisi, Tolak; keputusan destruktif/penolakan memerlukan konfirmasi dan alasan.

### 9.8 Monitoring dan temuan

- Daftar evaluasi per periode dengan kontrol, unit, evaluator, hasil, state.
- Detail memisahkan bukti unit, penilaian evaluator, dan tindak lanjut.
- Tindakan ditampilkan sebagai tabel atau board berdasarkan state.
- Riwayat verifikasi tetap terlihat ketika tindakan dikembalikan.

### 9.9 State UI wajib

Loading, kosong, belum dinilai, tidak berhak, file scan pending/gagal, link eksternal tidak terverifikasi, konflik edit, import gagal sebagian, dan error koneksi. Jangan menyatakan keberhasilan sebelum transaksi server sukses.

## 10. Strategi migrasi dua workbook

### 10.1 Tahapan import

```text
Upload -> Simpan sumber asli -> Parse -> Staging -> Preview
       -> Resolusi konflik -> Konfirmasi -> Commit -> Rekonsiliasi
```

1. Simpan salinan sumber immutable dan checksum file; batasi akses import.
2. Parse XLSX di backend/worker dengan library terpelihara, batas ukuran dan batas ekstraksi ZIP.
3. Deteksi sheet dan map header melalui konfigurasi; abaikan dashboard, petunjuk, formula ringkasan, dan baris tanpa identitas.
4. Ekstrak nilai asli, hyperlink, sheet, nomor baris, serta formula relevan sebagai provenance. Jangan menjalankan formula atau link eksternal dari file upload.
5. Normalisasi spasi, nama unit, tanggal, dan tipe boolean; nilai yang ambigu ditandai, bukan ditebak.
6. Lakukan matching: kode kanonis+versi yang tervalidasi; kandidat dari alias/nama+unit harus dikonfirmasi manusia.
7. Tampilkan konflik field-by-field: nilai dari sumber A, sumber B, dan pilihan nilai final. Jangan memilih otomatis berdasarkan urutan file.
8. Konflik kode, status pengesahan, versi, link resmi, dan tanggal wajib diselesaikan sebelum penerbitan.
9. Import record bersih ke register. Record bermasalah tetap di staging, tidak diam-diam dibuang.
10. Simpan keputusan rekonsiliasi, pengguna yang mengesahkan mapping, dan target_id setiap baris.
11. Rekonsiliasi jumlah: record kandidat = diterapkan + digabung secara sah + ditahan + ditolak dengan alasan. Laporkan per kategori dan sheet.
12. Reimport batch/checksum sama tidak membuat duplikasi. Gunakan idempotency key per baris dan mapping sumber-target; checksum baru tetap memerlukan preview.

### 10.2 Pemetaan field awal

| Field Excel | Tujuan |
|---|---|
| Kode / Nama Tata Kelola / Ruang Lingkup | governance_domains |
| Kode BP / Nama BP / Alur / Fokus / Peran / KPI | business_processes dan tabel pendukung |
| BP yang Dinaungi | domain_process setelah token kode diverifikasi |
| Nomor SOP / Kode XSOP / Kode IK / Kode Form | documents.canonical_code + alias sumber |
| SOP / Nama XSOP / Nama IK / Nama Form | documents.title |
| Divisi / Process Owner | unit dan user mapping; jabatan tidak otomatis dianggap akun pengguna |
| Versi Saat Ini / Versi | document_versions.version_label; nilai kosong perlu verifikasi |
| Link Master Document | attachments kategori master; URL hyperlink asli |
| Link Execution XSOP | attachments kategori execution_pack; bukan bukti implementasi otomatis |
| Status Master / Execution | catatan kesiapan artefak yang terpisah |
| Tanggal pembuatan/diperiksa/penetapan/sosialisasi | milestone historis dengan provenance |
| TTD Disusun / Diperiksa / Disetujui | catatan legacy, bukan keputusan approval web baru |
| Progress (%) / Status Keseluruhan | referensi formula sumber; hitung ulang menurut aturan web |
| Terhubung ke BP / XSOP Terkait | document_process setelah resolusi |
| Dasar Kebijakan / Tipe Relasi / Referensi | document_relationships jika target teridentifikasi |
| Status Implementasi / Kendala / Tindak Lanjut | catatan evaluasi legacy; periode/PIC yang kosong harus dilengkapi |

### 10.3 Aturan khusus riwayat legacy

- Dokumen yang terlihat disahkan di Excel masuk kategori `Legacy — Menunggu Verifikasi` sampai bukti dan tanggal diperiksa.
- Penerbitan legacy melalui tindakan eksplisit berwenang, dengan lampiran bukti dan jejak import; jangan membuat approval palsu atas nama pengesah lama.
- Jangan mengisi tanggal kosong dengan hari import.
- Jangan mengisi versi kosong sebagai `1.0` tanpa konfirmasi; simpan raw value dan status perlu verifikasi.
- Data lama menjadi read-only setelah cutover yang disepakati; tentukan tanggal pembekuan agar tidak ada dua sumber aktif.
- Uji pilot pada proses pengadaan; cek pemetaan Pengadaan Project/Internal ke proses berkode yang ada, jangan memaksakan kesetaraan berdasarkan nama.

## 11. Endpoint/aksi backend acuan

Inertia dapat memakai controller route; endpoint berikut adalah kontrak logis, bukan kewajiban membuat API publik.

| Aksi | Route contoh |
|---|---|
| Daftar/detail dokumen | GET /documents, GET /documents/{id} |
| Buat/edit identitas | POST /documents, PATCH /documents/{id} |
| Versi draft baru | POST /documents/{id}/versions |
| Update draft | PATCH /document-versions/{id}; wajib row_version |
| Ajukan | POST /document-versions/{id}/submit |
| Keputusan tahap | POST /approval-steps/{id}/decide |
| Terbitkan/cabut | POST /document-versions/{id}/publish, POST /documents/{id}/withdraw |
| Unggah/unduh file | POST /attachments, GET /attachments/{id}/download |
| Evaluasi/finalisasi | POST /evaluations, POST /evaluations/{id}/finalize |
| Tindakan/verifikasi | POST /findings/{id}/actions, POST /actions/{id}/submit-verification, POST /actions/{id}/verify |
| Import preview/commit | POST /imports, GET /imports/{id}/preview, POST /imports/{id}/commit |
| Ekspor | POST /exports; job dengan scope akses saat permintaan dan saat unduh |

Gunakan error 403 untuk akses ditolak, 422 untuk validasi, dan 409 untuk konflik state/versi. Gunakan transaksi, idempotency untuk keputusan/commit, optimistic concurrency untuk edit, dan row-level locking saat approval/penerbitan. Cegah mass assignment dan state transition lewat PATCH biasa.

## 12. Keamanan, audit, dan operasional

### 12.1 Kontrol wajib

- HTTPS; cookie secure, HttpOnly, SameSite; CSRF protection untuk sesi web.
- Password hashing yang didukung framework, rate limiting, reset password aman, invalidasi sesi saat akun dinonaktifkan.
- MFA untuk admin/pengesah atau kebijakan setara yang disetujui perusahaan.
- Private storage; server melakukan authorization sebelum memberikan signed URL berumur pendek. URL tidak ditulis pada log publik.
- File allowlist awal PDF/DOCX/XLSX/PNG/JPG, batas ukuran yang dapat dikonfigurasi; validasi extension, MIME, dan signature, scan malware, quarantine sampai lulus.
- Jangan merender HTML/SVG unggahan atau konten executable. Pratinjau Office melalui konversi terisolasi jika kelak diperlukan.
- URL eksternal hanya HTTPS yang valid; jangan auto-fetch arbitrary URL dari backend untuk menghindari SSRF. Izin Drive tetap dikelola pada Drive; akses aplikasi tidak otomatis memberi akses sumber.
- Audit log append-only pada jalur aplikasi; role operasional tidak memiliki update/delete log. Backup log terpisah. Jangan mengklaim tamper-proof tanpa mekanisme lebih lanjut.
- Audit: perubahan metadata, versi, akses/unduh dokumen terbatas sesuai kebijakan, keputusan, penerbitan, pencabutan, finalisasi, verifikasi, perubahan akses, dan import.
- Jangan mencatat password, token, isi file rahasia, atau seluruh bukti personal pada audit log.
- Ekspor spreadsheet menghindari formula injection pada teks yang dimulai `=`, `+`, `-`, `@`.
- Secrets pada secret manager/environment, bukan repo; dependency scanning dan patch rutin.
- Lindungi IDOR, XSS, SQL injection, dan bypass authorization di semua jalur.

### 12.2 Backup dan retensi

- Usulan awal: backup database harian + object storage versioning; backup terenkripsi dan akses terbatas.
- Tetapkan RPO/RTO serta retensi bersama IT dan manajemen, bukan dianggap final oleh spesifikasi.
- Uji restore sebelum go-live dan secara berkala.
- Retensi dokumen, bukti audit, log akses, dan data pribadi ditetapkan menurut kebijakan serta kewajiban relevan.
- Retention hold untuk audit/sengketa mencegah penghapusan oleh job retensi.
- Ketersediaan, disk, queue failure, backup failure, dan error rate harus dimonitor.

## 13. Tahapan implementasi dan deliverable

| Tahap | Pekerjaan | Keluaran/gate |
|---|---|---|
| 0. Validasi | Peran, workflow, kode, hosting, sumber resmi, konflik Excel | Kebutuhan disetujui dan daftar keputusan terbuka |
| 1. Fondasi | Repo, env, DB migration, auth, role/scope, audit, storage private | Tes akses negatif lulus |
| 2. Register | Domain, proses, dokumen, versi, relasi, katalog/detail | Satu contoh SOP dapat ditelusuri end-to-end |
| 3. Approval | Workflow, locking, keputusan, publication, lifecycle | Tidak ada publikasi tanpa kewenangan/bukti |
| 4. Import pilot | Staging, mapping, konflik, idempotency | Rekonsiliasi sumber-target disetujui |
| 5. Monev | Kontrol, evaluasi, temuan, tindakan, verifikasi | Pemisahan progress dan implementasi terbukti |
| 6. Dashboard | KPI, filter, notification, export | Angka cocok dengan daftar sumber |
| 7. UAT & cutover | Security test, restore, training, migrasi final | Sign-off pemilik proses, GCG, dan IT |

Urutan ini bukan estimasi durasi. Durasi dan biaya dihitung setelah jumlah pengguna, volume dokumen, workflow, dan kesiapan migrasi diketahui.

Deliverable developer: source code, migrations/seed role, konfigurasi contoh tanpa secrets, automated tests, data dictionary, dokumen API/routes, panduan deployment, backup/restore, panduan admin/pengguna, dan laporan rekonsiliasi import.

## 14. Kriteria penerimaan dan skenario uji

### Register dan versioning
- Pembaca hanya melihat dokumen yang diizinkan; draft dan file rahasia tidak bocor lewat pencarian/ekspor/URL langsung.
- Satu identitas memiliki satu versi berlaku pada saat tertentu; pengesahan versi masa depan tidak mematikan versi berjalan lebih awal.
- Revisi tidak mengubah file dan keputusan versi sebelumnya.
- Relasi SOP lintas proses dapat dibuka dua arah; siklus penggantian ditolak.

### Workflow
- Penyusun tidak dapat menyetujui pengajuannya sendiri melalui pergantian role.
- Perubahan file setelah submit ditolak atau memicu putaran ulang; approval lama tidak dipindahkan ke file baru.
- Dua request keputusan/publikasi bersamaan tidak menggandakan event atau versi aktif.
- Checklist legacy tidak menciptakan identitas/timestamp approval baru palsu.
- Review terlambat ditandai tanpa mencabut dokumen otomatis.

### Import
- PROC-003 yang berulang masuk konflik, bukan digabung/hilang otomatis.
- URL hyperlink tersimpan, baris kosong/dashboard tidak menjadi record.
- Tanggal/versi kosong dan status ambigu tetap ditandai.
- Reimport yang sama tidak menggandakan dokumen.
- Total kandidat dapat direkonsiliasi ke hasil import dan daftar ditahan/ditolak.

### Monitoring
- Persetujuan 100% tidak menyebabkan hasil implementasi Sesuai.
- Evaluasi final menyimpan versi acuan dan bukti; perubahan dokumen tidak mengubah hasil historis.
- PIC tidak dapat memverifikasi tindakannya sendiri.
- Temuan tidak ditutup sebelum tindakan wajib terverifikasi atau keputusan pengecualian berwenang tercatat.

### Operasional
- Signed URL kedaluwarsa, unggahan berbahaya ditolak/quarantine, akun nonaktif tidak dapat memakai sesi lama.
- Dashboard dan ekspor memakai scope akses yang sama.
- Restore database dan file berhasil pada environment uji.
- UAT mencakup desktop dan mobile; target performa ditetapkan terhadap data uji/kapasitas hosting yang disepakati.

## 15. Keputusan yang masih perlu dikonfirmasi

1. Laravel atau Next.js; skill tim pengembang dan anggaran hosting.
2. Jumlah pengguna, unit, serta pihak yang boleh melihat dokumen rahasia.
3. Matriks penyusun/pemeriksa/pengesah per jenis dokumen dan konflik peran GCG/internal audit.
4. Jenis SKD dan kedudukannya dalam hierarki dokumen perusahaan.
5. Kode resmi, alias, dan koreksi konflik kedua workbook.
6. Dokumen resmi tetap pada Google Drive atau file disimpan dalam storage aplikasi; sumber kebenaran harus jelas.
7. Apakah perlu TTE tersertifikasi atau approval internal + file bertanda tangan cukup.
8. Jadwal review tiga bulan berlaku untuk semua dokumen atau hanya jenis tertentu.
9. Timezone perusahaan, klasifikasi, retensi, backup, dan RPO/RTO.
10. Definisi kontrol, risiko, periode evaluasi, serta pihak penutup temuan.
11. Apakah regulasi eksternal masuk MVP atau tahap lanjutan.
12. Siapa yang melakukan validasi akhir dan sign-off migrasi.

## 16. Brief ringkas untuk developer

Bangun aplikasi web internal modular dengan Laravel + Inertia React + PostgreSQL (atau stack Next.js full-stack jika dipilih secara eksplisit). Implementasikan domain tata kelola, proses bisnis, register dokumen berversi, approval bertahap, penerbitan terkontrol, dan monitoring berbukti. Adaptasi struktur halaman detail BPK, bukan menyalin website secara persis. Dua workbook Excel menjadi sumber migrasi melalui staging, rekonsiliasi konflik, dan provenance. Utamakan otorisasi server-side, private files, immutable published versions, audit trail, serta pemisahan pengesahan dari kepatuhan. Jangan menetapkan kode, status berlaku, approval historis, atau keputusan legal yang belum diverifikasi. Selesaikan MVP dan UAT sebelum integrasi/AI/otomatisasi lanjutan.
