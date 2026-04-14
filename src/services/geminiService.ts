
import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from '@/utils/fileHelpers';
import { MeetingContext } from '@/types';

// === CONFIG ===
const IS_DEV = import.meta.env.DEV;
const PROXY_URL = "/.netlify/functions/gemini-proxy";
const KPU_LOGO_URL = "https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309";

// Model fallback chain:
// Fix: 3-flash-preview sering 503 di jam sibuk untuk akun Sandbox. Kembali ke 2.5-flash.
const MODEL_CHAIN = [
  "gemini-2.5-flash",              // Prioritas Utama (Super Stabil, Server Besar)
  "gemini-3-flash-preview",        // Cadangan 1 (Pintar, tapi server sering full)
  "gemini-2.0-flash",              // Cadangan 2
];

// Direct SDK instance (hanya untuk dev mode)
let directAI: GoogleGenAI | null = null;
if (IS_DEV) {
  const devApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (devApiKey) {
    directAI = new GoogleGenAI({ apiKey: devApiKey });
    console.log("[Gemini] 🔧 DEV MODE: Menggunakan SDK langsung (bypass proxy)");
  } else {
    console.warn("[Gemini] ⚠️ VITE_GEMINI_API_KEY tidak ditemukan di .env, akan fallback ke proxy.");
  }
}

// Rate limiting state
let lastRequestTime = 0;
const MIN_DELAY_MS = 2000;

const waitIfNeeded = async () => {
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < MIN_DELAY_MS) {
    const delay = MIN_DELAY_MS - timeSinceLast;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  lastRequestTime = Date.now();
};

// Single attempt to call a specific model
const tryModel = async (modelName: string, contents: any): Promise<string> => {
  // ===== DEV MODE: Direct SDK call =====
  if (IS_DEV && directAI) {
    const result = await directAI.models.generateContent({
      model: modelName,
      contents,
    });
    const text = result.text;
    if (!text) throw new Error("Model mengembalikan respons kosong.");
    return text;
  }

  // ===== PRODUCTION: Via Netlify Proxy =====
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "generateContent",
      payload: { model: modelName, contents }
    })
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
  if (!data.text) throw new Error("Model mengembalikan respons kosong.");
  return data.text;
};

// === CORE: Smart generate with model fallback chain ===
const callGemini = async (contents: any, maxRetries = 2, baseDelay = 1500): Promise<string> => {
  const errors: string[] = [];

  // Try each model in the chain
  for (const modelName of MODEL_CHAIN) {
    console.log(`[Gemini] ▶ Mencoba model: ${modelName}...`);

    // Retry each model a few times before moving to next
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(1.5, attempt - 1) + Math.random() * 500;
        console.log(`[Gemini] ⏳ Retry ${attempt + 1}/${maxRetries} untuk ${modelName} setelah ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        await waitIfNeeded();
      }

      try {
        const result = await tryModel(modelName, contents);
        if (modelName !== MODEL_CHAIN[0]) {
          console.log(`[Gemini] ✅ Berhasil dengan model fallback: ${modelName}`);
        } else {
          console.log(`[Gemini] ✅ Berhasil dengan model: ${modelName}`);
        }
        return result;
      } catch (error: any) {
        const errMsg = error.message || "";
        const is503 = errMsg.includes("503") || errMsg.includes("overloaded") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE");
        const is429 = errMsg.includes("429");

        console.warn(`[Gemini] ❌ ${modelName} attempt ${attempt + 1}: ${errMsg}`);
        errors.push(`${modelName}[${attempt + 1}]: ${errMsg}`);

        // Jika 503/overloaded, langsung coba model berikutnya (bukan retry model yang sama)
        if (is503) {
          console.log(`[Gemini] 🔄 Model ${modelName} overloaded, switch ke model berikutnya...`);
          break; // keluar dari retry loop, lanjut ke model berikutnya
        }

        // Jika 429 rate limit, tunggu lebih lama lalu retry model yang sama
        if (is429 && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
      }
    }
  }

  // Semua model gagal
  throw new Error(`Semua model AI gagal. Silakan coba lagi nanti.\n${errors.join('\n')}`);
};

// === Helper: deteksi MIME type dari file secara robust ===
const getAudioMimeType = (file: File | Blob): string => {
  if (file.type && file.type.startsWith('audio/')) return file.type;

  if (file instanceof File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'm4a': 'audio/mp4',
      'mp4': 'audio/mp4',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'webm': 'audio/webm',
      'aac': 'audio/aac',
      'flac': 'audio/flac',
      'wma': 'audio/x-ms-wma',
    };
    if (ext && mimeMap[ext]) return mimeMap[ext];
  }

  return 'audio/mpeg';
};

// === API: Analyze Document Style ===
export const analyzeDocumentStyle = async (file: File): Promise<string> => {
  try {
    const fileBase64 = await fileToBase64(file);
    const mimeType = file.type || (file.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/pdf');

    return await callGemini({
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
    });
  } catch (error: any) {
    throw new Error(error.message || "Gagal membaca file referensi.");
  }
};

// === API: Transcribe Full Audio ===
export const transcribeFullAudio = async (audioFile: File, context: MeetingContext): Promise<string> => {
  const audioBase64 = await fileToBase64(audioFile);
  const mimeType = getAudioMimeType(audioFile);
  console.log(`[Gemini] Transcribing audio: ${audioFile.name}, MIME: ${mimeType}, Size: ${(audioFile.size / 1024 / 1024).toFixed(1)}MB`);

  return await callGemini({
    parts: [
      { inlineData: { mimeType, data: audioBase64 } },
      {
        text: `
          TUGAS SISTEM UTAMA: Anda adalah asisten transkripsi profesional KPU. Transkripsikan file audio ini secara verbatim dan sangat akurat.
          
          DAFTAR PEMBICARA RESMI DALAM RAPAT INI:
          ${context.participants}
          
          INSTRUKSI SANGAT PENTING (SPEAKER DIARIZATION):
          1. DENGARKAN DENGAN SEKSAMA perbedaan setiap suara (pria/wanita, aksen, intonasi).
          2. Setiap kali ada pergantian pembicara, WAJIB buat baris baru dengan format:
             [Nama Pembicara]: [Apa yang diucapkan...]
          3. COCOKKAN suara pembicara aktif tersebut dengan "Daftar Pembicara Resmi" di atas. Gunakan logika bahasa dan konteks (misal jika ada yang menyapa "Pak Ketua", tebak siapa ketua dari daftar).
          4. Jika kamu yakin 100% suara itu milik siapa, sebutkan NAMA LENGKAPNYA sesuai daftar.
          5. Jika ada suara yang sama sekali tidak ada di daftar atau tidak bisa ditebak, beri label "Peserta Lain 1", "Peserta Lain 2", dst.
          6. JANGAN meringkas, tangkap setiap detil percakapan.
        `
      }
    ]
  });
};

// === API: Transcribe Audio Chunk ===
export const transcribeAudioChunk = async (audioBlob: Blob, context: MeetingContext, index: number): Promise<string> => {
  const audioBase64 = await fileToBase64(audioBlob);
  const mimeType = getAudioMimeType(audioBlob);

  return await callGemini({
    parts: [
      { inlineData: { mimeType, data: audioBase64 } },
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
  });
};

// === API: Generate Final Minutes ===
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

  return await callGemini({
    parts: [{ text: prompt }]
  });
};
