<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title?: string
}>()

const isOpen = ref(false)

const toggleModal = () => {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <button inline-block @click="toggleModal" class="ai-note-button">
    <div i-carbon-chat />
    <span v-if="title" class="button-title">{{ title }}</span>
    <Teleport to="body">
      <div v-if="isOpen" class="modal-overlay" @click="toggleModal">
        <div class="modal-content slidev-layout" @click.stop>
          <button @click="toggleModal" class="close-button">
            <div i-carbon-close />
          </button>
          <slot />
        </div>
      </div>
    </Teleport>
  </button>
</template>

<style scoped>
.ai-note-button {
  background: rgba(0, 0, 0, 0.03);
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.5rem;
  transition: background 0.2s;
  display: none; /* inline-flex; */
  align-items: center;
  gap: 0.5rem;
}

.button-title {
  font-size: 0.875rem;
}

.ai-note-button:hover {
  background: rgba(0, 0, 0, 0.08);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  width: 80vw;
  max-height: 90vh;
  overflow: auto;
  position: relative;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  --uno: text-xl;
  --slidev-code-font-size: 0.9em;
}

.close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.1);
}
</style>
