# Production Deployment

Stack production terdiri dari Nginx frontend, API Express, dan PostgreSQL. PostgreSQL tidak diekspos ke host; aplikasi diakses melalui port web.

## Persiapan

1. Install Docker Engine dan Docker Compose v2.
2. Salin environment. Di Windows gunakan `copy`; di Linux gunakan `cp`:

```bash
cp .env.example .env
```

3. Ganti `POSTGRES_PASSWORD` di `.env` dengan secret acak yang panjang.
4. Pastikan port `WEB_PORT` tersedia.

## Menjalankan

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Buka `http://localhost:<WEB_PORT>` sesuai nilai `WEB_PORT` di `.env`.

API akan menjalankan migration schema sebelum mulai menerima request. Volume PostgreSQL dan upload tetap bertahan saat container diperbarui.

Pada instalasi database baru, buat akun bootstrap untuk pengujian awal:

```bash
docker compose -f docker-compose.production.yml exec api npm run seed:director
```

Akun awal Admin: `admin@comtelindo.co.id` dengan password `admin123`. Segera ubah password tersebut setelah login pertama.

## Pemeriksaan

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 api
curl http://localhost:8080/api/health
```

Health API harus mengembalikan `ok: true` dan `database: postgresql`.

## Backup

```bash
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U gcg_app -d gcg_monev > backup-$(date +%Y%m%d-%H%M).sql
```

Backup volume `gcg-production-uploads` juga diperlukan karena file dokumen disimpan di sana.

## Update aplikasi

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Jangan menghapus volume production saat update. Untuk deployment publik, letakkan TLS/reverse proxy eksternal di depan port web dan simpan `.env` di luar repository.
