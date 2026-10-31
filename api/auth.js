// POST /api/auth — tells the frontend whether a password is needed, and whether the one it sent is right.
import { authRequired, checkAuth } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!authRequired()) {
    res.status(200).json({ required: false, ok: true });
    return;
  }
  if (!checkAuth(req, res)) return;
  res.status(200).json({ required: true, ok: true });
}
