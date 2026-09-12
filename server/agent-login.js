export function normalizeAgentPhone(value) {
  let digits = String(value || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('234') && digits.length === 13) digits = `0${digits.slice(3)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) digits = `0${digits}`;
  return /^0[789][0-9]{9}$/.test(digits) ? digits : '';
}

export async function findLoginUser(store, input, aliases = {}) {
  const login = String(input || '').trim().toLowerCase();
  if (!login || login.length > 254) return null;
  if (aliases[login]) return store.userByEmail(aliases[login]);
  if (/^pu-[a-z0-9-]+$/.test(login)) return store.userByEmail(`${login}@agents.sigar.invalid`);
  if (login.includes('@')) return store.userByEmail(login);
  const phone = normalizeAgentPhone(login);
  if (!phone) return null;
  const users = (await store.users()).filter(user => user.role === 'Agent' && user.active && normalizeAgentPhone(user.station) === phone);
  return users.length === 1 ? users[0] : null;
}
