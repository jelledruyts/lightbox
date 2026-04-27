<script setup lang="ts">
const props = defineProps<{
  modelValue: string
  label: string
  options: Array<{
    value: string
    label: string
  }>
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
  'update:modelValue': [value: string]
}>()

function handleChange(event: Event) {
  emit('update:modelValue', (event.target as HTMLSelectElement).value)
}
</script>

<template>
  <label :style="{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: colors.text, fontSize: '0.875rem', whiteSpace: 'nowrap' }">
    <span :style="{ color: colors.textSecondary }">{{ label }}</span>
    <select
      :value="modelValue"
      @change="handleChange"
      :style="{
        padding: '0.5rem 0.75rem',
        backgroundColor: colors.buttonBg,
        color: colors.text,
        borderRadius: '0.5rem',
        border: `1px solid ${colors.border}`,
        fontSize: '0.875rem',
        outline: 'none',
        cursor: 'pointer'
      }"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  </label>
</template>
