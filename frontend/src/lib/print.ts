export function printHtml(title: string, html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${title}</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif; padding: 24px; }
      h1 { font-size: 18px; margin: 0 0 12px; }
      h2 { font-size: 16px; margin: 16px 0 8px; }
      p { font-size: 12px; color: #666; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f3f4f6; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .text-red { color: #dc2626; }
      .mt-4 { margin-top: 16px; }
      .footer { margin-top: 32px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 8px; }
    </style>
  </head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 200);
}
