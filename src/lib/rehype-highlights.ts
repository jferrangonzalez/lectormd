import { visit } from 'unist-util-visit'
import type { Root, Text, ElementContent, RootContent } from 'hast'

export interface HighlightInput {
  id: number
  fragmento: string
  posicion: number
  color: string
}

interface Match {
  start: number
  end: number
  m: HighlightInput
}

/**
 * Plugin rehype que envuelve los `fragmento` de cada marcador con `<mark data-marcador-id data-color>`.
 *
 * Cuando hay duplicados del mismo `fragmento`, se usa `posicion` (índice de ocurrencia, 0-based)
 * para discriminar cuál instancia resaltar.
 *
 * Restricciones:
 * - Solo resalta fragmentos contenidos en UN solo text node (no atraviesa formato bold/italic).
 *   El frontend ya filtra selecciones razonables; los fragmentos típicos vienen del usuario.
 * - Si dos fragmentos se solapan en el mismo text node, gana el de menor `start`.
 */
export function rehypeHighlights(marcadores: HighlightInput[]) {
  return (tree: Root) => {
    if (marcadores.length === 0) return

    // Contadores globales de ocurrencias vistas para cada fragmento.
    const seen = new Map<string, number>()

    interface Replacement {
      parent: { children: RootContent[] | ElementContent[] }
      index: number
      pieces: ElementContent[]
    }
    const replacements: Replacement[] = []

    visit(tree, 'text', (node: Text, index, parent) => {
      if (index === null || index === undefined || !parent) return

      const matches: Match[] = []

      for (const m of marcadores) {
        if (!m.fragmento) continue
        let from = 0
        while (from <= node.value.length) {
          const idx = node.value.indexOf(m.fragmento, from)
          if (idx === -1) break
          const currentSeen = seen.get(m.fragmento) ?? 0
          if (currentSeen === m.posicion) {
            matches.push({ start: idx, end: idx + m.fragmento.length, m })
          }
          seen.set(m.fragmento, currentSeen + 1)
          from = idx + m.fragmento.length
        }
      }

      if (matches.length === 0) return

      // Quedarnos con un set de matches sin solapamientos (preferir el de menor start).
      matches.sort((a, b) => a.start - b.start)
      const filtered: Match[] = []
      let cursor = 0
      for (const x of matches) {
        if (x.start >= cursor) {
          filtered.push(x)
          cursor = x.end
        }
      }

      const pieces: ElementContent[] = []
      let pos = 0
      for (const x of filtered) {
        if (x.start > pos) {
          pieces.push({ type: 'text', value: node.value.slice(pos, x.start) })
        }
        pieces.push({
          type: 'element',
          tagName: 'mark',
          properties: {
            'data-marcador-id': String(x.m.id),
            'data-color': x.m.color,
          },
          children: [{ type: 'text', value: node.value.slice(x.start, x.end) }],
        })
        pos = x.end
      }
      if (pos < node.value.length) {
        pieces.push({ type: 'text', value: node.value.slice(pos) })
      }

      replacements.push({
        parent: parent as Replacement['parent'],
        index,
        pieces,
      })
    })

    // Aplicar de atrás hacia adelante para preservar índices del mismo parent.
    replacements.sort((a, b) => {
      if (a.parent !== b.parent) return 0
      return b.index - a.index
    })
    for (const r of replacements) {
      ;(r.parent.children as ElementContent[]).splice(r.index, 1, ...r.pieces)
    }
  }
}
