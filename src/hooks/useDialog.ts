import { useEffect, useRef } from 'react'

/**
 * Abre un <dialog> modal nativo al montar y lo cierra al desmontar.
 * Maneja: showModal, light-dismiss (closedby="any" + fallback Safari), evento close.
 *
 * Uso:
 *   const ref = useDialog(onClose)
 *   <dialog ref={ref} closedby="any">…</dialog>
 */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return

    dlg.showModal()

    // Fallback light-dismiss para navegadores sin soporte de `closedby` (Safari < 26).
    let onClick: ((e: MouseEvent) => void) | undefined
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      onClick = (e: MouseEvent) => {
        if (e.target !== dlg) return
        const r = dlg.getBoundingClientRect()
        const inside =
          r.top <= e.clientY && e.clientY <= r.bottom &&
          r.left <= e.clientX && e.clientX <= r.right
        if (!inside) dlg.close()
      }
      dlg.addEventListener('click', onClick)
    }

    const handleClose = () => onCloseRef.current()
    dlg.addEventListener('close', handleClose)

    return () => {
      if (onClick) dlg.removeEventListener('click', onClick)
      dlg.removeEventListener('close', handleClose)
      if (dlg.open) dlg.close()
    }
  }, [])

  return ref
}
