import { checkMagicBytes } from '../src/routes/upload';

describe('upload magic byte validation', () => {
  it('accepts WebP only when RIFF and WEBP markers are both present', () => {
    const validWebpHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
      0x56, 0x50, 0x38, 0x20,
    ]);

    expect(checkMagicBytes(validWebpHeader, 'image/webp')).toBe(true);
  });

  it('rejects RIFF files that are not WebP files', () => {
    const forgedRiffHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46,
      0x24, 0x00, 0x00, 0x00,
      0x41, 0x56, 0x49, 0x20,
      0x4c, 0x49, 0x53, 0x54,
    ]);

    expect(checkMagicBytes(forgedRiffHeader, 'image/webp')).toBe(false);
  });
});
