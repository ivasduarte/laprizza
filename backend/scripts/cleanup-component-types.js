const BASE_URL = process.env.API_URL;
const EMAIL = process.env.MANAGER_EMAIL;
const PASSWORD = process.env.MANAGER_PASSWORD;
const SEEDER_TYPES = new Set(['base dough', 'base sauce', 'cheese', 'topping']);
const apply = process.argv.includes('--apply');

async function request(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const login = await request('POST', '/auth/login', null, { email: EMAIL, password: PASSWORD });
if (login.status !== 200)
  throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.body)}`);
const token = login.body.accessToken;

const { body: types } = await request('GET', '/pizza-component-type', token);
const leftovers = types.filter(
  (t) =>
    t.isActive !== false && (t.minQuantity ?? 0) > 0 && !SEEDER_TYPES.has(t.name.toLowerCase()),
);

console.log(`${types.length} active types; ${leftovers.length} with minQuantity > 0:`);
for (const t of leftovers) console.log(`  - ${t.name} (min ${t.minQuantity}, id ${t.id})`);

if (!apply) {
  console.log('\nNothing was changed. Run with --apply to remove.');
  process.exit(0);
}

for (const t of leftovers) {
  const res = await request('DELETE', `/pizza-component-type/${t.id}`, token);
  console.log(`${res.status === 204 ? 'OK ' : 'ERR'} ${t.name}: ${res.status}`);
}
