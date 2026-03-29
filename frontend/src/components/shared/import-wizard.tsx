'use client'

import { useCallback, useRef, useState } from 'react'
import api from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  CheckCircle2,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  Loader2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type ImportWizardProps = {
  entityType: string
  endpoint: string
  requiredFields: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type ParsedCSV = {
  headers: string[]
  rows: string[][]
}

type ColumnMapping = Record<string, string>

type ImportResult = {
  created: number
  errors: { row: number; message: string }[]
}

function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map(parseLine)

  return { headers, rows }
}

function formatFieldLabel(field: string): string {
  return field
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ['Upload', 'Map Columns', 'Results']

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((label, i) => {
        const stepNum = i + 1
        const isActive = stepNum === currentStep
        const isCompleted = stepNum < currentStep

        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  'h-px w-8',
                  isCompleted ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  isActive && 'bg-primary text-primary-foreground',
                  isCompleted && 'bg-primary text-primary-foreground',
                  !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  stepNum
                )}
              </div>
              <span
                className={cn(
                  'text-xs',
                  isActive ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FileUploadStep({
  file,
  onFileSelect,
  onFileRemove,
}: {
  file: File | null
  onFileSelect: (file: File) => void
  onFileRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped && dropped.name.endsWith('.csv')) {
        onFileSelect(dropped)
      }
    },
    [onFileSelect]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files?.[0]
      if (selected) onFileSelect(selected)
    },
    [onFileSelect]
  )

  if (file) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <FileSpreadsheet className="h-8 w-8 text-green-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {(file.size / 1024).toFixed(1)} KB
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onFileRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 transition-colors cursor-pointer',
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50'
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <div className="text-center">
        <p className="text-sm font-medium">
          Drop your CSV file here, or click to browse
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Only .csv files are supported
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}

function ColumnMappingStep({
  csvHeaders,
  previewRows,
  requiredFields,
  mapping,
  onMappingChange,
}: {
  csvHeaders: string[]
  previewRows: string[][]
  requiredFields: string[]
  mapping: ColumnMapping
  onMappingChange: (field: string, csvColumn: string) => void
}) {
  const unmappedRequired = requiredFields.filter(
    (f) => !mapping[f] || mapping[f] === ''
  )

  return (
    <div className="space-y-4">
      {/* Preview table */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Preview (first {previewRows.length} rows)
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                {csvHeaders.map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="px-3 py-1.5 text-muted-foreground max-w-[150px] truncate"
                    >
                      {cell || '\u2014'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column mapping */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Map CSV columns to fields
        </p>
        <div className="space-y-2">
          {requiredFields.map((field) => (
            <div
              key={field}
              className="flex items-center gap-3"
            >
              <span className="text-sm w-40 shrink-0">
                {formatFieldLabel(field)}
                <span className="text-red-500 ml-0.5">*</span>
              </span>
              <Select
                value={mapping[field] ?? ''}
                onValueChange={(val) => onMappingChange(field, val)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {csvHeaders.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {unmappedRequired.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {unmappedRequired.length} required field(s) not yet mapped
        </p>
      )}
    </div>
  )
}

function ResultsStep({ result }: { result: ImportResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border bg-green-50 dark:bg-green-900/10 p-4">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium">
            {result.created} record{result.created !== 1 ? 's' : ''} imported
            successfully
          </p>
        </div>
      </div>

      {result.errors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
          </div>
          <div className="max-h-40 overflow-y-auto rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-1.5 text-left font-medium w-16">
                    Row
                  </th>
                  <th className="px-3 py-1.5 text-left font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {result.errors.map((err, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {err.row}
                    </td>
                    <td className="px-3 py-1.5 text-red-600 dark:text-red-400">
                      {err.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function ImportWizard({
  entityType,
  endpoint,
  requiredFields,
  open,
  onOpenChange,
  onSuccess,
}: ImportWizardProps) {
  const [step, setStep] = useState(1)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedCSV | null>(null)
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStep(1)
    setFile(null)
    setParsed(null)
    setMapping({})
    setResult(null)
    setLoading(false)
    setError(null)
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset()
      onOpenChange(open)
    },
    [onOpenChange, reset]
  )

  const handleFileSelect = useCallback(
    (selected: File) => {
      setFile(selected)
      setError(null)

      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const csv = parseCSV(text)
        if (csv.headers.length === 0) {
          setError('Could not parse CSV. Please check the file format.')
          return
        }
        setParsed(csv)

        // Auto-map columns with matching names
        const autoMapping: ColumnMapping = {}
        for (const field of requiredFields) {
          const match = csv.headers.find(
            (h) => h.toLowerCase().replace(/[\s-]/g, '_') === field.toLowerCase()
          )
          if (match) autoMapping[field] = match
        }
        setMapping(autoMapping)
      }
      reader.readAsText(selected)
    },
    [requiredFields]
  )

  const handleFileRemove = useCallback(() => {
    setFile(null)
    setParsed(null)
    setMapping({})
    setError(null)
  }, [])

  const handleMappingChange = useCallback((field: string, csvColumn: string) => {
    setMapping((prev) => ({ ...prev, [field]: csvColumn }))
  }, [])

  const handleImport = useCallback(async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mapping', JSON.stringify(mapping))

      const res = await api.post(`/v1${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setResult(res.data)
      setStep(3)
      onSuccess()
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' &&
              err !== null &&
              'response' in err &&
              typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
            ? (err as { response: { data: { detail: string } } }).response.data.detail
            : 'Import failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [file, mapping, endpoint, onSuccess])

  const allRequiredMapped = requiredFields.every(
    (f) => mapping[f] && mapping[f] !== ''
  )

  const canProceedStep1 = file !== null && parsed !== null
  const canProceedStep2 = allRequiredMapped

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Import {formatFieldLabel(entityType)}
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import {entityType} records.
          </DialogDescription>
        </DialogHeader>

        <StepIndicator currentStep={step} />

        <div className="min-h-[200px]">
          {step === 1 && (
            <FileUploadStep
              file={file}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
            />
          )}

          {step === 2 && parsed && (
            <ColumnMappingStep
              csvHeaders={parsed.headers}
              previewRows={parsed.rows.slice(0, 5)}
              requiredFields={requiredFields}
              mapping={mapping}
              onMappingChange={handleMappingChange}
            />
          )}

          {step === 3 && result && <ResultsStep result={result} />}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1}
              >
                Next
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={!canProceedStep2 || loading}
              >
                {loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Import
              </Button>
            </>
          )}

          {step === 3 && (
            <Button onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
