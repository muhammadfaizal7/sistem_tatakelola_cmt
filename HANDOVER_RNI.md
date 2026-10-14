# Handover Tim RNI

Dokumen ini menjadi panduan operasional untuk tim Research and Innovation setelah aplikasi diserahkan.

## 1. Tujuan Aplikasi

Governance Hub menyimpan dan mengelola:

- Register dokumen tata kelola, SOP/XSOP, instruksi kerja, dan form.
- Approval dokumen tiga tahap.
- Monitoring dan evaluasi per dokumen tata kelola.
- Temuan, tindakan korektif, pengajuan verifikasi, dan verifikasi.
- Metadata dokumen, catatan perubahan, status lifecycle, dan audit log.

## 2. Arsitektur

```text
Browser -> Nginx web -> Express API -> PostgreSQL
                         |
                         -> Docker volume upload dokumen
```

Container production:

- `toolsgcg-web-1`: frontend Nginx dan reverse proxy `/api`.
- `toolsgcg-api-1`: API Express dan migration schema.
- `toolsgcg-postgres-1`: PostgreSQL 16.

## 3. Role dan Tanggung Jawab

| Role     | Tanggung jawab utama                                                         |
| -------- | ---------------------------------------------------------------------------- |
| Admin    | Kelola akun, dokumen, metadata, dan approval semua tahap.                    |
| Manager  | Memeriksa dokumen pada tahap Manager dan mengelola proses sesuai kewenangan. |
| Director | Melakukan pengesahan tahap Direktur dan verifikasi tindak lanjut.            |
| Karyawan | Mengakses area yang diizinkan dan mengerjakan tindak lanjut yang ditugaskan. |

## 4. Alur Dokumen

1. Admin/Manager mengunggah file dan metadata.
2. Dokumen masuk status `Draft`.
3. Approval tahap 1: GCG & Internal Audit.
4. Approval tahap 2: Manager Divisi.
5. Approval tahap 3: Direktur.
6. Setelah semua tahap disetujui, dokumen menjadi `Berlaku`.
7. Jika dikembalikan, dokumen menjadi `Revisi` dan catatan revisi tersimpan.
8. Admin dapat menghapus dokumen sesuai kewenangan operasional.

File yang diterima: PDF, DOCX, XLSX, PNG, JPG/JPEG. Batas ukuran upload: 5 MB. PDF dan gambar dapat dipreview langsung; DOCX/XLSX tersedia untuk download.

## 5. Alur Monitoring

1. Pilih dokumen tata kelola.
2. Buat evaluasi dengan kontrol, proses, unit, periode, hasil, dan catatan.
3. Klik baris evaluasi untuk melihat detail.
4. Buat temuan bila terdapat ketidaksesuaian.
5. Tambahkan tindakan korektif dan PIC.
6. PIC mengajukan verifikasi.
7. Manager/Director/Admin memverifikasi atau meminta perbaikan.

Edit dan hapus tersedia untuk evaluasi dan temuan. Penghapusan evaluasi/temuan dapat menghapus data tindak lanjut terkait, sehingga gunakan konfirmasi dengan hati-hati.

## 6. Operasional Docker

Dari folder project:

```bash
# Menyalakan atau memperbarui service
docker compose -f docker-compose.production.yml up -d --build

# Memeriksa status
docker compose -f docker-compose.production.yml ps

# Melihat log API
docker compose -f docker-compose.production.yml logs --tail=100 api

# Menghentikan sementara tanpa menghapus data
docker compose -f docker-compose.production.yml stop

# Menyalakan kembali container yang berhenti
docker compose -f docker-compose.production.yml start
```

Jangan gunakan `docker compose down -v` pada environment yang berisi data nyata.

## 7. Backup dan Restore

Backup database:

```bash
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U gcg_app -d gcg_monev > backup-$(date +%Y%m%d-%H%M).sql
```

Restore ke database kosong:

```bash
cat backup.sql | docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U gcg_app -d gcg_monev
```

Volume `gcg-production-uploads` juga harus dicadangkan karena berisi file dokumen. Backup harus disimpan di lokasi terpisah dari server aplikasi dan diuji restore secara berkala.

## 8. Troubleshooting Singkat

**Aplikasi tidak terbuka**

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 web
```

Periksa konflik port `WEB_PORT` dan pastikan Docker Engine aktif.

**API unhealthy atau login gagal**

```bash
docker compose -f docker-compose.production.yml logs --tail=150 api
docker compose -f docker-compose.production.yml logs --tail=100 postgres
```

Periksa `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_USER`, dan volume database. Jangan menghapus volume sebagai langkah pertama.

**File tidak dapat dibuka**

Periksa volume upload dan log API. File yang hilang dari storage perlu diunggah ulang.

## 9. Checklist Serah Terima

- [ ] Repository GitHub sudah dibuat dan `.env` tidak ikut ter-commit.
- [ ] VPS, domain, HTTPS, dan firewall sudah dikonfigurasi.
- [ ] Akun Admin bootstrap sudah diganti passwordnya.
- [ ] Backup database dan upload sudah dijadwalkan.
- [ ] Restore backup sudah diuji.
- [ ] Tim RNI sudah menguji login, upload, approval, revisi, evaluasi, temuan, dan verifikasi.
- [ ] Kontak pemilik server, domain, database, dan aplikasi sudah dicatat.
- [ ] Aturan retensi dokumen dan kewenangan penghapusan sudah disetujui.

## 10. Batasan MVP

- Preview native tersedia untuk PDF dan gambar; Office masih download.
- Beberapa kontrol UI dapat menampilkan status tahap pengembangan.
- MFA, reset password, session timeout, dan notifikasi eksternal masih perlu diprioritaskan sebelum penggunaan publik berskala besar.
