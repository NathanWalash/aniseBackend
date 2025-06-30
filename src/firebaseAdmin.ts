import admin from 'firebase-admin';
import path from 'path';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      // Adjust the path if needed
      path.resolve(__dirname, '../config/serviceAccountKey.json')
    ),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export default admin; 