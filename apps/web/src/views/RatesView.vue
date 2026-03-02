<template>
  <div class="page-enter">
    <PageHero
      label="Green Fees"
      title-html="Rates &amp; <em>Services</em>"
      subtitle="Competitive rates with cart included. Twilight specials available every day after 2 PM."
    />

    <section class="topo py-14">
      <div class="max-w-7xl mx-auto px-5">

        <!-- Rate cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
          <div
            v-for="r in rateCards"
            :key="r.title"
            :class="['card rounded-lg overflow-hidden', r.featured ? 'ring-2' : '']"
            :style="r.featured ? 'box-shadow:0 0 0 2px #C4873A,0 3px 18px rgba(30,61,47,.09);' : ''"
          >
            <div v-if="r.featured" class="py-2 text-center" style="background:#C4873A;">
              <span style="font-family:'Lato',sans-serif;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#0D1F16;">Most Popular</span>
            </div>
            <div class="p-7">
              <div style="font-family:'Lato',sans-serif;font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(61,43,26,.4);margin-bottom:6px;">{{ r.subtitle }}</div>
              <h3 style="font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#1E3D2F;margin-bottom:14px;">{{ r.title }}</h3>
              <div class="flex items-end gap-1 mb-1">
                <span style="font-family:'Playfair Display',serif;font-size:48px;font-weight:900;color:#1E3D2F;line-height:1;">${{ r.price }}</span>
              </div>
              <div style="font-family:'Lato',sans-serif;font-size:12px;color:rgba(61,43,26,.4);margin-bottom:20px;">per player · cart included</div>
              <div class="divider mb-5"></div>
              <ul class="space-y-2.5">
                <li
                  v-for="item in r.includes"
                  :key="item"
                  class="flex items-center gap-2.5 text-sm"
                  style="font-family:'Lato',sans-serif;color:rgba(61,43,26,.65);"
                >
                  <svg class="w-4 h-4 flex-shrink-0" style="color:#1E3D2F;" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                  {{ item }}
                </li>
              </ul>
              <RouterLink to="/book" class="btn-amber w-full justify-center mt-6">Book This Rate</RouterLink>
            </div>
          </div>
        </div>

        <!-- Additional fees table -->
        <div class="max-w-3xl mx-auto mb-14">
          <SectionLabel text="Additional Services" center class="mb-6" />
          <div class="card rounded-lg overflow-hidden">
            <table class="w-full">
              <tbody>
                <tr
                  v-for="(fee, i) in additionalFees"
                  :key="fee.item"
                  class="border-b last:border-0"
                  :class="i % 2 === 1 ? 'sc-row' : ''"
                  style="border-color:rgba(61,43,26,.07);"
                >
                  <td class="py-3.5 px-5" style="font-family:'Lato',sans-serif;font-size:14px;font-weight:700;color:#1E3D2F;">{{ fee.item }}</td>
                  <td class="py-3.5 px-4 text-right" style="font-family:'Playfair Display',serif;font-size:18px;font-weight:900;color:#1E3D2F;white-space:nowrap;">{{ fee.price }}</td>
                  <td class="py-3.5 px-5 hidden md:table-cell" style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.45);">{{ fee.note }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Policies -->
        <div class="max-w-3xl mx-auto mb-14">
          <SectionLabel text="Course Policies" center class="mb-6" />
          <div class="card-pine rounded-lg p-8">
            <ul class="space-y-3">
              <li
                v-for="p in policies"
                :key="p"
                class="flex items-start gap-3"
                style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(242,235,217,.6);line-height:1.6;"
              >
                <span style="color:#C4873A;font-weight:900;flex-shrink:0;margin-top:1px;">—</span>
                {{ p }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Group CTA -->
        <div class="max-w-3xl mx-auto text-center">
          <SectionLabel text="Group Outings" center class="mb-5" />
          <h2 style="font-family:'Playfair Display',serif;font-size:32px;font-weight:900;color:#1E3D2F;margin-bottom:10px;">Planning a Group Outing?</h2>
          <p style="font-family:'Lato',sans-serif;font-size:14px;color:rgba(61,43,26,.5);margin-bottom:22px;line-height:1.7;">Corporate events, fundraisers, and groups of 16+ receive customized pricing. Contact the Pro Shop for a quote.</p>
          <RouterLink to="/contact" class="btn-amber">Contact the Pro Shop</RouterLink>
        </div>

      </div>
    </section>
  </div>
</template>

<script setup>
import PageHero     from '@/components/layout/PageHero.vue'
import SectionLabel from '@/components/ui/SectionLabel.vue'
import { rateCards, additionalFees, policies } from '@/data/rates'
</script>
