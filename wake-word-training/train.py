# Trains the "Hey ResQNow" classifier on embedding windows and reports honest held-out numbers.
# usage: train.py S <train_real ids e.g. 1,3,5 or all> <out name> [steps]
import sys, glob, json, numpy as np, torch, torch.nn as nn
S = sys.argv[1]; train_real = sys.argv[2]; name = sys.argv[3]; STEPS = int(sys.argv[4]) if len(sys.argv) > 4 else 24000
FD = f"{S}/feats"
NEGW = float(sys.argv[5]) if len(sys.argv) > 5 else 19
JIT = float(sys.argv[8]) if len(sys.argv) > 8 else 0.02
dev = "cuda" if torch.cuda.is_available() else "cpu"
torch.manual_seed(3); rng = np.random.default_rng(3)
ld = lambda n: np.load(f"{FD}/{n}.npy")
import re
ALL = sorted(int(re.search(r"stream_real_r(\d+)\.npy$", f.replace("\\", "/")).group(1)) for f in glob.glob(f"{FD}/stream_real_r*.npy"))
real_ids = ALL if train_real == "all" else [int(i) for i in train_real.split(",")]
test_ids = [i for i in ALL if i not in real_ids]

pos_tts = np.concatenate([np.load(f) for f in sorted(glob.glob(f"{FD}/pos_tts_train_*.npy"))])
pos_real = np.concatenate([ld(f"pos_real_r{i}") for i in real_ids] + [ld(f"pos_real_r{i}_clean") for i in real_ids])
adv = np.concatenate([np.load(f) for f in sorted(glob.glob(f"{FD}/adv_train_*.npy"))])
neg_speech = ld("neg_speech"); neg_noise = ld("neg_noise")
print("pos_tts", pos_tts.shape, "pos_real", pos_real.shape, "adv", adv.shape, "neg_speech", neg_speech.shape, "noise", neg_noise.shape, flush=True)

G = lambda a: torch.from_numpy(a)  # stay float16 on CPU, move per batch
sets = {"pos_tts": G(pos_tts), "pos_real": G(pos_real), "adv": G(adv), "neg_speech": G(neg_speech), "neg_noise": G(neg_noise)}
mix = [("pos_tts", 150, 1), ("pos_real", 60, 1), ("adv", 120, 0), ("neg_speech", 250, 0), ("neg_noise", 40, 0)]


HID = int(sys.argv[6]) if len(sys.argv) > 6 else 128
DROP = float(sys.argv[7]) if len(sys.argv) > 7 else 0.2


class Net(nn.Module):
    def __init__(self, h=HID):
        super().__init__()
        self.f = nn.Sequential(nn.Flatten(), nn.Linear(16 * 96, h), nn.LayerNorm(h), nn.ReLU(), nn.Dropout(DROP),
                               nn.Linear(h, h), nn.LayerNorm(h), nn.ReLU(), nn.Linear(h, 1))
    def forward(self, x): return torch.sigmoid(self.f(x))


net = Net().to(dev)
opt = torch.optim.AdamW(net.parameters(), lr=1e-3, weight_decay=1e-2)
sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=1e-3, total_steps=STEPS, pct_start=0.1)


def batch():
    xs, ys = [], []
    for k, n, y in mix + ([("hard", 160, 0)] if "hard" in sets else []):
        a = sets[k]; idx = torch.from_numpy(rng.integers(0, len(a), n))
        xs.append(a[idx]); ys.append(torch.full((n,), float(y)))
    x = torch.cat(xs).float().to(dev); y = torch.cat(ys).to(dev)
    x = x + torch.randn_like(x) * JIT * x.std()   # small feature jitter
    return x, y


@torch.no_grad()
def score(a):
    net.eval(); out = []
    for i in range(0, len(a), 4096): out.append(net(torch.from_numpy(np.asarray(a[i:i + 4096], np.float32)).to(dev)).squeeze(1).cpu().numpy())
    net.train(); return np.concatenate(out) if out else np.zeros(0)


def stream_scores(emb):
    if len(emb) < 16: return np.zeros(0)
    w = np.stack([emb[i:i + 16] for i in range(len(emb) - 15)])
    return score(w)


def events(sc, th, pat=1, refr=25):
    n = 0; last = -10 ** 9; run = 0
    for i, s in enumerate(sc):
        run = run + 1 if s >= th else 0
        if run >= pat and i - last > refr: n += 1; last = i; run = 0
    return n


def mine():
    # The ordinary-speech moments the model currently confuses with the wake word.
    pool = torch.cat([sets["neg_speech"], sets["adv"]])
    sc = score(pool.numpy())
    top = np.argsort(-sc)[:20000]
    sets["hard"] = pool[torch.from_numpy(top)]
    print("mined hard negatives; >0.5:", int((sc > 0.5).sum()), ">0.1:", int((sc > 0.1).sum()), flush=True)


evl = {k: np.load(f"{FD}/eval_ta_test_{k}.npy", allow_pickle=True) for k in ("clean", "noisy")}
EVAL_H = sum(len(e) for e in evl["clean"]) * 0.08 / 3600
streams = {i: np.load(f"{FD}/stream_real_r{i}.npy", allow_pickle=True) for i in ALL}
ptest_n, ptest_c, advt = ld("pos_tts_test_noisy"), ld("pos_tts_test_clean"), ld("adv_test")


def report(step):
    r = {"step": step}
    fa_sc = {k: [stream_scores(e.astype(np.float32)) for e in v] for k, v in evl.items()}
    rs = {i: [stream_scores(s.astype(np.float32)) for s in streams[i]] for i in ALL}
    for th in (0.5, 0.8, 0.95):
        for pat in (1, 2, 3):
            fa = {k: round(sum(events(s, th, pat) for s in v) / EVAL_H, 2) for k, v in fa_sc.items()}
            held = [round(float(np.mean([events(s, th, pat) > 0 for s in rs[i]])), 2) for i in test_ids]
            seen = round(float(np.mean([np.mean([events(s, th, pat) > 0 for s in rs[i]]) for i in real_ids])), 2)
            r[f"{th}/{pat}"] = dict(fa_clean=fa["clean"], fa_noisy=fa["noisy"], real_heldout=held, real_trained=seen)
        r[f"{th}"] = dict(tts_noisy=round(float((score(ptest_n) >= th).mean()), 3), tts_clean=round(float((score(ptest_c) >= th).mean()), 3), adv=round(float((score(advt) >= th).mean()), 3))
    print(json.dumps(r), flush=True)
    return r


bce = nn.BCELoss(reduction="none")
for step in range(1, STEPS + 1):
    x, y = batch()
    p = net(x).squeeze(1).clamp(1e-6, 1 - 1e-6)
    w = torch.where(y > 0, torch.ones_like(y), torch.full_like(y, 1 + NEGW * min(1, step / (0.6 * STEPS))))  # negatives count more over time
    loss = (bce(p, y) * w).mean()
    opt.zero_grad(); loss.backward(); opt.step(); sched.step()
    if step >= 6000 and step % 3000 == 0 and step < STEPS: mine()
    if step % 2000 == 0:
        print("step", step, "loss", round(loss.item(), 4), flush=True)
    if step % 6000 == 0 or step == STEPS:
        report(step)

torch.save(net.state_dict(), f"{S}/train/{name}.pt")
net.eval().cpu()
# Weights for public/hey-resqnow/detector.js: header "RQW1", in, hidden, then float32 LE tensors in order.
import struct
L=net.f
parts=[L[1].weight, L[1].bias, L[2].weight, L[2].bias, L[5].weight, L[5].bias, L[6].weight, L[6].bias, L[8].weight, L[8].bias]
with open(f"{S}/train/{name}.bin","wb") as fh:
    fh.write(b"RQW1"+struct.pack("<II",16*96,L[1].out_features))
    for t in parts: fh.write(t.detach().numpy().astype("<f4").tobytes())
print("saved", name)
