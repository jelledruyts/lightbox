declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>
  }

  interface FileSystemHandle {
    kind: 'file' | 'directory'
    name: string
    getFile(): Promise<File>
  }
}

export {}
