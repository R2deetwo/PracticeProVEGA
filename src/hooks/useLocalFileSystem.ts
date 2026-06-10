
import { useState, useEffect, useCallback } from 'react';

// Simple IndexedDB wrapper for storing handles
const DB_NAME = 'PracticePro_LocalFiles';
const STORE_NAME = 'handles';

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

const getHandle = async (key: string): Promise<any> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
};

const saveHandle = async (key: string, handle: any): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(handle, key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
};

export interface LocalFile {
    id: string; // path
    name: string;
    kind: 'file' | 'directory';
    size?: number;
    lastModified?: number;
    handle: FileSystemHandle;
    parentPath: string;
    cached?: boolean; // Mock status for now
}

export const useLocalFileSystem = () => {
    const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
    const [files, setFiles] = useState<LocalFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [folderName, setFolderName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Load handle from IDB on mount
    useEffect(() => {
        const loadHandle = async () => {
            try {
                const handle = await getHandle('root_dir');
                if (handle) {
                    setDirectoryHandle(handle);
                    setFolderName(handle.name);
                    // Verify permission
                    const perm = await handle.queryPermission({ mode: 'read' });
                    if (perm === 'granted') {
                        scanDirectory(handle);
                    }
                }
            } catch (err) {
                console.error("Error loading handle:", err);
            }
        };
        loadHandle();
    }, []);

    const scanDirectory = async (handle: FileSystemDirectoryHandle) => {
        setIsLoading(true);
        setError(null);
        try {
            const fileList: LocalFile[] = [];

            // Recursive scan function
            const scan = async (dirHandle: FileSystemDirectoryHandle, path: string) => {
                for await (const entry of dirHandle.values()) {
                    if (entry.kind === 'file') {
                        // For performance, we might not get full file details (size/date) immediately for ALL files if many
                        // But for a folder select, we usually want them.
                        const fileHandle = entry as FileSystemFileHandle;
                        const file = await fileHandle.getFile();
                        fileList.push({
                            id: `${path}/${entry.name}`,
                            name: entry.name,
                            kind: 'file',
                            size: file.size,
                            lastModified: file.lastModified,
                            handle: entry,
                            parentPath: path,
                            cached: false // Default
                        });
                    } else if (entry.kind === 'directory') {
                        // Recursion?? Limit depth?
                        // Let's go 2 levels deep for now to avoid huge trees
                        const depth = path.split('/').length;
                        if (depth < 5) {
                            await scan(entry as FileSystemDirectoryHandle, `${path}/${entry.name}`);
                        }
                    }
                }
            };

            await scan(handle, handle.name);
            setFiles(fileList);
        } catch (err: any) {
            console.error("Error scanning directory:", err);
            setError("Failed to scan directory. Permission might be needed.");
        } finally {
            setIsLoading(false);
        }
    };

    const selectFolder = async () => {
        try {
            const handle = await window.showDirectoryPicker();
            setDirectoryHandle(handle);
            setFolderName(handle.name);
            await saveHandle('root_dir', handle);
            scanDirectory(handle);
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error("Error selecting folder:", err);
                setError("Failed to select folder.");
            }
        }
    };

    const refreshFiles = async () => {
        if (directoryHandle) {
            // Check permission again
            const perm = await directoryHandle.queryPermission({ mode: 'read' });
            if (perm !== 'granted') {
                const newPerm = await directoryHandle.requestPermission({ mode: 'read' });
                if (newPerm !== 'granted') {
                    setError("Permission denied to access folder.");
                    return;
                }
            }
            scanDirectory(directoryHandle);
        }
    };

    const getFileContent = async (file: LocalFile): Promise<File | null> => {
        try {
            if (file.handle.kind === 'file') {
                return await (file.handle as FileSystemFileHandle).getFile();
            }
        } catch (err) {
            console.error("Error reading file:", err);
        }
        return null;
    };

    return {
        directoryHandle,
        folderName,
        files,
        isLoading,
        error,
        selectFolder,
        refreshFiles,
        getFileContent
    };
};

export const useFirmLocalFileSystem = (firmFolderPath?: string | null) => {
    const {
        directoryHandle,
        folderName,
        files,
        isLoading,
        error: internalError,
        selectFolder: baseSelectFolder,
        refreshFiles,
        getFileContent
    } = useLocalFileSystem();

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (internalError) setError(internalError);
    }, [internalError]);

    // Validation logic
    useEffect(() => {
        if (firmFolderPath && folderName) {
            if (folderName !== firmFolderPath) {
                // Determine if this is a mismatch we should warn about
                // For now, valid logic: specific warning
                // setError(`Connected folder "${folderName}" does not match Firm Folder "${firmFolderPath}".`);
            } else {
                setError(null);
            }
        }
    }, [firmFolderPath, folderName]);

    const selectFolder = async () => {
        await baseSelectFolder();
        // Post-selection validation could go here, but the effect above handles it reactively
    };

    return {
        directoryHandle,
        folderName,
        files,
        isLoading,
        error,
        selectFolder,
        refreshFiles,
        getFileContent,
        isMatchingFirm: firmFolderPath && folderName === firmFolderPath
    };
};
