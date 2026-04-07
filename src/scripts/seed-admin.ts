
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// Config from your project
const firebaseConfig = {
  apiKey: "AIzaSyAcdJflbBZXgwIss1wkdzpslaO9D-DI2WY",
  authDomain: "notulensi-rapat-kpu.firebaseapp.com",
  projectId: "notulensi-rapat-kpu",
  storageBucket: "notulensi-rapat-kpu.firebasestorage.app",
  messagingSenderId: "572554244870",
  appId: "1:572554244870:web:55b2bc43b046d1826c6487",
  measurementId: "G-ER6WBTYVFT"
};

async function seedAdmin() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const EMAIL = "admin@sinegu.kpu";
  const PASSWORD = "kingmu";
  const NAME = "Administrator SINEGU";

  console.log(`\n🚀 Memulai pembuatan akun admin: ${EMAIL}...`);

  try {
    let user;
    try {
      // Coba bikin user baru
      const cred = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
      user = cred.user;
      await updateProfile(user, { displayName: NAME });
      console.log("✅ User Auth baru berhasil dibuat.");
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        try {
          // If already exists, we can't easily update password from client SDK without old password
          // So we warn the user to delete the user in Console or try to login.
          console.log("ℹ️ User Auth sudah tersedia. Mencoba login...");
          const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
          user = cred.user;
          await updateProfile(user, { displayName: NAME });
          console.log("✅ Login berhasil dan profil diperbarui.");
        } catch (authErr: any) {
          if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password') {
             console.error("\n❌ ERROR: Akun 'admin@sinegu.kpu' sudah ada tapi passwordnya BUKAN 'kingmu'.");
             console.error("💡 Solusi: Hapus user tersebut di Firebase Console -> Authentication, lalu jalankan script ini lagi.");
          } else {
             throw authErr;
          }
        }
      } else {
        throw e;
      }
    }

    if (user) {
      // Set record di Firestore 'admins'
      await setDoc(doc(db, "admins", user.uid), {
        uid: user.uid,
        email: EMAIL,
        displayName: NAME,
        role: "admin",
        createdAt: serverTimestamp()
      });
      
      console.log("\n✨ SUKSES!");
      console.log("-----------------------------------------");
      console.log(`Email      : ${EMAIL}`);
      console.log(`Password   : ${PASSWORD}`);
      console.log(`Halaman    : /admin`);
      console.log("-----------------------------------------");
    }
  } catch (error: any) {
    console.error("\n❌ GAGAL membuat admin:", error.message);
  } finally {
    process.exit(0);
  }
}

seedAdmin();
