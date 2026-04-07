import { Handler } from '@netlify/functions';
import { google } from 'googleapis';
import { Readable } from 'stream';

export const handler: Handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { title, base64Pdf, date, subBagian } = JSON.parse(event.body || '{}');

    if (!title || !base64Pdf) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing title or PDF data' }),
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

    // 3. Navigate/Create Folder Structure
    // Root -> Sub-bagian -> Year -> Month -> Day -> Meeting Title
    let currentParentId = rootFolderId;

    // 3a. Sub-bagian (KUL, RENDATIN, etc.)
    const deptFolder = subBagian || 'KUL';
    currentParentId = await findOrCreateFolder(deptFolder, currentParentId);

    // 3b. Year
    currentParentId = await findOrCreateFolder(year, currentParentId);

    // 3c. Month
    currentParentId = await findOrCreateFolder(month, currentParentId);

    // 3d. Day
    currentParentId = await findOrCreateFolder(day, currentParentId);

    // 3e. Final Meeting Folder (Title)
    const finalFolderId = await findOrCreateFolder(title, currentParentId);

    // 4. Convert Base64 to Buffer
    const pdfBuffer = Buffer.from(base64Pdf.split(',')[1] || base64Pdf, 'base64');

    // 5. Create the PDF File in the final folder
    const fileMetadata = {
      name: `Notulensi - ${title}.pdf`,
      mimeType: 'application/pdf',
      parents: [finalFolderId],
    };

    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer),
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    // 6. Upload Photos if provided
    const { photos = [] } = JSON.parse(event.body || '{}');
    const photoLinks: string[] = [];

    for (const photo of photos) {
      const photoBuffer = Buffer.from(photo.base64.split(',')[1] || photo.base64, 'base64');
      const photoMetadata = {
        name: photo.name,
        mimeType: 'image/jpeg',
        parents: [finalFolderId],
      };
      const photoMedia = {
        mimeType: 'image/jpeg',
        body: Readable.from(photoBuffer),
      };

      const photoFile = await drive.files.create({
        requestBody: photoMetadata,
        media: photoMedia,
        fields: 'id, webViewLink, thumbnailLink',
      });

      // 7. Make the photo publicly viewable (so it can be embedded in the app)
      await drive.permissions.create({
        fileId: photoFile.data.id!,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      photoLinks.push(photoFile.data.id!);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        fileId: file.data.id,
        webViewLink: file.data.webViewLink,
        photoIds: photoLinks,
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
