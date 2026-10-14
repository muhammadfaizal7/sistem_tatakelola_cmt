# Comtelindo Governance Hub

Aplikasi web internal untuk register dokumen tata kelola, approval, monitoring & evaluasi, temuan, dan tindak lanjut PT Comtelindo.

## Stack

- Frontend: React 18, TypeScript, Vite, CSS custom, lucide-react.
- Backend: Node.js, Express, Multer.
- Database: PostgreSQL 16.
- Production: Docker Compose, Nginx, Docker volumes.

## Jalankan Lokal

Prasyarat: Node.js 20+, Docker Desktop, dan PostgreSQL melalui Docker.

```bash
npm install
npm run dev:full
```

Frontend development biasanya tersedia di `http://localhost:5173` dan API di `http://127.0.0.1:8787`.

## Jalankan Production Lokal

Salin `.env.example` menjadi `.env`, lalu isi password database dengan secret yang aman. Pastikan `WEB_PORT` belum dipakai aplikasi lain.

```bash
docker compose -f docker-compose.production.yml up -d --build
```

Akses aplikasi melalui `http://localhost:<WEB_PORT>`. Status service:

```bash
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs --tail=100 api
```

Health check: `http://localhost:<WEB_PORT>/api/health`.

## Akun Awal

Untuk database baru, jalankan seed dari container API:

```bash
docker compose -f docker-compose.production.yml exec api npm run seed:director
```

Seed menyediakan Admin, Director, dan Manager untuk pengujian. Password bootstrap wajib diganti setelah login pertama.

## Operasional

- Jangan commit `.env`, `node_modules`, `dist`, file upload, atau backup database.
- Jangan menjalankan `docker compose down -v` kecuali memang ingin menghapus seluruh data.
- Backup PostgreSQL dan volume upload sebelum update atau migrasi.
- Panduan serah terima RNI ada di [HANDOVER_RNI.md](HANDOVER_RNI.md).
- Panduan deployment rinci ada di [DEPLOYMENT.md](DEPLOYMENT.md).
