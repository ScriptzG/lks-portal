export interface StorageService {
  /** Saves a file's bytes under a logical path and returns a storage URL/reference to read it back later. */
  save(path: string, contents: Buffer): Promise<string>;
  read(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  deleteDir(path: string): Promise<void>;
  list(dirPath: string): Promise<string[]>;
}
