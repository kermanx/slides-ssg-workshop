import { computed, shallowRef, ref } from 'vue'

const directoryHandle = shallowRef<FileSystemDirectoryHandle | null>(null)
const isAuthorized = computed(() => directoryHandle.value !== null)
const isSupported = computed(() => 'showDirectoryPicker' in window)
const isObserverSupported = computed(() => 'FileSystemObserver' in self)

/**
 * 文件变化事件类型
 */
export interface FileChangeEvent {
  type: 'appeared' | 'disappeared' | 'modified' | 'unknown'
  changedHandle: FileSystemHandle
  relativePathComponents: string[]
  root: FileSystemHandle
}

/**
 * 文件监听回调函数类型
 */
export type FileChangeCallback = (events: FileChangeEvent[]) => void

// 文件监听相关状态
let fileObserver: any = null // FileSystemObserver 实例
let pollingIntervalId: number | null = null
let lastModifiedTimes = new Map<string, number>()
const changeCallbacks = new Set<FileChangeCallback>()
const isWatching = ref(false)

/**
 * 请求用户授权访问本地目录
 */
async function requestDirectory() {
  try {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API 不支持')
    }

    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
    })

    directoryHandle.value = handle
    return handle
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('选择目录失败:', error)
    }
    throw error
  }
}

/**
 * 验证目录访问权限
 */
async function verifyPermission() {
  if (!directoryHandle.value) return false

  const options = { mode: 'readwrite' as const }

  // 检查是否已有权限
  if ((await (directoryHandle.value as any).queryPermission(options)) === 'granted') {
    return true
  }

  // 请求权限
  if ((await (directoryHandle.value as any).requestPermission(options)) === 'granted') {
    return true
  }

  return false
}

/**
 * 读取文件内容
 */
async function readFile(filePath: string): Promise<string> {
  if (!directoryHandle.value) {
    throw new Error('未授权目录访问')
  }

  await verifyPermission()

  const fileHandle = await getFileHandle(filePath)
  const file = await fileHandle.getFile()
  return await file.text()
}

/**
 * 写入文件内容
 */
async function writeFile(filePath: string, content: string) {
  if (!directoryHandle.value) {
    throw new Error('未授权目录访问')
  }

  await verifyPermission()

  const fileHandle = await getFileHandle(filePath, true)
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

/**
 * 获取文件句柄（支持嵌套路径）
 */
async function getFileHandle(
  filePath: string,
  create = false
): Promise<FileSystemFileHandle> {
  if (!directoryHandle.value) {
    throw new Error('未授权目录访问')
  }

  const parts = filePath.split('/').filter(Boolean)
  let currentDir = directoryHandle.value

  // 遍历目录路径
  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create })
  }

  // 获取文件句柄
  const fileName = parts[parts.length - 1]
  return await currentDir.getFileHandle(fileName, { create })
}

/**
 * 列出目录中的文件和子目录
 */
async function listDirectory(subPath = ''): Promise<{
  files: string[]
  directories: string[]
}> {
  if (!directoryHandle.value) {
    throw new Error('未授权目录访问')
  }

  await verifyPermission()

  let targetDir = directoryHandle.value

  if (subPath) {
    const parts = subPath.split('/').filter(Boolean)
    for (const part of parts) {
      targetDir = await targetDir.getDirectoryHandle(part)
    }
  }

  const files: string[] = []
  const directories: string[] = []

  for await (const entry of targetDir.values()) {
    if (entry.kind === 'file') {
      files.push(entry.name)
    } else if (entry.kind === 'directory') {
      directories.push(entry.name)
    }
  }

  return { files, directories }
}

/**
 * 删除文件或目录
 */
async function remove(filePath: string, options?: { recursive?: boolean }) {
  if (!directoryHandle.value) {
    throw new Error('未授权目录访问')
  }

  await verifyPermission()

  const parts = filePath.split('/').filter(Boolean)
  let currentDir = directoryHandle.value

  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i])
  }

  const name = parts[parts.length - 1]
  await currentDir.removeEntry(name, options)
}

/**
 * 清除授权
 */
function clearAuthorization() {
  stopWatching() // 停止监听
  directoryHandle.value = null
}

/**
 * 获取目录名称
 */
const directoryName = computed(() => {
  return directoryHandle.value?.name || null
})

/**
 * 开始监听文件系统变化
 */
async function startWatching(callback?: FileChangeCallback): Promise<void> {
  if (!directoryHandle.value) {
    throw new Error('未授权目录访问')
  }

  if (isWatching.value) {
    console.warn('已经在监听中')
    return
  }

  if (callback) {
    changeCallbacks.add(callback)
  }

  await verifyPermission()

  // 优先使用 FileSystemObserver
  if (isObserverSupported.value) {
    try {
      await startNativeObserver()
      isWatching.value = true
      console.log('✅ 使用原生 FileSystemObserver 监听')
      return
    } catch (error) {
      console.warn('FileSystemObserver 启动失败，降级为轮询:', error)
    }
  }

  // 降级为轮询
  await startPolling()
  isWatching.value = true
  console.log('⚠️ 使用轮询方式监听文件变化')
}

/**
 * 停止监听文件系统变化
 */
function stopWatching(): void {
  if (!isWatching.value) return

  // 停止原生观察者
  if (fileObserver) {
    try {
      fileObserver.disconnect()
    } catch (error) {
      console.error('停止 FileSystemObserver 失败:', error)
    }
    fileObserver = null
  }

  // 停止轮询
  if (pollingIntervalId !== null) {
    clearInterval(pollingIntervalId)
    pollingIntervalId = null
  }

  lastModifiedTimes.clear()
  isWatching.value = false
  console.log('已停止监听文件变化')
}

/**
 * 添加文件变化回调
 */
function onFileChange(callback: FileChangeCallback): () => void {
  changeCallbacks.add(callback)
  
  // 返回取消订阅函数
  return () => {
    changeCallbacks.delete(callback)
  }
}

/**
 * 启动原生 FileSystemObserver
 */
async function startNativeObserver(): Promise<void> {
  if (!directoryHandle.value) return

  const FileSystemObserver = (self as any).FileSystemObserver
  
  fileObserver = new FileSystemObserver((records: any[]) => {
    const events: FileChangeEvent[] = records.map(record => ({
      type: record.type || 'unknown',
      changedHandle: record.changedHandle,
      relativePathComponents: record.relativePathComponents || [],
      root: record.root
    }))

    // 触发所有回调
    changeCallbacks.forEach(callback => {
      try {
        callback(events)
      } catch (error) {
        console.error('文件变化回调执行失败:', error)
      }
    })
  })

  await fileObserver.observe(directoryHandle.value, { recursive: true })
}

/**
 * 启动轮询监听
 */
async function startPolling(): Promise<void> {
  if (!directoryHandle.value) return

  // 初始化：记录所有文件的最后修改时间
  await updateFileModifiedTimes()

  // 每 2 秒检查一次
  pollingIntervalId = window.setInterval(async () => {
    await checkFileChanges()
  }, 2000)
}

/**
 * 更新文件修改时间缓存
 */
async function updateFileModifiedTimes(subPath = ''): Promise<void> {
  if (!directoryHandle.value) return

  try {
    const { files, directories } = await listDirectory(subPath)

    // 检查文件
    for (const fileName of files) {
      const filePath = subPath ? `${subPath}/${fileName}` : fileName
      try {
        const fileHandle = await getFileHandle(filePath)
        const file = await fileHandle.getFile()
        lastModifiedTimes.set(filePath, file.lastModified)
      } catch (error) {
        // 忽略无法访问的文件
      }
    }

    // 递归检查子目录
    for (const dirName of directories) {
      const dirPath = subPath ? `${subPath}/${dirName}` : dirName
      await updateFileModifiedTimes(dirPath)
    }
  } catch (error) {
    console.error('更新文件修改时间失败:', error)
  }
}

/**
 * 检查文件变化（轮询模式）
 */
async function checkFileChanges(subPath = ''): Promise<void> {
  if (!directoryHandle.value) return

  try {
    const { files, directories } = await listDirectory(subPath)
    const events: FileChangeEvent[] = []
    const currentFiles = new Set<string>()

    // 检查现有文件的修改和新增
    for (const fileName of files) {
      const filePath = subPath ? `${subPath}/${fileName}` : fileName
      currentFiles.add(filePath)

      try {
        const fileHandle = await getFileHandle(filePath)
        const file = await fileHandle.getFile()
        const lastModified = file.lastModified
        const previousModified = lastModifiedTimes.get(filePath)

        if (previousModified === undefined) {
          // 新文件
          events.push({
            type: 'appeared',
            changedHandle: fileHandle,
            relativePathComponents: filePath.split('/'),
            root: directoryHandle.value
          })
        } else if (previousModified !== lastModified) {
          // 文件被修改
          events.push({
            type: 'modified',
            changedHandle: fileHandle,
            relativePathComponents: filePath.split('/'),
            root: directoryHandle.value
          })
        }

        lastModifiedTimes.set(filePath, lastModified)
      } catch (error) {
        // 忽略无法访问的文件
      }
    }

    // 检查删除的文件
    for (const [filePath] of lastModifiedTimes) {
      if (filePath.startsWith(subPath || '') && !currentFiles.has(filePath)) {
        events.push({
          type: 'disappeared',
          changedHandle: null as any, // 文件已删除，无法获取 handle
          relativePathComponents: filePath.split('/'),
          root: directoryHandle.value
        })
        lastModifiedTimes.delete(filePath)
      }
    }

    // 触发回调
    if (events.length > 0) {
      changeCallbacks.forEach(callback => {
        try {
          callback(events)
        } catch (error) {
          console.error('文件变化回调执行失败:', error)
        }
      })
    }

    // 递归检查子目录
    for (const dirName of directories) {
      const dirPath = subPath ? `${subPath}/${dirName}` : dirName
      await checkFileChanges(dirPath)
    }
  } catch (error) {
    console.error('检查文件变化失败:', error)
  }
}

export {
  // 状态
  directoryHandle,
  isAuthorized,
  isSupported,
  isObserverSupported,
  directoryName,
  isWatching,

  // 方法
  requestDirectory,
  verifyPermission,
  readFile,
  writeFile,
  listDirectory,
  remove,
  clearAuthorization,
  
  // 文件监听
  startWatching,
  stopWatching,
  onFileChange,
}
