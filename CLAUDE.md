# Notes for sessions working on itemize.lol

## Text on the page: labels and numbers, not explanations

The user wants the site to read at a glance. On screen, use short labels and numbers; leave out sentences that
explain what a number means, how it was worked out, or what to do next.

- "taken by the dummy's 80 armor", "after the dummy's 80 armor" → "mitigated"
- "true · never blocked" → "true"
- "not learned yet, put a point in it to…" on a greyed ability → "not learned"
- "A hits harder, but B loses less to armor…" and other "why" lines → drop them
- "Kept in this browser only…", "Click a pip to set a rank", "Both builds use the champion, level…" → drop them

If something really needs explaining, put it in a `title` tooltip or behind a Details toggle that starts closed
(the item settings menu does this). When in doubt, leave the words out. This applies to wireframes too: their
captions are notes for the user, not text for the page.

## Temporary

Things done only because the site is in its early days, to undo later:

- **The big Feedback button** (Oct 29, 2026). In the footer of both pages it is a large filled button that
  rises out of the Riot notice's row, so that early visitors notice it. To revert, delete the two CSS blocks
  marked `TEMPORARY` in web/index.html and the two in web/receipt.html; Feedback goes back to the quiet
  outline button in the notice's row.
