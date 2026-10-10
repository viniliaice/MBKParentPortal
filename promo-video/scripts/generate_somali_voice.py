#!/usr/bin/env python3
"""
Generate the Somali (Awdal) narration for the MBK Parent Portal promo.

This script exists because NO Somali speech engine is reachable from a
network-restricted sandbox, and because the built-in Arena TTS has no Somali
language at all. It implements every route that was *verified* to support
Somali, with an honest preflight check so it fails loudly and immediately
instead of silently producing non-Somali audio.

Routes, in recommended order
----------------------------
  edge-tts     Microsoft neural voice `so-SO-MuuseNeural` (MALE) via the free
               Edge Read-Aloud endpoint. No API key. Commercially usable.
               Needs egress to speech.platform.bing.com.

  azure        Official Azure Speech SDK, same `so-SO-MuuseNeural` voice.
               Needs SPEECH_KEY and SPEECH_REGION, plus egress to
               <region>.api.cognitive.microsoft.com.

  elevenlabs   Eleven v3 / Multilingual v2, language `som`. Most expressive;
               commercial rights from the Creator plan. Needs
               ELEVENLABS_API_KEY and egress to api.elevenlabs.io.

  mms          Meta MMS-TTS `facebook/mms-tts-som`. Runs fully offline on CPU
               once downloaded. **CC BY-NC — NON-COMMERCIAL.** Refuses to run
               unless --i-understand-noncommercial is passed, because a school
               promo is commercial use. Needs one-time egress to
               huggingface.co.

  file         Skip synthesis: use recordings you already have (e.g. a native
               Awdal voice artist, or licensed Xasan Aadan Samatar masters).

Script text is read from `remotion/content.ts` (LONG_SCRIPT_SO / SHORT_SCRIPT_SO)
so there is exactly one source of truth for the approved copy.

Usage
-----
  python3 scripts/generate_somali_voice.py preflight
  python3 scripts/generate_somali_voice.py edge-tts
  python3 scripts/generate_somali_voice.py azure
  python3 scripts/generate_somali_voice.py elevenlabs
  python3 scripts/generate_somali_voice.py mms --i-understand-noncommercial
  python3 scripts/generate_somali_voice.py file --from-dir /path/to/takes

Output: assets/audio/somali/somali-long-01..05.wav and somali-short.wav,
trimmed of leading silence and ready for scripts/build-somali-dub.mjs.
"""

from __future__ import annotations

import argparse
import os
import re
import socket
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_TS = PROJECT_ROOT / "remotion" / "content.ts"
OUT_DIR = PROJECT_ROOT / "assets" / "audio" / "somali"

# ---------------------------------------------------------------- voices

VOICES = {
    "edge-tts": {
        "voice": "so-SO-MuuseNeural",
        "gender": "male",
        "host": "speech.platform.bing.com",
        "port": 443,
        "credential_env": None,
        "commercial": True,
        "note": "Microsoft neural Somali male voice, free endpoint, no key.",
    },
    "azure": {
        "voice": "so-SO-MuuseNeural",
        "gender": "male",
        "host": "{region}.api.cognitive.microsoft.com",
        "port": 443,
        "credential_env": ["SPEECH_KEY", "SPEECH_REGION"],
        "commercial": True,
        "note": "Official Azure Speech SDK; so-SO-UbaxNeural is the female alternative.",
    },
    "elevenlabs": {
        "voice": None,  # model-driven, language_code=som
        "gender": "any",
        "host": "api.elevenlabs.io",
        "port": 443,
        "credential_env": ["ELEVENLABS_API_KEY"],
        "commercial": True,
        "note": "Eleven v3 verified to list SOM (Somali). Most expressive of the automated routes.",
    },
    "mms": {
        "voice": "facebook/mms-tts-som",
        "gender": "male (single speaker)",
        "host": "huggingface.co",
        "port": 443,
        "credential_env": None,
        "commercial": False,
        "note": "CC BY-NC 4.0 — NON-COMMERCIAL. Offline after a one-time download.",
    },
}

# Expected take names, matching scripts/build-somali-dub.mjs.
LONG_NAMES = [f"somali-long-0{i}.wav" for i in range(1, 6)]
SHORT_NAME = "somali-short.wav"

# Per-line target ceiling in seconds, from the scene beats in content.ts.
LONG_BUDGETS = [12.0, 9.0, 7.0, 7.0, 6.1]
SHORT_BUDGET = 15.1


# ---------------------------------------------------------------- script text


def read_script_from_content_ts() -> tuple[list[str], str]:
    """Parse LONG_SCRIPT_SO / SHORT_SCRIPT_SO out of remotion/content.ts."""
    text = CONTENT_TS.read_text(encoding="utf-8")

    block = re.search(
        r"export const LONG_SCRIPT_SO = \[(.*?)\] as const;", text, re.S
    )
    if not block:
        sys.exit("Could not find LONG_SCRIPT_SO in remotion/content.ts")
    long_lines = re.findall(r"'((?:[^'\\]|\\.)*)'", block.group(1))

    short = re.search(
        r"export const SHORT_SCRIPT_SO =\s*\n?\s*'((?:[^'\\]|\\.)*)'", text
    )
    if not short:
        sys.exit("Could not find SHORT_SCRIPT_SO in remotion/content.ts")

    if len(long_lines) != 5:
        sys.exit(f"Expected 5 long lines in content.ts, found {len(long_lines)}")

    def unescape(literal: str) -> str:
        """Undo JS single-quoted string escaping WITHOUT touching UTF-8 bytes.

        `str.encode().decode("unicode_escape")` would corrupt the em-dash and
        any other multi-byte character in the Somali copy, so only the escapes
        that can actually appear inside a single-quoted TS literal are undone.
        """
        return literal.replace("\\\'", "'").replace("\\\\", "\\")

    return [unescape(l) for l in long_lines], unescape(short.group(1))


# ---------------------------------------------------------------- preflight


def host_reachable(host: str, port: int, timeout: float = 8.0) -> tuple[bool, str]:
    """
    One attempt, no retry loop. Returns (ok, detail).

    A plain TCP connect is NOT sufficient here: this sandbox puts a transparent
    egress proxy in front of :443 that accepts the TCP connection for any host
    and then closes it during the TLS handshake unless the SNI name is on the
    allow-list. So we must complete a real TLS handshake to claim a host is
    reachable, otherwise the preflight reports a false positive.
    """
    import ssl

    if "{" in host:
        return False, f"endpoint placeholder unresolved: {host} (set the region env var)"
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        return False, f"DNS failure: {exc}"
    fams = sorted({i[0].name for i in infos})
    tcp_ok = False
    last = "no attempt"
    for info in infos[:4]:
        try:
            raw = socket.create_connection((info[4][0], port), timeout=timeout)
        except OSError as exc:
            last = f"TCP {port} refused/blocked ({type(exc).__name__})"
            continue
        tcp_ok = True
        try:
            ctx = ssl.create_default_context()
            with ctx.wrap_socket(raw, server_hostname=host) as tls:
                return True, f"TLS {tls.version()} handshake completed (resolved {', '.join(fams)})"
        except Exception as exc:  # noqa: BLE001 - report the precise egress failure
            last = (
                f"TCP {port} open but TLS handshake blocked by egress proxy: "
                f"{type(exc).__name__}: {exc}"
            )
            try:
                raw.close()
            except OSError:
                pass
    if tcp_ok:
        return False, last
    return False, last



def env_status(route: str) -> list[str]:
    spec = VOICES[route]
    out = []
    for var in spec["credential_env"] or []:
        out.append(f"{'set' if os.environ.get(var) else 'MISSING'}  {var}")
    return out


def preflight(route: str | None = None) -> int:
    routes = [route] if route else list(VOICES)
    print("\nSomali TTS route preflight")
    print("=" * 74)
    any_ok = False
    for r in routes:
        spec = VOICES[r]
        host = spec["host"]
        if r == "azure":
            region = os.environ.get("SPEECH_REGION", "<region>")
            host = host.format(region=region)
        ok, detail = host_reachable(host, spec["port"])
        any_ok = any_ok or ok
        print(f"\n  [{r}]  {spec['note']}")
        print(f"    voice        {spec['voice'] or 'model-selected'} ({spec['gender']})")
        print(f"    endpoint     {host}:{spec['port']}")
        print(f"    reachable    {'YES' if ok else 'NO'} — {detail}")
        print(f"    commercial   {'yes' if spec['commercial'] else 'NO (CC BY-NC)'}")
        for line in env_status(r):
            print(f"    credential   {line}")
    print("\n" + "=" * 74)
    if any_ok:
        print("  At least one route is reachable — proceed with generation.\n")
        return 0
    print(
        "  NO automated Somali TTS route is reachable from this machine.\n"
        "  This is a network egress restriction, not a missing package.\n"
        "  See somali-dub/INVESTIGATION-somali-tts.md for the evidence and the\n"
        "  recommended paths (unblock one host, supply an API key, or record a\n"
        "  native Awdal voice and use the `file` route).\n"
    )
    return 1


# ---------------------------------------------------------------- post-processing


def ffmpeg() -> str:
    for cand in (os.environ.get("FFMPEG_PATH"), "ffmpeg"):
        if cand and (cand == "ffmpeg" or Path(cand).exists()):
            return cand
    return "ffmpeg"


def display(path: Path) -> str:
    """Project-relative when possible, absolute otherwise (--out-dir may be elsewhere)."""
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def duration_of(path: Path) -> float:
    res = subprocess.run(
        [ffmpeg(), "-hide_banner", "-i", str(path)],
        capture_output=True, text=True,
    )
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", res.stderr + res.stdout)
    if not m:
        return -1.0
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def normalise_take(src: Path, dst: Path, rate: int = 48000) -> None:
    """48 kHz stereo, leading silence trimmed so the take starts on the first phoneme."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            ffmpeg(), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
            "-af", (
                "highpass=f=70,"
                "silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB,"
                f"aresample={rate}:async=1:first_pts=0"
            ),
            "-ac", "2", "-ar", str(rate), "-c:a", "pcm_s24le", str(dst),
        ],
        check=True,
    )


def verify_somali_output(takes: list[tuple[Path, str, float, float]]) -> bool:
    """
    Verify each take really contains speech of plausible length. A silent or
    sub-second file means the engine did not actually speak Somali.
    """
    print("\nOutput verification")
    print("-" * 74)
    ok = True
    for path, text, budget, dur in takes:
        floor = min(1.2, budget * 0.15)
        good = dur >= floor and dur <= budget + 0.25
        ok = ok and good
        print(
            f"  {path.name:<22} {dur:5.2f}s / budget {budget:5.2f}s  "
            f"{'OK' if good else 'PROBLEM'}  [{len(text.split())} words]"
        )
        if dur < floor:
            print(f"      -> too short: the engine likely produced no speech")
        if dur > budget + 0.25:
            print(f"      -> overruns its scene beat by {dur - budget:.2f}s")
    print("-" * 74)
    print(
        "  NOTE: duration checks prove audio exists and fits; they do NOT prove the\n"
        "        language is Somali or the dialect is Awdal. A fluent Awdal Somali\n"
        "        speaker must audition every take before publication.\n"
    )
    return ok


# ---------------------------------------------------------------- routes


def route_edge_tts(lines: list[tuple[str, Path]], rate: str = "-2%") -> list[Path]:
    import asyncio

    import edge_tts  # type: ignore

    async def synth(text: str, out: Path) -> None:
        communicate = edge_tts.Communicate(text, VOICES["edge-tts"]["voice"], rate=rate)
        await communicate.save(str(out))

    made = []
    for text, out in lines:
        tmp = out.with_suffix(".raw.mp3")
        asyncio.run(synth(text, tmp))
        normalise_take(tmp, out)
        tmp.unlink(missing_ok=True)
        made.append(out)
    return made


def route_azure(lines: list[tuple[str, Path]]) -> list[Path]:
    import azure.cognitiveservices.speech as speechsdk  # type: ignore

    key, region = os.environ["SPEECH_KEY"], os.environ["SPEECH_REGION"]
    cfg = speechsdk.SpeechConfig(subscription=key, region=region)
    cfg.speech_synthesis_voice_name = VOICES["azure"]["voice"]
    cfg.speech_synthesis_output_format = (
        speechsdk.SpeechSynthesisOutputFormat.Raw48Khz16BitMonoPcm
    )
    made = []
    for text, out in lines:
        synth = speechsdk.SpeechSynthesizer(speech_config=cfg, audio_config=None)
        result = synth.speak_text_async(text).get()
        if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
            raise RuntimeError(f"Azure synthesis failed for {out.name}: {result.reason}")
        tmp = out.with_suffix(".raw.wav")
        import wave

        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(48000)
            w.writeframes(result.audio_data)
        normalise_take(tmp, out)
        tmp.unlink(missing_ok=True)
        made.append(out)
    return made


def route_elevenlabs(lines: list[tuple[str, Path]], voice_id: str | None) -> list[Path]:
    from elevenlabs.client import ElevenLabs  # type: ignore

    client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    vid = voice_id or os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    made = []
    for text, out in lines:
        audio = client.text_to_speech.convert(
            voice_id=vid,
            text=text,
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
            language_code="som",
        )
        tmp = out.with_suffix(".raw.mp3")
        with open(tmp, "wb") as fh:
            for chunk in audio:
                fh.write(chunk)
        normalise_take(tmp, out)
        tmp.unlink(missing_ok=True)
        made.append(out)
    return made


def route_mms(lines: list[tuple[str, Path]]) -> list[Path]:
    import torch  # type: ignore
    from transformers import AutoProcessor, VitsModel  # type: ignore

    name = VOICES["mms"]["voice"]
    model = VitsModel.from_pretrained(name)
    processor = AutoProcessor.from_pretrained(name)
    made = []
    for text, out in lines:
        inputs = processor(text=text, return_tensors="pt")
        with torch.no_grad():
            speech = model(**inputs).waveform[0].numpy()
        tmp = out.with_suffix(".raw.wav")
        import wave

        import numpy as np

        pcm = np.int16(np.clip(speech, -1, 1) * 32767)
        with wave.open(str(tmp), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(model.config.sampling_rate)
            w.writeframes(pcm.tobytes())
        normalise_take(tmp, out)
        tmp.unlink(missing_ok=True)
        made.append(out)
    return made


# ---------------------------------------------------------------- cli


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("route", choices=[*VOICES, "file", "preflight"], nargs="?", default="preflight")
    ap.add_argument("--i-understand-noncommercial", action="store_true",
                    help="required for the CC BY-NC MMS route")
    ap.add_argument("--from-dir", type=Path, help="for route `file`: folder of existing takes")
    ap.add_argument("--voice-id", help="ElevenLabs voice id override")
    ap.add_argument("--rate", default="-2%", help="edge-tts speaking rate (e.g. -5%%)")
    ap.add_argument("--out-dir", type=Path,
                    help="override the take output folder (default assets/audio/somali)")
    args = ap.parse_args()

    if args.route == "preflight":
        return preflight()

    long_lines, short_line = read_script_from_content_ts()
    global OUT_DIR
    if args.out_dir:
        OUT_DIR = args.out_dir.resolve()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    jobs: list[tuple[str, Path, float]] = [
        (t, OUT_DIR / n, b) for t, n, b in zip(long_lines, LONG_NAMES, LONG_BUDGETS)
    ] + [(short_line, OUT_DIR / SHORT_NAME, SHORT_BUDGET)]

    # --- route: use recordings you already have -------------------------------
    if args.route == "file":
        src = args.from_dir
        if not src or not src.is_dir():
            sys.exit("route `file` needs --from-dir pointing at your recordings")
        print(f"\nImporting takes from {src}")
        made = []
        for text, out, _budget in jobs:
            candidates = [src / out.name, src / out.with_suffix(".mp3").name,
                          src / out.with_suffix(".m4a").name, src / out.stem]
            found = next((c for c in candidates if c.exists()), None)
            if found is None:
                print(f"  MISSING {out.name} — looked for {out.stem}.* in {src}")
                continue
            normalise_take(found, out)
            made.append(out)
            print(f"  imported {found.name} -> {display(out)}")
        if len(made) != len(jobs):
            print(f"\n  Only {len(made)}/{len(jobs)} takes found; not finished.\n")
            return 1
    else:
        # --- automated routes: preflight first, fail loudly -------------------
        spec = VOICES[args.route]
        if not spec["commercial"] and not args.i_understand_noncommercial:
            print(
                "\n  REFUSING: facebook/mms-tts-som is licensed CC BY-NC 4.0\n"
                "  (non-commercial). A promotional video for a school product is\n"
                "  commercial use. Pass --i-understand-noncommercial only if you\n"
                "  have cleared this, otherwise use edge-tts, azure or elevenlabs.\n"
            )
            return 2
        if preflight(args.route) != 0:
            return 1
        for var in spec["credential_env"] or []:
            if not os.environ.get(var):
                sys.exit(f"route `{args.route}` requires the {var} environment variable")

        print(f"\nGenerating with route `{args.route}` …")
        pairs = [(t, out) for t, out, _b in jobs]
        try:
            if args.route == "edge-tts":
                route_edge_tts(pairs, rate=args.rate)
            elif args.route == "azure":
                route_azure(pairs)
            elif args.route == "elevenlabs":
                route_elevenlabs(pairs, args.voice_id)
            elif args.route == "mms":
                route_mms(pairs)
        except ImportError as exc:
            sys.exit(f"Missing Python dependency for route `{args.route}`: {exc}\n"
                     f"Install it into promo-video/.venv and re-run.")
        made = [out for _t, out, _b in jobs]

    takes = [(out, text, budget, duration_of(out)) for text, out, budget in jobs]
    ok = verify_somali_output(takes)

    if ok:
        print("  All takes present and inside their scene beats.")
        print("\n  Next steps:")
        print("    1. Have a fluent Awdal/Borama Somali speaker audition every take.")
        print("    2. node scripts/build-somali-dub.mjs measure")
        print("    3. node scripts/build-somali-dub.mjs all")
        print("    4. Listen to somali-dub/out/*.mp4 before publishing.\n")
        return 0
    print("  Some takes failed verification — see above.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
