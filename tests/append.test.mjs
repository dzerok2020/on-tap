import test from 'node:test';
import assert from 'node:assert/strict';
import { appendCatalog, validate } from '../scripts/content.mjs';
import { fixture } from './fixtures.mjs';

test('append preserves old entries and namespaces reused model IDs', () => {
  const original = fixture();
  const incoming = fixture();
  incoming.exams[0].title = 'Đề ôn tập mới khác nội dung';
  const merged = appendCatalog(original, incoming);
  assert.equal(merged.lessons.length, 8);
  assert.equal(merged.exams.length, 2);
  assert.deepEqual(merged.lessons.slice(0, 4), original.lessons);
  assert.deepEqual(merged.exams[0], original.exams[0]);
  assert.deepEqual(validate(merged), []);
  assert.equal(appendCatalog(merged, incoming), merged);
  assert.equal(appendCatalog(merged, original), merged);
  assert.equal(original.lessons.length, 4);
  assert.equal(incoming.lessons[0].id, original.lessons[0].id);
});

test('retry is independent of JSON object key order and preserves legacy catalog', () => {
  const incoming = fixture();
  assert.equal(appendCatalog(incoming, structuredClone(incoming)), incoming);
  const published = appendCatalog(null, incoming);
  const reordered = Object.fromEntries(Object.entries(incoming).reverse());
  assert.equal(appendCatalog(published, reordered), published);
});

test('invalid old or incoming content never replaces published history', () => {
  assert.throws(() => appendCatalog({lessons: [], exams: []}, fixture()), /đã đăng không hợp lệ/);
  assert.throws(() => appendCatalog(fixture(), {lessons: [], exams: []}), /Bản duyệt không hợp lệ/);
});
