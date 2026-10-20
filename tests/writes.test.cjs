'use strict';
/* Seam 4a — every change Bible Notes makes to a note's text. Each one must
   touch exactly what it says and leave every other byte alone. */
const assert = require('node:assert');
const W = require('../src/writes');

/* Ticking: only that one line changes; done adds the ✅ date the Tasks
   plugin uses, undone takes it away again. */
{
  const text = '---\nbible-notes: community\n---\n\n## Prayer\n- [ ] Thandi — job interview\n- [ ] Rain\n';
  const done = W.toggleTask(text, 5, '- [ ] Thandi — job interview', true, '2026-10-25');
  assert.strictEqual(done, '---\nbible-notes: community\n---\n\n## Prayer\n- [x] Thandi — job interview ✅ 2026-10-25\n- [ ] Rain\n');
  const undone = W.toggleTask(done, 5, '- [x] Thandi — job interview ✅ 2026-10-25', false, '2026-10-26');
  assert.strictEqual(undone, text);
}

/* A line that changed since Home read it is refused (null), never guessed. */
{
  const text = '## Prayer\n- [ ] Thandi — interview moved\n';
  assert.strictEqual(W.toggleTask(text, 1, '- [ ] Thandi — job interview', true, '2026-10-25'), null);
  assert.strictEqual(W.toggleTask(text, 7, '- [ ] Thandi — interview moved', true, '2026-10-25'), null, 'line out of range');
}

/* Windows line endings and indentation survive; an existing ✅ is not doubled. */
{
  const text = '## Response\r\n  * [ ] Read John 15\r\n';
  assert.strictEqual(W.toggleTask(text, 1, '  * [ ] Read John 15', true, '2026-10-25'), '## Response\r\n  * [x] Read John 15 ✅ 2026-10-25\r\n');
  const dated = '- [ ] Again ✅ 2026-01-01\n';
  assert.strictEqual(W.toggleTask(dated, 0, '- [ ] Again ✅ 2026-01-01', true, '2026-10-25'), '- [x] Again ✅ 2026-01-01\n');
}

/* Adopting adds only the kind; the body comes back byte for byte. */
{
  const body = '**Morning service**\n\nNotes on Psalm 1:1-3.\n';
  const bare = W.adopt(body, 'sunday');
  assert.strictEqual(bare, '---\nbible-notes: sunday\n---\n\n' + body);
  const withFm = '---\ntype: sermon\ntags: [community]\nscripture: Titus 2:11-14\n---\n# Grace in the ordinary\n\n### 1. Trained by grace\n';
  assert.strictEqual(W.adopt(withFm, 'community'), '---\ntype: sermon\ntags: [community]\nscripture: Titus 2:11-14\nbible-notes: community\n---\n# Grace in the ordinary\n\n### 1. Trained by grace\n');
  assert.strictEqual(W.adopt(W.adopt(withFm, 'community'), 'community'), W.adopt(withFm, 'community'), 'adopting twice changes nothing');
}

/* A study session: the block the template defines from its dated heading
   on, appended at the very end. */
{
  const tpl = '## Questions\n\n## Cross references\n\n## {{date_long}}\n\n### Observe\n\n### Interpret\n\n### Apply\n';
  assert.strictEqual(W.sessionBlock(tpl, '2026-10-20'), '## 20 October 2026\n\n### Observe\n\n### Interpret\n\n### Apply\n');
  assert.strictEqual(W.sessionBlock('## Notes\n', '2026-10-20'), '## 20 October 2026\n', 'no dated heading in the template → just the date');
  const note = '---\nbible-notes: study\n---\n\n## 1 September 2026\n\nSomething I wrote';
  assert.strictEqual(W.appendSession(note, W.sessionBlock(tpl, '2026-10-20')),
    note + '\n\n## 20 October 2026\n\n### Observe\n\n### Interpret\n\n### Apply\n');
  assert.strictEqual(W.appendSession('a\r\nb\r\n', '## 20 October 2026\n'), 'a\r\nb\r\n\r\n## 20 October 2026\r\n');
}

/* Templates fill their placeholders and leave unknown ones alone. */
assert.strictEqual(W.renderTemplate('## {{date_long}} {{scripture}} {{nope}}', { date_long: '1 May 2026', scripture: '' }), '## 1 May 2026  {{nope}}');

console.log('writes OK');
