import type { Editor } from '../engine/Editor'
import { addFiles } from '../lib/clipboard'
import { importCanvasJson } from '../lib/exportImport'
import { toast } from '../lib/uiState'

function pick(accept: string, multiple: boolean, onFiles: (files: File[]) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.onchange = () => onFiles([...(input.files ?? [])])
  input.click()
}

export function pickImages(editor: Editor) {
  pick('image/*,.ts,.tsx,.js,.jsx,.py,.go,.rs,.json,.md,.txt,.log,.sql,.sh,.yaml,.yml,.css,.html', true, (files) => {
    if (files.length) void addFiles(editor, files)
  })
}

export function pickAndImportJson(editor: Editor) {
  pick('.json,application/json', false, async ([file]) => {
    if (!file) return
    if (!window.confirm('Importing replaces the current canvas (you can undo). Continue?')) return
    const res = await importCanvasJson(editor, file)
    if (res.ok) toast({ title: 'Canvas imported', kind: 'success' })
    else toast({ title: 'Import failed', description: `That file is ${res.error}.`, kind: 'error' })
  })
}
