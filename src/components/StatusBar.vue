<script setup lang="ts">
const props = defineProps<{
  totalImages: number
  filteredCount: number
  acceptedCount: number
  rejectedCount: number
  untriagedCount: number
  selectedCount: number
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
</script>

<template>
  <div :style="{ 
    backgroundColor: colors.bgSecondary, 
    borderTop: `1px solid ${colors.border}`, 
    padding: '0.5rem 1rem', 
    fontSize: '0.875rem', 
    color: colors.textSecondary,
    textAlign: 'center'
  }">
    <span v-if="totalImages > 0">
      Showing {{ filteredCount }}/{{ totalImages }} images |
      {{ acceptedCount }} accepted, {{ rejectedCount }} rejected, {{ untriagedCount }} untriaged |
      {{ selectedCount }} selected
    </span>
    <span v-else>No images loaded</span>
  </div>
</template>
