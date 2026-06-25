const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('backend returns JSON for unmatched API routes after all API routers', async () => {
  const indexSource = await fs.readFile(path.join(process.cwd(), 'src', 'index.ts'), 'utf-8');

  const eventsRouteIndex = indexSource.indexOf("app.use('/api/v1/events', eventsRoutes)");
  const apiFallbackIndex = indexSource.indexOf("app.use('/api', (_req, res) =>");
  const uploadsIndex = indexSource.indexOf("app.use('/uploads'");

  assert.ok(eventsRouteIndex >= 0, 'events route should exist before the API fallback');
  assert.ok(apiFallbackIndex > eventsRouteIndex, 'API fallback should run after mounted API routes');
  assert.ok(uploadsIndex > apiFallbackIndex, 'uploads should stay outside the API fallback');
  assert.match(indexSource, /res\.status\(404\)\.json\(\{\s*error:\s*'ERR_NOT_FOUND'\s*\}\)/);
});

test('post routes reject malformed UUID params before database queries', async () => {
  const postRouteSource = await fs.readFile(path.join(process.cwd(), 'src', 'routes', 'post.ts'), 'utf-8');

  assert.match(postRouteSource, /const UUID_PATTERN = \/\^\[0-9a-f\]/);
  assert.match(postRouteSource, /function requireUuidParam\(paramName: string\)/);
  assert.match(postRouteSource, /router\.get\('\/:id', publicReadLimiter, requireUuidParam\('id'\), optionalAuth, getPostDetails\)/);
  assert.match(postRouteSource, /router\.get\('\/:id\/comments', publicReadLimiter, requireUuidParam\('id'\), optionalAuth, getComments\)/);
  assert.match(postRouteSource, /router\.put\('\/comments\/:commentId', requireUuidParam\('commentId'\), requireAuth/);
});

test('sensitive private routers hide unauthenticated probes behind 404 responses', async () => {
  const authSource = await fs.readFile(path.join(process.cwd(), 'src', 'middleware', 'auth.ts'), 'utf-8');
  const adminRouteSource = await fs.readFile(path.join(process.cwd(), 'src', 'routes', 'admin.ts'), 'utf-8');
  const messageRouteSource = await fs.readFile(path.join(process.cwd(), 'src', 'routes', 'message.ts'), 'utf-8');
  const friendRouteSource = await fs.readFile(path.join(process.cwd(), 'src', 'routes', 'friend.ts'), 'utf-8');
  const uploadRouteSource = await fs.readFile(path.join(process.cwd(), 'src', 'routes', 'upload.ts'), 'utf-8');
  const eventsRouteSource = await fs.readFile(path.join(process.cwd(), 'src', 'routes', 'events.ts'), 'utf-8');

  assert.match(authSource, /export const requireAuthHidden/);
  assert.match(authSource, /res\.status\(404\)\.json\(\{\s*error:\s*'ERR_NOT_FOUND'\s*\}\)/);
  assert.match(adminRouteSource, /router\.use\(requireAuthHidden\)/);
  assert.match(messageRouteSource, /requireAuthHidden/);
  assert.match(friendRouteSource, /requireAuthHidden/);
  assert.match(uploadRouteSource, /requireAuthHidden/);
  assert.match(eventsRouteSource, /res\.status\(404\)\.json\(\{\s*error:\s*'ERR_NOT_FOUND'\s*\}\)/);
});
