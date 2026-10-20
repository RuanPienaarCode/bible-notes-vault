# Bible Notes

Sunday, community, morning meditation and Bible study notes you come back to and build on.
Every note is a plain markdown file in your vault. The plugin gives it a clean, Notion-style
page and ties your notes together: by scripture, by what is still open, and by what you are
praying for.

## What it does

| | |
| --- | --- |
| **Home** | Start a note in one tap: Sunday is the lead card on Sundays, Meditation on other mornings. Below that: what is still open, what you are praying for, recent notes, your series, and an index of every passage you have written about. |
| **Cover band** | Each note opens with a flat band, its icon and a big title. The title *is* the file name, so editing it renames the file and links follow. The properties sit below as quiet rows you tap to edit. |
| **Scripture as the thread** | Write `John 15:5` anywhere and it becomes a passage chip. Tap it to open the passage and see every other note on that chapter. |
| **Still open** | Any checkbox `- [ ]` in a Bible Notes note is an open item. A new note shows what is still open from earlier, and so does Home. |
| **Praying for** | Checkboxes under a heading that mentions prayer (*Prayer*, *Praying for*) are prayer requests. Tick one from Bible Notes and it is remembered as answered, with how long ago you first wrote it down. |
| **Carry-over** | A new Sunday note starts with last Sunday's speaker, series and church. Series notes number themselves: Abide, part 4. |
| **Templates you own** | The four templates are ordinary notes in `Templates/Bible Notes/`. Reword a heading there and the next note follows. |
| **Adopt what you have** | *Adopt existing notes* finds sermon, community, meditation and study notes already in your vault. You review the list first; adopting adds one property and changes nothing else. |
| **Desktop and mobile** | Built for taking notes on a phone during the sermon. Follows your theme, light and dark. |

## How a note is shaped

A note belongs to Bible Notes when its frontmatter says so. Moving a note to another folder
never breaks it.

```yaml
---
bible-notes: sunday          # sunday | community | meditation | study
date: 2026-10-25
speaker: Ps. Andrew
series: Abide
scripture: John 15:1-8       # one passage or a list
church: Grace Church
---
```

| Kind | Properties | Headings in the template |
| --- | --- | --- |
| Sunday | `date`, `speaker`, `series`, `scripture`, `church` | Message · What stuck · Response · Questions |
| Community | `date`, `people`, `scripture` | Discussion · Prayer · Follow up |
| Meditation | `date`, `scripture` | Read · Noticed · Prayer · Carry today |
| Study | `started`, `scripture` | Questions · Cross references · then a dated session (Observe · Interpret · Apply) |

A study is one note per passage that grows: *Add a session* appends a new dated block to the end.

File names are `2026-10-25 Title.md` (a study is just `Romans 8.md`). A colon in a title
becomes a dot, because iOS and Windows don't allow colons in file names.

## Scripture

- References are read the way people type them: `John 15:1-8`, `Matthew 11:28–30`,
  `1 Sam 10:1,5-7`, `Acts 19:1,2, 19:6`, `John 1:12 (NIV)`.
- In the body of a note a reference needs a verse, so `Romans 8 was good` stays plain text.
  In the `scripture` property, chapters (`Romans 8`) are fine too.
- A passage opens, in this order:
  1. in [Bible Search](https://github.com/RuanPienaarCode/obsidian-bible-search)'s reader,
     when that plugin (1.2.0 or later) is on in the same vault;
  2. in your own Bible notes, when the vault has a chapter note named like `John 15` with
     a `chapter` property (the layout Bible Search and similar vaults use);
  3. otherwise on BibleHub, in the translation you choose in settings.
- Bible Notes never stores or shows verse text.

## The rules it keeps with your writing

Bible Notes only ever does these to a note:

- flips one checkbox (and refuses if that line changed since it was shown)
- adds or changes a frontmatter property
- appends a study session at the end
- renames the file from the title you typed

It never rewrites what you wrote.

## Commands

- *Open home* (also the book icon in the ribbon)
- *New Sunday note*, *New community note*, *New meditation note*, *New study note*
- *Add a study session*
- *Show or hide raw properties*
- *Adopt existing notes*

## Settings

The folder for each kind's new notes, the template folder, the BibleHub translation, whether
passage chips appear in every note or only in Bible Notes notes, and the church a Sunday
note uses when the last one has none.

## Privacy

Everything stays in your vault. There is no account, no telemetry and no network request,
except opening a BibleHub page in your browser when you tap a passage. That link carries
only the translation, book and chapter (for example `biblehub.com/niv/john/15.htm`) —
nothing from your notes.

## Development

```bash
./build.sh            # bundle src/ into main.js, then run the test suite
npm test              # the test suite on its own
npm run preview       # build the browser harness, then serve the repo and open /_preview/preview.html
BIBLE_NOTES_VAULT_PATH=~/path/to/vault ./scripts/deploy.sh   # copy main.js, styles.css and manifest.json into a vault and prove they landed
```

`main.js` and `styles.css` at the repo root are build output; edit `src/`. The mobile floor
is iOS 15 WebKit (no lookbehind regex, no Node APIs, no `innerHTML`); `tests/ios-hazards.test.cjs`
guards it. The preview harness loads Obsidian's own `app.css`, which you extract locally
(it is gitignored and not distributed here).

## Licence

[GNU AGPL v3](LICENSE).
