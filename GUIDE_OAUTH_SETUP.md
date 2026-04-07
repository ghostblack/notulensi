# Tutorial: Mendapatkan OAuth 2.0 Credentials (Refresh Token)

Karena akun Google gratis tidak mengizinkan *Service Account* untuk mengisi kuota penyimpanan, kita harus menggunakan cara **OAuth 2.0**. Dengan cara ini, aplikasi akan menyimpan file atas nama Anda dan menggunakan kuota Drive Anda sendiri.

## Langkah 1: Buat OAuth Client ID di Google Cloud
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Pastikan project yang benar terpilih (Contoh: `turnkey-girder-...`).
3. Pergi ke **APIs & Services** > **OAuth consent screen**.
   - Pilih **External**.
   - Isi data yang diperlukan (App name, Email support, Developer email). Klik **Save and Continue** sampai selesai.
4. Pergi ke **APIs & Services** > **Credentials**.
5. Klik **+ CREATE CREDENTIALS** > **OAuth client ID**.
6. Pilih Application type: **Web application**.
7. Pada bagian **Authorized redirect URIs**, tambahkan:
   - `https://developers.google.com/oauthplayground`
8. Klik **Create**. Catat **Client ID** dan **Client Secret** Anda.

## Langkah 2: Dapatkan Refresh Token via OAuth Playground
1. Buka [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Klik ikon gir (⚙️) di pojok kanan atas.
3. Centang **Use your own OAuth credentials**.
4. Masukkan **OAuth Client ID** dan **OAuth Client Secret** yang Anda dapat tadi. Klik Close.
5. Di kolom kiri (Step 1), cari **Drive API v3**.
6. Pilih scope: `https://www.googleapis.com/auth/drive.file`.
7. Klik **Authorize APIs**. Login dengan akun Google Anda.
8. Klik **Exchange authorization code for tokens**.
9. Anda akan melihat **Refresh Token**. Catat kodenya.

## Langkah 3: Update file .env
Hapus config Service Account lama dan ganti dengan ini di file `.env` Anda:

```env
GOOGLE_CLIENT_ID=isi_dengan_client_id_anda
GOOGLE_CLIENT_SECRET=isi_dengan_client_secret_anda
GOOGLE_REFRESH_TOKEN=isi_dengan_refresh_token_anda
GOOGLE_DRIVE_PARENT_FOLDER_ID=isi_dengan_folder_id_yg_lama
```
