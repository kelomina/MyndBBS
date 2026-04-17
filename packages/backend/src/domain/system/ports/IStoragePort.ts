/**
 * Callers: [SystemApplicationService]
 * Callees: []
 * Description: Port interface for persisting uploaded binary attachments (e.g. encrypted message files).
 * Keywords: storage, port, domain, system, upload
 */
export interface IStoragePort {
  saveFile(filename: string, content: Buffer): Promise<string>;
}

