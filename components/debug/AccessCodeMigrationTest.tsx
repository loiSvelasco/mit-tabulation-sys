"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface MigrationStatus {
  totalRecords: number
  oldFormat: number
  newFormat: number
  needsMigration: boolean
}

interface ValidationResult {
  valid: number
  invalid: number
  invalidRecords: any[]
}

interface MigrationResult {
  success: boolean
  migrated: number
  errors: string[]
  details: {
    oldFormat: number
    newFormat: number
    updated: number
  }
}

export default function AccessCodeMigrationTest() {
  const [status, setStatus] = useState<MigrationStatus | null>(null)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/migrate-access-codes')
      const data = await response.json()
      
      if (data.success) {
        setStatus(data.status)
        setValidation(data.validation)
      } else {
        setError(data.message || 'Failed to get status')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check status')
    } finally {
      setIsLoading(false)
    }
  }

  const runMigration = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/migrate-access-codes', {
        method: 'POST'
      })
      const data = await response.json()
      
      if (data.success) {
        setMigrationResult(data.result)
        // Refresh status after migration
        await checkStatus()
      } else {
        setError(data.message || 'Migration failed')
        setMigrationResult(data.result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Access Code Migration Test
          </CardTitle>
          <CardDescription>
            Test and manage the migration of access codes to the new format with competition ID prefix
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={checkStatus} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Check Status
            </Button>
            <Button 
              onClick={runMigration} 
              disabled={isLoading || !status?.needsMigration}
              variant="default"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Run Migration
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {status && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{status.totalRecords}</div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{status.oldFormat}</div>
                  <div className="text-sm text-muted-foreground">Old Format</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{status.newFormat}</div>
                  <div className="text-sm text-muted-foreground">New Format</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {status.needsMigration ? (
                      <Badge variant="destructive">Needs Migration</Badge>
                    ) : (
                      <Badge variant="default">Up to Date</Badge>
                    )}
                  </div>
                </div>
              </div>

              {validation && (
                <div className="space-y-2">
                  <h4 className="font-medium">Validation Results</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{validation.valid}</div>
                      <div className="text-sm text-muted-foreground">Valid Codes</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-red-600">{validation.invalid}</div>
                      <div className="text-sm text-muted-foreground">Invalid Codes</div>
                    </div>
                  </div>
                  
                  {validation.invalidRecords.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-medium text-sm">Invalid Records:</h5>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {validation.invalidRecords.map((record, index) => (
                          <div key={index} className="text-xs bg-red-50 p-2 rounded">
                            <div>ID: {record.id}</div>
                            <div>Code: {record.access_code}</div>
                            <div>Competition: {record.competition_id}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {migrationResult && (
            <div className="space-y-2">
              <h4 className="font-medium">Migration Results</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{migrationResult.migrated}</div>
                  <div className="text-sm text-muted-foreground">Migrated</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{migrationResult.details.oldFormat}</div>
                  <div className="text-sm text-muted-foreground">Old Format</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{migrationResult.details.newFormat}</div>
                  <div className="text-sm text-muted-foreground">New Format</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{migrationResult.details.updated}</div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </div>
              </div>

              {migrationResult.errors.length > 0 && (
                <div className="space-y-2">
                  <h5 className="font-medium text-sm text-red-600">Errors:</h5>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {migrationResult.errors.map((error, index) => (
                      <div key={index} className="text-xs bg-red-50 p-2 rounded text-red-700">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {migrationResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600">Migration completed successfully</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600">Migration completed with errors</span>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
