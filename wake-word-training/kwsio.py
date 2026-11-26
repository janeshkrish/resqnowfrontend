import numpy as np
from wavio import read_wav_bytes
def read_wav16(path):
    with open(path, "rb") as f: x, r = read_wav_bytes(f.read())
    if r == 16000: return x
    n = int(len(x) * 16000 / r)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)
