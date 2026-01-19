import { CellContextMenu } from './CellContextMenu'
import { ColumnHeaderMenu } from './ColumnHeaderMenu'

export function GridContextMenus() {
  return (
    <>
      {/* Both menus read state from stores and get actions from context */}
      <CellContextMenu />
      <ColumnHeaderMenu />
    </>
  )
}
