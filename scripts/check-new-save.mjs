/**
 * Reproduction and check for "saveName is not defined" when starting a new career.
 *
 * Also verifies the second, quieter half of that bug: the manager's user row was being created *after* a
 * line that always threw, inside a best-effort catch — so the save came back with a token for a manager
 * who did not exist in the database. A token that authenticates nobody looks fine until the first request.
 */
const API = 'http://127.0.0.1:3001';

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json().catch(() => null) };
}

// 1. Named career
const named = await post('/saves/new', {
  name: 'Carreira do Teste',
  managerFirstName: 'Alexandre',
  managerLastName: 'Mafra',
  managerNationality: 'BRA',
});
console.log('carreira nomeada ->', named.status, named.body?.error ?? `save "${named.body?.save?.name}"`);

// 2. Unnamed career, which is the case the fallback covers
const unnamed = await post('/saves/new', { managerFirstName: 'Zé', managerLastName: 'Técnico' });
console.log('carreira sem nome ->', unnamed.status, unnamed.body?.error ?? `save "${unnamed.body?.save?.name}"`);

// 3. The token has to belong to a manager who actually exists
if (named.body?.token) {
  const mine = await get('/clubs/mine', named.body.token);
  console.log('token do save funciona ->', mine.status === 200 ? `sim (${mine.body.length} clubes)` : `NÃO (${mine.status})`);
}

const list = await get('/saves');
console.log('saves no índice:', (list.body?.saves ?? list.body ?? []).length);
