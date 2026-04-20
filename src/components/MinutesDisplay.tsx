
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, FileText, Maximize2, Minimize2, Loader2, ArrowLeft, Edit3, Save, X as CloseIcon, Cloud, ExternalLink, AlertCircle, Download } from 'lucide-react';
import { saveMeetingToDrive } from '../services/driveService';
import RichTextEditor from './RichTextEditor';

interface MinutesDisplayProps {
  content: string;
  documentationPhotos?: File[];
  photoUrls?: string[];
  onReset: () => void;
  onSave?: (newContent: string, photoUrls?: string[], driveFileId?: string, driveWebViewLink?: string) => Promise<void>;
  meetingTitle?: string;
  meetingDate?: string;
  meetingSubBagian?: string;
  userDisplayName?: string | null;
  userSignature?: string | null;
}

const MinutesDisplay: React.FC<MinutesDisplayProps> = ({ content, documentationPhotos, photoUrls: initialPhotoUrls, onReset, onSave, meetingTitle, meetingDate, meetingSubBagian, userDisplayName, userSignature }) => {
  const [copied, setCopied] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [photoBase64s, setPhotoBase64s] = useState<string[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  // Google Drive states
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  React.useEffect(() => {
    let finalContent = content;
    // Paksa pastikan ada placeholder supaya blok TTD dan Foto selalu dirender
    // meskipun untuk riwayat notulensi lama yang tadinya belum memiliki placeholder ini.
    if (!finalContent.includes('[DOKUMENTASI_FOTO_DI_SINI]')) {
      finalContent += '\n\n[DOKUMENTASI_FOTO_DI_SINI]';
    }
    setEditableContent(finalContent);
  }, [content]);

  const compressImageToBase64DataUri = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetAspectRatio = 4 / 3;
        const imgAspectRatio = img.width / img.height;
        
        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
        
        // Crop center to exactly 4:3
        if (imgAspectRatio > targetAspectRatio) {
           sWidth = img.height * targetAspectRatio;
           sx = (img.width - sWidth) / 2;
        } else {
           sHeight = img.width / targetAspectRatio;
           sy = (img.height - sHeight) / 2;
        }

        const maxDim = 800; // max output width
        let width = maxDim;
        let height = maxDim / targetAspectRatio;

        // Do not scale up small images
        if (sWidth < maxDim) {
           width = sWidth;
           height = sHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { URL.revokeObjectURL(objectUrl); reject('Canvas context failed'); return; }
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject('Load error'); };
    });
  };

  React.useEffect(() => {
    if (documentationPhotos && documentationPhotos.length > 0) {
      const urls = documentationPhotos.map(photo => URL.createObjectURL(photo));
      setPhotoUrls(urls);

      // Also convert to base64 for export (blob URLs won't work server-side or in DOCX)
      const convertToBase64 = async () => {
        const base64List: string[] = [];
        for (const photo of documentationPhotos) {
          try {
            const b64 = await compressImageToBase64DataUri(photo);
            base64List.push(b64);
          } catch {
            base64List.push('');
          }
        }
        setPhotoBase64s(base64List);
      };
      convertToBase64();

      return () => urls.forEach(url => URL.revokeObjectURL(url));
    } else if (initialPhotoUrls && initialPhotoUrls.length > 0) {
      console.log(`[Photos] Ditemukan ${initialPhotoUrls.length} Drive ID:`, initialPhotoUrls);
      // Gunakan uc?id= supaya gambar bereaksi normal kalau proxy lokal gagal
      const urls = initialPhotoUrls.map(id => `https://drive.google.com/uc?id=${id}`);
      setPhotoUrls(urls);

      // Fetch base64 via proxy untuk kebutuhan export PDF/DOCX (CORS bypass)
      // Gunakan loop berurutan agar localhost Netlify tidak timeout / ETIMEDOUT karena concurrent lambdas.
      const fetchBase64sFromDrive = async () => {
        setIsLoadingPhotos(true);
        console.log('[Photos] Mulai ambil dari Drive via proxy...');
        const base64List: string[] = [];
        
        for (const id of initialPhotoUrls) {
          try {
            const res = await fetch(`/.netlify/functions/proxy-photo?id=${id}`);
            if (!res.ok) {
              console.warn(`[Photos] Proxy gagal ${id}: HTTP ${res.status}`);
              continue; // Abaikan biar fetch lanjut ke gambar berikutnya
            }
            const data = await res.json();
            if (data.base64) {
              base64List.push(`data:image/jpeg;base64,${data.base64}`);
            }
          } catch (err) {
            console.error(`[Photos] Error ${id}:`, err);
          }
        }
        const filtered = base64List.filter(b => b.length > 0);
        console.log(`[Photos] Selesai: ${filtered.length}/${initialPhotoUrls.length} berhasil`);
        setPhotoBase64s(filtered);
        // Ganti URL thumbnail yang gagal (403 Forbidden) dengan Base64 bersih dari proxy
        if (filtered.length > 0) {
          setPhotoUrls(filtered);
        }
        setIsLoadingPhotos(false);
      };
      fetchBase64sFromDrive();
    } else {
      console.log('[Photos] Tidak ada Drive IDs. initialPhotoUrls =', initialPhotoUrls);
      setPhotoUrls([]);
      setPhotoBase64s([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentationPhotos, initialPhotoUrls]);

  const KPU_LOGO_URL = "https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309";
  const LOGO_CACHE_KEY = 'kpu_logo_b64';
  const LOGO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 hari dalam milidetik

  React.useEffect(() => {
    // Pre-load logo as Base64 — cek localStorage dulu sebelum ke CDN
    const loadLogo = async () => {
      try {
        // Coba ambil dari cache localStorage
        const cached = localStorage.getItem(LOGO_CACHE_KEY);
        const cachedAt = localStorage.getItem(`${LOGO_CACHE_KEY}_ts`);

        if (cached && cachedAt) {
          const age = Date.now() - parseInt(cachedAt, 10);
          if (age < LOGO_CACHE_TTL) {
            // Cache masih valid — pakai langsung, tidak perlu fetch!
            setLogoBase64(cached);
            return;
          }
        }

        // Cache tidak ada atau sudah kadaluarsa — fetch dari CDN
        const response = await fetch(KPU_LOGO_URL);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setLogoBase64(result);
          // Simpan ke localStorage beserta timestamp
          try {
            localStorage.setItem(LOGO_CACHE_KEY, result);
            localStorage.setItem(`${LOGO_CACHE_KEY}_ts`, Date.now().toString());
          } catch {
            // localStorage penuh — abaikan, tetap tampil dari memory
          }
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error("Failed to load logo as base64:", err);
      }
    };
    loadLogo();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 4);
    if (files.length === 0) return;

    const urls = files.map(file => URL.createObjectURL(file));
    setPhotoUrls(urls);

    const base64List: string[] = [];
    for (const file of files) {
      try {
        const b64 = await compressImageToBase64DataUri(file);
        base64List.push(b64);
      } catch (err) {
        console.error('Failed to compress manually uploaded photo:', err);
      }
    }
    setPhotoBase64s(base64List);
  };

  // Returns base64 string (no data URI prefix) for Drive upload
  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        
        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject('Canvas context failed');
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(objectUrl);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject('Load error');
      };
    });
  };

  // Helper: convert markdown to a clean HTML string for docx export
  // exportPhotoBase64s: base64 data URIs to embed as photos in docx (for local files)
  const markdownToHtml = async (markdown: string, exportPhotoBase64s: string[] = [], forPdf = false, sigBase64: string | null = null, sigName: string | null = null): Promise<string> => {
    // Wait for logo to be loaded; if not ready, use external URL as fallback
    const KPU_LOGO_DATA = logoBase64 || KPU_LOGO_URL;
    
    // Simple line-by-line markdown parser for docx
    const lines = markdown.split('\n');
    const htmlLines: string[] = [];
    // State untuk metadata table (Hari/Pukul/Tempat)
    let inMetaTable = false;
    const metaRows: string[] = [];
    const FONT = "'Bookman Old Style',Georgia,serif";

    // State untuk list
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let listCounter = 0;

    const closeMetaTable = () => {
      if (metaRows.length > 0) {
        htmlLines.push(`<table style="border-collapse:collapse;width:auto;margin-bottom:8pt;border:none;">`);
        htmlLines.push(...metaRows);
        htmlLines.push(`</table>`);
        metaRows.length = 0;
        inMetaTable = false;
      }
    };

    const closeList = () => {
      closeMetaTable();
      if (inList && listType) {
        htmlLines.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
        listCounter = 0;
      }
    };

    const inlineFormat = (text: string): string => {
      return text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // ── Metadata lines: **Label** : Value ──
      // Handle SATU BARIS dengan banyak field (Gemini kadang output semua di 1 baris)
      // Pattern: **Hari, tanggal** : Senin ... **Pukul** : 10.00 **Tempat** : Kantor...
      const allMetaOnLine = [...line.matchAll(/\*\*([^*]{1,35})\*\*\s*:\s*([^*]+?)(?=\s+\*\*[^*]{1,35}\*\*\s*:|$)/g)];
      if (allMetaOnLine.length > 0) {
        const firstLabel = allMetaOnLine[0][1].trim();
        const firstLabelWords = firstLabel.split(/\s+/).length;
        if (firstLabelWords <= 4) {
          closeList();
          for (const m of allMetaOnLine) {
            const label = m[1].trim();
            const value = m[2].trim();
            metaRows.push(
              `<tr style="line-height:1.5;">` +
              `<td style="font-family:${FONT};font-size:11pt;padding:0 0 1pt 0;vertical-align:top;white-space:nowrap;min-width:90pt;">${label}</td>` +
              `<td style="font-family:${FONT};font-size:11pt;padding:0 8pt 1pt 8pt;vertical-align:top;">:</td>` +
              `<td style="font-family:${FONT};font-size:11pt;padding:0 0 1pt 0;vertical-align:top;text-align:justify;">${inlineFormat(value)}</td>` +
              `</tr>`
            );
          }
          inMetaTable = true;
          continue;
        }
      }
      // Bukan meta — flush tabel jika ada
      closeMetaTable();


      // Logo image
      if (/^!\[Logo KPU\]/.test(line)) {
        closeList();
        let logoWidth = 65;
        let logoHeight = 75; // fallback
        try {
          const dim = await new Promise<{w: number, h: number}>((res) => {
            const img = new Image();
            img.onload = () => res({w: img.width, h: img.height});
            img.onerror = () => res({w: logoWidth, h: logoHeight});
            img.src = KPU_LOGO_DATA;
          });
          if (dim.w > 0) {
            logoHeight = Math.round((logoWidth * dim.h) / dim.w);
          }
        } catch(e) {}

        htmlLines.push(`<div style="text-align:center;margin-bottom:15pt;"><img src="${KPU_LOGO_DATA}" alt="Logo KPU" width="${logoWidth}" height="${logoHeight}" style="display:block;margin:0 auto;width:${logoWidth}px;height:${logoHeight}px;"/></div>`);
        continue;
      }

      // Generic image (skip blob: URLs in export — they don't survive DOCX conversion)
      const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
      if (imgMatch) {
        closeList();
        const imgSrc = imgMatch[2];
        let targetWidth = imgSrc.startsWith('data:') ? 450 : 400;
        let targetHeight = 300; // fallback

        try {
          const dim = await new Promise<{w: number, h: number}>((res) => {
            const img = new Image();
            img.onload = () => res({w: img.width, h: img.height});
            img.onerror = () => res({w: targetWidth, h: targetHeight});
            img.src = imgSrc;
          });
          if (dim.w > 0) {
            targetHeight = Math.round((targetWidth * dim.h) / dim.w);
          }
        } catch(e) {}
        
        if (imgSrc.startsWith('data:') || !imgSrc.startsWith('blob:')) {
          htmlLines.push(`<div style="text-align:center;margin-bottom:10pt;"><img src="${imgSrc}" alt="${imgMatch[1]}" width="${targetWidth}" height="${targetHeight}" style="display:block;margin:0 auto;width:${targetWidth}px;height:${targetHeight}px;"/></div>`);
        }
        continue;
      }

      // Headings
      if (/^# /.test(line))  { closeList(); htmlLines.push(`<h1 style="text-align:center;font-size:14pt;font-weight:bold;text-transform:uppercase;margin-top:2pt;margin-bottom:4pt;line-height:1.5;font-family:'Bookman Old Style',Georgia,serif;">${inlineFormat(line.replace(/^# /, ''))}</h1>`); continue; }
      if (/^## /.test(line)) { closeList(); htmlLines.push(`<h2 style="text-align:center;font-size:12pt;font-weight:bold;text-transform:uppercase;margin-top:2pt;margin-bottom:8pt;line-height:1.5;font-family:'Bookman Old Style',Georgia,serif;">${inlineFormat(line.replace(/^## /, ''))}</h2>`); continue; }
      if (/^### /.test(line)) { closeList(); htmlLines.push(`<h3 style="text-align:left;font-size:11pt;font-weight:bold;text-transform:uppercase;margin-top:10pt;margin-bottom:4pt;line-height:1.5;font-family:'Bookman Old Style',Georgia,serif;">${inlineFormat(line.replace(/^### /, ''))}</h3>`); continue; }

      // Horizontal rule
      if (/^---+$/.test(line.trim())) { closeList(); htmlLines.push('<hr/>'); continue; }

      // Photo placeholder - embed using base64 data URIs
      // Dan inject TTD Notulis sebelum dokumentasi foto
      if (/\[DOKUMENTASI_FOTO_DI_SINI\]/i.test(line)) {
        closeList();

        htmlLines.push(`
          <table style="width:100%; border-collapse:collapse; margin-top:30pt; margin-bottom: 20pt; border:none; page-break-inside:avoid;">
            <tr>
              <td style="width:60%; border:none;"></td>
              <td style="width:40%; text-align:center; font-family:'Bookman Old Style',Georgia,serif; font-size:11pt; border:none; line-height:1.5;">
                <p style="margin:0; font-weight:bold;">NOTULIS,</p>
                
                ${sigBase64 
                  ? `<img src="${sigBase64}" style="max-height: 80px; max-width: 150px; margin: 10px auto; display: block;" alt="TTD Notulis" />` 
                  : `<br/><br/><br/><br/>`
                }
                
                <p style="margin:0; font-weight:bold;">${sigName ? sigName.toUpperCase() : 'NOTULIS Rapat'}</p>
              </td>
            </tr>
          </table>
        `);

        const photos = exportPhotoBase64s.filter(b => b);
        if (photos.length > 0) {
          // Ukuran foto tetap: 16:9 landscape hp standar
          const IMG_W = 280;
          const IMG_H = 158; // 16:9 landscape
          htmlLines.push('<div style="margin-top:16pt; page-break-inside: avoid;"><h3 style="text-align:center;font-size:11pt;font-weight:bold;font-family:\'Bookman Old Style\',Georgia,serif;">DOKUMENTASI FOTO</h3>');
          htmlLines.push('<table style="width:100%; border-collapse: collapse; margin-top: 8pt; border: none;">');
          const maxPhotos = Math.min(photos.length, 4);
          for (let row = 0; row < Math.ceil(maxPhotos / 2); row++) {
            htmlLines.push('<tr>');
            for (let col = 0; col < 2; col++) {
              const p = row * 2 + col;
              if (p < maxPhotos) {
                htmlLines.push(`
                  <td style="width:50%; text-align:center; vertical-align:top; padding: 6pt; border: none;">
                    <img src="${photos[p]}" alt="Foto ${p+1}" width="${IMG_W}" height="${IMG_H}" style="display:block;margin:0 auto;width:${IMG_W}px;height:${IMG_H}px;object-fit:cover;border-radius:4px;"/>
                    <p style="text-align:center;font-size:9pt;margin-top:3pt;color:#1a1a1a;font-family:'Bookman Old Style',Georgia,serif;">Foto ${p+1}</p>
                  </td>
                `);
              } else {
                htmlLines.push('<td style="width:50%; padding: 6pt; border: none;"></td>');
              }
            }
            htmlLines.push('</tr>');
          }
          htmlLines.push('</table></div>');
        } else if (photoUrls.length > 0) {
          htmlLines.push('<div style="margin-top:16pt;border:1pt solid #ccc;padding:8pt;text-align:center;"><p style="font-size:10pt;color:#666;font-family:\'Bookman Old Style\',Georgia,serif;">Dokumentasi foto tersedia di folder Google Drive yang sama.</p></div>');
        }
        continue;
      }

      // Unordered list
      const ulMatch = line.match(/^\s*[-*+] (.+)/);
      if (ulMatch) {
        if (!inList || listType !== 'ul') { closeList(); htmlLines.push('<ul style="margin-top:2pt;margin-bottom:4pt; padding-left: 20pt;">'); inList = true; listType = 'ul'; }
        htmlLines.push(`<li style="text-align:justify; line-height:1.5; margin-bottom:2pt;">${inlineFormat(ulMatch[1])}</li>`);
        continue;
      }

      // Ordered list
      const olMatch = line.match(/^\s*\d+\.\s+(.+)/);
      if (olMatch) {
        if (!inList || listType !== 'ol') { closeList(); htmlLines.push('<ol style="margin-top:2pt;margin-bottom:4pt; padding-left: 20pt;">'); inList = true; listType = 'ol'; listCounter = 0; }
        listCounter++;
        htmlLines.push(`<li style="text-align:justify; line-height:1.5; margin-bottom:2pt;">${inlineFormat(olMatch[1])}</li>`);
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        closeList();
        htmlLines.push('<p style="margin:0;line-height:0.3em;">&nbsp;</p>');
        continue;
      }

      // Regular paragraph
      closeList();
      htmlLines.push(`<p style="text-align:justify;line-height:1.5;margin-top:0;margin-bottom:2pt;font-size:11pt;font-family:'Bookman Old Style',Georgia,serif;">${inlineFormat(line)}</p>`);
    }
    closeList();

    return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>
      @page { size: A4 portrait; margin: 2cm 2cm; }
      body { font-family: 'Bookman Old Style', Georgia, serif; font-size: 11pt; line-height: 1.5; margin: 0; padding: 0; box-sizing: border-box; color: #000; width: 100%; }
      h1,h2,h3 { color: #000; font-family: 'Bookman Old Style', Georgia, serif; margin: 0; }
      strong { font-weight: bold; }
      ul, ol { padding-left: 1.5em; font-size: 11pt; line-height: 1.5; margin: 2pt 0; }
      li { line-height: 1.5; margin-bottom: 2pt; }
      p { margin: 0 0 2pt 0; }
      img { max-width: 100%; }
      h1,h2,h3 { page-break-after: avoid; break-after: avoid; }
      p,li,tr,img { page-break-inside: avoid; break-inside: avoid; }
    </style></head><body>${htmlLines.join('\n')}</body></html>`;
  };

  const handleDownloadWord = async () => {
    if (!editableContent && !content) return;
    const currentContent = editableContent || content;

    try {
      const { asBlob } = await import('html-docx-js-typescript');
      const { saveAs } = await import('file-saver');

      const title = meetingTitle?.replace(/\s+/g, '_') || 'Notulen';
      // Pass the already-computed base64 photo data URIs so images embed correctly
      const htmlContent = await markdownToHtml(currentContent, photoBase64s, false, userSignature, userDisplayName);

      const blob = await asBlob(htmlContent, {
        orientation: 'portrait',
        margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }) as Blob;

      saveAs(blob, `${title}_${new Date().toISOString().split('T')[0]}.docx`);
    } catch (error) {
      console.error('Word Download failed:', error);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(editableContent);
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToDrive = async () => {
    const currentContent = editableContent || content;
    if (!currentContent) return;

    setIsSavingToDrive(true);
    setDriveError(null);
    setDriveLink(null);

    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const title = meetingTitle || (content.match(/^#\s+(.+)$/m)?.[1]) || 'Rapat Tanpa Judul';
      
      // Buat HTML bersih dari markdown
      const htmlContent = await markdownToHtml(currentContent, photoBase64s, false, userSignature, userDisplayName);

      // Convert HTML → PDF blob
      // windowWidth: 643px = usable content area A4 dengan margin 20mm tiap sisi
      // = (210mm - 40mm) / 25.4 * 96dpi = tepat 1:1 tanpa scaling error
      const pdfBlob = await html2pdf().set({
        margin: [20, 20, 20, 20], // mm — 2cm tiap sisi, konsisten dengan @page
        image: { type: 'jpeg', quality: 0.9 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 643 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['p', 'li', 'h1', 'h2', 'h3', 'img'] }
      }).from(htmlContent).output('blob');

      // Convert PDF blob → base64
      const base64File = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(pdfBlob);
      });
      
      // Upload sebagai PDF asli ke Drive (BUKAN Google Docs!)
      const result = await saveMeetingToDrive(title, base64File, meetingDate || '', meetingSubBagian || 'KUL', [], 'pdf');
      
      if (result.success && result.webViewLink) {
        setDriveLink(result.webViewLink);
        if (onSave && (result.photoIds || result.fileId)) {
          await onSave(currentContent, result.photoIds, result.fileId, result.webViewLink);
        }
      } else {
        setDriveError(result.error || 'Gagal menyimpan ke Drive');
      }
    } catch (error: any) {
      console.error('Drive Save Error:', error);
      setDriveError(error.message || 'Terjadi kesalahan saat memproses dokumen');
    } finally {
      setIsSavingToDrive(false);
    }
  };

  const handleDownloadPdf = async () => {
    const currentContent = editableContent || content;
    const htmlContent = await markdownToHtml(currentContent, photoBase64s, false, userSignature, userDisplayName);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Popup diblokir browser! Izinkan popup untuk situs ini agar bisa mengunduh PDF.');
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    // Tunggu gambar load, lalu otomatis buka dialog Print → Save as PDF
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 1500);
  };

  return (
    <div className={`w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${isFullWidth ? 'fixed inset-0 z-[60] bg-slate-100 p-4 sm:p-10 overflow-y-auto custom-scrollbar' : 'flex-1 h-full flex flex-col'}`}>
      {/* Action Toolbar */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-none p-3 mb-6 flex items-center justify-between gap-2 sm:gap-4 transition-all print:hidden ${isFullWidth ? 'max-w-5xl mx-auto sticky top-0 z-10' : ''}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onReset} className="p-2 text-slate-400 hover:text-[#431317] rounded-lg hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-5 h-5 sm:w-4 sm:h-4" />
          </button>
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs sm:text-sm">
            <FileText className="w-4 h-4 text-slate-400 hidden sm:block" />
            <span className="truncate max-w-[100px] sm:max-w-none uppercase tracking-wide">Pratinjau Dokumen</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2">
          {isEditing ? (
            <>
              <button 
                onClick={() => { setIsEditing(false); setEditableContent(content); }} 
                className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl sm:rounded-lg hover:bg-slate-50 transition-all active:scale-95"
              >
                <CloseIcon className="w-4 h-4" />
                <span className="hidden sm:inline">BATAL</span>
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-white bg-emerald-600 rounded-xl sm:rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all active:scale-95 shadow-none"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span className="hidden sm:inline">SIMPAN</span>
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => { setIsEditing(true); setIsFullWidth(true); }}
                className="flex items-center gap-1.5 px-3 h-10 sm:h-9 bg-slate-50 text-slate-600 rounded-xl sm:rounded-lg text-xs font-bold hover:bg-slate-100 transition-all border border-slate-200"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">EDIT</span>
              </button>

              <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl sm:rounded-lg hover:bg-slate-50 transition-all active:scale-95">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'TERSALIN' : 'COPY'}</span>
              </button>
              
              <button 
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl sm:rounded-lg hover:bg-red-100 transition-all active:scale-95 shadow-none"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button 
                onClick={handleDownloadWord}
                disabled={isLoadingPhotos}
                className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl sm:rounded-lg hover:bg-blue-100 transition-all active:scale-95 shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">WORD</span>
              </button>
              
              <button 
                onClick={handleSaveToDrive} 
                disabled={isSavingToDrive || isLoadingPhotos}
                className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl sm:rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-all active:scale-95 shadow-none disabled:cursor-not-allowed"
              >
                {isSavingToDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                <span className="hidden sm:inline">{isSavingToDrive ? 'PROSES...' : 'DRIVE'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Drive Status Info */}
      <div className={`transition-all duration-500 overflow-hidden ${driveLink || driveError ? 'max-h-32 mb-6' : 'max-h-0'}`}>
        <div className={`rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${driveLink ? 'bg-emerald-50 border border-emerald-100/50' : 'bg-red-50 border border-red-100/50'}`}>
          <div className="flex items-center gap-4">
             {driveLink ? (
               <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                 <Check className="w-5 h-5" />
               </div>
             ) : (
               <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                 <AlertCircle className="w-5 h-5" />
               </div>
             )}
             <div className="space-y-0.5">
               <p className={`text-sm font-black ${driveLink ? 'text-emerald-900' : 'text-red-900'} uppercase tracking-tight`}>
                 {driveLink ? 'Tersimpan di Google Drive' : 'Gagal Menyimpan'}
               </p>
               <p className={`text-[11px] font-medium ${driveLink ? 'text-emerald-600/80' : 'text-red-600/80'}`}>
                 {driveLink ? 'Notulensi berhasil diunggah sebagai file PDF ke Google Drive.' : driveError}
               </p>
             </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            {driveLink && (
              <a 
                href={driveLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-[11px] font-black rounded-xl hover:bg-emerald-700 transition-all uppercase tracking-wider shadow-sm active:scale-95"
              >
                <span>Buka Dokumen</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button 
              onClick={handleDownloadWord}
              disabled={isLoadingPhotos}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 text-[11px] font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-wider shadow-sm active:scale-95 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Unduh Word</span>
            </button>
            <button 
              onClick={handleDownloadPdf}
              disabled={isLoadingPhotos}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 text-[11px] font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-wider shadow-sm active:scale-95 border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-4 h-4 text-red-600" />
              <span>Unduh PDF</span>
            </button>
            <button 
              onClick={() => { setDriveLink(null); setDriveError(null); }} 
              className="p-2.5 hover:bg-black/5 rounded-xl transition-colors"
            >
              <CloseIcon className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Document View */}
      <div className={`flex justify-center ${isFullWidth ? 'max-w-5xl mx-auto pb-12' : 'flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-4'} ${isEditing ? '!max-w-full !mx-0 !pb-0 h-full' : ''} print:block print:max-w-none print:w-full print:mx-0 print:p-0 print:overflow-visible`}>
        <div 
          id="markdown-content"
          className={`bg-white shadow-xl w-full ${isEditing ? '!p-0 !shadow-none h-full flex flex-col' : 'p-[1.5cm] sm:p-[2.5cm] print:shadow-none print:p-0'}`}
          style={{ 
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            minHeight: isEditing ? 'auto' : '297mm',
            boxSizing: 'border-box',
          }}
        >
          {isEditing ? (
            <div className="w-full flex-1 min-h-0 bg-white">
              <RichTextEditor 
                content={editableContent} 
                onChange={setEditableContent} 
                placeholder="Edit notulensi di sini..."
              />
            </div>
          ) : (
            <div className="prose prose-sm sm:prose-base max-w-none text-black">
               <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                      h1: ({node, ...props}) => <h1 className="text-center font-bold uppercase text-base sm:text-lg mb-4 leading-tight page-break-avoid" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-center font-bold uppercase text-sm sm:text-base mb-2 leading-tight page-break-avoid" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-center font-bold uppercase text-xs sm:text-sm mb-6 leading-tight border-b border-slate-900 pb-4 page-break-avoid" {...props} />,
                      p: ({node, children, ...props}) => {
                        const childrenArray = React.Children.toArray(children);
                        const placeholderRegex = /\[DOKUMENTASI_FOTO_DI_SINI\]/i;
                        const isPlaceholder = childrenArray.some(
                          child => typeof child === 'string' && placeholderRegex.test(child)
                        );

                        if (isPlaceholder) {
                          const limitedPhotos = photoUrls.slice(0, 4);
                          // Foto benar-benar hilang HANYA jika: tidak ada Drive IDs dan tidak ada local URLs
                          const hasDriveIds = initialPhotoUrls && initialPhotoUrls.length > 0;
                          const hasLocalUrls = limitedPhotos.length > 0;
                          const isMissingPhotosForExport = !hasDriveIds && !hasLocalUrls;

                          return (
                            <div className="mt-8 pt-6 border-t border-slate-200 placeholder-container page-break-avoid" key="documentation-gallery">
                              {/* Inject TTD ke DOM secara langsung sebelum blok foto */}
                              <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '30px' }}>
                                <div style={{ width: '40%', textAlign: 'center', fontFamily: '"Bookman Old Style", Georgia, serif', fontSize: '11pt', lineHeight: 1.5 }}>
                                  <p style={{ margin: 0, fontWeight: 'bold' }}>NOTULIS,</p>
                                  {userSignature ? (
                                    <img src={userSignature} style={{ maxHeight: '80px', maxWidth: '150px', margin: '10px auto', display: 'block' }} alt="TTD Notulis" />
                                  ) : (
                                    <div style={{ height: '80px', margin: '10px auto' }}></div>
                                  )}
                                  <p style={{ margin: 0, fontWeight: 'bold' }}>{userDisplayName ? userDisplayName.toUpperCase() : 'NOTULIS RAPAT'}</p>
                                </div>
                              </div>

                              {/* Loading indicator — saat sedang tarik foto dari Drive */}
                              {isLoadingPhotos && (
                                <div className="flex items-center justify-center gap-3 p-5 bg-sky-50 border border-sky-200 rounded-xl mb-4 no-print">
                                  <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                                  <p className="text-sky-700 text-sm font-medium">Menarik foto dokumentasi dari Google Drive...</p>
                                </div>
                              )}
                              
                              {/* Inject UI — hanya muncul kalau memang tidak ada foto sama sekali */}
                              {isMissingPhotosForExport && !isLoadingPhotos && (
                               <div className="flex flex-col mb-6 items-center justify-center p-5 bg-amber-50 border border-amber-200 rounded-xl no-print">
                                  <p className="text-amber-900 text-[11pt] text-center mb-3 max-w-lg leading-relaxed">
                                    <strong>Dokumentasi Foto Kosong / Link Terputus.</strong><br/>
                                    Pastikan foto benar-benar terpilih sebelum menekan Lanjut saat upload. Silakan unggah ulang foto Anda di sini agar ikut tercetak di PDF.
                                  </p>
                                  <label className="cursor-pointer bg-amber-500 text-white text-[10pt] font-bold py-2.5 px-5 rounded-xl hover:bg-amber-600 transition shadow-sm">
                                    SUNTIKKAN ULANG FOTO (MAKS 4)
                                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleManualPhotoUpload} />
                                  </label>
                               </div>
                              )}
                              {hasLocalUrls && (
                                <div className="grid grid-cols-2 gap-6">
                                  {limitedPhotos.map((url, idx) => (
                                    <div 
                                      key={idx} 
                                      className="flex flex-col gap-3 photo-card" 
                                      style={{ 
                                        breakInside: 'avoid', 
                                        pageBreakInside: 'avoid',
                                        display: 'block', // Block display helps break-inside
                                        marginBottom: '2rem'
                                      }}
                                    >
                                      <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                                        <img 
                                          src={url} 
                                          alt={`Dokumentasi ${idx}`} 
                                          className="w-full h-full object-cover"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                      <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">Foto Dokumentasi {idx + 1}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        const hasImage = node?.children?.some((child: any) => child.tagName === 'img');
                        if (hasImage) {
                          return <div className="mb-4 sm:mb-6" {...props}>{children}</div>;
                        }
                        return <p className="text-justify leading-relaxed mb-3 sm:mb-4 text-[10pt] sm:text-[11pt]" {...props}>{children}</p>;
                      },
                      img: ({node, ...props}) => {
                        const isLogo = props.src === KPU_LOGO_URL || props.alt?.toLowerCase().includes('logo kpu');
                        if (isLogo) {
                          return (
                            <div className="w-full flex justify-center mt-2 mb-4">
                              <img 
                                className="kpu-logo-img block" 
                                style={{ width: '48px', height: '60px', objectFit: 'contain' }}
                                src={logoBase64 || KPU_LOGO_URL} 
                                alt="Logo KPU" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          );
                        }
                        return <img {...props} referrerPolicy="no-referrer" className="doc-img max-w-full h-auto rounded-lg my-4 mx-auto block" />;
                      },
                      ul: ({node, ...props}) => <ul className="list-disc pl-6 sm:pl-8 mb-4 text-[10pt] sm:text-[11pt]" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-6 sm:pl-8 mb-4 text-[10pt] sm:text-[11pt]" {...props} />,
                      li: ({node, ...props}) => <li className="mb-1" {...props} />
                  }}
               >
                  {editableContent}
               </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      <p className="text-center text-[9px] sm:text-[10px] text-slate-400 mt-8 mb-12 uppercase font-medium italic">Sistem Automasi Notulensi Berbasis Kecerdasan Buatan</p>

      {/* Hidden export div removed - export now uses markdownToHtml() directly */}
    </div>
  );
};

export default MinutesDisplay;
