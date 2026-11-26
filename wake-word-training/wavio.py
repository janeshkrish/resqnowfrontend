import struct, numpy as np
def read_wav_bytes(b):
    """PCM16 or float32 WAV bytes -> (float32 mono samples, rate)."""
    assert b[:4] == b"RIFF" and b[8:12] == b"WAVE"
    o = 12; fmt = None; data = None
    while o + 8 <= len(b):
        cid = b[o:o+4]; n = struct.unpack("<I", b[o+4:o+8])[0]
        if cid == b"fmt ": fmt = struct.unpack("<HHIIHH", b[o+8:o+24])
        elif cid == b"data": data = b[o+8:o+8+n]; break
        o += 8 + n + (n & 1)
    tag, ch, rate, _, _, bits = fmt
    if tag == 3 or (tag == 0xFFFE and bits == 32): x = np.frombuffer(data[:len(data)//4*4], "<f4").astype(np.float32)
    else: x = np.frombuffer(data[:len(data)//2*2], "<i2").astype(np.float32) / 32768
    if ch > 1: x = x[: len(x)//ch*ch].reshape(-1, ch).mean(1)
    return x, rate
