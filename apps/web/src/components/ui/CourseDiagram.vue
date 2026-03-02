<template>
  <svg viewBox="0 0 360 280" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full max-w-md mx-auto opacity-90">
    <rect width="360" height="280" rx="8" fill="#142A20"/>
    <!-- Fairways -->
    <path d="M40 240 Q60 190 90 180 Q120 170 130 140 Q140 110 120 80" stroke="#2A5240" stroke-width="18" stroke-linecap="round" fill="none"/>
    <path d="M130 140 Q160 130 180 110 Q200 90 220 70" stroke="#2A5240" stroke-width="18" stroke-linecap="round" fill="none"/>
    <path d="M220 70 Q250 55 270 70 Q290 85 300 110" stroke="#2A5240" stroke-width="18" stroke-linecap="round" fill="none"/>
    <path d="M300 110 Q315 140 300 170 Q285 200 260 210" stroke="#2A5240" stroke-width="18" stroke-linecap="round" fill="none"/>
    <path d="M260 210 Q230 220 210 240" stroke="#2A5240" stroke-width="18" stroke-linecap="round" fill="none"/>
    <!-- Lakes -->
    <ellipse cx="170" cy="170" rx="28" ry="16" fill="rgba(74,102,112,.6)" stroke="rgba(74,102,112,.8)" stroke-width="1"/>
    <ellipse cx="280" cy="150" rx="18" ry="11" fill="rgba(74,102,112,.5)" stroke="rgba(74,102,112,.7)" stroke-width="1"/>
    <ellipse cx="95" cy="210" rx="14" ry="9" fill="rgba(74,102,112,.5)"/>
    <!-- Bunkers -->
    <ellipse cx="110" cy="130" rx="8" ry="5" fill="rgba(242,235,217,.12)"/>
    <ellipse cx="200" cy="85" rx="7" ry="4" fill="rgba(242,235,217,.12)"/>
    <ellipse cx="255" cy="175" rx="9" ry="5" fill="rgba(242,235,217,.12)"/>
    <ellipse cx="155" cy="110" rx="6" ry="4" fill="rgba(242,235,217,.1)"/>
    <!-- Greens -->
    <circle cx="120" cy="80" r="10" fill="rgba(30,100,50,.8)" stroke="rgba(196,135,58,.5)" stroke-width="1.5"/>
    <circle cx="220" cy="70" r="10" fill="rgba(30,100,50,.8)" stroke="rgba(196,135,58,.5)" stroke-width="1.5"/>
    <circle cx="300" cy="110" r="10" fill="rgba(30,100,50,.8)" stroke="rgba(196,135,58,.5)" stroke-width="1.5"/>
    <circle cx="260" cy="210" r="10" fill="rgba(30,100,50,.8)" stroke="rgba(196,135,58,.5)" stroke-width="1.5"/>
    <circle cx="210" cy="240" r="10" fill="rgba(30,100,50,.8)" stroke="rgba(196,135,58,.5)" stroke-width="1.5"/>
    <!-- Pin flags -->
    <line x1="120" y1="80" x2="120" y2="65" stroke="#C4873A" stroke-width="1.2"/>
    <path d="M120 65 L128 68 L120 71Z" fill="#C4873A"/>
    <line x1="220" y1="70" x2="220" y2="55" stroke="#C4873A" stroke-width="1.2"/>
    <path d="M220 55 L228 58 L220 61Z" fill="#C4873A"/>
    <!-- Tee marker -->
    <circle cx="40" cy="240" r="5" fill="#C4873A"/>
    <circle cx="40" cy="240" r="3" fill="#0D1F16"/>
    <!-- Legend -->
    <rect x="12" y="12" width="8" height="8" rx="1" fill="rgba(30,100,50,.8)" stroke="rgba(196,135,58,.5)" stroke-width="1"/>
    <text x="24" y="20" fill="rgba(242,235,217,.5)" font-size="9" font-family="Lato">Green</text>
    <rect x="70" y="12" width="8" height="8" rx="4" fill="rgba(74,102,112,.6)"/>
    <text x="82" y="20" fill="rgba(242,235,217,.5)" font-size="9" font-family="Lato">Lake</text>
    <rect x="128" y="12" width="8" height="8" rx="1" fill="rgba(242,235,217,.12)"/>
    <text x="140" y="20" fill="rgba(242,235,217,.5)" font-size="9" font-family="Lato">Bunker</text>
    <!-- Compass -->
    <text x="328" y="26" fill="rgba(196,135,58,.6)" font-size="11" font-family="Playfair Display" text-anchor="middle">N</text>
    <line x1="328" y1="28" x2="328" y2="40" stroke="rgba(196,135,58,.4)" stroke-width="1.2"/>
    <path d="M328 28 L324 36 L328 34 L332 36Z" fill="rgba(196,135,58,.4)"/>
  </svg>
</template>
