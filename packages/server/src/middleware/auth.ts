import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService.js';

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token ausente' });
    return;
  }

  try {
    req.userId = verifyToken(header.slice('Bearer '.length));
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
}
