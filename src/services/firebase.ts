import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  updateProfile,
  onAuthStateChanged,
  User
} from "firebase/auth";

import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  getDoc,
  getDocs,
  updateDoc, 
  arrayUnion,
  deleteDoc,
  setDoc,
  limit,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAcdJflbBZXgwIss1wkdzpslaO9D-DI2WY",
  authDomain: "notulensi-rapat-kpu.firebaseapp.com",
  projectId: "notulensi-rapat-kpu",
  storageBucket: "notulensi-rapat-kpu.firebasestorage.app",
  messagingSenderId: "572554244870",
  appId: "1:572554244870:web:55b2bc43b046d1826c6487",
  measurementId: "G-ER6WBTYVFT"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─────────────────────────────────────────────────────────────────
// AUTH FUNCTIONS — User / Admin
// ─────────────────────────────────────────────────────────────────

/** Cek apakah UID adalah admin */
export const checkIsAdmin = async (uid: string): Promise<boolean> => {
  try {
    const userEmail = auth.currentUser?.email;
    if (userEmail === "admin@sinegu.kpu" || userEmail === "admin") return true;
    
    const adminRef = doc(db, "admins", uid);
    const snap = await getDoc(adminRef);
    if (snap.exists()) return true;
    
    return userEmail === "admin@sinegu.kpu" || userEmail === "admin";
  } catch (error) {
    console.error("Error in checkIsAdmin:", error);
    return auth.currentUser?.email === "admin@sinegu.kpu" || auth.currentUser?.email === "admin";
  }
};

/** Login sebagai Admin (email/password Firebase) */
export const loginAsAdmin = async (emailInput: string, passwordInput: string) => {
  let email = emailInput.trim();
  let password = passwordInput;

  // HARDCODED BYPASS as requested
  // Convert 'admin' username to full email if needed
  if (email === 'admin' && password === 'kingmu') {
    email = "admin@sinegu.kpu";
  }

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const isAdmin = await checkIsAdmin(credential.user.uid);
    if (!isAdmin) {
      await logOut();
      throw new Error("Akun ini tidak memiliki hak akses admin.");
    }
    return credential.user;
  } catch (err: any) {
    // If it's the admin email and it doesn't exist, try to create it
    if (email === "admin@sinegu.kpu" && password === "kingmu" && 
       (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
      try {
        console.log("Auto-creating admin account...");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: 'Administrator SINEGU' });
        return cred.user;
      } catch (createErr: any) {
        throw createErr;
      }
    }
    throw err;
  }
};

/** Login sebagai Petugas (email/password Firebase) */
export const loginAsPetugas = async (email: string, password: string) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};

/**
 * Buat akun petugas baru. Karena Firebase Auth tidak bisa buat user lain
 * dari client tanpa sign-in, kita buat dengan secondary app instance.
 */
export const createPetugasAccount = async (
  email: string,
  password: string,
  displayName: string,
  signatureBase64: string | null = null
): Promise<{ uid: string; email: string; displayName: string }> => {
  // Create secondary app to avoid signing out current admin
  const { initializeApp: initSecondary, deleteApp } = await import("firebase/app");
  const { getAuth: getSecondaryAuth, createUserWithEmailAndPassword: createUser, updateProfile: updProfile, signOut: secSignOut } = await import("firebase/auth");
  
  const secondaryApp = initSecondary(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getSecondaryAuth(secondaryApp);

  try {
    const cred = await createUser(secondaryAuth, email, password);
    await updProfile(cred.user, { displayName });
    
    // Simpan ke Firestore collection 'users'
    await setDoc(doc(db, "users", cred.user.uid), {
      uid: cred.user.uid,
      email,
      displayName,
      role: "petugas",
      signatureBase64: signatureBase64 || null,
      createdAt: serverTimestamp(),
    });

    await secSignOut(secondaryAuth);
    return { uid: cred.user.uid, email, displayName };
  } finally {
    // Cleanup secondary app instance untuk mencegah memory leak
    try { await deleteApp(secondaryApp); } catch { /* abaikan error cleanup */ }
  }
};

/** Hapus akun petugas dari Firestore (tidak bisa hapus dari Auth di client) */
export const deletePetugasAccount = async (uid: string) => {
  await deleteDoc(doc(db, "users", uid));
};

/** Ambil semua akun petugas dari Firestore */
export const getAllUsers = async () => {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
};

/** Subscribe ke semua akun petugas */
export const subscribeToUsers = (callback: (data: any[]) => void) => {
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  return onSnapshot(q, 
    (snap) => callback(snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() }))),
    () => callback([])
  );
};

export const logOut = async () => {
  try { await signOut(auth); } catch (error) { console.error("Error signing out", error); }
};

export const saveUserSignature = async (uid: string, signatureBase64: string) => {
  try {
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, { signatureBase64 }, { merge: true });
  } catch (error) {
    console.error("Error saving user signature:", error);
    throw error;
  }
};

export const getUserSignature = async (uid: string): Promise<string | null> => {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (userSnap.exists() && userSnap.data().signatureBase64) {
      return userSnap.data().signatureBase64;
    }
    return null;
  } catch (error) {
    console.error("Error getting user signature:", error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────
// MEETING FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export const getMeeting = async (meetingId: string) => {
  try {
    const docRef = doc(db, "meetings", meetingId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
    return null;
  } catch (error) {
    console.error("Error getting meeting:", error);
    throw error;
  }
};


export const initializeMeeting = async (userId: string, title: string, participants: string, date: string, subBagian: string, location?: string, startTime?: string, endTime?: string) => {
  try {
    // Get user displayName from Firestore
    let userDisplayName = '';
    try {
      const userSnap = await getDoc(doc(db, "users", userId));
      if (userSnap.exists()) userDisplayName = (userSnap.data() as any).displayName || '';
    } catch {}
    
    const docRef = await addDoc(collection(db, "meetings"), {
      userId,
      userDisplayName,
      title: title || `Rapat ${new Date().toLocaleDateString('id-ID')}`,
      participants,
      date,
      subBagian,
      location: location || '',
      startTime: startTime || '',
      endTime: endTime || '',
      status: 'live',
      transcriptSegments: [], 
      content: '', 
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating meeting doc:", error);
    throw error;
  }
};

export const saveTranscriptChunk = async (meetingId: string, transcriptChunk: string) => {
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    await updateDoc(meetingRef, {
      transcriptSegments: arrayUnion(transcriptChunk),
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving transcript chunk:", error);
  }
};

/** Simpan draft notulensi (sebelum finalisasi foto) */
export const saveMeetingDraft = async (meetingId: string, content: string) => {
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    await updateDoc(meetingRef, {
      content,
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error("Error saving meeting draft:", error);
    throw error;
  }
};

export const finalizeMeeting = async (
  meetingId: string, 
  finalContent: string, 
  photoUrls?: string[],
  driveFileId?: string,
  driveWebViewLink?: string,
  subBagian?: string
) => {
  try {
    const meetingRef = doc(db, "meetings", meetingId);
    const updateData: any = {
      content: finalContent,
      status: 'completed',
      finishedAt: serverTimestamp()
    };
    if (photoUrls) updateData.photoUrls = photoUrls;
    if (driveFileId) updateData.driveFileId = driveFileId;
    if (driveWebViewLink) updateData.driveWebViewLink = driveWebViewLink;
    if (subBagian) updateData.subBagian = subBagian;
    await updateDoc(meetingRef, updateData);
  } catch (error) {
    console.error("Error finalizing meeting:", error);
    throw error;
  }
};

export const deleteMeeting = async (meetingId: string) => {
  try {
    await deleteDoc(doc(db, "meetings", meetingId));
  } catch (error) {
    console.error("Error deleting meeting:", error);
    throw error;
  }
};

export const subscribeToHistory = (userId: string, callback: (data: any[]) => void) => {
  // Query sederhana tanpa orderBy — menghindari keharusan composite index Firestore.
  // Sort dilakukan di client setelah data diterima.
  const q = query(collection(db, "meetings"), where("userId", "==", userId));
  return onSnapshot(q, 
    (snapshot) => {
      const meetings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data() as any).createdAt?.toDate() || new Date()
      }));
      meetings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      callback(meetings);
    },
    (error) => {
      console.warn("Error subscribing to history:", error);
      callback([]);
    }
  );
};

/** Subscribe to ALL meetings — admin only */
export const subscribeToAllMeetings = (callback: (data: any[]) => void) => {
  const q = query(collection(db, "meetings"), orderBy("createdAt", "desc"));
  return onSnapshot(q,
    (snap) => {
      const meetings = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: (d.data() as any).createdAt?.toDate() || new Date()
      }));
      callback(meetings);
    },
    () => callback([])
  );
};

// ─────────────────────────────────────────────────────────────────
// SUB-BAGIAN FUNCTIONS
// ─────────────────────────────────────────────────────────────────

const DEFAULT_SUB_BAGIANS = [
  { code: 'KUL', name: 'Keuangan & Logistik (KUL)' },
  { code: 'RENDATIN', name: 'Perencanaan & Data Informasi (RENDATIN)' },
  { code: 'SDMPARMAS', name: 'SDM & Partisipasi Masyarakat (SDMPARMAS)' },
  { code: 'HUKUMTEKNIS', name: 'Hukum & Teknis (HUKUMTEKNIS)' },
];

export const seedDefaultSubBagians = async () => {
  const snap = await getDocs(collection(db, "subBagians"));
  if (snap.size > 0) return; // Already seeded
  
  for (const sb of DEFAULT_SUB_BAGIANS) {
    await addDoc(collection(db, "subBagians"), {
      ...sb,
      createdAt: serverTimestamp(),
    });
  }
};

export const subscribeToSubBagians = (callback: (data: any[]) => void) => {
  return onSnapshot(collection(db, "subBagians"),
    (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() })) as any[];
      data.sort((a, b) => (a.code as string).localeCompare(b.code as string));
      callback(data);
    },
    () => callback([])
  );
};

/** Baca sub-bagian sekali saja — untuk form yang tidak butuh real-time */
export const getSubBagians = async (): Promise<any[]> => {
  try {
    const snap = await getDocs(collection(db, "subBagians"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() })) as any[];
    return data.sort((a, b) => (a.code as string).localeCompare(b.code as string));
  } catch { return []; }
};

export const addSubBagian = async (code: string, name: string) => {
  return addDoc(collection(db, "subBagians"), { code, name, createdAt: serverTimestamp() });
};

export const updateSubBagian = async (id: string, code: string, name: string) => {
  await updateDoc(doc(db, "subBagians", id), { code, name });
};

export const deleteSubBagian = async (id: string) => {
  await deleteDoc(doc(db, "subBagians", id));
};

// ─────────────────────────────────────────────────────────────────
// PARTICIPANTS FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export const subscribeToParticipants = (callback: (data: any[]) => void) => {
  return onSnapshot(collection(db, "participants"),
    (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() })) as any[];
      data.sort((a, b) => (a.name as string).localeCompare(b.name as string));
      callback(data);
    },
    () => callback([])
  );
};

/** Baca peserta sekali saja — untuk form yang tidak butuh real-time */
export const getParticipants = async (): Promise<any[]> => {
  try {
    const snap = await getDocs(collection(db, "participants"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() })) as any[];
    return data.sort((a, b) => (a.name as string).localeCompare(b.name as string));
  } catch { return []; }
};

export const addParticipant = async (name: string, jabatan: string) => {
  return addDoc(collection(db, "participants"), { name, jabatan, createdAt: serverTimestamp() });
};

export const updateParticipant = async (id: string, name: string, jabatan: string) => {
  await updateDoc(doc(db, "participants", id), { name, jabatan });
};

export const deleteParticipant = async (id: string) => {
  await deleteDoc(doc(db, "participants", id));
};

// ─────────────────────────────────────────────────────────────────
// MEETING CATEGORIES FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export const subscribeToCategories = (callback: (data: any[]) => void) => {
  return onSnapshot(collection(db, "meetingCategories"),
    (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() })) as any[];
      data.sort((a, b) => (a.name as string).localeCompare(b.name as string));
      callback(data);
    },
    () => callback([])
  );
};

/** Baca kategori rapat sekali saja — untuk form yang tidak butuh real-time */
export const getCategories = async (): Promise<any[]> => {
  try {
    const snap = await getDocs(collection(db, "meetingCategories"));
    const data = snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() || new Date() })) as any[];
    return data.sort((a, b) => (a.name as string).localeCompare(b.name as string));
  } catch { return []; }
};

export const addCategory = async (name: string, description: string, participants: any[]) => {
  return addDoc(collection(db, "meetingCategories"), {
    name,
    description,
    participants,
    createdAt: serverTimestamp(),
  });
};

export const updateCategory = async (id: string, name: string, description: string, participants: any[]) => {
  await updateDoc(doc(db, "meetingCategories", id), { name, description, participants });
};

export const deleteCategory = async (id: string) => {
  await deleteDoc(doc(db, "meetingCategories", id));
};

export { auth, db, onAuthStateChanged };
export type { User };