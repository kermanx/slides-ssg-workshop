<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { isSupported, isAuthorized, readFile, onFileChange, directoryHandle } from '../logic/workspace'
import SelectFolderPrompt from './SelectFolderPrompt.vue'
// @ts-expect-error
import Md1 from './ConfigTitleEditor_code1.md'

const currentTitle = ref<string | null>(null)
const isChecking = ref(false)
const configFile = ref<string | null>(null)
let unsubscribeFileChange: (() => void) | null = null

const isDefaultTitle = (title: string) => {
  const defaultTitles = ['My Awesome Project', 'Site Title', 'VitePress Site']
  return defaultTitles.includes(title)
}

async function checkTitle() {
  if (!isAuthorized.value) {
    currentTitle.value = null
    return
  }

  isChecking.value = true

  try {
    // 尝试读取配置文件
    const configFiles = ['.vitepress/config.ts', '.vitepress/config.js', '.vitepress/config.mts', '.vitepress/config.mjs']
    let content = ''

    for (const file of configFiles) {
      try {
        content = await readFile(file)
        configFile.value = file
        break
      } catch {
        continue
      }
    }

    if (!configFile.value) {
      currentTitle.value = null
      return
    }

    // 提取 title
    const titlePattern = /title:\s*['"`]([^'"`]+)['"`]/
    const match = content.match(titlePattern)
    
    if (match) {
      currentTitle.value = match[1]
    } else {
      currentTitle.value = null
    }
  } catch (error) {
    console.error('检查标题失败:', error)
    currentTitle.value = null
  } finally {
    isChecking.value = false
  }
}

// 监听 directoryHandle 变化
watch(directoryHandle, async (newHandle) => {
  if (newHandle) {
    await checkTitle()
    
    // 监听文件变化
    if (unsubscribeFileChange) {
      unsubscribeFileChange()
    }
    
    unsubscribeFileChange = onFileChange(async (events) => {
      // 检查是否有配置文件变化
      const hasConfigChange = events.some(event => 
        event.relativePathComponents.join('/').includes('.vitepress/config')
      )
      
      if (hasConfigChange) {
        await checkTitle()
      }
    })
  } else {
    currentTitle.value = null
    if (unsubscribeFileChange) {
      unsubscribeFileChange()
      unsubscribeFileChange = null
    }
  }
})

onUnmounted(() => {
  if (unsubscribeFileChange) {
    unsubscribeFileChange()
  }
})
</script>

<template>
  <div v-if="isSupported && isAuthorized" class="mb-4 p-2 rounded-lg border border-gray-200">
    <div v-if="isChecking" class="text-sm text-gray-600">
      正在检查配置...
    </div>
    
    <div v-else-if="currentTitle === null" class="text-sm text-gray-600">
      未找到配置文件或 title 字段
    </div>
    
    <div v-else-if="isDefaultTitle(currentTitle)">
      <div class="text-sm text-gray-700">
        <div>在 <code class="px-1 py-0.5 bg-gray-100 rounded text-xs">{{ configFile }}</code> 中修改：</div>
        <Md1 mt-1 />   
      </div>
    </div>
    
    <div v-else class="space-y-2">
      <div class="flex items-center gap-2">
        <div class="i-carbon-checkmark-filled text-xl text-green-500"></div>
        <div class="font-semibold text-gray-900">标题已配置</div>
      </div>
      <div class="text-sm text-gray-600">
        当前标题：<code class="px-1 py-0.5 bg-gray-100 rounded text-xs">{{ currentTitle }}</code>
      </div>
    </div>
  </div>
  
  <SelectFolderPrompt v-else-if="isSupported && !isAuthorized" message="请先选择项目文件夹以查看配置状态" />
  
  <div v-else class="my-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
    <div class="text-sm text-gray-700">
      <p class="font-semibold mb-2">💡 修改网站标题</p>
      <p class="mb-2">在 <code class="px-1 py-0.5 bg-gray-200 rounded text-xs">.vitepress/config.ts</code> 中找到并修改：</p>
      <pre class="mt-2 p-3 bg-white rounded text-xs overflow-x-auto border border-gray-200"><code>export default defineConfig({
  title: "我的博客",  // 👈 修改默认标题
  // ...
})</code></pre>
    </div>
  </div>
</template>
