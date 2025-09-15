import { useEffect } from 'react'
import useCompetitionStore from '@/utils/useCompetitionStore'

/**
 * Hook to set up real-time event synchronization for the competition store
 * This ensures that score deletions and updates are synchronized across all components
 */
export function useEventSync() {
  const { setupEventListeners, cleanupEventListeners, selectedCompetitionId } = useCompetitionStore()

  useEffect(() => {
    // Set up event listeners when the component mounts
    setupEventListeners()

    // Clean up event listeners when the component unmounts
    return () => {
      cleanupEventListeners()
    }
  }, [setupEventListeners, cleanupEventListeners])

  // Re-setup event listeners when competition changes
  useEffect(() => {
    if (selectedCompetitionId) {
      setupEventListeners()
    }
  }, [selectedCompetitionId, setupEventListeners])
}
