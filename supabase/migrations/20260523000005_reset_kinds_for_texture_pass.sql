-- Reset all `kind` values to NULL so the workspace's first-load classifier
-- re-runs against the updated 8-kind taxonomy (Style, Subject, Color,
-- Texture, Technique, Layout, Mood, Use). This surfaces any keywords that
-- should have been Texture but were forced into Technique/Subject under
-- the previous 7-kind list.
--
-- Cost: one Gemini call per active user on their next /workspace load.
-- Trade-off: any manual drag-and-drop kind reassignments are lost. The
-- user accepted this when requesting the Texture review.

update public.user_keywords set kind = null;
