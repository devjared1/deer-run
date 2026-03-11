/**
 * Home page spec
 *
 * Covers the public-facing landing page:
 *  - Hero section content and CTAs
 *  - Primary navigation links
 *  - Course stats strip
 *  - Feature cards
 *  - Bottom CTA section
 */

describe('Home page', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  // ── Hero ────────────────────────────────────────────────────────────────────

  it('displays the course name in the hero', () => {
    cy.contains('Deer Run').should('be.visible')
  })

  it('shows the course description in the hero', () => {
    cy.contains('18 championship holes').should('be.visible')
  })

  it('has a "Book a Tee Time" CTA that links to /book', () => {
    cy.contains('a', 'Book a Tee Time')
      .should('be.visible')
      .and('have.attr', 'href', '/book')
  })

  it('has a "View the Course" CTA that links to /scorecard', () => {
    cy.contains('a', 'View the Course')
      .should('be.visible')
      .and('have.attr', 'href', '/scorecard')
  })

  // ── Navigation ──────────────────────────────────────────────────────────────

  it('renders all primary nav links', () => {
    const navLinks = ['The Course', 'Rates', 'Memberships', 'Tournaments', 'Contact']
    navLinks.forEach((label) => {
      cy.get('nav').contains(label).should('be.visible')
    })
  })

  it('navigates to the scorecard page from the nav', () => {
    cy.get('nav').contains('The Course').click()
    cy.url().should('include', '/scorecard')
  })

  it('navigates to the booking page when "Book Tee Time" nav button is clicked', () => {
    // The sticky nav has a "Book Tee Time" button on desktop viewports
    cy.contains('a', 'Book Tee Time').first().click()
    cy.url().should('include', '/book')
  })

  // ── Stats strip ─────────────────────────────────────────────────────────────

  it('displays the four course stats', () => {
    cy.contains('18').should('be.visible')
    cy.contains('72').should('be.visible')
    cy.contains('6,745').should('be.visible')
    cy.contains('1980').should('be.visible')
  })

  // ── Feature cards ───────────────────────────────────────────────────────────

  it('shows all six feature cards', () => {
    const cardTitles = [
      '18 Holes of Earl Stone Design',
      'Online Booking',
      'Year-Round Events',
      'Moulton AL',
      'Open Daily',
      '(256) 974-7384',
    ]
    cardTitles.forEach((text) => {
      cy.contains(text).should('exist')
    })
  })

  // ── Bottom CTA ──────────────────────────────────────────────────────────────

  it('shows the "Book Your Next Round Today" CTA section', () => {
    cy.contains('Book Your Next Round Today').should('be.visible')
    cy.contains('a', 'Book Online').should('have.attr', 'href', '/book')
    cy.contains('a', 'View Rates').should('have.attr', 'href', '/rates')
  })
})
