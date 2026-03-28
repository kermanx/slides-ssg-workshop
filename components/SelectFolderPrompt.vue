<script setup lang="ts">
import { requestDirectory } from '../logic/workspace'

interface Props {
  message?: string
}

const props = withDefaults(defineProps<Props>(), {
  message: '请先选择项目文件夹'
})

async function handleSelectFolder() {
  try {
    await requestDirectory()
  } catch (error) {
    // 用户取消选择
  }
}
</script>

<template>
  <div class="mb-4 p-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between gap-4">
    <div class="text-sm text-gray-600">
      💡 {{ message }}
    </div>
    <button 
      @click="handleSelectFolder"
      class="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors cursor-pointer border border-gray-300 whitespace-nowrap"
    >
      <div class="i-carbon-folder-add text-base"></div>
      <span>选择文件夹</span>
    </button>
  </div>
</template>
