Next concrete steps. Some of these need you (interactive prompts), some I'll
   do for you.

  Step 1 (you) — Log in to Supabase CLI

  In terminal at the project root:

  supabase login

  This opens your browser, you confirm. Just type "done" back here when
  complete.

  Step 2 (you) — Get me your project ref

  Open your Supabase dashboard for the sellerlab project. The URL in your
  browser will look like:

  https://supabase.com/dashboard/project/<PROJECT_REF>/...

  That <PROJECT_REF> is a 20-character string. Paste it here (or paste the
  full URL).

  Step 3 (you) — Get me your project URL + anon key

  In the Supabase dashboard for your project → Settings → API, grab:
  - Project URL (looks like https://xxxxxxxxxxx.supabase.co)
  - anon public key (long string starting with eyJ...)

  Paste both. I'll put them in .env.local (gitignored) and instruct you on
  adding them to Vercel separately.

  Step 4 (you) — Confirm auth redirect URLs

  Per pre-build gotcha #4: in dashboard → Auth → URL Configuration, you should
   already have:
  - Site URL: https://sellerlab.app
  - Redirect URLs: http://localhost:3000/** AND https://sellerlab.app/**

  Send a screenshot if unsure. If missing, magic links will silently fail and
  we'll waste an hour debugging.

  ---
  Once I have all of the above, I'll:
  - Link the local repo to your remote project (supabase link --project-ref 
  ...)
  - Create the profiles migration via supabase migration new (using the proper
   CLI flow, not inventing filenames)
  - Write the SQL — profiles table + RLS policies + auto-create-on-signup
  trigger
  - Push the migration to your remote project
  - Verify in your dashboard that the table exists with RLS enabled
  - Then install @supabase/supabase-js + @supabase/ssr in the webapp and start
   the sign-in pages
   
  Let me know when you've done Steps 1-4.