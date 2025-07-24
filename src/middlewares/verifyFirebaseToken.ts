import { Request, Response, NextFunction } from 'express';
import admin from '../firebaseAdmin';

const db = admin.firestore();

export const verifyFirebaseToken = async (req: Request, res: Response, next: NextFunction) => {
  console.log("verifyFirebaseToken called");
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided.' });
      return;
    }
    const idToken = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Attach both auth and Firestore data to request
    (req as any).user = {
      ...decodedToken,
      walletAddress: userData?.wallet?.address || null,
      firstName: userData?.firstName,
      lastName: userData?.lastName,
      email: userData?.email,
      // Add the full wallet object for completeness
      wallet: userData?.wallet || null
    };

    return next();
  } catch (err) {
    console.error('Token verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}; 