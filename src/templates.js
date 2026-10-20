'use strict';
/* The built-in templates: headings only, no filler to delete. On first run
   they are written to the template folder as ordinary notes, and from then
   on the vault's copy is used — reword a heading there and the next note
   follows. A Study session repeats the template from its dated heading. */

const DEFAULT_TEMPLATES = {
  sunday: '## Message\n\n## What stuck\n\n## Response\n\n## Questions\n',
  community: '## Discussion\n\n## Prayer\n\n## Follow up\n',
  meditation: '## Read\n\n## Noticed\n\n## Prayer\n\n## Carry today\n',
  study: '## Questions\n\n## Cross references\n\n## {{date_long}}\n\n### Observe\n\n### Interpret\n\n### Apply\n',
};

const TEMPLATE_NAMES = { sunday: 'Sunday', community: 'Community', meditation: 'Meditation', study: 'Study' };

module.exports = { DEFAULT_TEMPLATES, TEMPLATE_NAMES };
