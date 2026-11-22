import type { Editor, TLUiToastsContextType } from 'tldraw'
import { importCanvasJson } from '../lib/exportImport'

export function pickAndImportJson(editor: Editor, addToast: TLUiToastsContextType['addToast']) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,.tldr,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    if (!window.confirm('Importing replaces the current canvas. Export first if you want a backup. Continue?')) return
    const res = await importCanvasJson(editor, file)
    if (res.ok) addToast({ title: 'Canvas imported', severity: 'success' })
    else addToast({ title: 'Import failed', description: `Not a valid defact0/tldraw file (${res.error}).`, severity: 'error' })
  }
  input.click()
}
