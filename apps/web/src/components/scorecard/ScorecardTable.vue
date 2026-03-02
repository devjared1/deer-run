<template>
  <div class="card rounded-lg overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full" style="min-width:560px;">
        <thead>
          <tr style="background:#1E3D2F;">
            <th class="py-3 px-4 text-left" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(242,235,217,.6);">Hole</th>
            <th class="py-3 px-3 text-center" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">{{ activeTeeLabel }}</th>
            <th class="py-3 px-3 text-center" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(242,235,217,.45);">Par</th>
            <th class="py-3 px-3 text-center" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(242,235,217,.45);">Hdcp</th>
            <th class="py-3 px-3 text-center" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(242,235,217,.45);">Features</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="h in holes"
            :key="h.hole"
            class="sc-row"
            style="border-bottom:1px solid rgba(61,43,26,.07);"
          >
            <td class="py-3 px-4">
              <div class="flex items-center gap-3">
                <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:#1E3D2F;">
                  <span style="font-family:'Lato',sans-serif;font-size:11px;font-weight:900;color:#C4873A;">{{ h.hole }}</span>
                </div>
                <span style="font-family:'Playfair Display',serif;font-size:15px;font-weight:600;color:#1E3D2F;">{{ h.name }}</span>
              </div>
            </td>
            <td class="py-3 px-3 text-center" style="font-family:'Lato',sans-serif;font-weight:700;font-size:14px;color:#3D2B1A;">
              {{ h.yards[activeTeeIndex] }}
            </td>
            <td class="py-3 px-3 text-center">
              <span :class="['font-bold text-sm', h.par === 3 ? 'sc-par3' : h.par === 5 ? 'sc-par5' : '']" style="font-family:'Lato',sans-serif;">{{ h.par }}</span>
            </td>
            <td class="py-3 px-3 text-center" style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.5);">{{ h.hdcp }}</td>
            <td class="py-3 px-3 text-center">
              <span v-if="h.water" title="Water" class="mr-1">🌊</span>
              <span v-if="h.bunkers > 0" title="Bunkers" class="mr-1">⛱</span>
              <span v-if="h.mountain" title="Mountain hole" class="mr-1">⛰</span>
              <span v-if="h.signature" title="Signature hole">⭐</span>
            </td>
          </tr>

          <!-- Subtotal row -->
          <tr class="sc-total" style="border-top:2px solid rgba(30,61,47,.2);">
            <td class="py-3 px-4" style="font-family:'Lato',sans-serif;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#1E3D2F;">{{ label }}</td>
            <td class="py-3 px-3 text-center" style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:#1E3D2F;">{{ subtotal }}</td>
            <td class="py-3 px-3 text-center" style="font-family:'Playfair Display',serif;font-size:16px;font-weight:900;color:#1E3D2F;">{{ parSubtotal }}</td>
            <td colspan="2"></td>
          </tr>

          <!-- Grand total row (back 9 only) -->
          <tr v-if="showGrandTotal" style="background:rgba(196,135,58,.08);border-top:2px solid rgba(196,135,58,.3);">
            <td class="py-3 px-4" style="font-family:'Lato',sans-serif;font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#1E3D2F;">TOTAL</td>
            <td class="py-3 px-3 text-center" style="font-family:'Playfair Display',serif;font-size:18px;font-weight:900;color:#1E3D2F;">{{ grandTotal }}</td>
            <td class="py-3 px-3 text-center" style="font-family:'Playfair Display',serif;font-size:18px;font-weight:900;color:#1E3D2F;">72</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { teeSets } from '@/data/teeSets'

const props = defineProps({
  holes:          { type: Array,   required: true },
  activeTeeIndex: { type: Number,  required: true },
  label:          { type: String,  default: 'OUT' },
  showGrandTotal: { type: Boolean, default: false },
  grandTotal:     { type: Number,  default: 0 },
})

const activeTeeLabel = computed(() => teeSets[props.activeTeeIndex].name)

const subtotal = computed(() =>
  props.holes.reduce((sum, h) => sum + h.yards[props.activeTeeIndex], 0)
)

const parSubtotal = computed(() =>
  props.holes.reduce((sum, h) => sum + h.par, 0)
)
</script>
