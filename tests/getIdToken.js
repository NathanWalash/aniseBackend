// tests/getIdToken.js
// Usage: Fill in your test user's email and password, then run with `node tests/getIdToken.js`

require('dotenv').config();

const API_KEY = process.env.FIREBASE_API_KEY; // Loaded from .env
const email = 'walash@email.com';            // <-- Fill in your test user's email
const password = 'password';             // <-- Fill in your test user's password

if (!API_KEY) {
  console.error('FIREBASE_API_KEY is missing from .env');
  process.exit(1);
}

async function getIdToken() {
  // Dynamically import node-fetch for compatibility with CommonJS
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (data.idToken) {
    console.log('ID_TOKEN:', data.idToken);
  } else {
    console.error('Error:', data.error || data);
  }
}

getIdToken(); 