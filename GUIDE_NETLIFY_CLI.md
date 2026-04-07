# Panduan Setup Netlify CLI (Local Development)

Aplikasi ini menggunakan **Netlify Functions** sebagai backend (untuk Gemini AI dan Google Drive). Agar fitur-fitur tersebut berjalan di komputer lokal Anda, Anda perlu menjalankan aplikasi menggunakan **Netlify CLI**, bukan hanya `npm run dev`.

## 1. Install Netlify CLI
Buka terminal Anda dan jalankan perintah ini secara global:

```bash
npm install -g netlify-cli
```

## 2. Login ke Netlify (Opsional tapi Disarankan)
Jika Anda ingin menghubungkan ke project di dashboard Netlify:
```bash
netlify login
```

## 3. Jalankan Aplikasi Secara Lokal
Alih-alih menggunakan `npm run dev`, gunakan perintah ini untuk menjalankan frontend sekaligus backend-nya:

```bash
netlify dev
```

### Apa yang terjadi saat menjalankan `netlify dev`?
1.  **Server Frontend**: Akan berjalan di port `5173` (seperti biasa).
2.  **Server Functions**: Akan menyalakan fungsi backend di port `8888`.
3.  **Proxying**: Netlify CLI akan otomatis menghubungkan frontend Anda ke fungsi-fungsi tersebut tanpa error CORS atau JSON input.

## 4. Memastikan `.env` Terbaca
Pastikan file `.env` Anda berada di root folder (sama dengan lokasi `package.json`). `netlify dev` akan otomatis membaca file tersebut dan memberikannya ke fungsi backend.

## Troubleshooting
Jika Anda melihat error **"json on Response"**, itu biasanya tanda bahwa server fungsi backend belum menyala. Selalu pastikan Anda menjalankan perintah:
```bash
netlify dev
```
Bukan `npm run dev`.
