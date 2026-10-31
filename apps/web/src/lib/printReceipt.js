/**
 * Prints the page with an 80 mm receipt page size. The @page rule is added only for this print
 * so other printing (schedules, timesheets) keeps the normal page size. With Chrome started with
 * --kiosk-printing, this prints straight to the default (receipt) printer with no dialog.
 * The component calling this is responsible for showing only the receipt in print (print:hidden etc.).
 */
export function printReceipt() {
  const style = document.createElement('style')
  style.textContent = '@page { size: 80mm auto; margin: 0; }'
  document.head.appendChild(style)
  const cleanup = () => {
    style.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)
  window.print()
}
