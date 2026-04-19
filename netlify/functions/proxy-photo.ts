import { Handler } from '@netlify/functions';
import { google } from 'googleapis';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const fileId = event.queryStringParameters?.id;
  if (!fileId) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing file ID' }) };
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Download file content dari Drive sebagai binary
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);
    const base64 = buffer.toString('base64');

    console.log(`[ProxyPhoto] Berhasil ambil file ${fileId}: ${(buffer.length / 1024).toFixed(0)}KB`);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ base64, mimeType: 'image/jpeg' }),
    };

  } catch (error: any) {
    console.error(`[ProxyPhoto] Error untuk file ${fileId}:`, error.message);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: error.message || 'Gagal mengambil foto dari Drive.' }),
    };
  }
};
