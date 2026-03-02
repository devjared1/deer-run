<template>
  <div id="inquiry-form" class="card-pine rounded-lg p-8 max-w-2xl mx-auto">
    <template v-if="!sent">
      <SectionLabel text="Get Started" dark class="mb-4" />
      <h2 style="font-family:'Playfair Display',serif;font-weight:700;font-size:26px;color:#F2EBD9;margin-bottom:6px;">Membership Inquiry</h2>
      <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(242,235,217,.5);margin-bottom:24px;">
        Fill out the form below and our Pro Shop staff will contact you within one business day.
      </p>

      <div v-if="error" class="mb-4 p-3 rounded" style="background:rgba(140,74,47,.3);color:#F2EBD9;font-family:'Lato',sans-serif;font-size:13px;">
        {{ error }}
      </div>

      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label" style="color:rgba(242,235,217,.45);">First Name</label>
            <input v-model="form.firstName" type="text" placeholder="John" class="field rounded-sm" />
          </div>
          <div>
            <label class="field-label" style="color:rgba(242,235,217,.45);">Last Name</label>
            <input v-model="form.lastName" type="text" placeholder="Smith" class="field rounded-sm" />
          </div>
        </div>
        <div>
          <label class="field-label" style="color:rgba(242,235,217,.45);">Email Address</label>
          <input v-model="form.email" type="email" placeholder="john@example.com" class="field rounded-sm" />
        </div>
        <div>
          <label class="field-label" style="color:rgba(242,235,217,.45);">Phone</label>
          <input v-model="form.phone" type="tel" placeholder="(256) 555-0100" class="field rounded-sm" />
        </div>
        <div>
          <label class="field-label" style="color:rgba(242,235,217,.45);">Interested In</label>
          <select v-model="form.tier" class="field rounded-sm">
            <option value="">Select a membership tier…</option>
            <option v-for="t in tiers" :key="t.name" :value="t.name">{{ t.name }} — ${{ t.annual }}/yr</option>
          </select>
        </div>
        <div>
          <label class="field-label" style="color:rgba(242,235,217,.45);">Message (optional)</label>
          <textarea v-model="form.message" rows="3" placeholder="Questions, family plan needs, etc." class="field rounded-sm resize-none"></textarea>
        </div>
        <button @click="submit" :disabled="loading" class="btn-amber w-full justify-center" :style="loading ? 'opacity:.6;cursor:not-allowed;' : ''">
          {{ loading ? 'Sending…' : 'Submit Inquiry' }}
        </button>
      </div>
    </template>

    <div v-else class="text-center">
      <div class="text-4xl mb-4">🏌️</div>
      <h3 style="font-family:'Playfair Display',serif;font-weight:700;font-size:24px;color:#F2EBD9;margin-bottom:10px;">Inquiry Received!</h3>
      <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(242,235,217,.5);">
        Our Pro Shop team will be in touch within one business day. We look forward to welcoming you to Deer Run.
      </p>
      <button @click="sent = false" class="btn-outline mt-6 inline-flex">Submit Another</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { membershipTiers as tiers } from '@/data/membershipTiers'

const props = defineProps({
  preSelectedTier: { type: String, default: '' },
})

const sent    = ref(false)
const loading = ref(false)
const error   = ref('')

const form = reactive({
  firstName: '',
  lastName:  '',
  email:     '',
  phone:     '',
  tier:      '',
  message:   '',
})

watch(() => props.preSelectedTier, (val) => {
  if (val) form.tier = val
})

async function submit() {
  error.value = ''
  if (!form.firstName || !form.email) {
    error.value = 'Please fill in your name and email.'
    return
  }
  loading.value = true
  try {
    const res = await fetch('/api/inquiries/membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) throw new Error('Server error')
    sent.value = true
  } catch (e) {
    error.value = 'Something went wrong. Please call us at (256) 974-7384.'
  } finally {
    loading.value = false
  }
}
</script>
