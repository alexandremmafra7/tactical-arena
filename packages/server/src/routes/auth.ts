import { Router } from 'express';
import { register, login, AuthError } from '../services/authService.js';

export const authRouter = Router();

authRouter.post('/register', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Email e senha (mín. 6 caracteres) são obrigatórios' });
    return;
  }

  try {
    const { token, userId } = await register(email, password);
    res.status(201).json({ token, userId });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Email e senha são obrigatórios' });
    return;
  }

  try {
    const { token, userId } = await login(email, password);
    res.json({ token, userId });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(401).json({ error: err.message });
      return;
    }
    throw err;
  }
});
