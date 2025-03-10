import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyARxMYqLwydJpwYOMAU83JpBSo03mOX8dw",
    authDomain: "commissions-app-c6e2c.firebaseapp.com",
    projectId: "commissions-app-c6e2c",
    storageBucket: "commissions-app-c6e2c.firebasestorage.app",
    messagingSenderId: "958861552351",
    appId: "1:958861552351:web:057416d2949bdc9681576a",
    measurementId: "G-218D0VTQ2W"
};

// Initialize Firebase
let firebaseApp;
if (getApps().length === 0) {
    firebaseApp = initializeApp(firebaseConfig);
} else {
    firebaseApp = getApps()[0];
}

// Initialize Firestore and Storage
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

export { firebaseApp, db, storage };