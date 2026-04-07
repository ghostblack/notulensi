# Panduan Setup Google Drive API

Ikuti langkah-langkah ini untuk mendapatkan kredensial yang diperlukan agar aplikasi bisa menyimpan notulensi ke Google Drive Anda secara otomatis.

## 1. Google Cloud Console
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat Project Baru (misal: "E-Notulen AI").
3. Di Menu Sidebar, cari **APIs & Services** > **Library**.
4. Cari **"Google Drive API"** dan klik **Enable**.

## 2. Membuat Service Account
1. Pergi ke **APIs & Services** > **Credentials**.
2. Klik **+ CREATE CREDENTIALS** > **Service account**.
3. Isi nama service account (misal: "drive-uploader"), klik **CREATE AND CONTINUE**.
4. Pilih role **Editor** (Opsional), lalu klik **DONE**.
5. Di daftar Service Accounts, klik email account yang baru dibuat.
6. Klik tab **KEYS** > **ADD KEY** > **Create new key**.
7. Pilih format **JSON**, lalu klik **CREATE**. File JSON akan terunduh otomatis.

## 3. Menyiapkan Folder Google Drive
1. Buka [Google Drive](https://drive.google.com/) Anda.
2. Buat folder baru (misal: "Arsip Notulen KPU").
3. Klik kanan folder tersebut > **Share**.
4. Masukkan email Service Account (yang ada di file JSON tadi, contoh: `drive-uploader@project-id.iam.gserviceaccount.com`).
5. Pastikan role-nya adalah **Editor**. Klik **Send**.
6. Ambil **Folder ID** dari URL browser Anda (angka unik setelah `folders/`). Simpan ID ini.

## 4. Konfigurasi Environment Variables
Buka file `.env` di project Anda dan tambahkan data berikut dari file JSON:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL="email-service-account-tadi"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_PARENT_FOLDER_ID="ID-Folder-Tadi"
```

> [!IMPORTANT]
> Pastikan Private Key dimasukkan dalam satu baris dengan karakter `\n` sebagai pengganti baris baru jika Anda memasukkannya langsung ke dashboard Netlify nanti.
