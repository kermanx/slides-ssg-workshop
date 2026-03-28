<script setup lang="ts">
import type { CheckerResult } from '../logic/checker'

interface Props {
  result: CheckerResult
}

const props = defineProps<Props>()

const getIcon = (level: string, passed: boolean) => {
  if (passed) return '✓'
  if (level === 'error') return '✗'
  if (level === 'warning') return '⚠'
  return 'ℹ'
}
</script>

<template>
  <div>
    <h4 class="mb-2">
      {{ result.passed ? '✓' : '✗' }}
      {{ result.passed ? '检查通过' : '检查未通过' }}
    </h4>
    
    <ul class="text-sm mt-2 list-none!">
      <li v-for="item in result.items" :key="item.id" :class="{
        'text-gray-600': item.passed,
        'text-red-600': !item.passed && item.level === 'error',
        'text-amber-600': !item.passed && item.level === 'warning',
        'text-blue-600': !item.passed && item.level === 'info',
      }">
        {{ getIcon(item.level, item.passed) }} {{ item.label }}
        <span v-if="item.message"> - {{ item.message }}</span>
      </li>
    </ul>
    
    <div v-if="result.metadata" class="mt-3 text-sm">
      <div v-if="result.metadata.packageManager && result.metadata.packageManager !== 'unknown'">
        📦 包管理器: {{ result.metadata.packageManager }}
      </div>
    </div>
  </div>
</template>
