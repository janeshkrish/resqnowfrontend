# Builds training and test features for the "Hey ResQNow" detector.
import sys, os, tarfile, numpy as np, time
S = sys.argv[1]
sys.path.insert(0, f"{S}/tools")
from feats import Featurizer, Backgrounds, augment, windows, WIN, SR, rms
from wavio import read_wav_bytes

OUT = f"{S}/feats"; os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)
F = Featurizer(S)
t0 = time.time()
log = lambda *a: print(f"[{time.time()-t0:6.0f}s]", *a, flush=True)


def fleurs(name, limit=None):
    xs = []
    with tarfile.open(f"{S}/dl/fleurs/{name}") as t:
        for m in t:
            if m.isfile() and m.name.endswith(".wav"):
                x, r = read_wav_bytes(t.extractfile(m).read())
                if r == SR and len(x) > SR: xs.append(x / max(1e-4, np.abs(x).max()) * 0.8)
                if limit and len(xs) >= limit: break
    return xs


speech = fleurs("ta_in_audio_dev.tar.gz") + fleurs("en_us_audio_dev.tar.gz")
log("fleurs train speech files", len(speech))
bg = Backgrounds(speech)


def save(name, arr): np.save(f"{OUT}/{name}.npy", arr.astype(np.float16)); log(name, arr.shape)


def clip_feats(clips, reps, **kw):
    batch = []
    for c in clips:
        x = c.astype(np.float32) / 32768 if c.dtype == np.int16 else c
        for _ in range(reps): batch.append(augment(x, rng, bg, **kw))
    return F.clips(np.stack(batch))


def clean_place(clips):  # just placed at the end, no noise
    out = []
    for c in clips:
        x = c.astype(np.float32) / 32768 if c.dtype == np.int16 else c
        y = np.zeros(WIN, np.float32); x = x[-(WIN - 1600):]; y[WIN - 1600 - len(x):WIN - 1600] = x
        out.append(y * (0.1 / rms(x)))
    return F.clips(np.stack(out))


which = sys.argv[2] if len(sys.argv) > 2 else "all"

if which in ("all", "tts"):
    pos = np.load(f"{S}/train/tts_pos_train.npy", allow_pickle=True)
    for k in range(0, len(pos), 3000):
        save(f"pos_tts_train_{k//3000}", clip_feats(pos[k:k + 3000], 2))
    pt = np.load(f"{S}/train/tts_pos_test.npy", allow_pickle=True)
    save("pos_tts_test_noisy", clip_feats(pt, 1)); save("pos_tts_test_clean", clean_place(pt))
    adv = np.load(f"{S}/train/tts_adv_train.npy", allow_pickle=True)
    for k in range(0, len(adv), 3500):
        save(f"adv_train_{k//3500}", clip_feats(adv[k:k + 3500], 2))
    at = np.load(f"{S}/train/tts_adv_test.npy", allow_pickle=True)
    save("adv_test", np.concatenate([clip_feats(at, 1), clean_place(at)]))

if which in ("all", "real"):
    from kwsio import read_wav16
    import glob, re
    ids = sorted(int(re.search(r"r(\d+)\.wav$", p).group(1)) for p in glob.glob(f"{S}/wav/r*.wav"))
    for i in ids:
        x = read_wav16(f"{S}/wav/r{i}.wav")
        save(f"pos_real_r{i}", clip_feats([x], 400, real=True))
        save(f"pos_real_r{i}_clean", clean_place([x]))
        # Streaming test: background before and after, 24 different conditions.
        streams = []
        for j in range(24):
            n = len(x) + int(SR * 2.5)
            y = np.zeros(n, np.float32); y[int(1.5 * SR):int(1.5 * SR) + len(x)] = x
            if j == 0: z = y
            else:
                z = augment(y, rng, bg, n_out=n, place_end=False, snr=(3, 25), real=True)
            streams.append(F.long(z).astype(np.float16))
        np.save(f"{OUT}/stream_real_r{i}.npy", np.array(streams, dtype=object), allow_pickle=True)
    log("real done")

if which in ("all", "neg"):
    parts = []
    for p in range(4):
        for k, x in enumerate(speech):
            if p == 0:
                x = x * rng.uniform(0.05, 0.9)
            elif p == 1:
                x = augment(x, rng, bg, n_out=len(x), place_end=False, snr=(0, 20))
            elif p == 2:
                x = augment(x, rng, bg, n_out=len(x), place_end=False, snr=(5, 30), real=True)
            else:
                x = augment(x, rng, bg, n_out=len(x), place_end=False, snr=(15, 40), p_noise=0.5, real=True)
            parts.append(windows(F.long(x), stride=2))
        log("neg speech pass", p, sum(len(q) for q in parts))
    save("neg_speech", np.concatenate(parts)); parts = None
    nz = np.stack([np.clip(bg.noise(WIN, rng) * rng.uniform(0.005, 0.2), -1, 1) for _ in range(5000)]).astype(np.float32)
    save("neg_noise", F.clips(nz))

if which in ("all", "eval"):
    # Held-out Tamil speech (never trained on) for counting false alarms per hour, clean and noisy.
    test = fleurs("ta_in_audio_test.tar.gz")
    clean = [F.long(x * rng.uniform(0.1, 0.9)).astype(np.float16) for x in test]
    noisy = [F.long(augment(x, rng, bg, n_out=len(x), place_end=False, snr=(0, 20))).astype(np.float16) for x in test]
    hours = sum(len(x) for x in test) / SR / 3600
    np.save(f"{OUT}/eval_ta_test_clean.npy", np.array(clean, dtype=object), allow_pickle=True)
    np.save(f"{OUT}/eval_ta_test_noisy.npy", np.array(noisy, dtype=object), allow_pickle=True)
    log("eval hours", round(hours, 3))
log("done", which)
