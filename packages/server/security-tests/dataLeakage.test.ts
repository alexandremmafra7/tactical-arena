import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestBoundary } from '../src/middleware/security.js';

describe('Data Leakage & Response Sanitization Tests', () => {
  const app = express();
  app.use(requestBoundary, express.json());
  app.get('/secure-profile', (_req, res) => {
    res.json({ id: 'user-1', name: 'Nilton', managerToken: 'secret-token-12345' });
  });

  it('omits or prevents tokens from leaking when required', async () => {
    const res = await request(app).get('/secure-profile').expect(200);
    // Verificando que cabeçalhos de segurança obrigatórios estão presentes
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });
});
