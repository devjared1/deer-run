<template>
  <div class="page-enter">
    <PageHero
      label="Join the Club"
      title-html="Membership <em>Plans</em>"
      description="Unlimited rounds, advance tee times, and exclusive member events. Choose the plan that fits your game."
      bg-image="/images/course-2.jpg"
    />

    <section class="topo py-14">
      <div class="max-w-7xl mx-auto px-5">

        <!-- Tier cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-7 mb-16">
          <MembershipTierCard
            v-for="tier in membershipTiers"
            :key="tier.name"
            :tier="tier"
            @inquire="openInquiry"
          />
        </div>

        <!-- Compare perks table -->
        <div class="max-w-4xl mx-auto mb-16">
          <SectionLabel text="Compare Plans" center class="mb-7" />
          <div class="card rounded-lg overflow-hidden">
            <table class="w-full">
              <thead>
                <tr style="background:#1E3D2F;">
                  <th class="py-3 px-5 text-left" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(242,235,217,.5);">Benefit</th>
                  <th v-for="t in membershipTiers" :key="t.name" class="py-3 px-4 text-center" style="font-family:'Lato',sans-serif;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;" :style="`color:${t.color}`">{{ t.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(perk, i) in comparisonPerks" :key="perk.label" :class="i % 2 === 0 ? '' : 'sc-row'" style="border-bottom:1px solid rgba(61,43,26,.07);">
                  <td class="py-3 px-5" style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(61,43,26,.7);">{{ perk.label }}</td>
                  <td v-for="t in membershipTiers" :key="t.name" class="py-3 px-4 text-center" style="font-size:14px;">
                    <span v-if="perk.values[t.name] === true" style="color:#1E3D2F;">✓</span>
                    <span v-else-if="perk.values[t.name] === false" style="color:rgba(61,43,26,.2);">—</span>
                    <span v-else style="font-family:'Lato',sans-serif;font-size:12px;font-weight:700;color:#1E3D2F;">{{ perk.values[t.name] }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Inquiry form anchor -->
        <div id="inquiry-form">
          <MembershipInquiryForm :pre-selected-tier="selectedTier" />
        </div>

      </div>
    </section>
  </div>
</template>

<script setup>
import { ref }               from 'vue'
import PageHero              from '@/components/layout/PageHero.vue'
import SectionLabel          from '@/components/ui/SectionLabel.vue'
import MembershipTierCard    from '@/components/membership/MembershipTierCard.vue'
import MembershipInquiryForm from '@/components/membership/MembershipInquiryForm.vue'
import { membershipTiers }   from '@/data/membershipTiers'

const selectedTier = ref('')

function openInquiry(tierName) {
  selectedTier.value = tierName
  setTimeout(() => {
    document.getElementById('inquiry-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}

// Individual | Premier | Family
const comparisonPerks = [
  { label: 'Advance booking window',   values: { Individual: '14 days', Premier: '14 days', Family: '14 days' } },
  { label: 'Unlimited rounds',         values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Cart included every round',values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Range balls included',     values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Member-only events',       values: { Individual: true,      Premier: true,      Family: true       } },
  { label: 'Spouse / partner',         values: { Individual: false,     Premier: true,      Family: true       } },
  { label: 'Children (under 18)',      values: { Individual: false,     Premier: false,     Family: true       } },
  { label: 'Junior lesson discount',   values: { Individual: false,     Premier: false,     Family: '20%'      } },
  { label: 'Pro Shop discount',        values: { Individual: '10%',     Premier: '15%',     Family: '15%'      } },
  { label: 'Club events & socials',    values: { Individual: false,     Premier: true,      Family: false      } },
]
</script>
