
// import { GoogleGenAI } from "@google/genai"; // No longer used on client
import { fileToBase64 } from '@/utils/fileHelpers';
import { MeetingContext } from '@/types';

const PROXY_URL = "/.netlify/functions/gemini-proxy";
const MODEL_NAME = "gemini-2.5-flash"; // Standard stable Free Tier model in 2026
const KPU_LOGO_URL = "https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309";

// Rate limiting state
let lastRequestTime = 0;
const MIN_DELAY_MS = 4000; // 4 seconds delay to stay safe under 15 RPM

const waitIfNeeded = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_DELAY_MS) {
    const delay = MIN_DELAY_MS - timeSinceLast;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();
};

const callGeminiProxy = async (action: string, payload: any): Promise<string> => {
  await waitIfNeeded();
  
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload })
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const errData = await response.json();
      throw new Error(errData.error || `Server error (${response.status})`);
    } else {
      const text = await response.text();
      throw new Error(text || `Request failed with status ${response.status}`);
    }
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Server did not return JSON. Check if Netlify Functions are running.");
  }

  const data = await response.json();
  return data.text;
};

export const analyzeDocumentStyle = async (file: File): Promise<string> => {
  try {
    const fileBase64 = await fileToBase64(file);
    const mimeType = file.type || (file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');

    const result = await callGeminiProxy("generateContent", {
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: fileBase64 } },
          { 
            text: `
              TUGAS: Buatlah "REPLIKA VISUAL MARKDOWN" dari dokumen ini untuk digunakan sebagai template.
              
              KEWAJIBAN MUTLAK:
              1. LOGO: Anda WAJIB menyertakan baris ini di baris paling atas: ![Logo KPU](${KPU_LOGO_URL})
              2. HEADER & FOOTER: Salin persis teks header (Lembaga, Alamat, dsb) secara verbatim.
              3. STRUKTUR KONTEN: Analisis bagaimana isi notulensi disusun (misal: penomoran, gaya paragraf, atau poin-poin). Gunakan placeholder [ISI NOTULENSI DI SINI] yang diletakkan di dalam struktur yang sesuai.
              4. GAYA BAHASA: Tiru gaya bahasa birokrasi KPU yang ada di dokumen.
              5. TANPA TABEL: DILARANG menggunakan tabel markdown. Gunakan paragraf naratif.
            `
          }
        ]
      }
    });

    return result;
  } catch (error: any) {
    throw new Error(error.message || "Gagal membaca file referensi.");
  }
};

export const transcribeFullAudio = async (audioFile: File, context: MeetingContext): Promise<string> => {
  const audioBase64 = await fileToBase64(audioFile);
  return await callGeminiProxy("generateContent", {
    model: MODEL_NAME,
    contents: {
      parts: [
        { inlineData: { mimeType: audioFile.type || 'audio/mpeg', data: audioBase64 } },
        { 
          text: `
            TUGAS: Transkripsikan audio ini secara lengkap.
            
            DAFTAR PEMBICARA RESMI:
            ${context.participants}
            
            INSTRUKSI:
            1. Identifikasi siapa yang sedang berbicara berdasarkan daftar pembicara di atas.
            2. Jika ada pembicara yang tidak terdaftar, tandai sebagai "Peserta Lain".
            3. Tuliskan transkrip secara verbatim dan akurat.
          `
        }
      ]
    }
  });
};

export const transcribeAudioChunk = async (audioBlob: Blob, context: MeetingContext, index: number): Promise<string> => {
  const audioBase64 = await fileToBase64(audioBlob);
  return await callGeminiProxy("generateContent", {
    model: MODEL_NAME,
    contents: {
      parts: [
        { inlineData: { mimeType: 'audio/webm', data: audioBase64 } },
        { 
          text: `
            TUGAS: Transkripsikan audio segmen ${index}.
            
            DAFTAR PEMBICARA RESMI:
            ${context.participants}
            
            INSTRUKSI:
            1. Gunakan daftar pembicara di atas untuk melabeli suara.
            2. Fokus pada akurasi teks segmen ini.
          `
        }
      ]
    }
  });
};

export const generateFinalMinutesFromText = async (fullTranscript: string, context: MeetingContext): Promise<string> => {
  const styleInstruction = context.styleGuide 
    ? `GUNAKAN RANGKA TEMPLATE INI (TERMASUK LOGO): \n${context.styleGuide}` 
    : `
![Logo KPU](${KPU_LOGO_URL})

# KOMISI PEMILIHAN UMUM
## KABUPATEN GUNUNGKIDUL
### NOTULEN RAPAT ${context.title.toUpperCase()}

---

**Hari, tanggal** : ${context.date}
**Pukul** : [WAKTU MULAI] WIB s.d. Selesai
**Tempat** : [TEMPAT RAPAT]

**PESERTA RAPAT YANG HADIR BERDASARKAN YANG MENANDATANGANI DAFTAR HADIR**

${context.participants.split(/,|\n/).map((p, i) => `${i + 1}. ${p.trim()}`).join('\n')}

---

**AGENDA RAPAT:**
1. [ISI AGENDA BERDASARKAN TRANSKRIP]
`;

  const photoPlaceholders = context.documentationPhotos 
    ? `\n\n# DOKUMENTASI ${context.title.toUpperCase()} ${context.date.toUpperCase()}\n\n[DOKUMENTASI_FOTO_DI_SINI]`
    : '';

  const prompt = `
    TUGAS UTAMA: Susun Notulensi Rapat KPU yang SANGAT DETAIL, KRONOLOGIS, dan BERBASIS ALUR PERCAKAPAN.
    
    KONTEKS:
    Judul: ${context.title} | Tanggal: ${context.date}
    Daftar Pembicara Resmi: ${context.participants}
    
    ATURAN FORMAT MUTLAK (WAJIB DIPATUHI):
    1. DILARANG KERAS MENGGUNAKAN TAG HTML APAPUN (seperti <p>, <div>, <br>, <img>, <b>, <i>, dll). Gunakan MURNI MARKDOWN.
    2. JANGAN PERNAH MENULISKAN TAG SEPERTI <P ALIGN="CENTER">. Gunakan simbol # untuk judul agar otomatis terpusat oleh sistem.
    3. GAYA PENULISAN: Gunakan format "**[NAMA]**, menyampaikan:" atau "**[NAMA]**, menanggapi:".
    4. STRUKTUR: Ikuti struktur dokumen dasar yang diberikan di bawah.
    5. LOGO: Baris pertama HARUS ![Logo KPU](${KPU_LOGO_URL}).
    6. DOKUMENTASI: Letakkan placeholder [DOKUMENTASI_FOTO_DI_SINI] di bagian paling akhir dokumen.
    
    DATA TRANSKRIP UNTUK DIPROSES:
    ${fullTranscript}
    
    STRUKTUR DOKUMEN DASAR:
    ${styleInstruction}
    ${photoPlaceholders}
  `;

  return await callGeminiProxy("generateContent", {
    model: MODEL_NAME,
    contents: { parts: [{ text: prompt }] }
  });
};
