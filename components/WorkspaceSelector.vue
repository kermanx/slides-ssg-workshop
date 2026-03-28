<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { isSupported, isAuthorized, directoryName, requestDirectory, directoryHandle, startWatching, stopWatching, onFileChange } from '../logic/workspace'
import { vitepressInitChecker } from '../logic/0001-init'
import { runChecker, type CheckerResult } from '../logic/checker'
import CheckResultPanel from './CheckResultPanel.vue'
import CheckerDisplay from './CheckerDisplay.vue'

const checkResult = ref<CheckerResult | null>(null)
const isChecking = ref(false)
let unsubscribeFileChange: (() => void) | null = null

async function performCheck(showLoading = true) {
  if (!isAuthorized.value) {
    checkResult.value = null
    return
  }
  
  if (showLoading) {
    isChecking.value = true
  }
  
  try {
    checkResult.value = await runChecker(vitepressInitChecker)
  } catch (error) {
    console.error('检查项目失败:', error)
  } finally {
    if (showLoading) {
      isChecking.value = false
    }
  }
}

async function handleSelectFolder() {
  try {
    await requestDirectory()
  } catch (error) {
    // 用户取消选择
  }
}

async function handleRecheck() {
  await performCheck(false) // 刷新时不显示 loading 状态
}

// 监听 directoryHandle 变化，自动检查项目
watch(directoryHandle, async (newHandle) => {
  if (newHandle) {
    await performCheck()
    
    // 开始监听文件变化
    try {
      // 注册文件变化回调
      unsubscribeFileChange = onFileChange(() => {
        // 文件变化时自动刷新检查（静默刷新）
        handleRecheck()
      })
      
      // 启动文件监听
      await startWatching()
    } catch (error) {
      console.error('启动文件监听失败:', error)
    }
  } else {
    checkResult.value = null
    
    // 停止监听
    if (unsubscribeFileChange) {
      unsubscribeFileChange()
      unsubscribeFileChange = null
    }
    stopWatching()
  }
})

onUnmounted(() => {
  // 组件卸载时清理监听
  if (unsubscribeFileChange) {
    unsubscribeFileChange()
  }
  stopWatching()
})
</script>

<template>
  <div class="max-w-2xl">
    <div v-if="!isSupported" class="flex items-center gap-3 p-4 rounded-lg border border-gray-200">
      <div class="i-carbon-warning text-3xl text-gray-400"></div>
      <div class="text-sm">
        <div class="font-semibold text-gray-900">浏览器不支持</div>
        <div class="text-gray-600">请使用 Chrome、Edge 或其他现代浏览器</div>
      </div>
    </div>
    
    <div v-else-if="!isAuthorized" class="flex items-center gap-4 p-5 rounded-lg border border-gray-200">
      <div class="i-carbon-folder text-5xl text-gray-400"></div>
      <div class="flex-1">
        <div class="font-semibold text-gray-900 mb-1">选择项目文件夹</div>
        <div class="text-sm text-gray-600">选择您的 VitePress 项目根目录</div>
      </div>
      <button 
        @click="handleSelectFolder"
        class="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors cursor-pointer border-none text-sm"
      >
        <div class="i-carbon-folder-add text-lg"></div>
        <span>选择</span>
      </button>
    </div>
    
    <div v-else class="flex items-center gap-4 p-5 rounded-lg border border-gray-200">
      <div class="i-carbon-checkmark-filled text-4xl text-green-400"></div>
      <div class="flex-1">
        <div class="font-semibold text-gray-900">已连接项目文件夹</div>
        <div class="text-sm text-gray-600 font-mono">{{ directoryName }}</div>
      </div>
      <div class="flex gap-2">
        <button 
          @click="handleSelectFolder"
          class="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors cursor-pointer border-none text-sm"
        >
          <div class="i-carbon-folder-add text-base"></div>
          <span>重选</span>
        </button>
      </div>
    </div>
    
    <CheckResultPanel 
      v-if="checkResult"
      :is-checking="isChecking"
      :title="vitepressInitChecker.title"
      :on-refresh="handleRecheck"
    >
      <CheckerDisplay :result="checkResult" />
    </CheckResultPanel>
  </div>
</template>
