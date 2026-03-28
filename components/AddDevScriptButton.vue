<script setup lang="ts">
import { ref } from 'vue'
import { isSupported, isAuthorized, readFile, writeFile } from '../logic/workspace'

const isModifying = ref(false)
const result = ref<{ success: boolean; message: string } | null>(null)

async function handleModifyPackageJson() {
  if (!isAuthorized.value) {
    result.value = { success: false, message: '请先选择项目文件夹' }
    return
  }

  isModifying.value = true
  result.value = null

  try {
    // 读取 package.json
    const content = await readFile('package.json')
    const pkg = JSON.parse(content)

    // 要添加的脚本
    const scriptsToAdd = {
      dev: 'vitepress dev',
      build: 'vitepress build',
      preview: 'vitepress preview'
    }

    // 检查是否已经存在这些脚本
    const existingScripts: string[] = []
    const scriptsAdded: string[] = []

    if (!pkg.scripts) {
      pkg.scripts = {}
    }

    for (const [name, command] of Object.entries(scriptsToAdd)) {
      if (pkg.scripts[name]) {
        existingScripts.push(name)
      } else {
        pkg.scripts[name] = command
        scriptsAdded.push(name)
      }
    }

    // 如果没有添加任何脚本（都已存在）
    if (scriptsAdded.length === 0) {
      result.value = { 
        success: true, 
        message: `✓ 所有脚本都已配置完成` 
      }
      return
    }

    // 写回文件
    const newContent = JSON.stringify(pkg, null, 2) + '\n'
    await writeFile('package.json', newContent)

    let message = `✓ 已添加脚本: ${scriptsAdded.join(', ')}`
    if (existingScripts.length > 0) {
      message += ` (已存在: ${existingScripts.join(', ')})`
    }

    result.value = { 
      success: true, 
      message 
    }
  } catch (error) {
    result.value = { 
      success: false, 
      message: `修改失败: ${error instanceof Error ? error.message : '未知错误'}` 
    }
  } finally {
    isModifying.value = false
  }
}
</script>

<template>
  <div v-if="isSupported" class="inline-block">
    <button 
      @click="handleModifyPackageJson"
      :disabled="!isAuthorized || isModifying"
      class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors cursor-pointer border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {{ isModifying ? '修改中...' : '一键添加' }}
    </button>
    
    <div v-if="result" class="mt-2 text-xs" :class="{
      'text-green-600': result.success,
      'text-red-600': !result.success
    }">
      {{ result.message }}
    </div>
  </div>
</template>
