// The Web Speech API (`SpeechRecognition` / vendor-prefixed `webkitSpeechRecognition`) is NOT in
// this project's TS DOM lib — `window.SpeechRecognition` errors TS2339. Declare the minimal surface
// actually used by the two consumers (InteractiveCatechism, PracticeMode) and attach the constructors
// to `Window`, so they can drop `(window as any)`.

interface SpeechRecognitionResultLike {
  readonly [index: number]: { readonly transcript: string };
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike {
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

export {};
