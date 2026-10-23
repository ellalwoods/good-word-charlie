export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Reads a word aloud, preferring an Australian voice, then British, then any English one. */
export function speak(text: string) {
  if (!canSpeak) return;
  try {
    const voices = speechSynthesis.getVoices();
    const pick = (lang: string) => voices.find(v => v.lang.replace('_', '-') === lang);
    const voice = pick('en-AU') ?? pick('en-GB') ?? voices.find(v => v.lang.startsWith('en')) ?? null;
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice?.lang ?? 'en-AU';
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // Speech is a nicety; ignore failures.
  }
}

// Some browsers load voices lazily; asking early means the first tap gets the right accent.
if (canSpeak) speechSynthesis.getVoices();
