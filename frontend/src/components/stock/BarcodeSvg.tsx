import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

/** A barcode drawn as SVG (EAN-13 when the code is a valid EAN, else Code 128). */
export function BarcodeSvg({ value, height = 36, width = 1.4 }: { value: string; height?: number; width?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    const ean = /^\d{13}$/.test(value);
    try {
      JsBarcode(ref.current, value, { format: ean ? 'EAN13' : 'CODE128', height, width, fontSize: 11, margin: 0, displayValue: true });
    } catch {
      JsBarcode(ref.current, value, { format: 'CODE128', height, width, fontSize: 11, margin: 0 });
    }
  }, [value, height, width]);
  return <svg ref={ref} role="img" aria-label={`Mã vạch ${value}`} />;
}
