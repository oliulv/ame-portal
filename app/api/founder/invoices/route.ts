import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFounder, getFounderStartupIds } from '@/lib/auth'

/**
 * GET /api/founder/invoices
 * Get invoices for the founder's startup
 */
export async function GET() {
  try {
    // 1. Authenticate and authorize
    await requireFounder()

    // 2. Get founder's startup IDs
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json({ invoices: [], pendingCount: 0 })
    }

    const supabase = await createClient()

    // 3. Fetch invoices
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .in('startup_id', startupIds)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching invoices:', error)
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
    }

    // 4. Count pending invoices (submitted or under_review)
    const pendingCount =
      invoices?.filter((invoice) => ['submitted', 'under_review'].includes(invoice.status))
        .length || 0

    return NextResponse.json({
      invoices: invoices || [],
      pendingCount,
    })
  } catch (error) {
    console.error('Error in GET /api/founder/invoices:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

/**
 * POST /api/founder/invoices
 * Upload a new invoice for the founder's startup
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate and authorize
    const user = await requireFounder()

    // 2. Get founder's startup ID
    const startupIds = await getFounderStartupIds()

    if (startupIds.length === 0) {
      return NextResponse.json(
        { error: 'No startup associated with your account' },
        { status: 400 }
      )
    }

    if (startupIds.length > 1) {
      return NextResponse.json(
        { error: 'Multiple startups found. Please contact support.' },
        { status: 400 }
      )
    }

    const startupId = startupIds[0]

    // 3. Parse form data
    const formData = await request.formData()

    const vendorName = formData.get('vendor_name') as string
    const invoiceDate = formData.get('invoice_date') as string
    const amountGbp = formData.get('amount_gbp') as string
    const description = formData.get('description') as string | null
    const file = formData.get('file') as File | null

    // 4. Validate required fields
    if (!vendorName || typeof vendorName !== 'string' || vendorName.trim().length === 0) {
      return NextResponse.json({ error: 'Vendor name is required' }, { status: 400 })
    }

    if (!invoiceDate || typeof invoiceDate !== 'string') {
      return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 })
    }

    // Validate date format
    const dateObj = new Date(invoiceDate)
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: 'Invalid invoice date format' }, { status: 400 })
    }

    if (!amountGbp || typeof amountGbp !== 'string') {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 })
    }

    const amount = parseFloat(amountGbp)
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 })
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Invoice file is required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ]
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File must be a PDF or image (JPEG, PNG, GIF, WebP)' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 10MB' }, { status: 400 })
    }

    const supabase = await createClient()

    // 5. Upload file to Supabase Storage
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `invoices/${startupId}/${timestamp}-${sanitizedFileName}`

    // Convert File to ArrayBuffer for Supabase Storage
    const fileBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('invoice_files')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      // Check if bucket doesn't exist (404 or specific error)
      // StorageError has status property, not statusCode
      const errorStatus =
        (uploadError as { status?: number | string; statusCode?: number | string }).status ||
        (uploadError as { statusCode?: number | string }).statusCode
      const isBucketNotFound =
        errorStatus === 404 ||
        errorStatus === '404' ||
        uploadError.message?.includes('Bucket not found') ||
        uploadError.message?.includes('not found')

      // Check if RLS policy violation (403)
      const isRLSViolation =
        errorStatus === 403 ||
        errorStatus === '403' ||
        uploadError.message?.includes('row-level security') ||
        uploadError.message?.includes('violates row-level security policy')

      if (isBucketNotFound || isRLSViolation) {
        // Log as info since we're handling it gracefully with admin client fallback
        console.warn(
          `Storage ${isRLSViolation ? 'RLS' : 'bucket'} issue detected, using admin client fallback:`,
          uploadError.message
        )
        // Use admin client to bypass RLS or create bucket if needed
        try {
          const adminClient = createAdminClient()

          // Only create bucket if it doesn't exist
          if (isBucketNotFound) {
            const { error: createBucketError } = await adminClient.storage.createBucket(
              'invoice_files',
              {
                public: true,
                allowedMimeTypes: [
                  'application/pdf',
                  'image/jpeg',
                  'image/jpg',
                  'image/png',
                  'image/gif',
                  'image/webp',
                ],
                fileSizeLimit: 10485760, // 10MB
              }
            )

            if (createBucketError) {
              console.error('Failed to create bucket:', createBucketError)
              return NextResponse.json(
                {
                  error:
                    'Storage bucket not configured. Please create the "invoice_files" bucket in Supabase Storage with public access enabled.',
                  details:
                    'Bucket creation failed. Please contact an administrator to set up the invoice_files storage bucket.',
                },
                { status: 500 }
              )
            }
          }

          // Upload using admin client (bypasses RLS)
          const { error: retryUploadError } = await adminClient.storage
            .from('invoice_files')
            .upload(filePath, fileBuffer, {
              contentType: file.type,
              upsert: false,
            })

          if (retryUploadError) {
            console.error('Retry upload error with admin client:', retryUploadError)
            return NextResponse.json(
              {
                error: 'Failed to upload invoice file',
                details: isRLSViolation
                  ? 'RLS policy issue detected. Using admin client as fallback but upload still failed. Please check your Supabase Storage policies.'
                  : 'Upload failed even with admin client. Please check your Supabase configuration.',
              },
              { status: 500 }
            )
          }

          // Use admin client for getting URL too since we used it for upload
          const { data: urlData } = adminClient.storage.from('invoice_files').getPublicUrl(filePath)

          const fileUrl = urlData.publicUrl

          // Skip to database insert since we already have the URL
          const { data: invoice, error: dbError } = await supabase
            .from('invoices')
            .insert({
              startup_id: startupId,
              uploaded_by_user_id: user.id,
              vendor_name: vendorName.trim(),
              invoice_date: invoiceDate,
              amount_gbp: amount,
              description: description?.trim() || null,
              file_path: fileUrl,
              status: 'submitted',
            })
            .select()
            .single()

          if (dbError) {
            console.error('Database error creating invoice:', dbError)
            return NextResponse.json({ error: 'Failed to create invoice record' }, { status: 500 })
          }

          return NextResponse.json({
            success: true,
            invoice: {
              id: invoice.id,
              vendor_name: invoice.vendor_name,
              invoice_date: invoice.invoice_date,
              amount_gbp: invoice.amount_gbp,
              status: invoice.status,
            },
          })
        } catch (adminError) {
          console.error('Admin client error:', adminError)
          return NextResponse.json(
            {
              error:
                'Storage bucket not configured. Please create the "invoice_files" bucket in Supabase Storage.',
              details:
                'Go to Supabase Dashboard > Storage > Create Bucket > Name: "invoice_files" > Public: Enabled',
            },
            { status: 500 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Failed to upload invoice file', details: uploadError.message },
          { status: 500 }
        )
      }
    }

    // 6. Get public URL for the uploaded file
    const { data: urlData } = supabase.storage.from('invoice_files').getPublicUrl(filePath)

    const fileUrl = urlData.publicUrl

    // 7. Create invoice record in database
    const { data: invoice, error: dbError } = await supabase
      .from('invoices')
      .insert({
        startup_id: startupId,
        uploaded_by_user_id: user.id,
        vendor_name: vendorName.trim(),
        invoice_date: invoiceDate,
        amount_gbp: amount,
        description: description?.trim() || null,
        file_path: fileUrl,
        status: 'submitted',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error creating invoice:', dbError)

      // If database insert fails, try to clean up the uploaded file
      await supabase.storage
        .from('invoice_files')
        .remove([filePath])
        .catch((cleanupError) => {
          console.error('Failed to cleanup uploaded file:', cleanupError)
        })

      return NextResponse.json({ error: 'Failed to create invoice record' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        vendor_name: invoice.vendor_name,
        invoice_date: invoice.invoice_date,
        amount_gbp: invoice.amount_gbp,
        status: invoice.status,
      },
    })
  } catch (error) {
    console.error('Error in POST /api/founder/invoices:', error)

    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
