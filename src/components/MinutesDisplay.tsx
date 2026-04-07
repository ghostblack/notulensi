
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Download, FileText, Maximize2, Minimize2, Loader2, ArrowLeft, Edit3, Save, X as CloseIcon, Cloud, ExternalLink, AlertCircle } from 'lucide-react';
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
}

const MinutesDisplay: React.FC<MinutesDisplayProps> = ({ content, documentationPhotos, photoUrls: initialPhotoUrls, onReset, onSave, meetingTitle, meetingDate, meetingSubBagian }) => {
  const [copied, setCopied] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editableContent, setEditableContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  
  // Google Drive states
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [driveError, setDriveError] = useState<string | null>(null);

  React.useEffect(() => {
    setEditableContent(content);
  }, [content]);

  React.useEffect(() => {
    if (documentationPhotos && documentationPhotos.length > 0) {
      const urls = documentationPhotos.map(photo => URL.createObjectURL(photo));
      setPhotoUrls(urls);
      return () => urls.forEach(url => URL.revokeObjectURL(url));
    } else if (initialPhotoUrls && initialPhotoUrls.length > 0) {
      // Construct direct embed URLs from Drive IDs
      const urls = initialPhotoUrls.map(id => `https://drive.google.com/thumbnail?id=${id}&sz=w1000`);
      setPhotoUrls(urls);
    } else {
      setPhotoUrls([]);
    }
  }, [documentationPhotos, initialPhotoUrls]);

  const KPU_LOGO_URL = "https://ik.imagekit.io/gambarid/file%20kpu/KPU_Logo.svg.png?updatedAt=1768041033309";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
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
          URL.revokeObjectURL(img.src);
          reject('Canvas context failed');
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(img.src);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject('Load error');
      };
    });
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('export-content');
    if (!element) return;

    setIsDownloadingPDF(true);
    try {
      const { toJpeg } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      // 1. Wait for images to load in the hidden renderer
      await new Promise(r => setTimeout(r, 200));

      // 2. Capture the element as a JPEG (high quality)
      const dataUrl = await toJpeg(element, {
        quality: 0.95, 
        pixelRatio: 2, 
        backgroundColor: '#ffffff',
        style: {
          padding: '0',
          margin: '0',
          width: '800px', 
        }
      });

      // 3. Create PDF (A4)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const imgWidth = img.width;
      const imgHeight = img.height;
      const pxPerMm = imgWidth / pdfWidth;
      const pxPageHeight = pdfHeight * pxPerMm;

      const scaleFix = imgWidth / 800; // Match the capture width scale
      const breakAvoidElements = Array.from(element.querySelectorAll('.photo-card, .kpu-logo-img, .placeholder-container, h1, h2, h3'));
      const elementPositions = breakAvoidElements.map(el => {
        const rect = el.getBoundingClientRect();
        const parentRect = element.getBoundingClientRect();
        return {
          top: (rect.top - parentRect.top) * scaleFix,
          bottom: (rect.bottom - parentRect.top) * scaleFix
        };
      });

      let sY = 0;
      while (sY < imgHeight) {
        if (sY > 0) pdf.addPage();
        
        let currentPagePxHeight = pxPageHeight;
        const pageBottom = sY + pxPageHeight;
        const splittingElement = elementPositions.find(pos => 
          pos.top < pageBottom && pos.bottom > pageBottom
        );

        if (splittingElement && sY < splittingElement.top) {
          currentPagePxHeight = splittingElement.top - sY;
        }

        const sHeight = Math.min(imgHeight - sY, currentPagePxHeight);
        const dHeight = sHeight / pxPerMm;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, sY, imgWidth, sHeight, 0, 0, imgWidth, sHeight);
          const pageDataUrl = pageCanvas.toDataURL('image/jpeg', 0.9);
          pdf.addImage(pageDataUrl, 'JPEG', 0, 0, pdfWidth, dHeight);
        }
        sY += sHeight;
      }

      const fileName = `${meetingTitle?.replace(/\s+/g, '_') || 'Notulen'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('PDF Download failed:', error);
    } finally {
      setIsDownloadingPDF(false);
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
    const element = document.getElementById('export-content');
    if (!element) return;

    setIsSavingToDrive(true);
    setDriveError(null);
    setDriveLink(null);

    try {
      const { toJpeg } = await import('html-to-image');
      const { jsPDF } = await import('jspdf');

      await new Promise(r => setTimeout(r, 200));

      const dataUrl = await toJpeg(element, {
        quality: 0.95, 
        pixelRatio: 2, 
        backgroundColor: '#ffffff',
        style: {
          padding: '0',
          margin: '0',
          width: '800px', 
        }
      });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const imgWidth = img.width;
      const imgHeight = img.height;
      const pxPerMm = imgWidth / pdfWidth;
      const pxPageHeight = pdfHeight * pxPerMm;

      const scaleFix = imgWidth / 800;
      const breakAvoidElements = Array.from(element.querySelectorAll('.photo-card, .kpu-logo-img, .placeholder-container, h1, h2, h3'));
      const elementPositions = breakAvoidElements.map(el => {
        const rect = el.getBoundingClientRect();
        const parentRect = element.getBoundingClientRect();
        return {
          top: (rect.top - parentRect.top) * scaleFix,
          bottom: (rect.bottom - parentRect.top) * scaleFix
        };
      });

      let sY = 0;
      while (sY < imgHeight) {
        let currentPagePxHeight = pxPageHeight;
        const pageBottom = sY + pxPageHeight;

        const splittingElement = elementPositions.find(pos => 
          pos.top < pageBottom && pos.bottom > pageBottom
        );

        if (splittingElement && sY < splittingElement.top) {
          currentPagePxHeight = splittingElement.top - sY;
        }

        const sHeight = Math.min(imgHeight - sY, currentPagePxHeight);
        const dHeight = sHeight / pxPerMm;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = imgWidth;
        pageCanvas.height = sHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, sY, imgWidth, sHeight, 0, 0, imgWidth, sHeight);
          const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(pageData, 'JPEG', 0, 0, pdfWidth, dHeight, undefined, 'FAST');
        }

        sY += sHeight;
        if (sY < imgHeight) {
          pdf.addPage();
        }
      }

      const base64Pdf = pdf.output('datauristring');
      
      const photoData = [];
      if (documentationPhotos) {
        for (const photo of documentationPhotos) {
          try {
            const base64 = await compressImage(photo);
            photoData.push({
              name: photo.name.replace(/\.[^/.]+$/, "") + ".jpg",
              base64: base64
            });
          } catch (err) {
            console.error("Gagal kompres foto:", photo.name, err);
            const base64 = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onloadend = () => res((reader.result as string).split(',')[1]);
              reader.readAsDataURL(photo);
            });
            photoData.push({ name: photo.name, base64 });
          }
        }
      }

      const title = meetingTitle || (content.match(/^#\s+(.+)$/m)?.[1]) || 'Rapat Tanpa Judul';
      const result = await saveMeetingToDrive(title, base64Pdf, meetingDate || '', meetingSubBagian || 'KUL', photoData);
      
      if (result.success && result.webViewLink) {
        setDriveLink(result.webViewLink);
        if (onSave && (result.photoIds || result.fileId)) {
          await onSave(editableContent, result.photoIds, result.fileId, result.webViewLink);
        }
      } else {
        setDriveError(result.error || 'Gagal menyimpan ke Drive');
      }
    } catch (error: any) {
      console.error('PDF Generation Error:', error);
      setDriveError(error.message || 'Terjadi kesalahan saat memproses PDF');
    } finally {
      setIsSavingToDrive(false);
    }
  };

  return (
    <div className={`w-full animate-in fade-in slide-in-from-bottom-4 duration-500 ${isFullWidth ? 'fixed inset-0 z-[60] bg-slate-100 p-4 sm:p-10 overflow-y-auto custom-scrollbar' : 'flex-1 h-full flex flex-col'}`}>
      {/* Action Toolbar */}
      <div className={`bg-white rounded-xl border border-slate-200 shadow-none p-3 mb-6 flex items-center justify-between gap-2 sm:gap-4 transition-all ${isFullWidth ? 'max-w-5xl mx-auto sticky top-0 z-10' : ''}`}>
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
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all border border-slate-200"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EDIT</span>
          </button>
              
              <button 
                onClick={() => setIsFullWidth(!isFullWidth)} 
                className="hidden sm:flex p-2 text-slate-400 hover:bg-slate-50 hover:text-[#431317] rounded-lg transition-colors border border-transparent hover:border-slate-100"
                title={isFullWidth ? "Perkecil" : "Perbesar"}
              >
                {isFullWidth ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              
              <button onClick={handleCopy} className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl sm:rounded-lg hover:bg-slate-50 transition-all active:scale-95">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <span className="sm:hidden text-xs">COPY</span>}
                <span className="hidden sm:inline">{copied ? 'TERSALIN' : 'COPY'}</span>
              </button>
              
              <button 
                onClick={handleSaveToDrive} 
                disabled={isSavingToDrive}
                className="inline-flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-bold text-emerald-600 bg-white border border-emerald-200 rounded-xl sm:rounded-lg hover:bg-emerald-50 disabled:opacity-50 transition-all active:scale-95 shadow-none"
              >
                {isSavingToDrive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                <span className="hidden sm:inline">{isSavingToDrive ? 'MENYIMPAN...' : 'SIMPAN KE DRIVE'}</span>
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
                 {driveLink ? 'Dokumen PDF dan foto Anda telah berhasil diunggah.' : driveError}
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
              onClick={handleDownloadPDF}
              disabled={isDownloadingPDF}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 text-[11px] font-black rounded-xl hover:bg-slate-200 transition-all uppercase tracking-wider shadow-sm disabled:opacity-50 active:scale-95"
            >
              {isDownloadingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span>{isDownloadingPDF ? 'Menyiapkan...' : 'Unduh PDF'}</span>
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
      <div className={`flex justify-center ${isFullWidth ? 'max-w-5xl mx-auto pb-12' : 'flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-4'} ${isEditing ? '!max-w-full !mx-0 !pb-0 h-full' : ''}`}>
        <div 
          id="markdown-content"
          className={`bg-white shadow-xl w-full ${isEditing ? '!p-0 !shadow-none h-full flex flex-col' : 'p-[1.5cm] sm:p-[2.5cm]'}`}
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
                          if (limitedPhotos.length === 0) return null;

                          return (
                            <div className="mt-8 pt-6 border-t border-slate-200 placeholder-container page-break-avoid" key="documentation-gallery">
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
                                src={KPU_LOGO_URL} 
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
                  {content}
               </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
      
      <p className="text-center text-[9px] sm:text-[10px] text-slate-400 mt-8 mb-12 uppercase font-medium italic">Sistem Automasi Notulensi Berbasis Kecerdasan Buatan</p>

      {/* 
          OFFICIAL EXPORT RENDERER (HIDDEN)
          This ensures that PDF and Word exports ALWAYS have the correct logo sizing 
          and layout, even if the user is currently the RichTextEditor.
      */}
      <div 
        id="export-content"
        className="fixed pointer-events-none bg-white opacity-100"
        style={{ width: '800px', left: '-1000px', top: 0, zIndex: -100 }}
      >
        <div className="bg-white p-[2.5cm] prose prose-base max-w-none text-black">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
                h1: ({node, ...props}) => <h1 className="text-center font-black uppercase text-lg mb-4 leading-tight page-break-avoid" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-center font-bold uppercase text-base mb-2 leading-tight page-break-avoid" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-center font-bold uppercase text-sm mb-6 leading-tight border-b border-slate-900 pb-4 page-break-avoid" {...props} />,
                p: ({node, children, ...props}) => {
                  const childrenArray = React.Children.toArray(children);
                  const placeholderRegex = /\[DOKUMENTASI_FOTO_DI_SINI\]/i;
                  const isPlaceholder = childrenArray.some(
                    child => typeof child === 'string' && placeholderRegex.test(child)
                  );

                  if (isPlaceholder) {
                    const limitedPhotos = photoUrls.slice(0, 4);
                    if (limitedPhotos.length === 0) return null;
                    return (
                      <div className="mt-8 pt-6 border-t border-slate-200 placeholder-container page-break-avoid" key="doc-gallery-export">
                        <div className="grid grid-cols-2 gap-6">
                          {limitedPhotos.map((url, idx) => (
                            <div key={idx} className="flex flex-col gap-3 photo-card">
                              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
                                <img src={url} alt={`Dokumentasi ${idx}`} className="w-full h-full object-cover" />
                              </div>
                              <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">Foto Dokumentasi {idx + 1}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return <p style={{ textAlign: 'justify', lineHeight: '1.6', marginBottom: '1rem', fontSize: '11pt' }} {...props}>{children}</p>;
                },
                img: ({node, ...props}) => {
                  const isLogo = props.src === KPU_LOGO_URL || props.alt?.toLowerCase().includes('logo kpu');
                  if (isLogo) {
                    return (
                      <div className="w-full flex justify-center mt-2 mb-4">
                        <img 
                          className="kpu-logo-img block" 
                          style={{ width: '48px', height: '60px', objectFit: 'contain' }}
                          src={KPU_LOGO_URL} 
                        />
                      </div>
                    );
                  }
                  return <img {...props} className="max-w-full h-auto rounded-lg my-4 mx-auto block" />;
                }
            }}
          >
            {editableContent}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default MinutesDisplay;
