import { Request, Response, NextFunction } from 'express';

/**
 * Gates the team editor to the packaged desktop build only (see packages/desktop/src/main.js, the only
 * place that sets DESKTOP_MODE). The editor lets a manager set any attribute freely — fine for a
 * single-player save, a real cheating vector if this server code ever runs hosted for multiple accounts
 * (the game already has real PvP between two different users on one server — see matchService.submitTactic).
 * Applied before requireAuth on the editor router so an unauthenticated probe against a hosted server gets
 * a flat 403 without revealing the route exists behind auth at all.
 */
export function requireDesktopMode(req: Request, res: Response, next: NextFunction): void {
  if (process.env['DESKTOP_MODE'] !== 'true') {
    res.status(403).json({ error: 'Disponível apenas na versão desktop.' });
    return;
  }
  next();
}
