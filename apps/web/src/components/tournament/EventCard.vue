<template>
  <div :class="['card rounded-lg p-6 event-row', event.past ? 'event-past' : '']">
    <div class="flex flex-col sm:flex-row sm:items-start gap-4">
      <!-- Date block -->
      <div class="flex-shrink-0 w-16 text-center rounded" style="background:#1E3D2F;padding:8px 4px;">
        <div style="font-family:'Lato',sans-serif;font-size:10px;font-weight:900;letter-spacing:.15em;text-transform:uppercase;color:rgba(196,135,58,.8);">{{ event.month }}</div>
        <div style="font-family:'Playfair Display',serif;font-size:28px;font-weight:900;color:#F2EBD9;line-height:1;">{{ event.day }}</div>
        <div style="font-family:'Lato',sans-serif;font-size:10px;color:rgba(242,235,217,.4);">{{ event.year }}</div>
      </div>

      <!-- Details -->
      <div class="flex-1">
        <div class="flex flex-wrap items-center gap-2 mb-1">
          <span v-if="event.memberOnly" class="tier-badge" style="background:rgba(196,135,58,.15);color:#A06E28;border:1px solid rgba(196,135,58,.3);">Member Only</span>
          <span v-if="event.featured"   class="tier-badge" style="background:rgba(30,61,47,.12);color:#1E3D2F;">Featured</span>
          <span v-if="event.past"       class="tier-badge" style="background:rgba(61,43,26,.08);color:rgba(61,43,26,.4);">Completed</span>
          <span class="tier-badge" style="background:rgba(74,102,112,.12);color:#344A52;">{{ event.format }}</span>
        </div>
        <h3 style="font-family:'Playfair Display',serif;font-weight:700;font-size:19px;color:#1E3D2F;margin-bottom:4px;">{{ event.name }}</h3>
        <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.55);margin-bottom:10px;line-height:1.6;">{{ event.desc }}</p>
        <div class="flex flex-wrap gap-4 text-xs" style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.45);">
          <span class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"/></svg>
            {{ event.time }}
          </span>
          <span class="flex items-center gap-1">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 12.094A5.973 5.973 0 004 15v1H1v-1a3 3 0 013.75-2.906z"/></svg>
            {{ event.spots }}
          </span>
          <span v-if="event.entry" class="flex items-center gap-1">
            ${{ event.entry }} entry
          </span>
        </div>
      </div>

      <!-- CTA -->
      <div class="flex-shrink-0 self-center">
        <RouterLink v-if="!event.past" to="/book" class="btn-primary whitespace-nowrap" style="padding:10px 20px;font-size:12px;">
          {{ event.memberOnly ? 'Member Sign-Up' : 'Register' }}
        </RouterLink>
        <span v-else style="font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(61,43,26,.3);">Completed</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  event: { type: Object, required: true },
})
</script>
