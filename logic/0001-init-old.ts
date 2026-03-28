import { listDirectory, readFile } from './workspace'

/**
 * VitePress 项目的必需文件和目录
 */
const REQUIRED_ITEMS = {
  files: ['package.json'],
  directories: ['.vitepress'],
} as const

/**
 * 可选但推荐的文件
 */
const RECOMMENDED_FILES = ['index.md', 'README.md'] as const

/**
 * 包管理器类型
 */
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown'

/**
 * 包管理器锁文件映射
 */
const LOCK_FILES: Record<PackageManager, string> = {
  pnpm: 'pnpm-lock.yaml',
  npm: 'package-lock.json',
  yarn: 'yarn.lock',
  bun: 'bun.lockb',
  unknown: '',
}

/**
 * 检查结果接口
 */
export interface InitCheckResult {
  isValid: boolean
  hasPackageJson: boolean
  hasVitePressConfig: boolean
  hasVitePressDir: boolean
  hasMarkdownFiles: boolean
  hasNodeModules: boolean
  packageManager: PackageManager
  hasLockFile: boolean
  missingItems: string[]
  warnings: string[]
  packageJsonContent?: any
}

/**
 * 检查选择的目录是否包含 VitePress 项目的基本文件
 */
export async function checkVitePressProject(): Promise<InitCheckResult> {
  const result: InitCheckResult = {
    isValid: false,
    hasPackageJson: false,
    hasVitePressConfig: false,
    hasVitePressDir: false,
    hasMarkdownFiles: false,
    hasNodeModules: false,
    packageManager: 'unknown',
    hasLockFile: false,
    missingItems: [],
    warnings: [],
  }

  try {
    // 列出根目录的文件和子目录
    const { files, directories } = await listDirectory()

    // 检查 node_modules
    result.hasNodeModules = directories.includes('node_modules')

    // 检查包管理器类型（通过锁文件）
    for (const [pm, lockFile] of Object.entries(LOCK_FILES)) {
      if (lockFile && files.includes(lockFile)) {
        result.packageManager = pm as PackageManager
        result.hasLockFile = true
        break
      }
    }

    // 如果没有 node_modules，给出提示
    if (!result.hasNodeModules) {
      const installCmd = result.packageManager !== 'unknown' 
        ? `${result.packageManager} install`
        : 'pnpm install'
      result.warnings.push(`缺少 node_modules 目录，请运行: ${installCmd}`)
    }

    // 如果没有锁文件，给出提示
    if (!result.hasLockFile && result.hasPackageJson) {
      result.warnings.push('未找到包管理器锁文件，建议使用 pnpm')
    }

    // 检查 package.json
    result.hasPackageJson = files.includes('package.json')
    if (result.hasPackageJson) {
      try {
        const content = await readFile('package.json')
        result.packageJsonContent = JSON.parse(content)
        
        // 检查是否包含 vitepress 依赖
        const deps = {
          ...result.packageJsonContent.dependencies,
          ...result.packageJsonContent.devDependencies,
        }
        
        if (!deps.vitepress) {
          result.warnings.push('package.json 中未找到 vitepress 依赖')
        }
      } catch (error) {
        result.warnings.push('无法读取或解析 package.json')
      }
    } else {
      result.missingItems.push('package.json')
    }

    // 检查 .vitepress 目录
    result.hasVitePressDir = directories.includes('.vitepress')
    if (result.hasVitePressDir) {
      // 检查 .vitepress 目录下是否有配置文件
      try {
        const vitepressContents = await listDirectory('.vitepress')
        const configFiles = ['config.ts', 'config.js', 'config.mts', 'config.mjs']
        result.hasVitePressConfig = configFiles.some(file => 
          vitepressContents.files.includes(file)
        )
        
        if (!result.hasVitePressConfig) {
          result.warnings.push('.vitepress 目录中未找到配置文件 (config.ts/js)')
        }
      } catch (error) {
        result.warnings.push('无法访问 .vitepress 目录')
      }
    } else {
      result.missingItems.push('.vitepress/')
    }

    // 检查是否有 Markdown 文件
    const hasRecommendedMd = RECOMMENDED_FILES.some(file => files.includes(file))
    const hasMdFiles = files.some(file => file.endsWith('.md'))
    result.hasMarkdownFiles = hasRecommendedMd || hasMdFiles

    if (!result.hasMarkdownFiles) {
      result.warnings.push('未找到任何 Markdown 文件 (如 index.md)')
    }

    // 判断是否为有效的 VitePress 项目
    result.isValid = result.hasPackageJson && result.hasVitePressDir

  } catch (error) {
    console.error('检查 VitePress 项目时出错:', error)
    result.warnings.push('检查项目时出现错误')
  }

  return result
}

/**
 * 检查并返回是否需要初始化
 */
export async function needsInitialization(): Promise<boolean> {
  const result = await checkVitePressProject()
  return !result.isValid
}
