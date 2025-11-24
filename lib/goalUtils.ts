import { GoalTemplateCondition } from './schemas'

/**
 * Extract conditions JSON from description field
 * Format: <!-- CONDITIONS_JSON:... -->
 */
export function extractConditionsFromDescription(description: string | null | undefined): {
  cleanDescription: string
  conditions: GoalTemplateCondition[] | null
} {
  if (!description) {
    return { cleanDescription: '', conditions: null }
  }

  const conditionsMatch = description.match(/<!-- CONDITIONS_JSON:(.+?) -->/)
  
  if (!conditionsMatch) {
    return { cleanDescription: description, conditions: null }
  }

  try {
    const conditionsJson = conditionsMatch[1]
    const conditions = JSON.parse(conditionsJson) as GoalTemplateCondition[]
    
    // Remove the conditions JSON comment from description
    const cleanDescription = description.replace(/<!-- CONDITIONS_JSON:.+? -->/g, '').trim()
    
    return { cleanDescription, conditions }
  } catch (error) {
    console.error('Failed to parse conditions JSON:', error)
    // If parsing fails, just return the description without the comment
    const cleanDescription = description.replace(/<!-- CONDITIONS_JSON:.+? -->/g, '').trim()
    return { cleanDescription, conditions: null }
  }
}

/**
 * Format description with conditions JSON for storage
 */
export function formatDescriptionWithConditions(
  description: string | undefined,
  conditions: GoalTemplateCondition[]
): string {
  const conditionsJson = JSON.stringify(conditions)
  const conditionsComment = `<!-- CONDITIONS_JSON:${conditionsJson} -->`
  
  if (!description) {
    return conditionsComment
  }
  
  return `${description}\n\n${conditionsComment}`
}

