/**
 * Print utilities for receipts and documents
 */

export interface PrintOptions {
  title?: string;
  paperSize?: 'A4' | '80mm' | 'letter';
  orientation?: 'portrait' | 'landscape';
  margins?: string;
}

/**
 * Print a React component or HTML element
 */
export const printElement = (
  element: HTMLElement,
  options: PrintOptions = {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=800,height=600');

      if (!printWindow) {
        reject(new Error('Could not open print window. Please allow popups.'));
        return;
      }

      // Get styles from current document
      const styles = Array.from(document.styleSheets)
        .map((styleSheet) => {
          try {
            return Array.from(styleSheet.cssRules)
              .map((rule) => rule.cssText)
              .join('\n');
          } catch (e) {
            // CORS error, skip external stylesheets
            return '';
          }
        })
        .join('\n');

      // Additional print styles
      const printStyles = `
        @media print {
          @page {
            size: ${options.paperSize === '80mm' ? '80mm auto' : options.paperSize || 'A4'};
            margin: ${options.margins || '0'};
          }
          body {
            margin: 0;
            padding: 0;
          }
        }
      `;

      // Build HTML document
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${options.title || 'Print'}</title>
            <style>${styles}</style>
            <style>${printStyles}</style>
          </head>
          <body>
            ${element.outerHTML}
          </body>
        </html>
      `);

      printWindow.document.close();

      // Wait for content to load
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();

          // Close window after print dialog
          setTimeout(() => {
            printWindow.close();
            resolve();
          }, 100);
        }, 250);
      };

      // Handle print cancellation
      printWindow.onafterprint = () => {
        printWindow.close();
        resolve();
      };
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Download element as PDF (browser print to PDF)
 */
export const downloadAsPDF = (
  element: HTMLElement,
  _filename: string = 'receipt.pdf',
  options: PrintOptions = {}
): void => {
  // Note: This opens the print dialog where user can select "Save as PDF"
  // The filename parameter is kept for API consistency but not currently used
  printElement(element, options).catch((error) => {
    console.error('Failed to open print dialog:', error);
    alert('Could not open print dialog. Please check your browser settings.');
  });
};

/**
 * Generate receipt number
 */
export const generateReceiptNumber = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `RCP${timestamp}${random}`;
};

/**
 * Format receipt data for printing
 */
export interface ReceiptPrintData {
  receiptNumber: string;
  date: Date;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  vat: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change?: number;
}

/**
 * Print receipt using thermal printer (ESC/POS commands)
 * Note: This requires a thermal printer driver or service
 */
export const printThermalReceipt = async (
  data: ReceiptPrintData
): Promise<void> => {
  // TODO: Implement actual thermal printer integration
  // This would typically use:
  // - Native printing API
  // - Electron integration
  // - Or a printing service/driver

  console.log('Thermal print requested:', data);

  // For now, fallback to browser print
  throw new Error('Thermal printing not yet implemented. Please use browser print.');
};

/**
 * Send receipt via email
 */
export const emailReceipt = async (
  email: string,
  receiptHTML: string
): Promise<void> => {
  // TODO: Implement email sending via backend API
  console.log('Email receipt to:', email);
  console.log('Receipt HTML:', receiptHTML);

  // This would typically call:
  // await apiClient.post('/receipts/email', { email, html: receiptHTML });

  throw new Error('Email functionality not yet implemented');
};

/**
 * Send receipt via SMS (link to digital receipt)
 */
export const smsReceipt = async (
  phone: string,
  receiptUrl: string
): Promise<void> => {
  // TODO: Implement SMS sending via backend API
  console.log('SMS receipt to:', phone);
  console.log('Receipt URL:', receiptUrl);

  throw new Error('SMS functionality not yet implemented');
};
