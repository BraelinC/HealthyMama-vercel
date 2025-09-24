import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export async function bufferToOpenableUrl(pdfBuffer, preferDataUrl = false) {
  try {
    if (preferDataUrl && pdfBuffer.byteLength < 7_000_000) {
      const base64 = pdfBuffer.toString('base64');
      return { url: `data:application/pdf;base64,${base64}`, type: 'data' };
    }
  } catch {}

  // Fallback to a temp file
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hm-pdf-'));
  const filePath = path.join(tmpDir, `doc-${Date.now()}.pdf`);
  await fs.writeFile(filePath, pdfBuffer);
  const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
  return { url: fileUrl, type: 'file', filePath };
}


