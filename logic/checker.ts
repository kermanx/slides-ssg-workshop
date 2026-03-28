/**
 * 检查项结果
 */
export interface CheckItemResult {
  id: string
  label: string
  passed: boolean
  message?: string
  level: 'error' | 'warning' | 'info'
}

/**
 * 检查器结果
 */
export interface CheckerResult {
  id: string
  title: string
  passed: boolean
  items: CheckItemResult[]
  metadata?: Record<string, any>
}

/**
 * 检查函数类型
 */
export type CheckFunction = () => Promise<boolean | string>

/**
 * 检查项定义
 */
export interface CheckItemDefinition {
  id: string
  label: string
  check: CheckFunction
  level?: 'error' | 'warning' | 'info'
}

/**
 * 检查器定义
 */
export interface CheckerDefinition {
  id: string
  title: string
  items: CheckItemDefinition[]
  computeMetadata?: () => Promise<Record<string, any>>
}

/**
 * 检查项构建器
 */
export class CheckItemBuilder {
  private items: CheckItemDefinition[] = []

  /**
   * 添加检查项
   */
  add(
    id: string,
    label: string,
    check: CheckFunction,
    level: 'error' | 'warning' | 'info' = 'error'
  ): this {
    this.items.push({ id, label, check, level })
    return this
  }

  /**
   * 添加错误级别检查项
   */
  error(id: string, label: string, check: CheckFunction): this {
    return this.add(id, label, check, 'error')
  }

  /**
   * 添加警告级别检查项
   */
  warning(id: string, label: string, check: CheckFunction): this {
    return this.add(id, label, check, 'warning')
  }

  /**
   * 添加信息级别检查项
   */
  info(id: string, label: string, check: CheckFunction): this {
    return this.add(id, label, check, 'info')
  }

  /**
   * 获取所有检查项
   */
  build(): CheckItemDefinition[] {
    return this.items
  }
}

/**
 * 定义检查器
 */
export function defineChecker(
  id: string,
  title: string,
  setup: (check: CheckItemBuilder) => void | Promise<void>,
  computeMetadata?: () => Promise<Record<string, any>>
): CheckerDefinition {
  const builder = new CheckItemBuilder()
  const setupResult = setup(builder)
  
  // 如果 setup 返回 Promise，需要处理（但通常我们期望同步定义）
  if (setupResult instanceof Promise) {
    console.warn('defineChecker setup function returned a Promise, which is unexpected')
  }

  return {
    id,
    title,
    items: builder.build(),
    computeMetadata,
  }
}

/**
 * 运行检查器
 */
export async function runChecker(
  checker: CheckerDefinition
): Promise<CheckerResult> {
  const items: CheckItemResult[] = []
  let allPassed = true

  // 执行所有检查项
  for (const item of checker.items) {
    try {
      const result = await item.check()
      const passed = result === true
      const message = typeof result === 'string' ? result : undefined

      if (!passed && item.level === 'error') {
        allPassed = false
      }

      items.push({
        id: item.id,
        label: item.label,
        passed,
        message,
        level: item.level || 'error',
      })
    } catch (error) {
      allPassed = false
      items.push({
        id: item.id,
        label: item.label,
        passed: false,
        message: error instanceof Error ? error.message : '检查失败',
        level: item.level || 'error',
      })
    }
  }

  // 计算元数据
  let metadata: Record<string, any> | undefined
  if (checker.computeMetadata) {
    try {
      metadata = await checker.computeMetadata()
    } catch (error) {
      console.error('计算元数据失败:', error)
    }
  }

  return {
    id: checker.id,
    title: checker.title,
    passed: allPassed,
    items,
    metadata,
  }
}
