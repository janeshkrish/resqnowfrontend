import sys, numpy as np, torch, torch.nn as nn
# usage: evaluate.py <workdir> <model name> [held-out recording ids, e.g. 2,4,6]
S=sys.argv[1]; FD=f"{S}/feats"
MODEL=sys.argv[2]; HELD=[int(i) for i in sys.argv[3].split(",")] if len(sys.argv)>3 else []
class Net(nn.Module):
    def __init__(self, h=64):
        super().__init__()
        self.f = nn.Sequential(nn.Flatten(), nn.Linear(16*96, h), nn.LayerNorm(h), nn.ReLU(), nn.Dropout(0.5), nn.Linear(h, h), nn.LayerNorm(h), nn.ReLU(), nn.Linear(h, 1))
    def forward(self, x): return torch.sigmoid(self.f(x))
def ss(net,e):
    e=e.astype(np.float32)
    if len(e)<16: return np.zeros(0)
    w=np.stack([e[i:i+16] for i in range(len(e)-15)])
    with torch.no_grad(): return net(torch.from_numpy(w)).squeeze(1).numpy()
def events(sc, hi, lo, refr=25):
    n=0; last=-10**9
    for i in range(len(sc)):
        if sc[i]>=hi and i-last>refr:
            if (i>0 and sc[i-1]>=lo) or (i+1<len(sc) and sc[i+1]>=lo): n+=1; last=i
    return n
rules=[(0.95,0.95),(0.95,0.5),(0.95,0.3),(0.9,0.5),(0.95,0.0)]
for name,test in ((MODEL,HELD),):
    net=Net(); net.load_state_dict(torch.load(f"{S}/train/{name}.pt")); net.eval()
    ev={k:[ss(net,e) for e in np.load(f"{FD}/eval_ta_test_{k}.npy",allow_pickle=True)] for k in ("clean","noisy")}
    H=sum(len(s)+15 for s in ev["clean"])*0.08/3600
    rs={i:[ss(net,s) for s in np.load(f"{FD}/stream_real_r{i}.npy",allow_pickle=True)] for i in test}
    for hi,lo in rules:
        fa={k:sum(events(s,hi,lo) for s in v)/H for k,v in ev.items()}
        rec=" ".join(f"r{i}={np.mean([events(s,hi,lo)>0 for s in rs[i]]):.2f}" for i in test)
        print(f"{name} hi {hi} lo {lo}: FA/h clean {fa['clean']:.2f} noisy {fa['noisy']:.2f}  heldout {rec}")
