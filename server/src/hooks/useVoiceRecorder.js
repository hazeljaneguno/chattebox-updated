import { useEffect, useRef, useState } from "react";

const formats = [
  ["audio/webm;codecs=opus", "webm"],
  ["audio/ogg;codecs=opus", "ogg"],
  ["audio/mp4", "m4a"],
];

export default function useVoiceRecorder({ onRecorded, onError, maxBytes }) {
  const sessionRef = useRef(null);
  const [status, setStatus] = useState("idle");

  function release(session) {
    clearTimeout(session.timer);
    session.stream?.getTracks().forEach((track) => track.stop());
  }

  function cancel(updateStatus = true) {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    if (session.recorder?.state === "recording") session.recorder.stop();
    release(session);
    if (updateStatus) setStatus("idle");
  }

  useEffect(() => () => cancel(false), []);

  async function start() {
    if (sessionRef.current) return;
    const Recorder = globalThis.MediaRecorder;
    const device = navigator.mediaDevices;
    const format = formats.find(([mime]) => Recorder?.isTypeSupported(mime));
    if (!device?.getUserMedia || !format) {
      onError("Voice recording is unavailable on this device.");
      return;
    }

    const session = { chunks: [], bytes: 0 };
    sessionRef.current = session;
    setStatus("starting");
    onError("");

    try {
      session.stream = await device.getUserMedia({ audio: true });
      if (sessionRef.current !== session) {
        release(session);
        return;
      }

      const [mime, extension] = format;
      const recorder = new Recorder(session.stream, { mimeType: mime, audioBitsPerSecond: 64000 });
      session.recorder = recorder;
      recorder.ondataavailable = ({ data }) => {
        if (sessionRef.current !== session || !data.size) return;
        session.bytes += data.size;
        if (session.bytes > maxBytes) {
          cancel();
          onError("Voice recording exceeded the 10 MB attachment limit.");
          return;
        }
        session.chunks.push(data);
      };
      recorder.onstop = () => {
        release(session);
        if (sessionRef.current !== session) return;
        sessionRef.current = null;
        setStatus("idle");
        if (!session.bytes) {
          onError("No audio was recorded. Try again.");
          return;
        }

        const filename = `voice-message-${Date.now()}.${extension}`;
        onRecorded(new File(session.chunks, filename, { type: mime.split(";")[0] }));
      };
      recorder.onerror = () => {
        if (sessionRef.current !== session) return;
        cancel();
        onError("Could not record audio. Try again.");
      };

      recorder.start(250);
      session.timer = setTimeout(() => stop(), 120_000);
      setStatus("recording");
    } catch (error) {
      if (sessionRef.current !== session) return;
      cancel();
      onError(error.name === "NotAllowedError"
        ? "Allow microphone access to record a voice message."
        : "Could not open the microphone.");
    }
  }

  function stop() {
    const recorder = sessionRef.current?.recorder;
    if (recorder?.state !== "recording") return;
    setStatus("processing");
    recorder.stop();
  }

  return { status, start, stop, cancel };
}
