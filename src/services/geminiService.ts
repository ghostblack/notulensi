
import { GoogleGenAI } from "@google/genai";
import { fileToBase64 } from '@/utils/fileHelpers';
import { MeetingContext } from '@/types';

// === CONFIG ===
const IS_DEV = import.meta.env.DEV;
const PROXY_URL = "/.netlify/functions/gemini-proxy";
const KPU_LOGO_URL = "https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309";

// Model fallback chain (USER PREFERENCE):
// gemini-3-flash-preview punya limit 1.500 RPD jadi diprioritaskan.
const MODEL_CHAIN = [
  "gemini-3-flash-preview",        // Prioritas Utama (Super Kuota 1.500/hari)
  "gemini-2.0-flash",              // Cadangan 1 (Kuota 1.500/hari)
  "gemini-2.5-flash",              // Cadangan Darurat Tertinggi (Cuma 20/hari)
];

const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY_4,
  import.meta.env.VITE_GEMINI_API_KEY_5
].filter(Boolean);

// State global untuk caching posisi Model dan Key yang masih hidup (hidupkan efisiensi!)
let activeModelIndex = 0;
let activeKeyIndex = 0;

// Helper function untuk mengambil instance GenAI sesuai key yang aktif saat ini
const getActiveGenAI = () => {
  const key = API_KEYS[activeKeyIndex % API_KEYS.length];
  return new GoogleGenAI({ apiKey: key });
};

// Pindah ke Key berikutnya secara berurutan
const nextApiKey = () => {
  activeKeyIndex = (activeKeyIndex + 1) % API_KEYS.length;
  console.log(`[Gemini] Menggeser ke API Key antrean: ${activeKeyIndex + 1}/${API_KEYS.length}...`);
};

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
  // Ambil API yang diyakini masih hidup di index ini
  const genAI = getActiveGenAI();
  console.log(`[Gemini] Memanggil model: ${modelName} dg API Key ke-${(activeKeyIndex % API_KEYS.length) + 1}`);

  const response = await genAI.models.generateContent({
    model: modelName,
    contents,
  });

  if (response.text) return response.text;
  if (response.candidates && response.candidates.length > 0) {
    const candidate = response.candidates[0];
    if (candidate.content && candidate.content.parts) {
      return candidate.content.parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join("");
    }
  }

  throw new Error("Model mengembalikan respons kosong.");
};

// === CORE: Smart generate with model fallback chain ===
export const callGemini = async (contents: any): Promise<string> => {
  const errors: string[] = [];

  // Pastikan contents diformat ke standard Array (Mencegah error 'Respons kosong' atau SDK reject)
  const formattedContents = Array.isArray(contents) ? contents : [contents];

  // Kita kasih kesempatan maksimum sebanyak N-Keys * M-Models percobaan
  const maxAttempts = API_KEYS.length * MODEL_CHAIN.length * 3; // Dikali 3 untuk kompensasi retry High Demand
  let totalAttempts = 0;
  let current503Retries = 0; // Tracking khusus kegagalan High Demand (503)

  while (totalAttempts < maxAttempts) {
    const modelName = MODEL_CHAIN[activeModelIndex % MODEL_CHAIN.length];
    
    try {
      await waitIfNeeded(); // Rate limit inter-request gap
      
      const result = await tryModel(modelName, formattedContents);
      current503Retries = 0; // Reset tracking kalau tembus sukses
      return result; // Sukses! Index ter-cache, siap untuk chunk selanjutnya.
      
    } catch (error: any) {
      const errMsg = error.message || "";
      const is503 = errMsg.includes("503") || errMsg.includes("unavailable") || errMsg.includes("overloaded");
      const is429 = errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("exhausted") || errMsg.includes("Too Many Requests");

      console.warn(`[Gemini] ❌ ${modelName} dg Key-${(activeKeyIndex % API_KEYS.length)+1} gagal: ${errMsg.substring(0, 80)}...`);
      errors.push(`${modelName}[Key-${(activeKeyIndex % API_KEYS.length)+1}]: ${errMsg}`);
      totalAttempts++;

      if (is503) {
        if (current503Retries < 3) {
          current503Retries++;
          console.log(`[Gemini] ⏳ Server High Demand (503). Percobaan ulang ke-${current503Retries}/3 tunggu 5 detik...`);
          await new Promise(resolve => setTimeout(resolve, 5000)); // Nunggu server reda
          continue; // Tetap stay di Model dan Key yang sama
        } else {
          console.log(`[Gemini] 🔄 Server model benar-benar mati (sudah dicoba 3x). Mengubah ke Model/Key Cadangan...`);
          current503Retries = 0;
          activeModelIndex = (activeModelIndex + 1) % MODEL_CHAIN.length;
          nextApiKey(); // Servernya ngaco, mending pindah server (key) sekalian
          continue;
        }
      }

      current503Retries = 0; // Kalo lolos dari 503 tapi kena error lain, reset meternya

      if (is429) {
        console.log(`[Gemini] ⚠️ Quota harian habis untuk Model ini di Key ini! Turun kasta ke Model Cadangan dulu...`);
        // USER REQUEST: Kalau limit habis, kita ganti MODEL-nya dulu, jangan ganti KEY-nya karena Key masih punya kuota untuk model lain!
        
        // Kita lompat ke model cadangan. Jika index kembali memutar ke 0 (habis semua model untuk key ini), barulah ganti Key!
        const previousModelIndex = activeModelIndex;
        activeModelIndex = (activeModelIndex + 1) % MODEL_CHAIN.length;
        
        if (activeModelIndex <= previousModelIndex) {
          // Artinya kita udah muterin semua model untuk Key ini tapi gagal semua. Barulah ganti Key!
          console.log(`[Gemini] 🔁 Semua model habis limit di Key ini. Mengubah API Key...`);
          nextApiKey(); 
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        continue;
      }
      
      // Jika error aneh (Misal bad request), ganti model & key sekalian biar fresh
      activeModelIndex = (activeModelIndex + 1) % MODEL_CHAIN.length;
      nextApiKey();
    }
  }

  // Jika kode sampai sini, artinya SELURUH Key dan SELURUH Model Cadangan benar-benar kehabisan peluru.
  throw new Error(`Semua Model AI dan Backup API Key Gagal Total. Tunggu besok atau gunakan key baru.\n${errors.join('\n')}`);
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
  const mimeType = getAudioMimeType(audioFile);
  const totalSize = audioFile.size;
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB per chunk

  console.log(`[Gemini] Transcribing audio: ${audioFile.name}, MIME: ${mimeType}, Size: ${(totalSize / 1024 / 1024).toFixed(1)}MB`);

  // Jika file kecil (<4MB), proses utuh secara langsung (paling rapi)
  if (totalSize <= CHUNK_SIZE) {
    const audioBase64 = await fileToBase64(audioFile);
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
            3. COCOKKAN suara pembicara aktif tersebut dengan "Daftar Pembicara Resmi" di atas. Gunakan logika bahasa dan konteks.
            4. Jika kamu yakin 100% suara itu milik siapa, sebutkan NAMA LENGKAPNYA sesuai daftar.
            5. Jika ada suara yang tidak bisa ditebak, beri label "Peserta Lain 1", "Peserta Lain 2", dst.
            6. JANGAN meringkas, tangkap setiap detil percakapan.
          `
        }
      ]
    });
  }

  // Jika file besar, potong dan proses SEOKUENSIAL agar bisa lempar konteks sebelumnya
  // Ini menghindari error 429 dan menjaga transkrip tetap sangat "RAPI" dan bersambung.
  console.log(`[Gemini] File besar. Memotong dan memproses berurutan agar rapi...`);
  const chunks: Blob[] = [];
  let offset = 0;
  while (offset < totalSize) {
    chunks.push(audioFile.slice(offset, offset + CHUNK_SIZE, mimeType));
    offset += CHUNK_SIZE;
  }

  let finalTranscript = "";
  let previousContext = "";

  for (let i = 0; i < chunks.length; i++) {
    console.log(`[Gemini] Memproses potongan ${i + 1}/${chunks.length}...`);
    const chunkBase64 = await fileToBase64(chunks[i]);
    
    // Kirim transkrip sebelumnya agar AI tahu siapa yang sedang bicara jika terpotong di tengah!
    const promptText = `
      TUGAS: Transkripsikan potongan audio rapat KPU ini (potongan ke-${i + 1} dari ${chunks.length}).
      
      DAFTAR PEMBICARA RESMI:
      ${context.participants}
      
      ${previousContext ? `KONTEKS SEBELUMNYA (KALIMAT TERAKHIR DARI POTONGAN SEBELUMNYA):
      "${previousContext}"
      
      INSTRUKSI KHUSUS SAMBUNGAN:
      Lanjutkan kalimat yang terpotong dari konteks di atas dengan nama pembicara yang tepat. Lanjutkan silsilah pembicara.` : ""}
      
      INSTRUKSI:
      1. Tulis verbatim. Buat baris baru bila ganti orang dengan format: [Nama Pembicara]: [Ucapan]
      2. Jangan menambahkan pembukaan basa-basi (seperti "Berikut adalah transkripsinya"). LANGSUNG ke percakapan!
    `;

    const chunkResult = await callGemini({
      parts: [
        { inlineData: { mimeType, data: chunkBase64 } },
        { text: promptText }
      ]
    });

    // Buang teks basa-basi dari Gemini kalau ada (biar rapi waktu disambung)
    const cleanResult = chunkResult.replace(/^(Berikut|Ini)( adalah)? (transkrip|potongan).*/im, "").trim();

    finalTranscript += (finalTranscript ? "\n\n" : "") + cleanResult;
    
    // Ambil 3-4 kalimat terakhir dari hasil ini untuk contekan potongan berikutnya
    const lines = cleanResult.split('\n').filter(l => l.trim().length > 0);
    previousContext = lines.slice(-4).join('\n');
  }

  return finalTranscript;
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
          TUGAS: Transkripsikan audio segmen berjalan (chunk ${index}).
          
          DAFTAR PEMBICARA RESMI:
          ${context.participants}
          
          INSTRUKSI:
          1. Gunakan daftar pembicara di atas untuk melabeli suara. Gunakan format "Nama Pembicara: Ucapan".
          2. Jika potongan ini memotong kalimat di tengah, tuliskan kata sebisa mungkin, abaikan konteks kalimat yang tidak utuh karena akan disambung dengan chunk sebelumnya.
          3. Jangan sampai ada yang diringkas. Tulis verbatim.
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
