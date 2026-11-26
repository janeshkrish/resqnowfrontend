# Thozhan voice reliability: implementation and release assessment

Payment changes are deferred. This assessment covers wake activation, conversation capture,
understanding, interruptions, overload handling, and Android packaging.

## Architecture and workflow

1. The React/TypeScript application runs in a browser/PWA or an Android Capacitor WebView.
   An opted-in customer page captures microphone audio, resamples it to 16 kHz, and sends
   frames to ResQNow's own on-device wake-word model in a Web Worker (see
   wake-word-training/README.md; it replaced the sherpa-onnx spotter on 2026-11-26).
2. A detected wake phrase releases keyword capture before navigating to Thozhan. The
   conversation opens recognition through browser SpeechRecognition or the Android Java
   VoiceThozhan plugin and SpeechRecognizer. Tamil starts with ta-IN; English and Tanglish
   start with en-IN. An unsupported language gets one fallback attempt.
3. The local engine extracts service, vehicle, answers, corrections and safety conditions.
   The conversation hook asks for missing fields. Optional authenticated Express endpoints
   use Anthropic for remaining text interpretation and validate returned form values.
4. Replies use optional Sarvam/Google audio, then device text-to-speech when unavailable.
   The completed draft enters the existing request form for review and confirmation.
   Existing backend idempotency and durable dispatch recovery protect request submission.

The wake detector is foreground-only and requires opt-in and microphone permission.
This implementation does not provide lock-screen or system-wide Siri/Alexa activation.
Recognition connectivity and mixed-language accuracy depend on the browser or installed
Android speech service. Optional Android vocabulary hints are advisory, not a measured
accuracy improvement or an offline recognition guarantee.

The main implementation entry points are:

| Function/module | Responsibility |
| --- | --- |
| `listenForWakeWord`, `to16k`, `stopSpotter` | Microphone capture, audio resampling, worker ownership and shutdown |
| `listen`, `speak`, `silence` | Recognition attempts, transcript delivery, speech output and cancellation |
| `VoiceThozhanPlugin.listen/speak/stop/silence` | Android speech service and device voice bridge |
| `hear`, `mergeHeard`, `mergeAiWithFeedback`, `nextStep` | Extract and validate request fields, preserve corrections, choose missing questions |
| `useVoiceThozhan` | Conversation state, turn ownership, hands-free follow-up and form handoff |
| `askVoiceAi`, `fetchVoiceAudio` | Optional backend requests with cancellation and deadlines |
| `createVoiceCapacity` | Provider concurrency limits and optional expiring Redis leases |
| `verifyThozhanDist`, `verifyThozhanApk` | Verify emitted voice code and packaged model/plugin bytes |

## Confirmed defects addressed

| Failure | Cause | Correction |
| --- | --- | --- |
| Badge appears but wake processing stalls | Capture readiness was insufficient evidence that the worker decoded audio | Badge follows decoded-frame acknowledgements; startup and stalled-frame deadlines; worker protocol versioning and session ownership |
| Wake activation does not flow into conversation | Wake and conversation compete for capture; follow-up capture lacks lifecycle coordination | Release capture before navigation; wait for actual recognition readiness; follow-up waits for spoken reply completion |
| Repeated/uncertain transcript becomes a request | Cumulative browser results were appended; uncertain/partial output could proceed | Rebuild final text from recognition results; editable review for low confidence, errors and partial-only output |
| Cancelled speech or recognition returns later | Listener registration, language fallback, audio fetch and voice discovery outlive their owner | Attempt/session ownership, cancellation checks, stale callback rejection and playback generation checks |
| Hidden app continues an old conversation | Queued prompts and AI/location/handoff continuations survive visibility changes | Abort the active turn on hide/unmount and guard every asynchronous continuation |
| Resumed description is ignored | A draft can exist before the interrupted first question, leaving no current step | Parse the resumed description before choosing the next question |
| AI stays busy on a stalled connection | Supplying caller cancellation replaced the original network deadline | Combine caller cancellation with bounded AI/audio request deadlines |
| A landmark changes the vehicle | Vehicle keywords occur in bus stops, bike shops and car showrooms | Exclude business/location and recovery-vehicle mentions; respect explicit ownership and corrections |
| Conflicting vehicles silently keep an old choice | Generic reply processing bypasses ambiguity handling | Clear conflicting vehicle fields and ask for the vehicle type; prevent AI from filling that ambiguity |
| An electric vehicle is treated as petrol/diesel | Ownership preference hides the trailing predicate in "my car is electric" | Associate that predicate with its vehicle while preserving genuine multi-vehicle ambiguity |
| Provider overload accumulates work | External calls can exceed useful concurrent capacity | Bounded optional AI/TTS concurrency, deadlines, local fallbacks and Redis leases when configured |
| Android release omits wake assets | Source checks do not verify packaged output | Validate emitted Vite graph, model/WASM digests, APK asset bytes and native plugin presence |

## Validation and limits

Final checks on the fixed voice snapshot completed on 17 November 2026:

| Check | Result |
| --- | --- |
| Frontend unit suite | 1,054 passed across 127 test files |
| TypeScript | Passed |
| Final phone/desktop browser subset | 10 passed: actual-model wake activation, follow-up listening, editable uncertain transcript, emergency guidance, hide/resume |
| Android JVM suite | 70 passed; zero failures/errors |
| Android instrumentation | Compiled; device execution not run |
| Vite/Capacitor/Android debug build | Passed |
| Packaged wake model, WASM, voice chunks and native plugin | Passed byte-level artifact checks |
| Independent review | Two important findings corrected and regression-tested; no remaining important findings reported in those corrections |

The preceding full voice browser run passed 60 of 62 cases and exposed the hide/resume defect
on both layouts. Those two cases were reproduced in a hook regression, repaired, and passed
in the final 10-case subset. The entire 62-case set was not rerun after that repair.

Local candidate: `output/thozhan-qa/ResQNow-Thozhan-QA.apk`, version `1.4.5-voice-qa` / code 5,
27,224,481 bytes, SHA-256 `d644cb7081af869e29fe874f91ab25d76e8d1eeaa4d5103ee3e3744c1b3ad999`.
It is debug-signed and is not a published production update. Build provenance and checked source
hashes are in `output/thozhan-qa/debug-qa-verification.json`.

Current verification results are recorded with the local QA artifact. Android JVM tests and
instrumentation compilation check native integration; they do not execute a microphone or
prove speech quality. Browser tests exercise conversation behavior with simulated transcripts;
wake tests additionally exercise the actual keyword model with fixtures.

Earlier backend verification completed 900 tests: 894 passed and 6 skipped. A synthetic
2,000-call held-provider burst admitted 16 AI calls and rejected excess optional work;
capacity recovered afterward. That is overload/fallback evidence, not a claim that 2,000
simultaneous real conversations can be served. Real provider quotas, latency, Redis replica
coordination, database/dispatch performance and sustained traffic remain unmeasured.

The broader GitHub release-quality run 42965082136 failed 17 browser tests outside the voice
suite (account, admin monitoring/shell/technicians, customer login/tracking and garage). Voice cases
passed in that run and the native-verification job passed. Whole-application release acceptance
is therefore not green. Existing unrelated staged changes are excluded from this voice change.

A later shared-workspace run also encountered `Mappls map surface: contains a synchronous SDK
exception and can retry without crashing the screen` while separate map work was changing.
Final voice verification uses a fixed HEAD-plus-voice-patch snapshot to exclude concurrent edits.

The 17 earlier failures, grouped by test name and layout, were:

| Test | Layouts |
| --- | --- |
| Account: Privacy and security, and reaching support | Phone, desktop |
| Admin monitor: Replay, a finished job's route, what happened and how long it took | Phone |
| Admin monitor: Technician record, numbers, job history, cancellations and delays, and reviews | Desktop |
| Admin portal shell: technician profile/documents, prices, payouts, log-in hours and hiding | Desktop |
| Admin technicians: hiding from new jobs, a log-in reminder and deleting from the row | Phone, desktop |
| Customer login: returning customer, number/SMS code and straight in | Phone, desktop |
| Customer login: new number gives its name once | Phone, desktop |
| Customer login: server failure after a right code, retry without new SMS | Phone, desktop |
| Customer login: email/password and back to mobile number | Phone, desktop |
| Customer tracking: shrinks to a strip, comes back and opens details | Phone |
| My garage: newest vehicle with what the app knows | Phone |

## Remaining release gates

1. Run real Android and browser microphone trials across Tamil, Tanglish and English speakers,
   including traffic/wind, accents, low volume, long pauses and similarly sounding non-wake speech.
   Record wake miss/false-activation rates, transcript word error, correct service/vehicle fields,
   clarification rate and time to a usable draft. Agree release thresholds before evaluating.
2. Exercise interruption recovery on physical devices: permission denial/revocation, app background,
   phone call, Bluetooth changes, network loss, slow providers and repeated wake/reopen cycles.
   Verify capture stops and the UI always offers an actionable recovery path.
3. Benchmark sustained staged traffic at agreed concurrent-user levels with production-like
   provider quotas and Redis. Measure p50/p95 latency, timeouts, fallback frequency, CPU/memory,
   database/queue pressure and recovery after replica/provider failure. Configure alert thresholds
   and gradual account rollout from measured capacity.
4. Produce the owner-signed QA APK with the existing keystore and manual password entry, verify
   upgrade continuity on an installed production app, then publish only the verified artifact.
   A debug-signed QA APK cannot replace the existing owner-signed installation directly.

No real-device speech corpus, physical-device execution or multi-replica production load result
is available from this machine. Production readiness remains conditional on these gates.
