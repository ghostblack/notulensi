import { Handler } from '@netlify/functions';
import { google } from 'googleapis';
import { Readable } from 'stream';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { photos, meetingTitle, date, subBagian } = JSON.parse(event.body || '{}');

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Tidak ada foto yang dikirim.' }) };
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const rootFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    if (!rootFolderId) throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID belum dikonfigurasi.');

    // Helper: cari atau buat folder
    const findOrCreateFolder = async (name: string, parentId: string): Promise<string> => {
      const safeName = name.replace(/[<>:"/\\|?*]/g, '').substring(0, 80);
      const search = await drive.files.list({
        q: `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (search.data.files && search.data.files.length > 0) {
        return search.data.files[0].id!;
      }

      const created = await drive.files.create({
        requestBody: { name: safeName, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
        fields: 'id',
      });
      return created.data.id!;
    };

    // Struktur folder: Root → SubBagian → Dokumentasi → [JudulRapat - YYYY-MM-DD]
    const meetingDate = date ? new Date(date) : new Date();
    const dateStr = meetingDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const safeTitle = (meetingTitle || 'Rapat').replace(/[<>:"/\\|?*]/g, '').substring(0, 50).trim();
    const folderName = `${safeTitle} - ${dateStr}`;

    let parentId = rootFolderId;
    parentId = await findOrCreateFolder(subBagian || 'KUL', parentId);
    parentId = await findOrCreateFolder('Dokumentasi', parentId);
    parentId = await findOrCreateFolder(folderName, parentId);

    // Upload semua foto PARALEL — lebih cepat dari sequential, hindari timeout 10s Netlify
    const photoIds = await Promise.all(
      photos.map(async ({ name, base64 }, i) => {
        const buffer = Buffer.from(base64, 'base64');

        const file = await drive.files.create({
          requestBody: { name: name || `Foto_${i + 1}.jpg`, parents: [parentId] },
          media: { mimeType: 'image/jpeg', body: Readable.from(buffer) },
          fields: 'id',
        });

        // Set publicly readable agar thumbnail URL bisa diakses browser tanpa login
        await drive.permissions.create({
          fileId: file.data.id!,
          requestBody: { role: 'reader', type: 'anyone' },
        });

        console.log(`[Photos] Upload foto ${i + 1}/${photos.length}: ${file.data.id}`);
        return file.data.id!;
      })
    );

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true, photoIds }),
    };
  } catch (error: any) {
    console.error('[Photos] Error:', error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || 'Gagal mengupload foto ke Drive.' }),
    };
  }
};
