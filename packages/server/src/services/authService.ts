import { randomBytes } from 'node:crypto';
import { isLocalMode } from '../middleware/security.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';

const localKey = randomBytes(32).toString('hex');
export function assertSigningKey(): string {
  const configured = process.env['JWT_SECRET'];
  if (configured && configured.length >= 32 && configured !== 'dev-only-secret-change-me') return configured;
  if (isLocalMode()) return localKey;
  throw new Error('Configure JWT_SECRET forte (mínimo 32 caracteres) antes de iniciar o servidor hospedado.');
}
const TOKEN_TTL = '7d';

export class AuthError extends Error {}

export async function register(email: string, password: string): Promise<{ token: string; userId: string }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthError('Email já cadastrado');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  return { token: signToken(user.id), userId: user.id };
}

export async function login(email: string, password: string): Promise<{ token: string; userId: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError('Credenciais inválidas');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError('Credenciais inválidas');
  }

  return { token: signToken(user.id), userId: user.id };
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, assertSigningKey(), { expiresIn: TOKEN_TTL, algorithm: 'HS256' });
}

export function createManagerToken(userId: string): string {
  return signToken(userId);
}

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, assertSigningKey(), {algorithms: ['HS256']}) as { sub: string };
  if (typeof payload.sub !== 'string' || !payload.sub) throw new AuthError('Token inválido');
  return payload.sub;
}
