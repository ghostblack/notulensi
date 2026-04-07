
export enum AppStatus {
  IDLE = 'IDLE',
  SETUP = 'SETUP',
  READY = 'READY',
  RECORDING = 'RECORDING',
  PROCESSING_CHUNK = 'PROCESSING_CHUNK',
  PROCESSING_EXTERNAL = 'PROCESSING_EXTERNAL', 
  PROCESSING_FINAL = 'PROCESSING_FINAL',
  PHOTO_UPLOAD = 'PHOTO_UPLOAD',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export type InputMode = 'live' | 'upload';

export interface MeetingContext {
  meetingId?: string;
  title: string;
  date: string;
  subBagian: string;
  participants: string;
  referenceFile: File | null;
  styleGuide?: string;
  inputMode: InputMode;
  audioFile?: File | null;
  documentationPhotos?: File[];
  photoUrls?: string[];
}

export interface MeetingHistoryItem {
  id: string;
  title: string;
  date: string;
  subBagian?: string;
  content: string;
  createdAt: Date;
  userId: string;
  userDisplayName?: string;
  transcriptSegments?: string[];
  status?: 'live' | 'completed';
  participants?: string;
  photoUrls?: string[];
  driveFileId?: string;
  driveWebViewLink?: string;
}

// ── Admin System Types ──────────────────────────────────────────

export interface SubBagian {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
}

export interface Participant {
  id: string;
  name: string;
  jabatan: string;
  createdAt: Date;
}

export interface MeetingCategory {
  id: string;
  name: string;
  subBagianId?: string;
  description?: string;
  participants: CategoryParticipantRef[];
  createdAt: Date;
}

export interface CategoryParticipantRef {
  participantId: string;
  name: string;
  jabatan: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Date;
  role: 'petugas' | 'admin';
}
