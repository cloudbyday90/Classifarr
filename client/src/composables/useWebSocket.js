import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'

/**
 * WebSocket composable for real-time classification progress updates
 * @param {Object} options - Configuration options
 * @param {Function} options.onProgress - Callback for progress updates
 * @param {Function} options.onComplete - Callback for classification completion
 * @param {Function} options.onError - Callback for errors
 * @returns {Object} WebSocket connection state and methods
 */
export function useWebSocket(options = {}) {
  const { onProgress, onComplete, onError } = options
  
  const socket = ref(null)
  const isConnected = ref(false)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 5
  
  /**
   * Initialize WebSocket connection
   */
  const connect = () => {
    if (socket.value?.connected) {
      return
    }
    
    // Get WebSocket URL from environment or use default
    const wsUrl = import.meta.env.VITE_WS_URL || window.location.origin
    
    try {
      socket.value = io(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts
      })
      
      // Connection established
      socket.value.on('connect', () => {
        console.log('WebSocket connected')
        isConnected.value = true
        reconnectAttempts.value = 0
      })
      
      // Connection lost
      socket.value.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason)
        isConnected.value = false
      })
      
      // Reconnection attempt
      socket.value.on('reconnect_attempt', (attemptNumber) => {
        reconnectAttempts.value = attemptNumber
        console.log(`WebSocket reconnecting... (attempt ${attemptNumber})`)
      })
      
      // Reconnection successful
      socket.value.on('reconnect', (attemptNumber) => {
        console.log(`WebSocket reconnected after ${attemptNumber} attempts`)
        isConnected.value = true
        reconnectAttempts.value = 0
      })
      
      // Reconnection failed
      socket.value.on('reconnect_failed', () => {
        console.error('WebSocket reconnection failed')
        isConnected.value = false
        onError?.({ message: 'WebSocket reconnection failed' })
      })
      
      // Listen for progress updates
      socket.value.on('classification:progress', (data) => {
        console.log('Progress update received:', data)
        onProgress?.(data)
      })
      
      // Listen for classification completion
      socket.value.on('classification:complete', (data) => {
        console.log('Classification complete:', data)
        onComplete?.(data)
      })
      
      // Listen for errors
      socket.value.on('error', (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      })
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error)
      onError?.(error)
    }
  }
  
  /**
   * Disconnect WebSocket
   */
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
    }
  }
  
  /**
   * Reconnect WebSocket
   */
  const reconnect = () => {
    disconnect()
    connect()
  }
  
  /**
   * Join a classification room for specific task updates
   * @param {string} taskId - Task ID to join
   */
  const joinTask = (taskId) => {
    if (socket.value?.connected) {
      socket.value.emit('join:task', { taskId })
    }
  }
  
  /**
   * Leave a classification room
   * @param {string} taskId - Task ID to leave
   */
  const leaveTask = (taskId) => {
    if (socket.value?.connected) {
      socket.value.emit('leave:task', { taskId })
    }
  }
  
  // Auto-connect on mount
  onMounted(() => {
    connect()
  })
  
  // Disconnect on unmount
  onUnmounted(() => {
    disconnect()
  })
  
  return {
    socket,
    isConnected,
    reconnectAttempts,
    connect,
    disconnect,
    reconnect,
    joinTask,
    leaveTask
  }
}

export default useWebSocket
