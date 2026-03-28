<script setup lang="ts">
interface Props {
  isChecking?: boolean
  title?: string
  onRefresh?: () => void | Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  isChecking: false,
  title: '检查结果'
})

async function handleRefresh() {
  if (props.onRefresh) {
    await props.onRefresh()
  }
}
</script>

<template>
  <div class="mt-4">
    <div v-if="isChecking" class="text-gray-600">
      <p>{{ title }}中...</p>
    </div>
    
    <div v-else>
      <div class="flex items-center justify-between mb-2">
        <h4 class="m-0">{{ title }}</h4>
        <button 
          v-if="onRefresh"
          @click="handleRefresh"
          :disabled="isChecking"
          class="flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div class="i-carbon-renew text-sm"></div>
          <span>刷新</span>
        </button>
      </div>
      
      <slot />
    </div>
  </div>
</template>
