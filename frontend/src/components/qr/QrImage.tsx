import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Skeleton } from '@/components/ui/skeleton';

/** A QR code drawn in the browser from its text content. */
export function QrImage({ value, size = 260 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then((url) => alive && setSrc(url));
    return () => { alive = false; };
  }, [value, size]);
  return src ? <img src={src} width={size} height={size} alt="Mã QR thanh toán" className="rounded-md border bg-white" /> : <Skeleton style={{ width: size, height: size }} />;
}
