/**
 * Prints the page in landscape. Like printReceipt(), the @page rule is added only for this print
 * so receipts and other printing keep their own page size.
 */
export function printLandscape() {
  const style = document.createElement('style')
  style.textContent = '@page { size: landscape; margin: 10mm; }'
  document.head.appendChild(style)
  const cleanup = () => {
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
