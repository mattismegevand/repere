import { beforeEach, describe, expect, it } from 'vitest'
import { useDialogStore } from '@/stores/dialogStore'

describe('dialogStore', () => {
  beforeEach(() => {
    useDialogStore.getState().closeDialog()
  })

  describe('openDialog', () => {
    it('opens join dialog', () => {
      useDialogStore.getState().openDialog({ type: 'join' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'join' })
    })

    it('opens join dialog with preselected nodes', () => {
      useDialogStore.getState().openDialog({
        type: 'join',
        preSelectedLeft: 'node1',
        preSelectedRight: 'node2',
      })
      expect(useDialogStore.getState().activeDialog).toEqual({
        type: 'join',
        preSelectedLeft: 'node1',
        preSelectedRight: 'node2',
      })
    })

    it('opens union dialog', () => {
      useDialogStore.getState().openDialog({ type: 'union' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'union' })
    })

    it('opens union dialog with preselected nodes', () => {
      useDialogStore.getState().openDialog({
        type: 'union',
        preSelectedNodes: ['node1', 'node2'],
      })
      expect(useDialogStore.getState().activeDialog?.type).toBe('union')
    })

    it('opens addColumn dialog', () => {
      useDialogStore.getState().openDialog({ type: 'addColumn' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'addColumn' })
    })

    it('opens loadSession dialog', () => {
      useDialogStore.getState().openDialog({ type: 'loadSession' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'loadSession' })
    })

    it('opens shortcutCheatsheet dialog', () => {
      useDialogStore.getState().openDialog({ type: 'shortcutCheatsheet' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'shortcutCheatsheet' })
    })

    it('opens shareUrl dialog', () => {
      useDialogStore.getState().openDialog({ type: 'shareUrl' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'shareUrl' })
    })

    it('opens deleteConfirm dialog with nodeIds', () => {
      useDialogStore.getState().openDialog({ type: 'deleteConfirm', nodeIds: ['a', 'b', 'c'] })
      expect(useDialogStore.getState().activeDialog).toEqual({
        type: 'deleteConfirm',
        nodeIds: ['a', 'b', 'c'],
      })
    })

    it('opens connectionType dialog', () => {
      useDialogStore.getState().openDialog({
        type: 'connectionType',
        sourceId: 'source',
        targetId: 'target',
      })
      expect(useDialogStore.getState().activeDialog).toEqual({
        type: 'connectionType',
        sourceId: 'source',
        targetId: 'target',
      })
    })

    it('opens export dialog', () => {
      useDialogStore.getState().openDialog({ type: 'export' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'export' })
    })

    it('opens export dialog with sourceNodeId', () => {
      useDialogStore.getState().openDialog({ type: 'export', sourceNodeId: 'node1' })
      expect(useDialogStore.getState().activeDialog).toEqual({
        type: 'export',
        sourceNodeId: 'node1',
      })
    })

    it('opens chartModal dialog', () => {
      useDialogStore.getState().openDialog({ type: 'chartModal', nodeId: 'chart1' })
      expect(useDialogStore.getState().activeDialog).toEqual({
        type: 'chartModal',
        nodeId: 'chart1',
      })
    })

    it('opens branchDecision dialog', () => {
      useDialogStore.getState().openDialog({ type: 'branchDecision' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'branchDecision' })
    })

    it('opens window dialog', () => {
      useDialogStore.getState().openDialog({ type: 'window' })
      expect(useDialogStore.getState().activeDialog).toEqual({ type: 'window' })
    })

    it('opens window dialog with column', () => {
      useDialogStore.getState().openDialog({ type: 'window', column: 'price' })
      expect(useDialogStore.getState().activeDialog).toEqual({
        type: 'window',
        column: 'price',
      })
    })

    it('replaces current dialog when opening new one', () => {
      useDialogStore.getState().openDialog({ type: 'join' })
      useDialogStore.getState().openDialog({ type: 'union' })
      expect(useDialogStore.getState().activeDialog?.type).toBe('union')
    })
  })

  describe('closeDialog', () => {
    it('closes active dialog', () => {
      useDialogStore.getState().openDialog({ type: 'join' })
      useDialogStore.getState().closeDialog()
      expect(useDialogStore.getState().activeDialog).toBeNull()
    })

    it('is no-op when no dialog is open', () => {
      useDialogStore.getState().closeDialog()
      expect(useDialogStore.getState().activeDialog).toBeNull()
    })
  })

  describe('initial state', () => {
    it('starts with no active dialog', () => {
      // Reset to fresh state
      useDialogStore.setState({ activeDialog: null })
      expect(useDialogStore.getState().activeDialog).toBeNull()
    })
  })
})
