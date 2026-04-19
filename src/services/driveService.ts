interface SaveToDriveResponse {
  success: boolean;
  fileId?: string;
  webViewLink?: string;
  photoIds?: string[];
  error?: string;
}

export interface PhotoUploadData {
  name: string;
  base64: string;
}

export const saveMeetingToDrive = async (
  title: string, 
  base64File: string, 
  date: string,
  subBagian: string,
  photos: PhotoUploadData[] = [],
  fileType: 'pdf' | 'docx' = 'docx'
): Promise<SaveToDriveResponse> => {
  try {
    const response = await fetch('/.netlify/functions/save-to-drive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, base64File, date, subBagian, fileType }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to save to Drive');
    }

    return data;
  } catch (error: any) {
    console.error('Drive Service Error:', error);
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan saat menyimpan ke Drive',
    };
  }
};

/** Upload foto dokumentasi ke Drive — returns array of Drive file IDs */
export const uploadPhotosToDrive = async (
  photos: PhotoUploadData[],
  meetingTitle: string,
  date: string,
  subBagian: string
): Promise<{ success: boolean; photoIds?: string[]; error?: string }> => {
  try {
    const response = await fetch('/.netlify/functions/upload-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos, meetingTitle, date, subBagian }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Gagal upload foto');
    }

    return data;
  } catch (error: any) {
    console.error('Photo Upload Error:', error);
    return { success: false, error: error.message || 'Terjadi kesalahan saat upload foto.' };
  }
};
