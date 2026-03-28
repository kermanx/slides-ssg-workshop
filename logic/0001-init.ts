import { listDirectory, readFile } from './workspace'
import { defineChecker, type CheckerDefinition } from './checker'

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
 * 检测包管理器类型
 */
async function detectPackageManager(): Promise<PackageManager> {
  try {
    const { files } = await listDirectory()
    for (const [pm, lockFile] of Object.entries(LOCK_FILES)) {
      if (lockFile && files.includes(lockFile)) {
        return pm as PackageManager
      }
    }
  } catch (error) {
    // 忽略错误
  }
  return 'unknown'
}

/**
 * VitePress 初始化检查器
 */
export const vitepressInitChecker: CheckerDefinition = defineChecker(
  'vitepress-init',
  'VitePress 项目初始化检查',
  (check) => {
    // 检查 package.json
    check.error('package-json', 'package.json', async () => {
      const { files } = await listDirectory()
      if (!files.includes('package.json')) {
        return '缺少 package.json 文件'
      }

      // 检查是否包含 vitepress 依赖
      try {
        const content = await readFile('package.json')
        const pkg = JSON.parse(content)
        const deps = {
          ...pkg.dependencies,
          ...pkg.devDependencies,
        }

        if (!deps.vitepress) {
          return '⚠ package.json 中未找到 vitepress 依赖'
        }
      } catch (error) {
        return '⚠ 无法读取或解析 package.json'
      }

      return true
    })

    // 检查 .vitepress 目录
    check.error('vitepress-dir', '.vitepress 目录', async () => {
      const { directories } = await listDirectory()
      return directories.includes('.vitepress') || '缺少 .vitepress 目录'
    })

    // 检查 VitePress 配置文件
    check.warning('vitepress-config', 'VitePress 配置文件', async () => {
      const { directories } = await listDirectory()
      if (!directories.includes('.vitepress')) {
        return true // 如果目录都不存在，这个检查跳过
      }

      try {
        const vitepressContents = await listDirectory('.vitepress')
        const configFiles = ['config.ts', 'config.js', 'config.mts', 'config.mjs']
        const hasConfig = configFiles.some(file =>
          vitepressContents.files.includes(file)
        )

        return hasConfig || '.vitepress 目录中缺少配置文件'
      } catch (error) {
        return '无法访问 .vitepress 目录'
      }
    })

    // 检查 Markdown 文件
    check.warning('markdown-files', 'Markdown 文件', async () => {
      const { files } = await listDirectory()
      const recommendedFiles = ['index.md', 'README.md']
      const hasRecommended = recommendedFiles.some(file => files.includes(file))
      const hasMdFiles = files.some(file => file.endsWith('.md'))

      return (hasRecommended || hasMdFiles) || '未找到任何 Markdown 文件'
    })

    // 检查 node_modules
    check.error('node-modules', 'node_modules', async () => {
      const { directories } = await listDirectory()
      if (!directories.includes('node_modules')) {
        const pm = await detectPackageManager()
        const installCmd = pm !== 'unknown' ? `${pm} install` : 'pnpm install'
        return `缺少 node_modules，请运行: ${installCmd}`
      }
      return true
    })

    // 检查包管理器锁文件
    check.info('lock-file', '包管理器锁文件', async () => {
      const pm = await detectPackageManager()
      if (pm === 'unknown') {
        return '未找到包管理器锁文件，建议使用 pnpm'
      }
      return true
    })
  },
  // 计算元数据
  async () => {
    const packageManager = await detectPackageManager()
    const { directories } = await listDirectory()
    const hasNodeModules = directories.includes('node_modules')

    return {
      packageManager,
      hasNodeModules,
    }
  }
)

/**
 * 运行 VitePress 初始化检查
 */
export async function checkVitePressProject() {
  const { runChecker } = await import('./checker')
  return await runChecker(vitepressInitChecker)
}
