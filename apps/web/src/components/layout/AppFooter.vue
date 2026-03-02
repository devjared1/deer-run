<template>
  <footer style="background:#0D1F16;margin-top:24px;">
    <div class="max-w-7xl mx-auto px-5 py-14">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 mb-8" style="border-bottom:1px solid rgba(255,255,255,.07);">
        <!-- Brand -->
        <div class="md:col-span-2">
          <RouterLink to="/" class="flex items-center gap-3 mb-4">
            <DeerLogo :size="36" variant="dark" />
            <div>
              <div class="logo-text" style="font-size:18px;">Deer Run Golf Course</div>
              <div class="logo-sub">Est. 1980 · Earl Stone Design</div>
            </div>
          </RouterLink>
          <p style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(242,235,217,.35);line-height:1.8;max-width:300px;">
            18 holes nestled at the entrance to the Bankhead National Forest in Moulton, Alabama. Open to the public daily.
          </p>
        </div>

        <!-- Quick links -->
        <div>
          <div style="font-family:'Lato',sans-serif;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(196,135,58,.6);margin-bottom:14px;">Quick Links</div>
          <div class="space-y-2">
            <RouterLink
              v-for="p in pages"
              :key="p.to"
              :to="p.to"
              class="block footer-link"
            >
              {{ p.label }}
            </RouterLink>
          </div>
        </div>

        <!-- Contact -->
        <div>
          <div style="font-family:'Lato',sans-serif;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(196,135,58,.6);margin-bottom:14px;">Contact</div>
          <div class="space-y-1" style="font-family:'Lato',sans-serif;font-size:13px;color:rgba(242,235,217,.4);line-height:1.7;">
            <div>1175 County Road 100</div>
            <div>Moulton, AL 35650</div>
            <a href="tel:2569747384" class="block footer-link-phone">(256) 974-7384</a>
            <div style="margin-top:8px;color:rgba(242,235,217,.3);">Open daily · 7:30 AM</div>
            <div style="color:rgba(242,235,217,.3);">Closed Christmas Eve &amp; Day</div>
          </div>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div style="font-family:'Lato',sans-serif;font-size:12px;color:rgba(242,235,217,.2);">
          © {{ new Date().getFullYear() }} City of Moulton, AL · Deer Run Golf Course. All rights reserved.
        </div>
        <div class="flex gap-5">
          <span v-for="l in footerLinks" :key="l" class="footer-small">{{ l }}</span>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup>
import DeerLogo from '@/components/ui/DeerLogo.vue'

const pages = [
  { to: '/',            label: 'Home' },
  { to: '/scorecard',   label: 'The Course' },
  { to: '/rates',       label: 'Rates' },
  { to: '/memberships', label: 'Memberships' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/contact',     label: 'Contact' },
  { to: '/book',        label: 'Book a Tee Time' },
]

const footerLinks = ['Privacy Policy', 'Accessibility', 'City of Moulton']
</script>

<style scoped>
.footer-link {
  font-family: 'Lato', sans-serif;
  font-size: 13px;
  color: rgba(242, 235, 217, 0.4);
  transition: color 0.15s;
  text-decoration: none;
}
.footer-link:hover { color: rgba(242, 235, 217, 0.75); }

.footer-link-phone {
  font-family: 'Lato', sans-serif;
  font-size: 13px;
  color: rgba(242, 235, 217, 0.4);
  transition: color 0.15s;
  text-decoration: none;
}
.footer-link-phone:hover { color: #c4873a; }

.footer-small {
  font-family: 'Lato', sans-serif;
  font-size: 12px;
  color: rgba(242, 235, 217, 0.3);
  cursor: pointer;
  transition: color 0.15s;
}
.footer-small:hover { color: rgba(242, 235, 217, 0.6); }
</style>
