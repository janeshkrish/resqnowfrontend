# "Hey ResQNow" wake-word model: how it is made

ResQNow's own wake-word detector, `public/hey-resqnow/hey-resqnow.bin`, is trained with the scripts in
this folder. It runs entirely on the customer's phone (`public/hey-resqnow/detector.js` in a Web
Worker). No audio is sent anywhere, and nothing here is a paid service.

## Why it exists

Until 2026-11-26 the app used sherpa-onnx's English keyword spotter (gigaspeech 3.3M). It was tuned on
Windows' synthetic voices and **did not detect a single one of six real recordings** of people saying
"Hey ResQNow" (best score 0.001 at the loosest setting). The model had learned American podcast
English and did not hear Indian voices on phone microphones as "hey rescue now".

## How it works

1. 16 kHz audio becomes a mel spectrogram (`melspectrogram.onnx`), then speech embeddings
   (`embedding_model.onnx`). These are Google's speech-embedding model as packaged by openWakeWord
   v0.5.1, Apache-2.0. The embeddings are robust to accents because Google trained them on a very
   large amount of speech.
2. Every 80 ms our classifier (`hey-resqnow.bin`, 64-unit two-layer network, 400 KB) scores the last
   ~2 seconds of embeddings.
3. It wakes when a score reaches **0.95** and the moment just before or after it is at least **0.5**
   (`THRESHOLD` / `CONFIRM` in `public/hey-resqnow/worker.js`).

## Training data (all free, all allow commercial use)

| What | Where from | Licence |
|---|---|---|
| Real recordings of people saying "Hey ResQNow" | ResQNow (WhatsApp voice notes) | ResQNow's own; **not stored in the repo** |
| ~9,600 synthetic "Hey ResQNow" clips, 904 voices, Indian-English pronunciations (flat "hē", tapped r, "res-kyu", "nau") | Piper `en_US-libritts_r-medium` (`gen_tts.py`) | MIT; LibriTTS-R data CC BY 4.0 |
| ~7,800 near-miss phrases ("hey rescue me", "hey Siri", "yes now", Tanglish roadside talk) | same | same |
| 2.3 h Tamil + English speech for "not the wake word" | Google FLEURS `ta_in` dev, `en_us` dev | CC BY 4.0 |
| 2.1 h Tamil speech **held back** to count false alarms | Google FLEURS `ta_in` test | CC BY 4.0 |
| Noise: traffic-like, horns, babble, room echo, phone band-limits | generated in `feats.py` | — |

Deliberately **not** used: openWakeWord's ACAV100M feature set (CC BY-NC-SA, non-commercial) and the
MIT impulse-response set (licence unknown).

## Results (model shipped 2026-11-26)

Honest checks: each fold model was trained on half the real recordings and tested on the other half,
which it never heard.

| Check | Result |
|---|---|
| Six real recordings, each tested by a model that never heard it, shipping JavaScript, 8 dither seeds × 16 alignments | **128/128 detected, every recording** |
| Same, under 24 noise/echo/phone conditions each (harsh: babble down to 3 dB SNR) | 58–100% per recording |
| Six real recordings in real Chrome (Playwright fake microphone), phone and desktop | 12/12 open Thozhan |
| Held-back Tamil speech (2.1 h), shipped setting | ~1.5 false wakes per hour of continuous talk (clean and noisy) |
| Near-miss phrases, held-back voices | ~1% wake |
| Previous sherpa-onnx spotter on the same six recordings | 0/6 |

More real recordings are the best way to improve it. Aim for 50–100 recordings from 20+ different
people (men, women, older, younger, different districts), plus a few minutes of ordinary Tamil and
Tanglish talk near the phone.

## Retraining

Work in a scratch folder `W` (never in the repo). Layout:

```
W/dl/oww/melspectrogram.onnx, embedding_model.onnx   openWakeWord v0.5.1 release
W/dl/piper/en_US-libritts_r-medium.onnx(.json)        huggingface.co/rhasspy/piper-voices
W/dl/fleurs/ta_in_audio_dev.tar.gz, en_us_audio_dev.tar.gz, ta_in_audio_test.tar.gz
W/wav/r1.wav, r2.wav, ...                             real recordings, 16 kHz mono 16-bit
W/train, W/feats                                      made by the scripts
```

Python 3.13 with numpy, torch, onnxruntime and piper-tts. WhatsApp `.ogg` voice notes can be turned
into `W/wav/rN.wav` with `decode-server.mjs` and `decode.html`: name them `rN.ogg`, serve the folder,
and open `decode.html?n=<count>` in Chrome.

```
python gen_tts.py W 9000 7000           # synthetic positives and near misses
python build_feats.py W real            # real recordings, 400 varied copies each + streaming tests
python build_feats.py W tts
python build_feats.py W neg             # FLEURS speech, 4 augmentation passes, and noise
python build_feats.py W eval            # held-back Tamil speech
python train.py W 1,3,5 foldA 24000 49 64 0.5 0.1    # honest check: hold out 2,4,6
python evaluate.py W foldA 2,4,6
python train.py W all final 24000 49 64 0.5 0.1      # the model to ship
python evaluate.py W final
```

To ship: copy `W/train/final.bin` to `public/hey-resqnow/hey-resqnow.bin`, put its SHA-256 in
`scripts/thozhan-artifacts.mjs`, then run `npm test`, `npm run test:scripts` and the Playwright suite.
