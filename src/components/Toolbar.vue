<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  currentFolderHandle?: FileSystemDirectoryHandle | null
  colors: {
    bg: string
    bgSecondary: string
    border: string
    text: string
    textSecondary: string
    buttonBg: string
    buttonHoverBg: string
  }
}>()

const supportsFileSystemAccess = 'showDirectoryPicker' in window

const emit = defineEmits<{
  folderSelected: [files: File[], dirHandle: FileSystemDirectoryHandle]
}>()

const isLoading = ref(false)
const loadingAction = ref<'open' | 'reload'>('open')

async function readImageFiles(dirHandle: FileSystemDirectoryHandle) {
  const imageFiles: File[] = []

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      const file = await entry.getFile()
      if (file.type.startsWith('image/')) {
        imageFiles.push(file)
      }
    }
  }

  return imageFiles
}

async function openFolder() {
  if (!supportsFileSystemAccess) {
    alert('File System Access API is not supported in this browser. Please use Chrome or Edge.')
    return
  }

  try {
    isLoading.value = true
    loadingAction.value = 'open'
    const dirHandle = await window.showDirectoryPicker()
    const imageFiles = await readImageFiles(dirHandle)

    emit('folderSelected', imageFiles, dirHandle)
  } catch (error) {
    if ((error as Error).name !== 'AbortError') {
      console.error('Error opening folder:', error)
      alert('Failed to open folder')
    }
  } finally {
    isLoading.value = false
  }
}

async function reloadFolder() {
  if (!props.currentFolderHandle) {
    return
  }

  try {
    isLoading.value = true
    loadingAction.value = 'reload'
    const imageFiles = await readImageFiles(props.currentFolderHandle)
    emit('folderSelected', imageFiles, props.currentFolderHandle)
  } catch (error) {
    console.error('Error reloading folder:', error)
    alert('Failed to reload folder')
  } finally {
    isLoading.value = false
  }
}

// Expose openFolder to parent component
defineExpose({
  openFolder,
  reloadFolder
})
</script>

<template>
  <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '1rem', backgroundColor: colors.bgSecondary, borderBottom: `1px solid ${colors.border}`, flexWrap: 'wrap' }">
    <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 200px;">
      <button
        @click="openFolder"
        :disabled="isLoading"
        :style="{
          padding: '0.5rem 1.5rem',
          backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
          color: 'white',
          borderRadius: '0.5rem',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          fontWeight: '500',
          transition: 'background-color 0.2s'
        }"
        @mouseover="($event.currentTarget as HTMLElement).style.backgroundColor = isLoading ? '#9ca3af' : '#1d4ed8'"
        @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = isLoading ? '#9ca3af' : '#2563eb'"
      >
        {{ isLoading && loadingAction === 'open' ? 'Loading...' : 'Open Folder' }}
      </button>
      <button
        @click="reloadFolder"
        :disabled="isLoading || !currentFolderHandle"
        :style="{
          width: '2.5rem',
          height: '2.5rem',
          backgroundColor: isLoading || !currentFolderHandle ? colors.border : colors.buttonBg,
          color: isLoading || !currentFolderHandle ? colors.textSecondary : colors.text,
          borderRadius: '0.5rem',
          border: 'none',
          cursor: isLoading || !currentFolderHandle ? 'not-allowed' : 'pointer',
          fontWeight: '500',
          transition: 'background-color 0.2s',
          opacity: isLoading || !currentFolderHandle ? '0.6' : '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.125rem',
          lineHeight: '1'
        }"
        @mouseover="!isLoading && currentFolderHandle && (($event.currentTarget as HTMLElement).style.backgroundColor = colors.buttonHoverBg)"
        @mouseout="($event.currentTarget as HTMLElement).style.backgroundColor = isLoading || !currentFolderHandle ? colors.border : colors.buttonBg"
        title="Reload the currently opened folder (R)"
      >
        {{ isLoading && loadingAction === 'reload' ? '…' : '↻' }}
      </button>
      <div v-if="!supportsFileSystemAccess" style="color: #dc2626; font-size: 0.875rem; font-weight: 500;">
        ⚠️ File System Access API not supported. Please use Chrome or Edge.
      </div>
    </div>
    
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
