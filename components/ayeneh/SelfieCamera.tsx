"use client";

// The camera inside the page. The phone's own camera (a file input with `capture`) is not
// reliable: in-app browsers (Telegram, Instagram, QR scanner apps) and some phones ignore it and
// open the gallery. This asks the browser for the front camera and shows it live.
import { useEffect, useRef, useState } from "react";
import { COPY } from "./copy";
import { IconCamera } from "./icons";

export type CameraFailure = "denied" | "unavailable";

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

type Props = { onShot: (file: File) => void; onCancel: () => void; onFail: (why: CameraFailure) => void };

export function SelfieCamera({ onShot, onCancel, onFail }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // The callbacks are read at the time they are needed, so the camera opens once.
  const fail = useRef(onFail);
  useEffect(() => { fail.current = onFail; });

  useEffect(() => {
    let closed = false;
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } } })
      .then(async (s) => {
        if (closed) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        const v = video.current;
        if (!v) return;
        v.srcObject = s;
        await v.play().catch(() => undefined);
        setReady(true);
        box.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      })
      .catch((e: unknown) => {
        if (closed) return;
        const name = e instanceof DOMException ? e.name : "";
        fail.current(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      });
    return () => {
      closed = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { onFail("unavailable"); return; }
    // Mirrored, like the live view. The whole frame is kept, not only the square on show.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) onShot(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      else onFail("unavailable");
    }, "image/jpeg", 0.92);
  }

  return (
    <>
      <div ref={box} className="relative grid aspect-square place-items-center overflow-hidden rounded-3xl border-2 border-line-strong bg-surface">
        <video ref={video} playsInline muted autoPlay aria-label={COPY.cameraLive} className="size-full -scale-x-100 object-cover" />
        {!ready && <div className="absolute inset-0 grid place-items-center bg-surface text-ink-2"><span className="flex flex-col items-center gap-3"><span className="spinner" /><span className="text-sm">{COPY.cameraOpening}</span></span></div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={!ready} onClick={shoot} className="btn btn-primary"><IconCamera />{COPY.cameraShoot}</button>
        <button type="button" onClick={onCancel} className="btn btn-outline">{COPY.cameraCancel}</button>
      </div>
    </>
  );
}
