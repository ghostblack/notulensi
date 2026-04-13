
import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import BottomNav from '@/components/BottomNav';
import AudioRecorder from '@/components/AudioRecorder';
import MinutesDisplay from '@/components/MinutesDisplay';
import SetupMeeting from '@/components/SetupMeeting';
import PhotoUpload from '@/components/PhotoUpload';
import Login from '@/components/Login';
import HistoryList from '@/components/HistoryList';
import ConfirmationModal from '@/components/ConfirmationModal';
import { AppStatus, MeetingHistoryItem, MeetingContext } from '@/types';
import { transcribeAudioChunk, generateFinalMinutesFromText, transcribeFullAudio } from '@/services/geminiService';
import { auth, logOut, subscribeToHistory, initializeMeeting, saveTranscriptChunk, saveMeetingDraft, finalizeMeeting, onAuthStateChanged, type User } from '@/services/firebase';
import { Loader2, Plus, AlertTriangle, Activity, FileCheck, Users, ArrowRight, CheckCircle2, MessageSquare, History as HistoryIcon, ClipboardList, Mic } from 'lucide-react';

const SESSION_KEY = 'pending_meeting_session_kpu';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [minutes, setMinutes] = useState<string | null>(null);
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalizationProgress, setFinalizationProgress] = useState(0);
  const [processStatus, setProcessStatus] = useState<string>(''); 
  const [meetingContext, setMeetingContext] = useState<MeetingContext | null>(null);
  const accumulatedTranscripts = useRef<string[]>([]);
  
  const [history, setHistory] = useState<MeetingHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'tab' | 'reset', value?: string } | null>(null);

  const processingQueue = useRef<Promise<void>>(Promise.resolve());
  const activeTasksCount = useRef(0);

  const isRecordingInProgress = status === AppStatus.RECORDING || status === AppStatus.PROCESSING_CHUNK;

  const isSessionActive = [
    AppStatus.SETUP,
    AppStatus.READY,
    AppStatus.RECORDING,
    AppStatus.PROCESSING_CHUNK,
    AppStatus.PROCESSING_FINAL,
    AppStatus.PROCESSING_EXTERNAL,
    AppStatus.PHOTO_UPLOAD
  ].includes(status);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRecordingInProgress) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isRecordingInProgress]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser as User | null);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = subscribeToHistory(user.uid, (data) => {
        // Auto-complete live sessions older than 1 hour
        const now = Date.now();
        const oneHour = 60 * 60 * 1000;
        
        // Use a loop so we can trigger finalizeMeeting for abandoned ones
        data.forEach(item => {
          if (item.status === 'live') {
            const age = now - (item.createdAt?.getTime() || 0);
            if (age > oneHour) {
              finalizeMeeting(item.id, item.content || '').catch(console.error);
            }
          }
        });

        setHistory(data);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const handleStartNew = () => {
    setStatus(AppStatus.SETUP);
    setActiveTab('start');
    setMeetingContext(null);
    setMinutes(null);
    setShowHistory(false);
    setError(null);
    accumulatedTranscripts.current = [];
    setFinalizationProgress(0);
  };

  const handleTabChange = (tabId: string) => {
    if (isRecordingInProgress && tabId !== activeTab) {
      setPendingAction({ type: 'tab', value: tabId });
      setIsConfirmModalOpen(true);
      return;
    }

    setActiveTab(tabId);
    if (tabId === 'start') {
      handleStartNew();
    } else if (tabId === 'dashboard') {
      handleReset();
    } else if (tabId === 'history' || tabId === 'list') {
      setActiveTab('list'); // Consolidate to gallery
      setStatus(AppStatus.IDLE);
      setShowHistory(true);
      setMinutes(null);
    }
  };

  const handleSetupComplete = async (data: MeetingContext) => {
    setMeetingContext(data);
    
    if (data.inputMode === 'live') {
      if (user) {
        try {
          const mId = await initializeMeeting(
            user.uid, 
            data.title, 
            data.participants, 
            data.date, 
            data.subBagian,
            data.location,
            data.startTime,
            data.endTime
          );
          setMeetingContext({ ...data, meetingId: mId });
          localStorage.setItem(SESSION_KEY, JSON.stringify({ meetingId: mId, title: data.title, subBagian: data.subBagian }));
        } catch (e) {}
      }
      setStatus(AppStatus.READY);
    } else {
      startExternalProcessing(data);
    }
  };

  const startExternalProcessing = async (data: MeetingContext) => {
    setStatus(AppStatus.PROCESSING_EXTERNAL);
    setProcessStatus(data.inputMode === 'upload' ? 'Menganalisis audio...' : 'Memproses transkrip...');
    setFinalizationProgress(15);
    setError(null);

    try {
      let transcript = "";
      if (data.inputMode === 'upload' && data.audioFile) {
        transcript = await transcribeFullAudio(data.audioFile, data);
      }

      if (!transcript) throw new Error("Tidak ada data pembicaraan yang ditemukan.");

      setFinalizationProgress(50);
      setProcessStatus("Menyusun Notulensi...");
      
      const finalResult = await generateFinalMinutesFromText(transcript, data);
      
      setMinutes(finalResult);
      if (user) {
        const mId = await initializeMeeting(
          user.uid, 
          data.title, 
          data.participants, 
          data.date, 
          data.subBagian,
          data.location,
          data.startTime,
          data.endTime
        );
        setCurrentMeetingId(mId);
        setMeetingContext({ ...data, meetingId: mId }); 
        
        // Save as draft immediately
        await saveMeetingDraft(mId, finalResult);
      }
      
      setFinalizationProgress(100);
      setStatus(AppStatus.PHOTO_UPLOAD); // Transition to photo upload
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat pemrosesan dokumen.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleChunkReady = async (blob: Blob) => {
    if (!meetingContext) return;
    setStatus(AppStatus.PROCESSING_CHUNK);
    setProcessStatus("Sinkronisasi suara..."); // Use a neutral message for ongoing chunks
    activeTasksCount.current++;
    
    const task = async () => {
      try {
        const text = await transcribeAudioChunk(blob, meetingContext, accumulatedTranscripts.current.length);
        if (text) {
          accumulatedTranscripts.current.push(text);
          if (meetingContext.meetingId) await saveTranscriptChunk(meetingContext.meetingId, text);
        }
      } catch (e) {} finally {
        activeTasksCount.current--;
        if (activeTasksCount.current === 0) setStatus(AppStatus.RECORDING);
      }
    };
    processingQueue.current = processingQueue.current.then(task);
  };

  const handleStopRecording = async () => {
    setStatus(AppStatus.PROCESSING_FINAL);
    setProcessStatus("Menyusun dokumen naratif...");
    setFinalizationProgress(30);
    await processingQueue.current;
    
    try {
      setFinalizationProgress(60);
      const full = accumulatedTranscripts.current.join("\n\n");
      
      let finalContext = { ...meetingContext! };
      // Auto-set end time if empty and it was a live session
      if (!finalContext.endTime) {
        finalContext.endTime = new Date().toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace('.', ':');
        setMeetingContext(finalContext);
      }

      const res = await generateFinalMinutesFromText(full, finalContext);
      setMinutes(res);
      if (meetingContext?.meetingId) {
        setCurrentMeetingId(meetingContext.meetingId);
        await saveMeetingDraft(meetingContext.meetingId, res);
      }
      setFinalizationProgress(100);
      setStatus(AppStatus.PHOTO_UPLOAD); // Transition to photo upload
    } catch (e: any) {
      setError(e.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const handlePhotosComplete = async (photos: File[]) => {
    if (!currentMeetingId || !minutes || !meetingContext) return;
    
    try {
      let finalMinutes = minutes;
      if (photos.length > 1 && !minutes.includes('[DOKUMENTASI_FOTO_DI_SINI]')) {
        finalMinutes = minutes + "\n\n[DOKUMENTASI_FOTO_DI_SINI]";
      }
      
      setMinutes(finalMinutes);
      setMeetingContext({ ...meetingContext, documentationPhotos: photos });
      await finalizeMeeting(currentMeetingId, finalMinutes);
      setStatus(AppStatus.COMPLETED);
    } catch (e: any) {
      setError(e.message);
      setStatus(AppStatus.ERROR);
    }
  };

  const handleRegenerate = async (item: MeetingHistoryItem) => {
    if (!item.transcriptSegments || item.transcriptSegments.length === 0) return;
    
    setStatus(AppStatus.PROCESSING_EXTERNAL);
    setProcessStatus("Menyusun Ulang...");
    setFinalizationProgress(20);
    setError(null);
    setShowHistory(false);

    try {
      const fullTranscript = item.transcriptSegments.join("\n\n");
      const context: MeetingContext = {
        title: item.title,
        date: item.date || item.createdAt.toISOString().split('T')[0],
        subBagian: item.subBagian || 'KUL', // Fallback for legacy
        participants: item.participants || "",
        inputMode: 'live',
        referenceFile: null
      };

      setFinalizationProgress(50);
      const res = await generateFinalMinutesFromText(fullTranscript, context);
      
      setMinutes(res);
      await finalizeMeeting(item.id, res);
      setCurrentMeetingId(item.id);
      
      setFinalizationProgress(100);
      setStatus(AppStatus.COMPLETED);
    } catch (e: any) {
      setError(e.message || "Gagal menyusun ulang dokumen.");
      setStatus(AppStatus.ERROR);
    }
  };

  const handleSaveMinutes = async (newContent: string, photoUrls?: string[], driveFileId?: string, driveWebViewLink?: string) => {
    setMinutes(newContent);
    if (currentMeetingId) {
      try {
        await finalizeMeeting(currentMeetingId, newContent, photoUrls, driveFileId, driveWebViewLink);
      } catch (e) {
        console.error("Gagal menyimpan perubahan ke database:", e);
      }
    }
  };

  const handleReset = () => {
    if (isRecordingInProgress) {
      setPendingAction({ type: 'reset' });
      setIsConfirmModalOpen(true);
      return;
    }

    setStatus(AppStatus.IDLE);
    setActiveTab('dashboard');
    setMinutes(null);
    setCurrentMeetingId(null);
    setShowHistory(true);
    setMeetingContext(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const handleConfirmAction = () => {
    setIsConfirmModalOpen(false);
    if (!pendingAction) return;

    if (pendingAction.type === 'tab' && pendingAction.value) {
      const tabId = pendingAction.value;
      setActiveTab(tabId);
      if (tabId === 'start') {
        handleStartNew();
      } else if (tabId === 'history' || tabId === 'list') {
        setActiveTab('list');
        setStatus(AppStatus.IDLE);
        setShowHistory(true);
        setMinutes(null);
      }
    } else if (pendingAction.type === 'reset') {
      setStatus(AppStatus.IDLE);
      setActiveTab('dashboard');
      setMinutes(null);
      setCurrentMeetingId(null);
      setShowHistory(true);
      setMeetingContext(null);
      localStorage.removeItem(SESSION_KEY);
    }
    setPendingAction(null);
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-slate-400 w-6 h-6" /></div>;
  if (!user) return <Login />;

  const isCompleted = status === AppStatus.COMPLETED;
  const stats = {
    total: history.length,
    completed: history.filter(h => h.status !== 'live').length,
    live: history.filter(h => h.status === 'live').length
  };

  return (
    <div className="min-h-screen flex bg-white">
      {!isSessionActive && <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />}
      
      <div className="flex-1 flex flex-col min-w-0 bg-[#F8F9FA]/50 h-screen overflow-hidden">
        <Header user={user} onLogout={logOut} />
        
        <main className={`flex-1 w-full px-4 sm:px-10 py-6 overflow-hidden flex flex-col`}>
          
          {status === AppStatus.IDLE && activeTab === 'dashboard' && (
            <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 pb-10 md:pb-0">
              {/* Dashboard Greeting */}
              <div className="space-y-1 shrink-0">
                <p className="text-sm font-medium text-slate-500">
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
                <h2 className="text-3xl font-extrabold text-[#111827] tracking-tight">
                  {new Date().getHours() < 11 ? 'Selamat Pagi' : new Date().getHours() < 15 ? 'Selamat Siang' : new Date().getHours() < 18 ? 'Selamat Sore' : 'Selamat Malam'}, {user.displayName?.split(' ')[0]}
                </h2>
                <p className="text-sm text-slate-500">
                  Mulai rapat kamu dan biarkan AI menyusun notulensi secara otomatis.
                </p>
              </div>

              {/* Top Row Cards - Optimized Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
                {/* Action Card - Prominent (col-span-2) */}
                <div className="md:col-span-2 bg-[#431317] rounded-3xl p-6 text-white relative overflow-hidden border border-[#431317] shadow-none flex flex-col justify-between min-h-[180px]">
                  <div className="relative z-10">
                     <div className="inline-flex items-center px-2.5 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-white/10 mb-3">
                       Fitur Utama
                     </div>
                     <h3 className="text-2xl font-extrabold tracking-tight mb-2">Buat Notulen</h3>
                     <p className="text-white/60 text-xs font-medium max-w-[280px] leading-relaxed">
                       Teknologi AI canggih untuk membantu menyusun notulensi secara otomatis dan presisi.
                     </p>
                  </div>
                  <div className="relative z-10 pt-4">
                    <button 
                      onClick={handleStartNew}
                      className="w-full sm:w-auto bg-white text-[#431317] py-3 rounded-2xl font-bold flex items-center justify-center gap-6 px-8 hover:bg-slate-50 transition-all border border-white active:scale-[0.98]"
                    >
                      <span className="text-sm">Mulai Rapat Baru</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Stats Card 1 */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-none flex flex-col justify-between shrink-0">
                  <div className="space-y-3">
                    <div className="p-2 bg-slate-50 w-fit rounded-xl border border-slate-100">
                       <FileCheck className="w-5 h-5 text-slate-400" />
                    </div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Semua Rapat</h3>
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{stats.total}</p>
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">
                       Aktivitas Total
                     </div>
                  </div>
                </div>

                {/* Stats Card 2 */}
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-none flex flex-col justify-between shrink-0">
                  <div className="space-y-3">
                    <div className="p-2 bg-slate-50 w-fit rounded-xl border border-slate-100">
                       <Activity className="w-5 h-5 text-slate-400" />
                    </div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notulensi Bulan Ini</h3>
                  </div>
                  <div className="mt-4 space-y-1">
                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{stats.completed}</p>
                    <div className="text-[10px] font-bold text-[#431317] uppercase">
                       Pembaruan Terkini
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Notulensi Terakhir - lg:col-span-12 (Full Width) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-[500px] md:min-h-0 shrink-0 md:shrink">
                <div className="lg:col-span-12 bg-white rounded-3xl border border-slate-200 shadow-none flex flex-col overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                        <HistoryIcon className="w-4 h-4 text-slate-400" />
                      </div>
                      <h3 className="font-bold text-slate-900 text-xs">Notulensi Terakhir</h3>
                    </div>
                    <button onClick={() => setActiveTab('list')} className="p-2 text-slate-400 hover:text-[#431317] transition-colors">
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-2 overflow-y-auto flex-1 custom-scrollbar">
                    <HistoryList 
                      history={history.slice(0, 5)} 
                      hideHeader={true}
                      onSelect={(item) => { 
                        setMinutes(item.content); 
                        setCurrentMeetingId(item.id);
                        const context: MeetingContext = {
                          title: item.title,
                          date: item.date,
                          subBagian: item.subBagian || 'KUL',
                          participants: item.participants || "",
                          location: (item as any).location || "",
                          startTime: (item as any).startTime || "",
                          endTime: (item as any).endTime || "",
                          inputMode: 'live',
                          referenceFile: null,
                          photoUrls: item.photoUrls,
                          meetingId: item.id
                        };
                        setMeetingContext(context);
                        
                        // Detect if it's a draft (live but has content)
                        if (item.status === 'live' && item.content) {
                          setStatus(AppStatus.PHOTO_UPLOAD);
                        } else {
                          setStatus(AppStatus.COMPLETED); 
                        }
                        setShowHistory(false); 
                      }} 
                      onRegenerate={handleRegenerate}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* History List was here, now redundant with MinutesGallery */}

          {status === AppStatus.IDLE && activeTab === 'list' && (
            <div className="h-full flex flex-col space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 overflow-hidden">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-2 sm:px-0">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-extrabold text-[#111827] tracking-tight">Daftar Notulen</h2>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Arsip dokumen notulensi yang telah difinalisasi</p>
                  </div>
               </div>
               
               <div className="flex-1 overflow-hidden flex flex-col">
                  <HistoryList 
                    history={history} 
                    onSelect={(item) => { 
                      setMinutes(item.content); 
                      setCurrentMeetingId(item.id);
                      setMeetingContext({
                        title: item.title,
                        date: item.date,
                        subBagian: item.subBagian || 'KUL',
                        participants: item.participants || "",
                        location: (item as any).location || "",
                        startTime: (item as any).startTime || "",
                        endTime: (item as any).endTime || "",
                        inputMode: 'live',
                        referenceFile: null,
                        photoUrls: item.photoUrls,
                        meetingId: item.id
                      });
                      
                      if (item.status === 'live' && item.content) {
                        setStatus(AppStatus.PHOTO_UPLOAD);
                      } else {
                        setStatus(AppStatus.COMPLETED); 
                      }
                      setShowHistory(false); 
                    }} 
                    onRegenerate={handleRegenerate}
                  />
               </div>
            </div>
          )}

          {status === AppStatus.SETUP && <SetupMeeting onNext={handleSetupComplete} onCancel={handleReset} />}

          {(status === AppStatus.READY || status === AppStatus.RECORDING || status === AppStatus.PROCESSING_CHUNK || status === AppStatus.PROCESSING_FINAL) && (
            <AudioRecorder status={status} progress={finalizationProgress} processingStatus={processStatus} onStartRecording={() => setStatus(AppStatus.RECORDING)} onStopRecording={handleStopRecording} onChunkReady={handleChunkReady} error={error} />
          )}

          {status === AppStatus.PROCESSING_EXTERNAL && (
            <div className="flex flex-col items-center justify-center py-20 gap-8 animate-in fade-in">
              <div className="relative">
                <div className="w-20 h-20 border-[3px] border-slate-200 border-t-[#431317] rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-900">{finalizationProgress}%</div>
              </div>
              <div className="text-center space-y-2 px-6">
                <h3 className="text-lg font-semibold text-slate-900">{processStatus}</h3>
                <p className="text-xs text-slate-500">AI sedang memproses data. Mohon tidak menutup halaman ini.</p>
              </div>
            </div>
          )}

          {status === AppStatus.PHOTO_UPLOAD && (
            <PhotoUpload 
              meetingTitle={meetingContext?.title} 
              onComplete={handlePhotosComplete} 
              onCancel={handleReset} 
            />
          )}

          {(isCompleted || (status === AppStatus.IDLE && minutes)) && minutes && (
            <div className="space-y-6">
              <MinutesDisplay 
                content={minutes} 
                documentationPhotos={meetingContext?.documentationPhotos}
                photoUrls={meetingContext?.photoUrls}
                onReset={handleReset} 
                onSave={handleSaveMinutes} 
                meetingTitle={meetingContext?.title}
                meetingDate={meetingContext?.date}
                meetingSubBagian={meetingContext?.subBagian}
              />
            </div>
          )}

          {status === AppStatus.ERROR && (
            <div className="p-8 bg-white rounded-xl border border-red-100 shadow-none text-center space-y-6 animate-in fade-in">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto border border-red-100">
                 <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="space-y-2 px-4">
                 <h3 className="font-semibold text-slate-900">Pemrosesan Gagal</h3>
                 <p className="text-red-600 text-xs font-medium">{error}</p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3 px-6">
                <button onClick={handleReset} className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-md border border-slate-200">Batal</button>
                <button onClick={() => meetingContext && startExternalProcessing(meetingContext)} className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-white bg-[#431317] hover:bg-[#5a1a1f] rounded-md border border-[#431317]">Coba Lagi</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {!isSessionActive && <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />}

      <ConfirmationModal 
        isOpen={isConfirmModalOpen}
        onClose={() => { setIsConfirmModalOpen(false); setPendingAction(null); }}
        onConfirm={handleConfirmAction}
        title="Batalkan Rekaman?"
        message="Rekaman sedang berlangsung. Jika Anda keluar sekarang, data rekaman saat ini tidak akan disimpan."
        confirmText="YA, BATALKAN"
        variant="danger"
      />
    </div>
  );
};

export default App;

