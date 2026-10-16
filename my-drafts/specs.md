# General

- General design is found in Figma Desktop at: https://www.figma.com/design/0V1cRgRyGaqx9rOnlCiL39/EnglishChunksHome?node-id=0-1 page where I put all screens designs. If not all options are sketched, use your designer criteria to add the missing parts.

- The app (EnglishChunks.guru) teaches chunks to english learners
- This app is for english learners users (ESOL stands for English for Speakers of Other Languages).
- Each user is in different level of learning: A1 to C2 or simply basic, intermediate. or advanced. This is a gude about english levels: https://preply.com/en/blog/english-language-levels/
- The chunks teached everyday depend on english level of the user. In English, chunks (also known as formulaic language or multi-word units) are groups of words that native speakers naturally use together as a single, pre-assembled block of meaning rather than building sentences word-by-word from scratch.

## Types of Chunks in English

Linguists and educators generally divide language chunks into two main categories: lexical chunks and grammatical chunks (which include several specific sub-types).

1. Lexical Chunks
   These are groups of words defined by their vocabulary and frequent co-occurrence. They act almost like single vocabulary items.

- Collocations: Words that habitually go together in English (e.g., make a decision, take a break, utter disaster).
- Idioms and Fixed Expressions: Expressions where the overall meaning cannot be understood just by looking at the individual words (e.g., over the hill, long time no see, spill the beans).
- Polywords (Short Social Chunks): Brief, unchangeable social formulas used in daily interactions (e.g., by the way, how's it going, have a nice day).
- Vague Language Chunks: Groups of words used to refer to categories or collections without listing everything (e.g., and that kind of thing, or something like that).

2. Grammatical Chunks
   These are semi-fixed or structured patterns that follow specific grammatical rules, where you swap out one or two slots inside a ready-made frame.

- Sentence Builders / Frames: Fixed templates where you insert a new word or clause (e.g., "I tend to [do something]", "I find it easy to [do something]").
- Verb Patterns / Phrasal Verbs: Fixed verb combinations that require specific following structures (e.g., "dependent on", "encourage + someone + to do", "look forward to [doing]").
- Discourse Markers: Chunks that connect, structure, or signal the flow of conversation or writing (e.g., "having said that", "at the end of the day", "you see").

3. Idioms

Some additional info about chunks is below but you can search more:

- https://www.splendid-speaking.com/improve-english-fluency/
- https://www.teachingenglish.org.uk/professional-development/teachers/teaching-knowledge-database/c/chunks
- https://www.theidioms.com/
- https://www.barefootteflteacher.com/p/teaching-chunks-of-language

# Details

- There is a landing page with why learn chunks, some cool video and call to action for sign up for a free trial for 7 days.
- If not registered, user must register with username and password or Google Auth
- Each user is requested to input his english level (CEFR or beginner, advanced, level)
- Every user has a profile with basic info and mother tongue. User can change your profile picture if wanted. The pic must be formatted if needed and saved in cloud.
- User gets the chunk of the day, meaning of the chunk, when to use it and three examples of how to use it.
- Examples apply for casual use or business-related use
- User can read and hear chunk and examples out loud with play button to hear pronunciation (American English).
- Daily session flow (Just one chunk practice per day for basic plan):
  - 1. Learn: see the chunk, its meaning, when to use it and 3 examples, with a play button on each (ElevenLabs, American voice, audio cached per sentence).
  - 2. Speak, try 1: user records the chunk and each of three example. Other Open weight-model scores it, then Gemma model gives warm tips.
  - 3. Speak, try 2: user records again chunk and each of three examples. The app shows her score and how much it improved since try 1.
  - 4. Write: she writes 3 of her own sentences. Gemma grades each one (correct usage, grammar) and returns a corrected version.
  - 5. Read aloud: she plays the corrected sentences through ElevenLabs, then records herself reading them. Open weight-model scores it.
  - 6. Daily score: saved to database, with a progress chart and streak.

- User can see a page of progress: daily scores and streak. Cool graphics should be used.
- In Progress, the user can see its position in ranking among users.
- User can change voice from several options for reproducing chunks or sentences.
- User can choose dark/light mode.
- There is separated admin page with details of users for admin and CRUD operations.
- Admin page should show the type of subscription of listed users.
- For each user details should show subscription details and payment methods
- Use cool and friendly design for persons of all ages and background.

- Monthly Pricing:
  - Basic: 1 chunk practice per day per user $7
  - Standard: 3 chunk practices per day per user $9
  - Premium: 5 chunk practices per day per user $11 + Conversations (1 conversation per day with our guru to use learned chunks in real conversations and get more points per day)
  - Billing should be processed by Stripe Billing. The service will be at no cost until I explicitly define it and in that moment, stripe should be used for real transactions.
  - Demo account and payment on stripe must be validated before go live.

- App should have 1000 pre-loaded commonly used chunks and curated across A1–C2 levels for casual, academic, and professional English.
- Use anthoer low cost model to audit chunks before preload them in app.
- User can add new chunks for consideration.
- If a chunk is submmitted by user, it should be validated by the app. If approximated or equal exists, the app should suggest the existing to the user. If it's new, the chunk muust be notified to admin to accept or deny. If accepted, a notification in app or email is sent to the user and the new chunk is added to the library. User get points.
- User can search specific chunks in chunk library. If allowed (not exceeded the chunks per day), the user can launch a practice for the selected chunk.

# Technical aspects

Suggested Deployment Details with hybrid setup:
Vercel: Next.js frontend + Gemma 4 26B A4B via AI Gateway (cheapest Gemma, and 26B A4B is not on DigitalOcean).
DigitalOcean: one Droplet with a small FastAPI “scoring service” (Silero VAD + Parakeet + wav2vec2). Vercel app sends the audio there and gets back the score.

Vercel -> Next.js app
Gemma 4 26B A4B (Vercel AI Gateway) -> Tips + writing grades and another model for chunk preload.
DigitalOcean CPU Droplet (4 vCPU / 8 GB) -> Parakeet + wav2vec2 + Silero VAD
ElevenLabs -> shared daily audio of chunks and created sentences
Audio storage (DigitalOcean Spaces) -> Cached TTS files
Database (Neon free tier) -> Users, scores, progress and chunks library

Suggested pipeline for one recording:
Step 1. Silero VAD trims the audio.
Step 2. Parakeet → transcript + timestamps → word accuracy + fluency.
Step 3. wav2vec2 phonemes vs. expected phonemes → per-sound scores.
Step 4. Combine into one score (0–100), save per attempt.
Step 5. Gemma 4 receives the score + the 2–3 worst sounds → writes the warm tips.

- App uses International Phonetic Alphabet (IPA). Keep the IPA-to-friendly-hint mapping in app (a small table of the ~40 English sounds), not generated by Gemma. That way the hint for each sound is always correct and consistent; Gemma only adds the warm, personal tone around it.
- Open core: Gemma, find the daily chunk at user's level and it provides 3 examples. Then wait for inputs: chunk pronunciation, 3 sentences in text and then spoken and help them to correct and grade session to keep a score that shows her progress.
- Open weighted model handles her spoken answers of chunk, the 3 examples and the 3 own sentences
- ElevenLabs: She hears from it the correct pronunciation for chunk and examples. Then for inputs she wrote.
- Difficulty Level: Basic to Advanced.
- Colors of app based on this palette: https://coolors.co/5dfdcb-7cc6fe-f4faff-8789c0-08090a
- Use Typescript language where possible
- Registration should be validated by email using Resend. Also password resets.
- Responsive design. Screens supported: desktop, mobile and tablet.
- Use Nextjs for frontend and nodejs for backend. Use postgresql for database.
- I'll provide you the api key for Vercel, ElevenLabs, Resend and for DigitalOcean as your request.

# Costs

1. Use stripe real payments Only after explicit start pay period settled by admin. Stardard and premium as not enabled yet.
   Meanwhile, only sign up required and just basic profiles allowed.
2. Generate audio only when the user clicks play. Many users won’t play all 3 sentences, so this could keep costs low in ElevenLabs
3. Use the Flash model for ElevenLabs. Same American voice quality for short sentences, half the credits.
4. Quantize the speech models (ONNX int8). They become smaller, and you might fit on a 4 GB Droplet for about half the price.
5. Test the scoring quality first.
6. While you are still testing with friends (no payments), Vercel Hobby is fine, which saves $20.

# Security

- No environment variables or api keys in repos
- Recommended security considerations for payments

# Tests

- Create unit and complete test for application in order to validate any change.
