/**
 * Network Resilience Utilities
 * Handles network connectivity issues and provides retry mechanisms
 */

export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on the last attempt
      if (attempt === options.maxRetries) {
        break
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        options.baseDelay * Math.pow(options.backoffMultiplier, attempt),
        options.maxDelay
      )
      
      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, error)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError || new Error('Retry failed')
}

/**
 * Check if an error is network-related
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false
  
  const errorMessage = error.message?.toLowerCase() || ''
  const errorName = error.name?.toLowerCase() || ''
  
  return (
    errorMessage.includes('network') ||
    errorMessage.includes('fetch') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('refused') ||
    errorName.includes('network') ||
    errorName.includes('timeout') ||
    error.code === 'NETWORK_ERROR' ||
    error.code === 'TIMEOUT'
  )
}

/**
 * Enhanced fetch with retry and network error handling
 */
export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<Response> {
  return retryWithBackoff(async () => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your network connection')
      }
      
      throw error
    }
  }, retryOptions)
}

/**
 * Check network connectivity
 */
export async function checkConnectivity(baseUrl: string = ''): Promise<boolean> {
  try {
    const testUrl = baseUrl ? `${baseUrl}/api/health` : '/api/health'
    const response = await fetch(testUrl, { 
      method: 'HEAD',
      cache: 'no-cache'
    })
    return response.ok
  } catch (error) {
    console.warn('Network connectivity check failed:', error)
    return false
  }
}

/**
 * Network status monitor
 */
export class NetworkStatusMonitor {
  private isOnline: boolean = navigator.onLine
  private listeners: Set<(isOnline: boolean) => void> = new Set()
  
  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.notifyListeners()
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifyListeners()
    })
  }
  
  get status(): boolean {
    return this.isOnline
  }
  
  addListener(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  
  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.isOnline))
  }
}

export const networkMonitor = new NetworkStatusMonitor()
