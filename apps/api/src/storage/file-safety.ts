import { Socket } from 'net';

/** File kinds accepted by uploads, identified by magic bytes (never by the client's MIME type). */
const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'application/pdf', ext: 'pdf', test: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  // DOCX is a ZIP container; accepted only where the caller allows it.
  { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx', test: (b) => b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 },
  { mime: 'application/msword', ext: 'doc', test: (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) },
];

export function detectFileType(buffer: Buffer, allowed: string[]) {
  const sig = SIGNATURES.find((s) => allowed.includes(s.mime) && s.test(buffer));
  return sig ? { mime: sig.mime, ext: sig.ext } : null;
}

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const DOCUMENT_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];

export type ScanResult = 'CLEAN' | 'INFECTED' | 'FAILED';

/**
 * Malware scan through a ClamAV daemon (CLAMAV_HOST, CLAMAV_PORT) using the
 * INSTREAM protocol. Returns null when no scanner is configured, so callers
 * keep the file PENDING rather than pretending it is clean.
 */
export async function scanWithClamAv(buffer: Buffer, host: string | undefined, port = 3310, timeoutMs = 30_000): Promise<ScanResult | null> {
  if (!host) return null;
  return new Promise((resolve) => {
    const socket = new Socket();
    let reply = '';
    const done = (r: ScanResult) => {
      socket.destroy();
      resolve(r);
    };
    socket.setTimeout(timeoutMs, () => done('FAILED'));
    socket.on('error', () => done('FAILED'));
    socket.on('data', (d) => (reply += d.toString('utf8')));
    socket.on('end', () => done(/OK\0?$/.test(reply.trim()) ? 'CLEAN' : /FOUND/.test(reply) ? 'INFECTED' : 'FAILED'));
    socket.connect(port, host, () => {
      socket.write('zINSTREAM\0');
      for (let i = 0; i < buffer.length; i += 64 * 1024) {
        const chunk = buffer.subarray(i, i + 64 * 1024);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
  });
}
