import test from 'node:test';
import assert from 'node:assert/strict';
import { registerBoundaryRoutes } from './boundary-routes.js';

function fixture() {
  const routes = new Map();
  const app = {
    get(path, ...handlers) {
      routes.set(`get:${path}`, handlers.at(-1));
    },
    use() {},
  };
  const next = (_req, _res, next) => next?.();
  registerBoundaryRoutes({ app, auth: next, adminOnly: next, rateLimit: next, asyncRoute: (fn) => fn, store: {} });
  return {
    routes,
    call: async (method, path, req = {}) => {
      const res = {
        statusCode: 200,
        headers: {},
        setHeader(name, value) { this.headers[name] = value; },
        set(name, value) { this.headers[name] = value; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
      };
      await routes.get(`${method}:${path}`)({ query: {}, ...req }, res);
      return res;
    },
  };
}

test('Oyo boundaries expose source certainty and preserve unknown geometry instead of inventing coordinates', async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url) => {
    if (String(url).includes('FeatureServer/2')) {
      return {
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { name: 'Oyo' }, geometry: { type: 'Polygon', coordinates: [[ [7.0, 3.0], [8.0, 3.0], [8.0, 4.0], [7.0, 3.0] ]] } }],
        }),
      };
    }
    if (String(url).includes('FeatureServer/1')) {
      return {
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: { name: 'Ibadan North' }, geometry: { type: 'Point', coordinates: [null, null] } }],
        }),
      };
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const api = fixture();
    const res = await api.call('get', '/api/boundaries/oyo');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.metadata.classification, 'official-electoral');
    assert.equal(res.body.metadata.sourceCertainty, 'authoritative');
    assert.equal(res.body.metadata.sourceVersion, 'oyo-official-boundaries-v1');
    assert.equal(res.body.lgas.features[0].geometry.type, 'Point');
    assert.deepEqual(res.body.lgas.features[0].geometry.coordinates, [null, null]);
  } finally {
    global.fetch = originalFetch;
  }
});
