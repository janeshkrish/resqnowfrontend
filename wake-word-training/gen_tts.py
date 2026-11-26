# Makes synthetic "Hey ResQNow" clips (many voices, Indian-English pronunciations) and near-miss
# phrases that must NOT wake it. Output: 16 kHz int16 clips in .npy object arrays.
import sys, random, numpy as np
from piper import PiperVoice
from piper.config import SynthesisConfig

S = sys.argv[1]
N_POS = int(sys.argv[2]) if len(sys.argv) > 2 else 9000
N_ADV = int(sys.argv[3]) if len(sys.argv) > 3 else 7000
TRAIN_SPEAKERS = range(0, 840)          # 840..903 are kept back for testing
TEST_SPEAKERS = range(840, 904)
rng = random.Random(7)
voice = PiperVoice.load(f"{S}/dl/piper/en_US-libritts_r-medium.onnx")
pm = voice.config.phoneme_id_map


def to16k(x, sr=22050):
    n_out = int(round(len(x) * 16000 / sr))
    X = np.fft.rfft(x)
    Y = np.zeros(n_out // 2 + 1, dtype=complex)
    m = min(len(X), len(Y))
    Y[:m] = X[:m]
    y = np.fft.irfft(Y, n_out) * (n_out / len(x))
    return y.astype(np.float32)


def trim(x, thr=0.01):
    idx = np.where(np.abs(x) > thr * max(1e-6, np.abs(x).max()))[0]
    return x[max(0, idx[0] - 400): idx[-1] + 400] if len(idx) else x


def scales():
    return SynthesisConfig(speaker_id=None, length_scale=rng.uniform(0.75, 1.35),
                           noise_scale=rng.uniform(0.35, 0.95), noise_w_scale=rng.uniform(0.5, 1.1))


# Pronunciations of "Hey ResQNow" heard in India: flat "hē", tapped or rolled r, "res-kyu", "nau".
HEY = ["heɪ", "heː", "he", "hɛ", "haɪ", "hai", "heɪ"]
R = ["ɹ", "ɾ", "r", "ɹ"]
E = ["ɛ", "e"]
SZ = ["s", "s", "z"]
CUE = ["kjuː", "kju", "kjʊ", "kjuː", "kʲuː", "kjuː"]
NOW = ["naʊ", "nau", "naʊ", "nɑʊ", "naː"]
POS_TEXT = ["hey rescue now", "hey, rescue now", "hey rescue now!", "hey res q now", "hey resq now",
            "hi rescue now", "hai rescue now", "hey rescue now.", "hey ResQNow", "Hey ResQ Now!"]


def pos_phonemes():
    st = lambda: "ˈ" if rng.random() < 0.7 else ""
    h = rng.choice(HEY)
    hey = "h" + st() + h[1:]
    sep1 = rng.choice([" ", " ", ", "])
    res = rng.choice(R) + st() + rng.choice(E) + rng.choice(SZ)
    sep2 = rng.choice(["", "", " "])
    cue = rng.choice(CUE)
    sep3 = rng.choice([" ", " ", ""])
    now = "n" + st() + rng.choice(NOW)[1:]
    s = hey + sep1 + res + sep2 + cue + sep3 + now + rng.choice(["", "", "!", "."])
    return [c for c in s if c in pm]


def synth_phonemes(ph, sid):
    cfg = scales(); cfg.speaker_id = sid
    ids = voice.phonemes_to_ids(ph)
    return voice.phoneme_ids_to_audio(ids, cfg)


def synth_text(text, sid):
    cfg = scales(); cfg.speaker_id = sid
    return np.concatenate([c.audio_float_array for c in voice.synthesize(text, cfg)])


# Things people say near the phone that sound a little like it, plus everyday roadside talk.
ADV = """hey rescue me|hey rescue team|hey rescue|rescue me now|hey resume now|hey recipe now|hey risk now|hey rest now|hey press now
hey yes now|hey yes no|yes now|hey there now|hey now|hey you now|hey Siri|hey Google|ok Google|alexa|hey Jarvis|hey reskill now
hey rescue dog|hey request now|request now|hey dress now|hey Jessica|hey Rachel|hey Raskin|hey Ross now|hey Russ now|hey rescuer
hello rescue|help me now|call rescue now|is it rescue|hey brother|hey machan|hey dude|hey man how are you|hey listen now
hey, wait now|hey, come now|hey ready now|hey Rescue Nine|hey rest you now|they rescued now|they're rescuing now|hey RCB now
hey Resco now|hey Fresco now|hey Tesco now|escuela now|hey Kesav now|hey Rakesh now|hey Ramesh now|hey Suresh now|hey Mahesh now
enna da panra|vandi puncture aayiduchu|seekiram vaa|battery down aayiduchu|petrol theernthu pochu|tyre flat aayiduchu|en car start aagala
bike nikkuthu|konjam help pannunga|enga irukeenga|naan highway la irukken|mechanic venum|towing venum|ippo varuveengala|evlo neram aagum
okay thank you|yes yes|no problem|one minute|hello can you hear me|where are you now|please come fast|my car broke down|I need help now
the tyre is flat|battery is dead|out of petrol|how much will it cost|send someone now|rescue|now|hey|hey hey|hey you|hi there|hai da
hey, she is now|hey, she knew now|hey Resna|hey Reshma now|hey Rescue Mission|rest in peace|hey resonate|hey Raskal|hey rascal now""".replace("\n", "|").split("|")
ADV = [a.strip() for a in ADV if a.strip()]


def run(kind, n, speakers):
    out = []
    spk = list(speakers)
    for i in range(n):
        sid = rng.choice(spk)
        if kind == "pos":
            a = synth_phonemes(pos_phonemes(), sid) if rng.random() < 0.6 else synth_text(rng.choice(POS_TEXT), sid)
        else:
            a = synth_text(rng.choice(ADV), sid)
        a = trim(to16k(np.asarray(a, np.float32)))
        a = a / max(1e-6, np.abs(a).max()) * 0.9
        out.append((a * 32767).astype(np.int16))
        if i % 1000 == 0:
            print(kind, i, flush=True)
    arr = np.empty(len(out), dtype=object); arr[:] = out
    return arr


np.save(f"{S}/train/tts_pos_train.npy", run("pos", N_POS, TRAIN_SPEAKERS), allow_pickle=True)
np.save(f"{S}/train/tts_pos_test.npy", run("pos", 600, TEST_SPEAKERS), allow_pickle=True)
np.save(f"{S}/train/tts_adv_train.npy", run("adv", N_ADV, TRAIN_SPEAKERS), allow_pickle=True)
np.save(f"{S}/train/tts_adv_test.npy", run("adv", 800, TEST_SPEAKERS), allow_pickle=True)
print("done")
