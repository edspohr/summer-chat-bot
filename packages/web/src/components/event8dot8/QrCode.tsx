import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Client-side QR rendered to inline SVG — no external image service.
export function QrCode({ url, size }: { url: string; size: number }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#0F1226", light: "#FFFFFF" },
    })
      .then((s) => {
        if (alive) setSvg(s);
      })
      .catch(() => {
        if (alive) setSvg(null);
      });
    return () => {
      alive = false;
    };
  }, [url]);

  return (
    <div
      className="rounded-2xl bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      // SVG markup is generated locally by the qrcode package from a constant URL.
      dangerouslySetInnerHTML={svg !== null ? { __html: svg } : { __html: "" }}
    />
  );
}
