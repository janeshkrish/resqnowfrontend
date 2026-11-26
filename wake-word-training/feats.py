# Shared audio -> openWakeWord-style features (16 x 96 speech embeddings, about 2 s), plus
# augmentation that makes clean clips sound like a phone on an Indian roadside.
import numpy as np, onnxruntime as ort

SR = 16000
WIN = 32000          # 2.0 s -> 197 mel frames -> 16 embeddings
EMB_T = 16


class Featurizer:
    def __init__(self, S, threads=8):
        o = ort.SessionOptions(); o.intra_op_num_threads = threads
        self.mel = ort.InferenceSession(f"{S}/dl/oww/melspectrogram.onnx", o, providers=["CPUExecutionProvider"])
        self.emb = ort.InferenceSession(f"{S}/dl/oww/embedding_model.onnx", o, providers=["CPUExecutionProvider"])

    def melspec(self, batch):  # batch (B, n) float32 in [-1, 1]
        m = self.mel.run(None, {"input": (batch * 32767).astype(np.float32)})[0][:, 0]
        return m / 10 + 2   # (B, frames, 32)

    def embed_windows(self, mels):  # mels (B, frames, 32) -> (B, n, 96)
        B, F, _ = mels.shape
        starts = list(range(0, F - 76 + 1, 8))
        w = np.stack([mels[:, s:s + 76] for s in starts], 1)  # B, n, 76, 32
        out = []
        flat = w.reshape(-1, 76, 32, 1).astype(np.float32)
        for i in range(0, len(flat), 2048):
            out.append(self.emb.run(None, {"input_1": flat[i:i + 2048]})[0].reshape(-1, 96))
        return np.concatenate(out).reshape(B, len(starts), 96)

    def clips(self, batch):  # (B, WIN) -> (B, 16, 96)
        out = []
        for i in range(0, len(batch), 64):
            out.append(self.embed_windows(self.melspec(batch[i:i + 64]))[:, -EMB_T:])
        return np.concatenate(out)

    def long(self, x, piece=SR * 30):  # whole recording -> (n, 96), one embedding per 80 ms
        mels = []
        for s in range(0, len(x), piece):
            seg = x[max(0, s - 480): s + piece]
            if len(seg) < 400: break
            m = self.melspec(seg[None].astype(np.float32))[0]
            mels.append(m if s == 0 else m[3:])
        m = np.concatenate(mels)[None]
        if m.shape[1] < 76: return np.zeros((0, 96), np.float32)
        return self.embed_windows(m)[0]


def windows(emb, stride=1):  # (n, 96) -> (k, 16, 96)
    if len(emb) < EMB_T: return np.zeros((0, EMB_T, 96), np.float32)
    idx = np.arange(0, len(emb) - EMB_T + 1, stride)
    return np.stack([emb[i:i + EMB_T] for i in idx])


# ---------- augmentation ----------
def colored(n, rng, kind):
    w = rng.standard_normal(n)
    if kind == "white": return w
    f = np.fft.rfftfreq(n, 1 / SR); f[0] = f[1]
    X = np.fft.rfft(w) / (np.sqrt(f) if kind == "pink" else f)
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-9)


def traffic(n, rng):
    # Engine rumble + passing vehicles: brown noise, amplitude-swept, with a low hum.
    y = colored(n, rng, "brown") * 0.7 + colored(n, rng, "pink") * 0.3
    t = np.arange(n) / SR
    env = 0.6 + 0.4 * np.sin(2 * np.pi * rng.uniform(0.05, 0.4) * t + rng.uniform(0, 6))
    hum = np.sin(2 * np.pi * rng.uniform(40, 120) * t) * rng.uniform(0, 0.5)
    if rng.random() < 0.3:  # a horn
        s = rng.integers(0, n); L = int(rng.uniform(0.2, 0.8) * SR); f0 = rng.uniform(300, 600)
        h = np.zeros(n); seg = np.arange(min(L, n - s))
        h[s:s + len(seg)] = np.sign(np.sin(2 * np.pi * f0 * seg / SR)) * rng.uniform(0.5, 2)
        y = y + h
    y = y * env + hum
    return y / (np.std(y) + 1e-9)


def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-9)


def rir(x, rng):
    rt60 = rng.uniform(0.12, 0.7)
    L = int(rt60 * SR)
    t = np.arange(L) / SR
    h = rng.standard_normal(L) * np.exp(-6.9 * t / rt60)
    h[0] = rng.uniform(1.5, 4)
    h /= np.sqrt(np.sum(h ** 2))
    n = len(x) + L - 1; nf = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nf) * np.fft.rfft(h, nf), nf)[:len(x)]
    return y.astype(np.float32)


def bandlimit(x, rng):
    lo, hi = rng.uniform(60, 350), rng.uniform(3300, 7900)
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] *= 0.03
    return np.fft.irfft(X, len(x)).astype(np.float32)


def speed(x, rng, lo=0.88, hi=1.12):
    r = rng.uniform(lo, hi)
    n = int(len(x) / r)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


class Backgrounds:
    """Speech pieces from FLEURS for babble / talk in the background."""
    def __init__(self, speech):  # list of float32 arrays
        self.speech = speech

    def babble(self, n, rng, k=None):
        k = k or rng.integers(1, 6)
        y = np.zeros(n, np.float32)
        for _ in range(k):
            s = self.speech[rng.integers(len(self.speech))]
            if len(s) < n: s = np.tile(s, n // len(s) + 1)
            o = rng.integers(0, len(s) - n + 1)
            seg = s[o:o + n]; y += seg / rms(seg)
        return y / rms(y)

    def noise(self, n, rng):
        r = rng.random()
        if r < 0.3: return traffic(n, rng)
        if r < 0.55: return self.babble(n, rng)
        if r < 0.85: return colored(n, rng, rng.choice(["white", "pink", "brown"]))
        return self.babble(n, rng) * 0.5 + traffic(n, rng) * 0.5


def augment(x, rng, bg, n_out=None, snr=(0, 25), place_end=True, p_noise=0.85, real=False):
    """x: float32 speech. Returns float32 of length n_out with speech ending near the end."""
    x = x.astype(np.float32)
    if rng.random() < (0.7 if real else 0.4): x = speed(x, rng)
    if rng.random() < 0.4: x = rir(x, rng)
    if rng.random() < 0.5: x = bandlimit(x, rng)
    n_out = n_out or WIN
    y = np.zeros(n_out, np.float32)
    if place_end:
        end = n_out - int(rng.uniform(0.0, 0.28) * SR)
        start = end - len(x)
        if start < 0: x = x[-start:]; start = 0
        y[start:start + len(x)] = x
    else:
        y[:min(n_out, len(x))] = x[:n_out]
    level = rng.uniform(0.02, 0.25)
    y *= level / rms(x)
    if rng.random() < p_noise:
        nz = bg.noise(n_out, rng).astype(np.float32)
        s = rng.uniform(*snr)
        y += nz * (level / (10 ** (s / 20)))
    else:
        y += rng.standard_normal(n_out).astype(np.float32) * level * 10 ** (-rng.uniform(35, 55) / 20)
    if rng.random() < 0.12: y *= rng.uniform(2, 5)    # very loud voice / AGC clipping
    return np.clip(y, -1, 1)
