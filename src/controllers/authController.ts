// src/controllers/authController.ts
// Controller for user authentication flows

import { Request, Response } from 'express';
import admin from '../firebaseAdmin';
import fetch from 'node-fetch';

const db = admin.firestore();

// Helper: Firebase Auth REST API endpoint
const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

// Signup API
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, dateOfBirth } = req.body;
    if (!email || !password || !firstName || !lastName || !dateOfBirth) {
      res.status(400).json({ error: 'Missing required fields.' });
      return;
    }
    // Create user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`
    });
    // Store extra info in Firestore
    await db.collection('users').doc(userRecord.uid).set({
      firstName,
      lastName,
      dateOfBirth,
      email,
      createdAt: Date.now(),
    });
    res.status(201).json({ uid: userRecord.uid, email: userRecord.email });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

// Login API (using Firebase Auth REST API)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required.' });
      return;
    }
    const response = await fetch(`${FIREBASE_AUTH_URL}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await response.json();
    if (!response.ok) {
      res.status(401).json({ error: (data as any).error?.message || 'Invalid credentials.' });
      return;
    }
    // Return Firebase ID token and user info
    res.json({ idToken: (data as any).idToken, refreshToken: (data as any).refreshToken, uid: (data as any).localId, email: (data as any).email });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Forgot Password API (send reset email)
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email required.' });
      return;
    }
    const response = await fetch(`${FIREBASE_AUTH_URL}:sendOobCode?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
    });
    const data = await response.json();
    if (!response.ok) {
      res.status(400).json({ error: (data as any).error?.message || 'Failed to send reset email.' });
      return;
    }
    res.json({ message: 'Password reset email sent.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch user profile
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || !user.uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const docRef = db.collection('users').doc(user.uid);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    // Add uid to the returned profile
    res.json({ ...docSnap.data(), uid: user.uid });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Update user profile
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user || !user.uid) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { firstName, lastName, dateOfBirth } = req.body;
    await db.collection('users').doc(user.uid).update({ firstName, lastName, dateOfBirth });
    res.json({ message: 'Profile updated.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}; 