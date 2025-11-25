'use client'

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { UseFormReturn } from 'react-hook-form'
import { GoalTemplateFormData } from '@/lib/schemas'

interface FundingInputProps {
  form: UseFormReturn<GoalTemplateFormData>
}

export function FundingInput({ form }: FundingInputProps) {
  return (
    <FormField
      control={form.control}
      name="fundingUnlocked"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Funding Unlocked on Completion (Optional)</FormLabel>
          <FormControl>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                £
              </span>
              <Input
                type="number"
                placeholder="e.g., 5000"
                className="pl-8"
                {...field}
                value={field.value ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                  field.onChange(value === '' ? undefined : parseFloat(value))
                }}
              />
            </div>
          </FormControl>
          <FormDescription>
            Amount in GBP that triggers internal accelerator funding logic when this goal is
            completed
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
