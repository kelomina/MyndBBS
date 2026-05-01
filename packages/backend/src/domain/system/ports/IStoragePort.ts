/**
 * 接口名称：IStoragePort
 *
 * 函数作用：
 *   文件存储端口接口——用于持久化上传的二进制附件。
 * Purpose:
 *   Port interface for persisting uploaded binary attachments.
 *
 * 中文关键词：
 *   存储，端口接口，上传
 * English keywords:
 *   storage, port interface, upload
 */
export interface IStoragePort {
  saveFile(filename: string, content: Buffer): Promise<string>;
}

