
interface FileSystemHandle {
    readonly kind: 'file' | 'directory';
    readonly name: string;
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
    queryPermission(descriptor?: any): Promise<PermissionState>;
    requestPermission(descriptor?: any): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
    keys(): AsyncIterableIterator<string>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
    getFileHandle(name: string, options?: any): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: any): Promise<FileSystemDirectoryHandle>;
    removeEntry(name: string, options?: any): Promise<void>;
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

interface FileSystemFileHandle extends FileSystemHandle {
    getFile(): Promise<File>;
    createWritable(options?: any): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
    write(data: any): Promise<void>;
    seek(position: number): Promise<void>;
    truncate(size: number): Promise<void>;
}

interface Window {
    showDirectoryPicker(options?: any): Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker(options?: any): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
}
