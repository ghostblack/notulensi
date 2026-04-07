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
  base64Pdf: string, 
  date: string,
  subBagian: string,
  photos: PhotoUploadData[] = []
): Promise<SaveToDriveResponse> => {
  try {
    const response = await fetch('/.netlify/functions/save-to-drive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, base64Pdf, date, subBagian, photos }),
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
