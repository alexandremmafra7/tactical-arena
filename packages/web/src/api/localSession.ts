let activeBase: string | undefined;
let session: Promise<Record<string, string>> | undefined;

export function localSessionHeaders(base: string): Promise<Record<string, string>> {
  if (!session || activeBase !== base) {
    activeBase = base;
    session = fetch(`${base}/local-session`, {cache: 'no-store'})
      .then(async (response): Promise<Record<string, string>> => {
        if (!response.ok) throw new Error('Não foi possível iniciar a sessão local.');
        const body = await response.json();
        return body.enabled && typeof body.token === 'string' ? {'X-Local-Session': body.token} : {};
      }).catch(error => { session = undefined; throw error; });
  }
  return session!;
}
