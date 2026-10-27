-- Short share links (src/server/links.ts): /b/<id> opens the build `state` (the page's encodeState) in `layout`.
-- The id is made from the layout and state, so a build shared twice is one row. Nothing about who made it is kept;
-- `created` is the day only, enough to see how the table grows or to clear out old links one day.
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  layout TEXT NOT NULL CHECK (layout IN ('tabs', 'receipt')),
  state TEXT NOT NULL,
  created TEXT NOT NULL
) WITHOUT ROWID;
