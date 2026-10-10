# Qoraalka Xayaysiinta — Af-Soomaali (Awdal / Boorama)
## MBK Parent Portal · Somali voiceover script & recording direction

This is the script deliverable for the Somali (Awdal) dub of the MBK Parent
Portal promo. It contains the narration, the per-scene timing budget, the
performance direction, and the recording specification needed to finish the
video with `scripts/build-somali-dub.mjs`.

| Cut | Master | Duration | Spec |
| --- | --- | --- | --- |
| Long | `final-promo.mp4` | 41.10 s | 1080×1920, 30 fps, H.264 High, yuvj420p |
| Short | `short-version.mp4` | 15.10 s | 1080×1920, 30 fps, H.264 High, yuvj420p |

---

## 1. Voice rights — Xasan Aadan Samatar

**No voice cloning or impersonation of Xasan Aadan Samatar is performed in
this project, and none should be.**

He is a real, living, individually identifiable Somali artist. Reproducing
his vocal timbre would be an impersonation of a named person, and the project
brief made that conditional:

> "If authorized voice recordings and the necessary permission are provided,
> use the approved voice recording under the applicable terms. Otherwise, do
> not clone or impersonate his exact voice."

A search of this repository found **no authorized recording of the artist and
no permission instrument** — the only audio present is generated narration and
the procedurally synthesized score in `assets/audio/`. The condition is
therefore unmet.

Two lawful routes remain:

1. **Licensed use of real audio.** If written permission from Xasan Aadan
   Samatar (or his rights holder) is obtained together with the master
   recordings, those recordings can be edited, time-aligned to the scene beats
   below and mixed into the video. That is use of licensed audio, not cloning.
2. **An original voice in the same artistic spirit.** A mature Somali male
   narrator with a rich, warm, resonant tone — ideally a native speaker from
   Borama/Awdal — delivering the script below with the dignified, nostalgic,
   melodically-phrased quality of classic Somali performance, without
   imitating any identifiable artist.

The performance notes in section 4 are written for route 2 and work equally
well as direction for route 1.

---

## 2. Dialect brief — why this reads as Awdal Somali

The register targets educated, everyday speech in Borama and the surrounding
Awdal communities: Northern Somali (Af-Soomaali Waqooyi), in the school-and-
`dugsi` idiom familiar from the region, not Maay and not a word-for-word
calque of the English.

Deliberate choices:

| Choice | Why it is Awdal-natural |
| --- | --- |
| `ha ka maqnaan` ("don't be absent from it") | Idiomatic northern way to say "stay close to / don't miss". A literal `u dhowow` would read as physical proximity and sound translated. |
| `la soco` ("keep pace with") | The everyday northern collocation for following records and updates. |
| `indhaha ku hay` ("keep in your eyes") | Native idiom for "keep an eye on"; not a borrowed construction. |
| `ayaa` / `waxaa` focus markers | Northern Somali is focus-heavy; the copy uses `ayaa` for subject focus and the `waxaa` construction where the subject follows the verb. |
| `warbixinno`, `xaadirin`, `ogeysiis`, `diiwaangeli`, `imtixaan` | The Arabic-derived educated register that Awdal schools actually use, appropriate to a school product. |
| `meel keliya` / `hal meel` | Standard "in one place"; avoids the calqued `hal meel ah`. |
| `MBK Parent Portal` left untransliterated | It is the product name. Somali speakers say it as a proper noun. |
| Full articulation of `x`, `c`, `q` | `maqnaan`, `xaadirinta`, `casharrada`, `xaqiiji`, `dugsigu`. Clear pharyngeals are a hallmark of Awdal pronunciation and must not be softened. |

Rejected as un-Awdal or unnatural: `iska daawo`, `wax kasta oo`, southern
`-iin` plural verbs, and any English calques such as `hubi inaad` for
"make sure you".

---

## 3. Long cut — 41 s narration

Timing windows are taken from `LONG_VOICE_SEGMENTS` in `remotion/content.ts`.
Each line must **start** at its cue and **finish before** the next cue, or it
will collide with the following scene.

### Line 1 — cue 0.00 s · budget 12.00 s · target ≤ 8.5 s
**Scenes:** Hook (crest + login screen) → "The school day moves fast."

> **Waalid, ilmahaaga maalintiisa dugsiga ha ka maqnaan.**
> **MBK Parent Portal ayaa wararka dugsiga meel keliya kuu keenaya.**

*Gloss:* Parent, don't be absent from your child's school day. MBK Parent
Portal brings you the school's news in a single place.

*Direction:* Open low, warm and unhurried — this is the hook, so let `Waalid`
land as a direct address with a small beat of silence after it. The second
sentence picks up slightly, with quiet authority. This is the "classic Somali
opening" moment: dignified, not salesy.

*Pronunciation:* `Waa-lid` · `il-ma-haa-ga maa-lin-tii-sa dug-si-ga` ·
`ha ka maq-naan` (hold the `q`) · `wararka` (rolled r) · `meel keliya`.

---

### Line 2 — cue 12.00 s · budget 9.00 s · target ≤ 6.5 s
**Scenes:** 01 / Academic progress (Marks, Monthly · Midterm · Final) → 02 / Everyday details

> **La soco dhibcaha iyo warbixinnada, xaqiiji xaadirinta,**
> **shaqada gurigana indhaha ku hay.**

*Gloss:* Follow the marks and reports, confirm attendance, and keep homework
in view.

*Direction:* A confident, even three-part rhythm — the three clauses should
feel like a list being counted off, each slightly separated. Keep the pace
moving; `indhaha ku hay` gets a small warmth at the end.

*Pronunciation:* `dhib-ca-ha` (aspirated dh) · `war-bi-xin-na-da` (geminate
nn, clear `x`) · `xa-qii-ji xaa-di-rin-ta` (long ii, long aa) ·
`in-dhe-ha ku hay`.

---

### Line 3 — cue 21.00 s · budget 7.00 s · target ≤ 4.5 s
**Scene:** 03 / From the school (Inbox · Announcements · Sent)

> **Fariimaha iyo ogeysiisyada dugsiga hal meel ka akhri.**

*Gloss:* Read the school's messages and announcements in one place.

*Direction:* The shortest, calmest line — a single clean statement, slightly
softer than line 2, letting the music breathe underneath.

*Pronunciation:* `fa-rii-me-ha` · `o-gey-sii-sya-da` · `ka akh-ri` (the `kh`
is clearly audible).

---

### Line 4 — cue 28.00 s · budget 7.00 s · target ≤ 6.5 s
**Scene:** 04 / Learning support (Mathematics · English · Class quizzes)

> **Ardaydana casharrada, layliyada iyo imtixaannada fasalka**
> **ayaa waxbarashada sii wadaya.**

*Gloss:* And for students, it is the lessons, exercises and class exams that
keep learning moving forward.

*Direction:* The emotional peak — lift the tone here, more resonance and a
touch of pride. `sii wadaya` should be delivered with a slight forward push,
the way a Somali singer leans into the last word of a phrase. Do not rush it;
this line fills a 7 s window and the original English ran 6.43 s.

*Pronunciation:* `ar-day-da-na` · `ca-shar-ra-da` (geminate rr) ·
`lay-li-ya-da` · `im-ti-xaa-na-da fa-sal-ka` · `wax-ba-ra-sha-da sii wa-da-ya`.

---

### Line 5 — cue 35.00 s · budget 6.10 s · target ≤ 4.5 s
**Scene:** CTA (crest, "A clearer view of school life.", Sign in)

> **MBK Parent Portal — ku gal iimaylka uu dugsigu kuu diiwaangeliyay.**

*Gloss:* MBK Parent Portal — sign in with the email your school registered for
you.

*Direction:* Settle back down. Brand name first, a clear beat, then the
instruction delivered as a warm, trustworthy invitation rather than a command.
End cleanly with no trailing breath — the video cuts to black immediately
after.

*Pronunciation:* `MBK` as three letters · `ku gal` · `ii-mayl-ka` ·
`uu dug-si-gu kuu dii-waan-ge-li-yay` (clear `c`-free, crisp `g`).

---

## 4. Short cut — 15 s narration

Single continuous take, cue 0.00 s, budget 15.10 s, **target ≤ 14.0 s**.
Beats: hook → marks → attendance/homework → school messages → learning → CTA,
2.5 s each.

> **Ilmahaaga maalintiisa dugsiga ha ka maqnaan.**
> **Dhibcaha, xaadirinta, shaqada guriga iyo fariimaha hal meel ka arag.**
> **Casharrada iyo imtixaannada fasalkana raac.**
> **MBK Parent Portal — ku gal iimaylka laguu diiwaangeliyay.**

*Gloss:* Don't be absent from your child's school day. See marks, attendance,
homework and messages in one place. Follow the lessons and class exams too.
MBK Parent Portal — sign in with the email registered for you.

*Direction:* Faster than the long cut but never clipped — this is a social
edit, so it needs energy while staying warm. Roughly 74 syllables, so aim for
about 5.3 syllables/second. Leave the final brand line slightly separated.

---

## 5. Voice character (both cuts)

- Mature Somali male, approximately 40–60 years old in character.
- Rich, warm, resonant chest voice; never thin, nasal or announcer-bright.
- Confident and expressive, with the melodic rise-and-fall of traditional
  Somali performance phrasing — but speech, not singing.
- Dignified, nostalgic, inspiring; communicates trust, pride and community.
- Clear standard pronunciation with natural Awdal regional colour; full
  pharyngeals (`x`, `c`, `q`), true vowel length, geminates preserved.
- No robotic cadence, no over-enunciation, no broadcast "hype", no audible
  reverb or room echo.

---

## 6. Recording specification

| Item | Requirement |
| --- | --- |
| Format | WAV, 48 kHz (44.1 kHz accepted), 24-bit preferred |
| Channels | Mono or stereo — the mix down-converts to stereo |
| Headroom | Peak ≤ −6 dBFS; no clipping, no limiter on the way in |
| Noise floor | ≤ −60 dBFS; dry room, no reverb, no music under the voice |
| Takes | 2–3 takes per line, plus one clean pick-up per line |
| Slate | State the line number at the head of each take |
| Naming | `somali-long-01.wav` … `somali-long-05.wav`, `somali-short.wav` |
| Placement | `promo-video/assets/audio/somali/` |

Trim leading silence so each file starts on the first spoken phoneme: the
build script pins every file to its cue by its own start point.

---

## 7. Finishing the video

Once the five long files (and the short file) are in `assets/audio/somali/`:

```bash
cd promo-video
node scripts/build-somali-dub.mjs measure   # timing QC: every line inside its beat
node scripts/build-somali-dub.mjs all       # build both cuts
```

Outputs (originals are never modified):

| File | What it is |
| --- | --- |
| `somali-dub/out/final-promo-somali-awdal.mp4` | Final 41 s promo, Somali audio |
| `somali-dub/out/short-version-somali-awdal.mp4` | Final 15 s social cut, Somali audio |
| `somali-dub/final-promo-somali-awdal.m4a` | Standalone narration + music mix |
| `somali-dub/short-version-somali-awdal.m4a` | Standalone narration + music mix |
| `somali-dub/out/dub-report-*.json` | Loudness, duration and sync report |

What the build does:

1. Keeps the **existing procedural music bed and transition tones** — they are
   original to this repository and need no replacement — at the same levels the
   Remotion composition used (bed 0.18, tones 0.34, voice 1.0).
2. Pins each Somali line to its scene-beat cue.
3. **Sidechain-ducks** the music under the voice so narration stays clear and
   prominent.
4. Masters to **−16 LUFS / −1.5 dBTP / LRA 11** using two-pass EBU R128 with
   linear gain, matching `scripts/normalize-audio.mjs` without pumping the
   vocal dynamics.
5. Muxes onto a **bit-exact copy** of the original picture (`-c:v copy`), so
   resolution, aspect ratio, frame rate, branding, on-screen text and
   transitions are unchanged — verified by identical video-stream MD5.
6. Encodes audio as AAC 192 kbps / 48 kHz stereo, the standard companion for
   H.264 MP4 delivery on WhatsApp, Facebook, TikTok and YouTube. The source
   audio was 96 kHz, but its actual content (a 44.1 kHz bed plus generated
   speech) has nothing above 22.05 kHz, so 48 kHz loses nothing real.

To review sync before any recording exists:

```bash
node scripts/build-somali-dub.mjs guide
```

That builds both cuts with a soft 660 Hz blip on every cue instead of voice,
so scene alignment, ducking and loudness can be checked first.

---

## 8. Pre-publication checklist

- [ ] A fluent Awdal Somali speaker has reviewed this script and the recording.
- [ ] `measure` reports every line inside its scene beat.
- [ ] Listening pass: no English remains anywhere in the audio.
- [ ] Listening pass: no original voice, no abrupt cut, no music over the vocal.
- [ ] Output duration matches the source master exactly (41.10 s / 15.10 s).
- [ ] Video-stream MD5 matches the source master.
- [ ] Loudness within ±0.5 LU of −16 LUFS, true peak above −2.0 dBFS.
- [ ] Clean start and clean end, no clipped first or last frame.
- [ ] Rights position for the voice is documented and satisfied.

---

## 9. External voice generation — handoff

Somali speech cannot be produced inside this repository's build environment;
it must be generated externally and ingested. Two services were **verified
against their own documentation** to support Somali. Neither has been run
successfully here, so **no audio file from either has been heard or approved**.

### Option 1 — Azure AI Speech (recommended)

| | |
| --- | --- |
| Voice | **`so-SO-MuuseNeural`** — Somali (Somalia), **male**. `so-SO-UbaxNeural` is the female alternative. |
| Verified by | Microsoft Azure Speech release notes, October 2021: *"Ubax in so-SO Somali (Somalia), Muuse in so-SO Somali (Somalia)"*, plus the Azure language-support table listing `so-SO`. |
| Account needed | **Yes.** A free Azure account, then create a **Speech** resource. |
| Credentials | `SPEECH_KEY` and `SPEECH_REGION` environment variables. Never commit these. |
| Cost | Free tier **F0 = 500,000 neural TTS characters/month**, no payment details required, does not expire. This script is about **500 characters in total**, so the whole narration sits far inside the free allowance. |
| Terms | Official, documented, commercial-use permitted under the Azure AI Speech terms. |

```bash
pip install azure-cognitiveservices-speech
export SPEECH_KEY=...      # from your Azure Speech resource
export SPEECH_REGION=...   # e.g. eastus

# One test sentence first — listen to it before generating everything.
python3 - <<'PY'
import os, azure.cognitiveservices.speech as sdk
cfg = sdk.SpeechConfig(subscription=os.environ["SPEECH_KEY"], region=os.environ["SPEECH_REGION"])
cfg.speech_synthesis_voice_name = "so-SO-MuuseNeural"
r = sdk.SpeechSynthesizer(speech_config=cfg, audio_config=sdk.audio_config.AudioOutputConfig(filename="test-so.wav"))
res = r.speak_text_async("Waalid, ilmahaaga maalintiisa dugsiga ha ka maqnaan.").get()
print("reason:", res.reason)
PY
```

If `test-so.wav` sounds acceptable, generate all six takes:

```bash
cd promo-video
python3 scripts/generate_somali_voice.py azure
```

### Option 2 — ElevenLabs

| | |
| --- | --- |
| Voice | Model-selected; language code **`som`**. |
| Verified by | ElevenLabs support article *"What languages do you support?"* — Eleven v3 lists **SOM Somali** among 74 languages. |
| Account needed | **Yes**, plus `ELEVENLABS_API_KEY`. |
| Terms | Commercial usage rights begin at the paid **Creator** plan. |
| Note | The most expressive automated option, but you must pick or design a voice; it is not a dedicated Somali voice. |

```bash
pip install elevenlabs
export ELEVENLABS_API_KEY=...
python3 scripts/generate_somali_voice.py elevenlabs --voice-id <voice_id>
```

### Not recommended for this deliverable

- **`edge-tts`** (Python, free, no key) drives the same `so-SO-MuuseNeural`
  voice through Microsoft's Edge Read-Aloud endpoint. It works and is widely
  used, but that endpoint is **not a documented, licensed public API**. For a
  promotional video that will be published commercially, use the official
  Azure SDK above instead.
- **Meta MMS-TTS `facebook/mms-tts-som`** and **SeamlessM4T-v2** both support
  Somali and run offline, but are **CC BY-NC 4.0 — non-commercial**. They must
  not ship in this promo. `generate_somali_voice.py` refuses that route unless
  `--i-understand-noncommercial` is passed.

### Dialect caveat — read this before publishing

`so-SO` voices are trained on **standard Somali**. Nothing verified here shows
that any synthetic voice reproduces **Awdal / Borama** regional speech, and no
such claim is made anywhere in this project. The Awdal character of this dub
comes from the **script** (section 2), not from the voice. A fluent Awdal
speaker should audition the result; if the synthetic delivery is not good
enough, section 6 and `RECORDING-SHEET.md` cover recording a native speaker
instead.

### Ingesting whatever you generate

```bash
cd promo-video

# One continuous read of the whole 41 s script:
node scripts/build-somali-dub.mjs ingest /path/to/narration.mp3 --as full-long

# …or the five scene-beat takes individually:
node scripts/build-somali-dub.mjs ingest /path/to/take1.mp3 --as long-1
node scripts/build-somali-dub.mjs ingest /path/to/take2.mp3 --as long-2
node scripts/build-somali-dub.mjs ingest /path/to/take3.mp3 --as long-3
node scripts/build-somali-dub.mjs ingest /path/to/take4.mp3 --as long-4
node scripts/build-somali-dub.mjs ingest /path/to/take5.mp3 --as long-5
node scripts/build-somali-dub.mjs ingest /path/to/short.mp3  --as short

# …or drop all six in one folder and let it map them by filename:
node scripts/build-somali-dub.mjs ingest /path/to/takes
```

`ingest` accepts wav, mp3, m4a, aac, flac, ogg, opus, webm and mp4. It
**rejects** anything that is missing, has no audio stream, is effectively
silent (peak below −50 dB), or is shorter than 0.5 s, and it **warns** when a
take overruns its scene beat or is clipping. Accepted files are converted to
48 kHz stereo WAV with handling rumble high-passed and leading silence
trimmed, then written to `assets/audio/somali/`.
