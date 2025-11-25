'use client'

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { UseFormReturn } from 'react-hook-form'
import { GoalTemplateFormData } from '@/lib/schemas'

interface SubmitBarProps {
  form: UseFormReturn<GoalTemplateFormData>
  isLoading: boolean
  cohortSlug?: string
}

export function SubmitBar({ form, isLoading, cohortSlug }: SubmitBarProps) {
  const isFormValid = form.formState.isValid

  return (
    <div className="flex gap-4">
      <Button type="submit" disabled={isLoading || !isFormValid}>
        {isLoading ? 'Creating...' : 'Create Goal Template'}
      </Button>
      <Link href={cohortSlug ? `/admin/${cohortSlug}/goals` : '/admin/goals'}>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </Link>
    </div>
  )
}
