<!-- components/game/Card.vue -->
<template>
  <div 
    class="relative" 
    :style="{ width: `${width}px`, height: `${height}px` }"
    :class="{ 'cursor-pointer': clickable }"
    @click="$emit('click')"
  >
    <playing-card 
      :cid="faceUp ? cardCode : null"
      :rank="!faceUp ? '0' : null"
      :data-code="cardCode"
      class="transform-gpu"
      :class="animationClass"
    ></playing-card>
  </div>
</template>

<script setup>
defineProps({
  cardCode: {
    type: String,
    required: true
  },
  faceUp: {
    type: Boolean,
    default: true
  },
  width: {
    type: Number,
    default: 120
  },
  height: {
    type: Number,
    default: 168
  },
  clickable: {
    type: Boolean,
    default: false
  },
  animationClass: {
    type: String,
    default: ''
  }
});

defineEmits(['click']);
</script>