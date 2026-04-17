import { Handler } from '@netlify/functions';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { title, base64File, base64Pdf, date, subBagian, fileType = 'docx' } = JSON.parse(event.body || '{}');

    // Support legacy base64Pdf for backward compatibility
    const fileContent = base64File || base64Pdf;

    if (!title || !fileContent) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing title or file data' }),
      };
    }

    // 1. Setup Auth (OAuth 2.0)
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const rootFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

    if (!rootFolderId) {
      throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID is not configured');
    }

    // Helper function to find or create a folder
    const findOrCreateFolder = async (name: string, parentId: string) => {
      const search = await drive.files.list({
        q: `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (search.data.files && search.data.files.length > 0) {
        return search.data.files[0].id!;
      } else {
        const metadata = {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parentId],
        };
        const created = await drive.files.create({
          requestBody: metadata,
          fields: 'id',
        });
        return created.data.id!;
      }
    };

    // 2. Parse Date parts
    const meetingDate = date ? new Date(date) : new Date();
    const year = meetingDate.getFullYear().toString();
    const month = (meetingDate.getMonth() + 1).toString().padStart(2, '0');
    const day = meetingDate.getDate().toString().padStart(2, '0');
    const dateFolderName = `${year}-${month}-${day}`;

    // 3. Navigate/Create Folder Structure
    // Root -> Sub-bagian -> YYYY-MM-DD
    let currentParentId = rootFolderId;

    // 3a. Sub-bagian (KUL, RENDATIN, etc.)
    const deptFolder = subBagian || 'KUL';
    currentParentId = await findOrCreateFolder(deptFolder, currentParentId);

    // 3b. Final Date Folder (YYYY-MM-DD)
    const finalFolderId = await findOrCreateFolder(dateFolderName, currentParentId);

    // 4. Convert Base64 to Buffer
    const buffer = Buffer.from(fileContent.split(',')[1] || fileContent, 'base64');

    // 5. Create the File as NATIVE format (TANPA konversi ke Google Docs/Sheets!)
    // Ini memastikan file tetap dalam format aslinya (DOCX/PDF) sehingga bisa di-download langsung.
    const isDocx = fileType === 'docx';
    
    const uploadMimeType = isDocx 
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      : 'application/pdf';

    const fileMetadata = {
      name: `Notulensi - ${title}${isDocx ? '.docx' : '.pdf'}`,
      // TIDAK menggunakan Google Docs mimeType agar file TIDAK dikonversi
      parents: [finalFolderId],
    };

    const media = {
      mimeType: uploadMimeType,
      body: Readable.from(buffer),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        fileId: file.data.id,
        webViewLink: file.data.webViewLink,
        photoIds: [],
      }),
    };
  } catch (error: any) {
    console.error('Error saving to Drive:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
