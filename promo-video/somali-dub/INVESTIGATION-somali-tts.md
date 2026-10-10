# Somali TTS investigation — MBK Parent Portal promo dub

**Date:** 2026-10-10 · **Status: no Somali speech has been generated. The task is not complete.**

This report records a full Phase 1 investigation into how to produce natural
Awdal Somali narration for `final-promo.mp4` and `short-version.mp4`, what was
verified, what was ruled out and why, and the exact restriction that blocks
completion here.

Every language-support claim below was checked against a primary source or
tested directly. Nothing is asserted from memory.

---

## 1. Bottom line

**No reachable Somali text-to-speech engine exists in this environment.**

Somali TTS *does* exist and is well supported commercially and in open
research — but every engine that has it is delivered either as a cloud API or
as model weights hosted on Hugging Face, and this sandbox's network allow-list
blocks both. The engines that could be installed offline from PyPI/npm
(eSpeak NG, Coqui, Piper) **do not support Somali at all**.

So the gap is not "nobody has built Somali TTS". It is "the two Somali-capable
distribution channels — cloud endpoints and Hugging Face — are both outside the
allow-list".

---

## 2. The exact network restriction

Tested directly with Python `ssl` (a plain TCP probe is misleading here — see
the note below):

| Host | Purpose | DNS | TCP :443 | TLS handshake |
| --- | --- | --- | --- | --- |
| `pypi.org` | allowed package host | ok | ok | **ok (TLSv1.3)** |
| `github.com`, `api.github.com` | allowed | ok | ok | **ok** |
| `registry.npmjs.org` | allowed | ok | ok | **ok** |
| `speech.platform.bing.com` | edge-tts / Azure neural Somali | ok | ok | **BLOCKED — `SSLZeroReturnError`, connection closed at handshake** |
| `api.elevenlabs.io` | ElevenLabs Somali (`som`) | ok | ok | **BLOCKED — same** |
| `huggingface.co` | MMS-TTS-som, SeamlessM4T, all open Somali weights | ok | ok | **BLOCKED — same** |
| `*.api.cognitive.microsoft.com` | official Azure Speech | n/a | n/a | **BLOCKED — DNS not resolvable without a region; endpoint family not allow-listed** |
| `texttospeech.googleapis.com` | Google Cloud TTS | — | — | **BLOCKED** |
| `translate.google.com` | gTTS | — | — | **BLOCKED** |

**Why a TCP probe lies:** the egress proxy accepts the TCP connection on :443
for *any* host and only closes it during the TLS handshake when the SNI name is
not allow-listed. My first preflight version tested TCP only and wrongly
reported `edge-tts`, `elevenlabs` and `huggingface` as reachable. That was
fixed in `scripts/generate_somali_voice.py` — reachability now requires a
completed TLS handshake. The corrected preflight correctly reports all four
routes as unreachable and exits non-zero.

**Practical consequence:** unblocking exactly one host,
`speech.platform.bing.com`, would be enough to produce real neural Somali male
speech with no API key and no cost (see route A).

---

## 3. Engines verified to support Somali

| Engine | Somali support — how verified | Voice | Licence | Reachable | Needs |
| --- | --- | --- | --- | --- | --- |
| **Azure Speech neural TTS** | Microsoft release notes (Oct 2021) and Azure language-support docs list `so-SO` | **`so-SO-MuuseNeural` (male)**, `so-SO-UbaxNeural` (female) | Commercial (paid service; Edge endpoint free) | ❌ | `SPEECH_KEY`, `SPEECH_REGION` — or nothing via edge-tts |
| **edge-tts** (same Azure neural voices, free Edge endpoint) | PyPI `edge-tts` 7.2.8 installed and executed; failed only at the TLS handshake above | `so-SO-MuuseNeural` | MIT package, free endpoint | ❌ | **nothing — no key** |
| **ElevenLabs** | ElevenLabs support article: Eleven v3 supports 74 languages including **SOM Somali** | model-selected | Commercial rights from Creator plan | ❌ | `ELEVENLABS_API_KEY` |
| **Meta MMS-TTS** (`facebook/mms-tts-som`) | MMS covers 1000+ languages incl. Somali; runs offline on CPU | single male speaker | **CC BY-NC 4.0 — non-commercial** (read from the reachable `facebookresearch/fairseq` `examples/mms/MODEL_CARD.md`) | ❌ | one-time HF download |
| **Meta SeamlessM4T-v2-large** | arXiv 2308.11596 lists `som · Somali` among the **36 speech-output languages**; the HiFi-GAN vocoder covers all 36 | translation-oriented voice | CC BY-NC 4.0 | ❌ | HF download, 2.3 B params |
| **Google Cloud TTS** | aggregator listings show `so-SO`; **not independently confirmed here** | — | Commercial | ❌ | GCP credentials |

---

## 4. Engines ruled out — no Somali at all

Each was checked against a primary source, not assumed.

| Engine | Proof it lacks Somali |
| --- | --- |
| **Arena built-in `add_voice` / `generate_speech`** | Tool returned: `language "so" is not supported by any available system`. A selected voice then returned: `Voice "voice-01" cannot speak "so"`. No Somali model is registered. |
| **eSpeak NG** | Authoritative listing of all 2 928 files in `espeak-ng/espeak-ng-data/lang/` — no `so`. The Cushitic folder `lang/cus/` contains **only `om` (Oromo)**. The PyPI `espeakng_loader` wheel ships `libespeak-ng.so` + 141 languages; `so` is not among them. |
| **Coqui TTS / XTTS-v2** | Official docs: XTTS-v2 supports **17 languages** (en, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh-cn, ja, hu, ko, hi). No Somali. |
| **Piper** | `piper_tts` 1.8.0 wheel bundles `espeak-ng-data` with no `so`; `rhasspy/piper` and `OHF-Voice/piper1-gpl` releases contain **0** Somali voice assets. |
| **sherpa-onnx GitHub-release MMS mirrors** | All **644 assets** of the `tts-models` release enumerated: `vits-mms-*` covers only **deu, eng, fra, nan, rus, spa, tha, ukr** (8 languages). Zero assets matching `som`. |
| **Amazon Polly** | Not confirmed to have Somali; endpoint unreachable regardless. |
| **gTTS** | Depends on `translate.google.com`, blocked; no Somali voice guarantee. |
| **npm `node-edge-tts`, `edge-tts-universal`, `@andresaya/edge-tts`** | Same blocked `speech.platform.bing.com` endpoint as the Python package. |
| **GitHub "Somali TTS" repos** | All 6 results are 0–1★ hobby projects that call Azure or a Hugging Face Space — no weights, nothing self-contained. |

---

## 5. A licensing finding that rules out the obvious offline option

MMS-TTS and SeamlessM4T are the only Somali engines that run fully offline
once downloaded, which makes them look like the natural fallback. They are
licensed **CC BY-NC 4.0 — non-commercial** (verified from the reachable
fairseq `MODEL_CARD.md`).

A promotional video for a school product is commercial use. So even with HF
unblocked, **MMS/SeamlessM4T audio should not ship in this promo** without a
separate licence. `scripts/generate_somali_voice.py` enforces this: the `mms`
route refuses to run unless `--i-understand-noncommercial` is passed.

---

## 6. Recommendation

**Route A — `edge-tts` → `so-SO-MuuseNeural`** is the best automated option if
one host can be allow-listed:

- a real neural Somali **male** voice, matching the brief's gender and register;
- **no API key, no cost**, package already installable from the reachable PyPI;
- commercially usable, unlike MMS/SeamlessM4T;
- requires only `speech.platform.bing.com` to be unblocked.

**Route B — commission a native Awdal speaker.** This is what I recommend for
publication. No current Somali TTS reproduces Awdal/Borama regional colour or
the traditional Somali melodic phrasing the brief asks for: Azure's `so-SO`
voices are trained on **standard Somali**, and every automated option will need
a fluent local reviewer anyway (brief §2 and §7 both require that review).
The script, per-line timing budget and performance direction are already
written — see `SCRIPT-somali-awdal.md`. Recording is a 30-minute session.

**Route C — licensed Xasan Aadan Samatar audio.** Only with written permission
from the artist or his rights holder plus the master recordings. That is
licensed use of real audio, not cloning. No permission instrument or recording
exists in this repository. Cloning or imitating his voice without that is not
something this project will do.

**Not recommended:** MMS-TTS (non-commercial licence, and noticeably synthetic
— it would not meet the "avoid robotic pronunciation" requirement).

---

## 7. What is already built and verified

The dub pipeline is complete and tested, so a voice file is the only missing
input.

| Item | Evidence |
| --- | --- |
| Awdal Somali script, 5 long lines + 1 short line, cued to the real scene beats | `SCRIPT-somali-awdal.md`; recorded in `remotion/content.ts` as `LONG_SCRIPT_SO` / `SHORT_SCRIPT_SO` |
| Scene-beat timing extracted from the actual masters | `LONG_VOICE_SEGMENTS` cues 0/12/21/28/35 s; masters measured at 41.10 s and 15.10 s |
| Audio-replacement build | `scripts/build-somali-dub.mjs` |
| **Video preserved bit-for-bit** | video-stream MD5 identical to source for both cuts: `708dbfb6…` (long), `68cd3701…` (short) |
| **Spec preserved** | 1080×1920, 30 fps, H.264 High, yuvj420p → AAC stereo; durations 41.10 s and 15.10 s unchanged |
| **Mix faithful to the original** | rebuilt using the original English takes: −16.2 → −15.9 LUFS (long), −15.8 → −16.1 LUFS (short) |
| Loudness mastering | EBU R128 two-pass with linear gain to −16 LUFS / −1.5 dBTP, matching `normalize-audio.mjs` without pumping vocal dynamics |
| Voice-over-music clarity | sidechain ducking on the existing procedural bed |
| Original music retained | bed + transition tones are original to this repo, kept at the documented levels (0.18 / 0.34) |
| End-to-end dry run | placeholder takes of realistic length ran through import → verification → `measure` → build → MD5 check, all green |
| Sync proof for review | `somali-dub/out/*-GUIDE-PROOF.mp4` — real picture, music intact, a 660 Hz blip on every cue |
| Multi-route generator with honest preflight | `scripts/generate_somali_voice.py`; correctly reports all automated routes unreachable and exits 1 |

**Not done, and not claimed:** no Somali audio exists. No final dubbed video
has been produced. The `-GUIDE-PROOF` files contain **tone blips, not speech**.

---

## 8. To finish

Pick a route, then:

```bash
cd promo-video

# Route A (after speech.platform.bing.com is allow-listed)
python3 -m venv .venv && .venv/bin/pip install edge-tts
FFMPEG_PATH=/usr/bin/ffmpeg .venv/bin/python scripts/generate_somali_voice.py edge-tts

# Route B (native Awdal recording — send the takes, or point at them)
.venv/bin/python scripts/generate_somali_voice.py file --from-dir /path/to/takes

# then, either way
node scripts/build-somali-dub.mjs measure   # every line inside its beat
node scripts/build-somali-dub.mjs all       # both cuts, picture untouched
```

Outputs land in `somali-dub/out/` plus standalone `.m4a` narration mixes in
`somali-dub/`. `final-promo.mp4`, `short-version.mp4` and everything in
`assets/audio/` are only ever read, never written.
