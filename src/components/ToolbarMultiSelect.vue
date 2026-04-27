<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  modelValue: string[]
  options: Array<{
    value: string
    label: string
  }>
  allLabel: string
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

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const summaryLabel = computed(() => {
  if (props.options.length === 0) {
    return props.allLabel
  }

  if (props.modelValue.length === 0) {
    return 'No cameras'
  }

  if (props.modelValue.length === props.options.length) {
    return props.allLabel
  }

  if (props.modelValue.length === 1) {
    return props.options.find(option => option.value === props.modelValue[0])?.label ?? props.modelValue[0]
  }

  return `${props.modelValue.length} cameras`
})

function handleDocumentClick(event: MouseEvent) {
  if (!rootRef.value?.contains(event.target as Node)) {
    isOpen.value = false
  }
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

function toggleOption(value: string) {
  const nextValues = new Set(props.modelValue)

  if (nextValues.has(value)) {
    nextValues.delete(value)
  } else {
    nextValues.add(value)
  }

  emit('update:modelValue', [...nextValues])
}

function selectAll() {
  emit('update:modelValue', props.options.map(option => option.value))
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick)
})
</script>

<template>
  <div ref="rootRef" :style="{ position: 'relative' }">
    <button
      type="button"
      @click.stop="toggleDropdown"
      :style="{
        padding: '0.5rem 0.75rem',
        backgroundColor: colors.buttonBg,
        color: colors.text,
        borderRadius: '0.5rem',
        border: `1px solid ${colors.border}`,
        fontSize: '0.875rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }"
      :title="allLabel"
    >
      {{ summaryLabel }} ▾
    </button>

    <div
      v-if="isOpen"
      :style="{
        position: 'absolute',
        top: 'calc(100% + 0.5rem)',
        right: 0,
        minWidth: '14rem',
        maxHeight: '18rem',
        overflowY: 'auto',
        padding: '0.5rem',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
        zIndex: 20
      }"
    >
      <button
        type="button"
        @click="selectAll"
        :style="{
          width: '100%',
          marginBottom: '0.5rem',
          padding: '0.5rem 0.625rem',
          backgroundColor: colors.buttonBg,
          color: colors.text,
          borderRadius: '0.375rem',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '0.875rem'
        }"
      >
        Select all
      </button>

      <label
        v-for="option in options"
        :key="option.value"
        :style="{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.25rem',
          color: colors.text,
          fontSize: '0.875rem',
          cursor: 'pointer'
        }"
      >
        <input
          type="checkbox"
          :checked="modelValue.includes(option.value)"
          @change="toggleOption(option.value)"
        >
        <span :title="option.label">{{ option.label }}</span>
      </label>
    </div>
  </div>
</template>
