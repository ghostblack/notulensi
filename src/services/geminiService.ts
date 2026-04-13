
// import { GoogleGenAI } from "@google/genai"; // No longer used on client
import { fileToBase64 } from '@/utils/fileHelpers';
import { MeetingContext } from '@/types';

const PROXY_URL = "/.netlify/functions/gemini-proxy";
const MODEL_NAME = "gemini-2.5-flash"; // Switched to 2.5 Flash (Stable & Latest)
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

const callGeminiProxy = async (action: string, payload: any, maxRetries = 6, baseDelay = 4000): Promise<string> => {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    if (attempt > 0) {
      // Exponential backoff with some random jitter
      const delay = baseDelay * Math.pow(1.5, attempt - 1) + Math.random() * 1000;
      console.log(`[Gemini API] Server sibuk. Percobaan ulang (${attempt + 1}/${maxRetries}) setelah ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      await waitIfNeeded();
    }
    
    try {
      const response = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload })
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errMsg = `Gagal dengan status ${response.status}`;
        if (contentType && contentType.includes("application/json")) {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } else {
          const text = await response.text();
          errMsg = text || errMsg;
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server tidak mengembalikan format JSON yang valid.");
      }

      const data = await response.json();
      return data.text;
      
    } catch (error: any) {
      const errMsg = error.message.toLowerCase();
      // Retry if it's a known overload/rate limit issue or network error
      const shouldRetry = errMsg.includes("503") || errMsg.includes("429") || errMsg.includes("high demand") || errMsg.includes("temporarily overloaded") || errMsg.includes("fetch") || errMsg.includes("network");
      
      console.error(`[Gemini API] Error pada percobaan ${attempt + 1}: ${error.message}`);
      
      if (shouldRetry && attempt < maxRetries - 1) {
        attempt++;
      } else if (attempt < maxRetries - 1) {
        // Even for 500s or other errors, sometimes just retrying once or twice helps with transient function crashes
        attempt++;
      } else {
        throw new Error(`Sistem AI sedang sangat sibuk setelah ${maxRetries} percobaan. Silakan coba lagi nanti. Detail: ${error.message}`);
      }
    }
  }
  
  throw new Error("Terjadi kesalahan yang tidak terduga saat menghubungi AI.");
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
**Pukul** : ${context.startTime || '[JAM MULAI]'} WIB s.d. ${context.endTime || 'Selesai'}
**Tempat** : ${context.location || '[TEMPAT RAPAT]'}

**PESERTA RAPAT YANG HADIR BERDASARKAN YANG MENANDATANGANI DAFTAR HADIR**

${context.participants.split(/,|\n/).map((p, i) => `${i + 1}. ${p.trim()}`).join('\n')}

---

**AGENDA RAPAT:**
1. [ISI AGENDA BERDASARKAN TRANSKRIP]

---

**KESIMPULAN / HASIL RAPAT:**
* [RINGKASAN POIN-POIN PENTING HASIL RAPAT DI SINI]
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
    7. KESIMPULAN: WAJIB menyertakan bagian "KESIMPULAN / HASIL RAPAT" yang berisi poin-poin ringkasan hasil rapat sebelum bagian dokumentasi foto.
    
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
