import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

/**
 * PATCH /api/admin/invoices/[id]
 * Update invoice status (approve, reject, or mark as paid)
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    // 1. Authenticate and authorize
    const admin = await requireAdmin()
    const { id } = await context.params

    // 2. Parse request body
    const body = await request.json()
    const { status, admin_comment } = body

    // 3. Validate status
    const validStatuses = ['approved', 'rejected', 'paid', 'under_review']
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // 4. Get current invoice to check status transitions
    const { data: currentInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('status')
      .eq('id', id)
      .single()

    if (fetchError || !currentInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      )
    }

    // 5. Validate status transitions
    const currentStatus = currentInvoice.status
    const validTransitions: Record<string, string[]> = {
      'submitted': ['approved', 'rejected', 'under_review'],
      'under_review': ['approved', 'rejected'],
      'approved': ['paid'],
      'rejected': [], // Cannot transition from rejected
      'paid': [], // Cannot transition from paid
    }

    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        { 
          error: `Cannot change status from "${currentStatus}" to "${status}". Valid transitions: ${validTransitions[currentStatus]?.join(', ') || 'none'}` 
        },
        { status: 400 }
      )
    }

    // 6. Prepare update data
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (admin_comment !== undefined) {
      updateData.admin_comment = admin_comment?.trim() || null
    }

    // Set approval fields if approving
    if (status === 'approved') {
      updateData.approved_by_admin_id = admin.id
      updateData.approved_at = new Date().toISOString()
    }

    // Set paid timestamp if marking as paid
    if (status === 'paid') {
      updateData.paid_at = new Date().toISOString()
    }

    // 7. Update invoice
    const { data: invoice, error: updateError } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Database error updating invoice:', updateError)
      return NextResponse.json(
        { error: 'Failed to update invoice' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      invoice,
    })
  } catch (error) {
    console.error('Error in PATCH /api/admin/invoices/[id]:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

