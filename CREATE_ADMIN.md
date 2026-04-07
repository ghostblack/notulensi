/**
 * This script runs in the browser console to create the first admin account.
 * 
 * HOW TO USE:
 * 1. Open the app in the browser
 * 2. Open browser console (F12)
 * 3. Paste and run this script
 * 4. It will create admin@sinegu.kpu and set the UID in Firestore 'admins' collection
 */

// Paste ini di browser console setelah app terbuka:
/*
const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
const { getAuth, createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js");
const { getFirestore, doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

const config = {
  apiKey: "AIzaSyAcdJflbBZXgwIss1wkdzpslaO9D-DI2WY",
  authDomain: "notulensi-rapat-kpu.firebaseapp.com",
  projectId: "notulensi-rapat-kpu",
  storageBucket: "notulensi-rapat-kpu.firebasestorage.app",
  messagingSenderId: "572554244870",
  appId: "1:572554244870:web:55b2bc43b046d1826c6487"
};

const app2 = initializeApp(config, "seed-admin");
const auth2 = getAuth(app2);
const db2 = getFirestore(app2);

// Create admin account
const EMAIL = "admin@sinegu.kpu";
const PASSWORD = "Admin@SINEGU2026";
const NAME = "Administrator SINEGU";

try {
  let uid;
  try {
    const cred = await createUserWithEmailAndPassword(auth2, EMAIL, PASSWORD);
    await updateProfile(cred.user, { displayName: NAME });
    uid = cred.user.uid;
    console.log("Admin created with UID:", uid);
  } catch(e) {
    if (e.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth2, EMAIL, PASSWORD);
      uid = cred.user.uid;
      console.log("Admin already exists with UID:", uid);
    } else throw e;
  }
  
  // Set admin record in Firestore
  await setDoc(doc(db2, "admins", uid), {
    uid,
    email: EMAIL,
    displayName: NAME,
    role: "admin",
    createdAt: serverTimestamp()
  });
  
  console.log("✅ Admin berhasil dibuat!");
  console.log("Email:", EMAIL);
  console.log("Password:", PASSWORD);
  console.log("Login di: /admin");
} catch(e) {
  console.error("Error:", e);
}
*/
