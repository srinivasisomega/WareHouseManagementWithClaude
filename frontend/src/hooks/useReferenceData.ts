import { itemsApi, locationsApi } from '../api/warehouseApi'
import { useApiData } from './useApiData'

/** Active items for pickers on operational forms. */
export function useActiveItems() {
  return useApiData(() => itemsApi.list(), 'active-items')
}

/** Active locations for pickers on operational forms. */
export function useActiveLocations() {
  return useApiData(() => locationsApi.list(), 'active-locations')
}
