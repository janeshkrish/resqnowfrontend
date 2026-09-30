export const JOB_ALERT_SOUND_URL = "https://cdn.pixabay.com/audio/2021/08/04/audio_0625c1539c.mp3";

const onScreen = () => typeof document === "undefined" || document.visibilityState === "visible";

/**
 * The looping siren for an offer card. It sounds only while the page is on screen: with the
 * app in the background or the screen off, the phone's own alert rings instead (the Android
 * full-screen alarm, or the web push notification).
 */
export function createJobAlertSiren(src = JOB_ALERT_SOUND_URL) {
  let audio: HTMLAudioElement | null = null;
  let ringing = false;

  const play = () => {
    if (!onScreen()) return;
    try {
      audio ??= Object.assign(new Audio(src), { loop: true });
      audio.currentTime = 0;
      void audio.play().catch(() => {
        // Autoplay can be refused until the page has had a tap; the card still shows.
      });
    } catch {
      // No audio support.
    }
  };

  const onVisibilityChange = () => {
    if (!ringing) return;
    if (onScreen()) play();
    else audio?.pause();
  };

  return {
    start() {
      if (!ringing) document.addEventListener("visibilitychange", onVisibilityChange);
      ringing = true;
      play();
    },
    stop() {
      ringing = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    },
  };
}
