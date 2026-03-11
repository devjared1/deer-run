/**
 * Booking wizard spec
 *
 * Covers the 4-step booking flow at /book:
 *  Step 1 – Date picker      (StepDate)
 *  Step 2 – Tee time select  (StepTime)  — API is intercepted / stubbed
 *  Step 3 – Player details   (StepDetails)
 *  Step 4 – Payment summary  (StepPayment)
 */

// Stub tee-time slots returned by GET /api/teetimes.
// Shape mirrors what teetimes.js returns after computing available/full.
const MOCK_SLOTS = [
  {
    id: 'slot-1',
    date: '2026-03-13',
    startTime: '08:00',
    maxPlayers: 4,
    memberOnly: false,
    bookedPlayers: 0,
    available: 4,
    full: false,
  },
  {
    id: 'slot-2',
    date: '2026-03-13',
    startTime: '08:10',
    maxPlayers: 4,
    memberOnly: false,
    bookedPlayers: 2,
    available: 2,
    full: false,
  },
]

describe('Booking wizard', () => {
  beforeEach(() => {
    // Stub the tee-times API so tests never reach a real server
    cy.intercept('GET', '/api/teetimes*', { body: MOCK_SLOTS }).as('getTeetimes')
    cy.visit('/book')
  })

  // ── Step indicator ───────────────────────────────────────────────────────────

  it('renders all four wizard steps in the progress indicator', () => {
    ;['Date', 'Tee Time', 'Details', 'Payment'].forEach((label) => {
      cy.contains(label).should('be.visible')
    })
  })

  // ── Step 1: Date ─────────────────────────────────────────────────────────────

  it('shows the date-picker heading on initial load', () => {
    cy.contains('h2', 'Select a Date').should('be.visible')
  })

  it('disables "Choose a Tee Time" button when no date is selected', () => {
    cy.contains('button', 'Choose a Tee Time').should('be.disabled')
  })

  it('enables "Choose a Tee Time" button after a valid date is chosen', () => {
    // Click the first non-disabled day button inside the calendar grid
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('button', 'Choose a Tee Time').should('not.be.disabled')
  })

  it('displays the "Selected:" summary after a date is chosen', () => {
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('Selected:').should('be.visible')
  })

  // ── Step 2: Tee Time ─────────────────────────────────────────────────────────

  it('advances to step 2 and shows available tee times from the API', () => {
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('button', 'Choose a Tee Time').click()

    cy.wait('@getTeetimes')

    cy.contains('h2', 'Choose a Tee Time').should('be.visible')
    // formatTime("08:00") → "8:00 AM", formatTime("08:10") → "8:10 AM"
    cy.contains('8:00 AM').should('be.visible')
    cy.contains('8:10 AM').should('be.visible')
  })

  it('shows the correct open-spot count for each slot', () => {
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('button', 'Choose a Tee Time').click()

    cy.wait('@getTeetimes')

    cy.contains('4 open').should('be.visible')
    cy.contains('2 open').should('be.visible')
  })

  it('shows the player selector and price total after a slot is selected', () => {
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('button', 'Choose a Tee Time').click()
    cy.wait('@getTeetimes')

    // Clicking the slot button selects it
    cy.contains('8:00 AM').click()

    cy.contains('Number of Players').should('be.visible')
    cy.contains('Total (incl. cart)').should('be.visible')
  })

  // ── Step 3: Details ───────────────────────────────────────────────────────────

  it('advances to the details step after selecting a slot and clicking Continue', () => {
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('button', 'Choose a Tee Time').click()
    cy.wait('@getTeetimes')

    cy.contains('8:00 AM').click()
    cy.contains('button', 'Continue to Details').click()

    cy.contains('h2', 'Your Details').should('be.visible')
  })

  it('shows guest name and email fields when continuing as a guest', () => {
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('button', 'Choose a Tee Time').click()
    cy.wait('@getTeetimes')

    cy.contains('8:00 AM').click()
    cy.contains('button', 'Continue to Details').click()

    // Default mode for unauthenticated users is guest
    cy.get('input[placeholder="John Smith"]').should('be.visible')
    cy.get('input[placeholder="john@example.com"]').should('be.visible')
  })

  // ── Navigation: back button ───────────────────────────────────────────────────

  it('returns to step 1 when the back arrow (←) is clicked from step 2', () => {
    cy.get('.grid button:not([disabled])').first().click()
    cy.contains('button', 'Choose a Tee Time').click()
    cy.wait('@getTeetimes')

    // Step 2 renders a "←" character button for navigating back
    cy.contains('button', '←').click()

    cy.contains('h2', 'Select a Date').should('be.visible')
  })
})
