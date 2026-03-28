// File System Access API 类型扩展
interface Window {
  showDirectoryPicker(options?: {
    mode?: 'read' | 'readwrite'
    startIn?: FileSystemHandle | string
  }): Promise<FileSystemDirectoryHandle>
}

interface FileSystemHandle {
  queryPermission(descriptor?: {
    mode?: 'read' | 'readwrite'
  }): Promise<'granted' | 'denied' | 'prompt'>
  
  requestPermission(descriptor?: {
    mode?: 'read' | 'readwrite'
  }): Promise<'granted' | 'denied' | 'prompt'>
}
