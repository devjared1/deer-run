// Cypress E2E support file — runs before every spec.
// Import custom commands or global configuration here.

// Suppress uncaught Supabase auth errors that occur when the app
// tries to refresh a session in the test environment (no real auth).
Cypress.on('uncaught:exception', (err) => {
  if (
    err.message.includes('supabase') ||
    err.message.includes('JWT') ||
    err.message.includes('AuthSession')
  ) {
    return false
  }
})
