<!-- components/game/Card.vue -->
<template>
  <div 
    class="relative" 
    :style="{ width: `${width}px`, height: `${height}px` }"
    :class="{ 'cursor-pointer': clickable }"
    @click="$emit('click')"
  >
    <!-- API Image Version -->
    <img 
      v-if="faceUp && cardImage" 
      :src="cardImage" 
      :alt="cardCode" 
      class="w-full h-full rounded-lg shadow"
      :class="animationClass"
    />
    
    <!-- CardMeister Version -->
    <playing-card 
      v-else-if="cardMeisterAvailable"
      :cid="faceUp ? cardCode : null"
      :rank="!faceUp ? '0' : null"
      :data-code="cardCode"
      class="transform-gpu"
      :class="animationClass"
    ></playing-card>
    
    <!-- Fallback Display -->
    <div 
      v-else 
      class="card-fallback" 
      :class="{'text-red-600': isRedSuit}"
    >
      {{ faceUp ? displayCardCode : '🂠' }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const props = defineProps({
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
  },
  // Optional image URL from Deck of Cards API
  image: {
    type: String,
    default: ''
  }
});

defineEmits(['click']);

const cardMeisterAvailable = ref(false);

// Generate card image URL using Deck of Cards API
const cardImage = computed(() => {
  if (props.image) return props.image;
  
  // If no image provided, generate URL from card code
  if (props.cardCode) {
    return `https://deckofcardsapi.com/static/img/${props.cardCode}.png`;
  }
  return '';
});

// Is this a red suit (hearts or diamonds)?
const isRedSuit = computed(() => {
  if (!props.cardCode) return false;
  const suit = props.cardCode.slice(-1);
  return suit === 'H' || suit === 'D';
});

// Display text version of card
const displayCardCode = computed(() => {
  const code = props.cardCode;
  if (!code) return '?';
  
  // Extract rank and suit
  const rank = code.slice(0, -1);
  const suit = code.slice(-1);
  
  // Convert suit to symbol
  let suitSymbol = '';
  switch (suit) {
    case 'H': suitSymbol = '♥'; break;
    case 'D': suitSymbol = '♦'; break;
    case 'C': suitSymbol = '♣'; break;
    case 'S': suitSymbol = '♠'; break;
    default: suitSymbol = suit;
  }
  
  // Handle 10 specially (comes as '0' in the code)
  const rankDisplay = rank === '0' ? '10' : rank;
  
  return `${rankDisplay}${suitSymbol}`;
});

onMounted(() => {
  // Check if CardMeister is loaded
  const checkCardsLoaded = setInterval(() => {
    if (typeof window !== 'undefined' && window.customElements && 
        window.customElements.get('playing-card')) {
      cardMeisterAvailable.value = true;
      clearInterval(checkCardsLoaded);
    }
  }, 100);
  
  // Clear interval after 2 seconds even if not loaded
  setTimeout(() => {
    clearInterval(checkCardsLoaded);
  }, 2000);
});
</script>

<style scoped>
.card-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  font-size: 24px;
  font-weight: bold;
}
.card-fallback:empty::after {
  content: '?';
}
</style>