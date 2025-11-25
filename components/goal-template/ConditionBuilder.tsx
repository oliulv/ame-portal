'use client'

import { UseFormReturn, useFieldArray } from 'react-hook-form'
import { GoalTemplateFormData } from '@/lib/schemas'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { ConditionRow } from './ConditionRow'

interface ConditionBuilderProps {
  form: UseFormReturn<GoalTemplateFormData>
}

export function ConditionBuilder({ form }: ConditionBuilderProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'conditions',
  })

  const addCondition = () => {
    append({
      dataSource: 'stripe' as const,
      metric: '',
      operator: '>=' as const,
      targetValue: 0,
      unit: '',
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Success Condition</h3>
        <p className="text-sm text-muted-foreground mt-1">This goal is complete when:</p>
      </div>

      <div className="space-y-4">
        {fields.map((field, index) => (
          <ConditionRow
            key={field.id}
            form={form}
            index={index}
            canRemove={fields.length > 1}
            onRemove={() => remove(index)}
          />
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addCondition} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add another condition
      </Button>

      {fields.length > 1 && (
        <p className="text-xs text-muted-foreground">
          All conditions must be satisfied (AND logic)
        </p>
      )}
    </div>
  )
}
