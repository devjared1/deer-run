<template>
  <svg :width="size" :height="size" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="22"
      :fill="`rgba(196,135,58,${variant === 'dark' ? '0.1' : '0.18'})`"
      :stroke="`rgba(196,135,58,${variant === 'dark' ? '0.25' : '0.35'})`"
      stroke-width="1" />
    <g transform="translate(7,5)" fill="#C4873A">
      <ellipse cx="17" cy="24" rx="10" ry="6.5" />
      <rect x="22" y="16" width="4" height="9" rx="2" />
      <ellipse cx="25" cy="14" rx="4" ry="3.5" />
      <ellipse cx="28" cy="15.5" rx="1.5" ry="1" />
      <path d="M22 11 Q19 7 17 4" stroke="#C4873A" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <path d="M19.5 7 Q17 6 15 7" stroke="#C4873A" stroke-width="1.2" stroke-linecap="round" fill="none" />
      <path d="M18 5.5 Q16 3 15 1.5" stroke="#C4873A" stroke-width="1.2" stroke-linecap="round" fill="none" />
      <path d="M25 10 Q26 6 28 3.5" stroke="#C4873A" stroke-width="1.5" stroke-linecap="round" fill="none" />
      <path d="M26.5 6.5 Q28.5 5.5 30 6.5" stroke="#C4873A" stroke-width="1.2" stroke-linecap="round" fill="none" />
      <path d="M27.5 5 Q29 2.5 30 1.5" stroke="#C4873A" stroke-width="1.2" stroke-linecap="round" fill="none" />
      <ellipse cx="7" cy="22" rx="2" ry="2.5" transform="rotate(-15 7 22)" fill="rgba(242,235,217,0.6)" />
      <path d="M20 29 L19 36 L20.5 36" stroke="#C4873A" stroke-width="2" stroke-linecap="round" fill="none" />
      <path d="M23 29.5 L22.5 36 L24 36" stroke="#C4873A" stroke-width="2" stroke-linecap="round" fill="none" />
      <path d="M12 28 L11 36 L12.5 36" stroke="#C4873A" stroke-width="2" stroke-linecap="round" fill="none" />
      <path d="M15 29 L14.5 36 L16 36" stroke="#C4873A" stroke-width="2" stroke-linecap="round" fill="none" />
      <circle cx="27" cy="13" r=".8" fill="#0D1F16" />
    </g>
  </svg>
</template>

<script setup>
defineProps({
  size:    { type: Number, default: 48 },
  variant: { type: String, default: 'light' }, // 'light' | 'dark'
})
</script>
