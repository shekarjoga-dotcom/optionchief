import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type ConfirmationResult
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBcfKQytXqLzoSonODt95pdAbHTB4KSoxE",
  authDomain: "optionchief-144a2.firebaseapp.com",
  projectId: "optionchief-144a2",
  storageBucket: "optionchief-144a2.firebasestorage.app",
  messagingSenderId: "890103215682",
  appId: "1:890103215682:web:456cce42b6ddac19791fdb",
  measurementId: "G-H1Z9DMYRP3"
};

// Initialize Firebase App singleton
export const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firebaseAuth = getAuth(firebaseApp);
firebaseAuth.useDeviceLanguage();

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signInWithPopup, 
  firebaseSignOut 
};
export type { ConfirmationResult };
