'use client'

import { UseFormReturn, useWatch } from 'react-hook-form'
import { GoalTemplateFormData } from '@/lib/schemas'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import {
  getDataSourceOptions,
  getMetricOptions,
  hasPredefinedMetrics,
  getUnitForMetric,
  type DataSource,
} from '@/lib/goalMetrics'
import { useEffect } from 'react'

interface ConditionRowProps {
  form: UseFormReturn<GoalTemplateFormData>
  index: number
  canRemove: boolean
  onRemove: () => void
}

const OPERATORS = [
  { value: '>=', label: '≥ (Greater than or equal)' },
  { value: '>', label: '> (Greater than)' },
  { value: '=', label: '= (Equal to)' },
  { value: '<=', label: '≤ (Less than or equal)' },
  { value: '<', label: '< (Less than)' },
  { value: 'increased_by', label: 'Has increased by' },
  { value: 'decreased_by', label: 'Has decreased by' },
] as const

export function ConditionRow({ form, index, canRemove, onRemove }: ConditionRowProps) {
  const dataSource = useWatch({
    control: form.control,
    name: `conditions.${index}.dataSource`,
  }) as DataSource | undefined

  const metric = useWatch({
    control: form.control,
    name: `conditions.${index}.metric`,
  })

  // Auto-set unit when metric changes for predefined data sources
  useEffect(() => {
    if (dataSource && hasPredefinedMetrics(dataSource) && metric) {
      const unit = getUnitForMetric(dataSource, metric)
      if (unit) {
        form.setValue(`conditions.${index}.unit`, unit)
      }
    }
  }, [dataSource, metric, index, form])

  // Clear metric and unit when data source changes
  useEffect(() => {
    if (dataSource) {
      const currentMetric = form.getValues(`conditions.${index}.metric`)
      if (hasPredefinedMetrics(dataSource)) {
        // If switching to predefined, clear metric if it's not valid for new source
        const metricOptions = getMetricOptions(dataSource)
        if (currentMetric && !metricOptions.find((m) => m.value === currentMetric)) {
          form.setValue(`conditions.${index}.metric`, '')
          form.setValue(`conditions.${index}.unit`, '')
        }
      } else {
        // If switching to 'other', clear metric and unit
        form.setValue(`conditions.${index}.metric`, '')
        form.setValue(`conditions.${index}.unit`, '')
      }
    }
  }, [dataSource, index, form])

  const isOtherDataSource = dataSource === 'other'
  const metricOptions = dataSource ? getMetricOptions(dataSource) : []

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Condition {index + 1}</h4>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name={`conditions.${index}.dataSource`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Data Source</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {getDataSourceOptions().map((ds) => (
                    <SelectItem key={ds.value} value={ds.value}>
                      {ds.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {isOtherDataSource ? (
          <>
            <FormField
              control={form.control}
              name={`conditions.${index}.metric`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Metric Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Custom Metric" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`conditions.${index}.unit`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., units, events" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <FormField
            control={form.control}
            name={`conditions.${index}.metric`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Metric</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={!dataSource}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {metricOptions.map((metric) => (
                      <SelectItem key={metric.value} value={metric.value}>
                        {metric.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name={`conditions.${index}.operator`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Condition Operator</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select operator" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <FormField
            control={form.control}
            name={`conditions.${index}.targetValue`}
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Target Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="e.g., 100"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? undefined : parseFloat(value))
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!isOtherDataSource && (
            <FormField
              control={form.control}
              name={`conditions.${index}.unit`}
              render={({ field }) => (
                <FormItem className="w-32">
                  <FormLabel>Unit</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly className="bg-muted" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>
    </div>
  )
}

