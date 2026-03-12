import { action } from './functions'
import { v } from 'convex/values'

/**
 * Extract structured invoice data from uploaded PDFs using Gemini Flash 3 via OpenRouter.
 */
export const extractInvoiceData = action({
  args: {
    invoiceStorageId: v.id('_storage'),
    receiptStorageIds: v.array(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is not configured')
    }

    // Fetch PDFs from Convex storage as base64
    async function fetchAsBase64(storageId: string): Promise<string> {
      const url = await ctx.storage.getUrl(storageId as any)
      if (!url) throw new Error(`Could not get URL for storage ID ${storageId}`)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch file from storage`)
      const buffer = await response.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
      }
      return btoa(binary)
    }

    const invoiceBase64 = await fetchAsBase64(args.invoiceStorageId as string)
    const receiptBase64s = await Promise.all(
      args.receiptStorageIds.map((id) => fetchAsBase64(id as string))
    )

    // Build content parts for the API call
    const contentParts: Array<Record<string, unknown>> = [
      {
        type: 'text',
        text: `You are an invoice data extraction assistant. Extract the following from the provided PDF documents and respond ONLY with valid JSON (no markdown, no explanation):

{
  "vendorNames": "comma-separated vendor name(s) from the invoice and receipts",
  "description": "brief description of what was purchased",
  "invoiceDate": "YYYY-MM-DD format, the date on the invoice",
  "totalAmount": <number - the total amount from the invoice PDF>,
  "receiptAmounts": [<number for each receipt PDF, the amount on that receipt>]
}

The first PDF is the invoice. The remaining PDFs are receipts.
Extract amounts as numbers (no currency symbols). If you cannot determine a value, use null.`,
      },
      {
        type: 'file',
        file: {
          filename: 'invoice.pdf',
          data: invoiceBase64,
        },
      },
    ]

    receiptBase64s.forEach((b64, i) => {
      contentParts.push({
        type: 'file',
        file: {
          filename: `receipt_${i + 1}.pdf`,
          data: b64,
        },
      })
    })

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-2.0',
        messages: [
          {
            role: 'user',
            content: contentParts,
          },
        ],
        temperature: 0,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    const rawContent = data.choices?.[0]?.message?.content ?? ''

    // Parse JSON from the response (handle possible markdown wrapping)
    let jsonStr = rawContent.trim()
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    }

    let parsed: {
      vendorNames: string | null
      description: string | null
      invoiceDate: string | null
      totalAmount: number | null
      receiptAmounts: (number | null)[]
    }

    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      throw new Error(`Failed to parse AI response as JSON: ${jsonStr.slice(0, 200)}`)
    }

    // Programmatic math: sum receipt amounts (not AI-computed)
    const receiptAmounts = (parsed.receiptAmounts ?? []).map((a) => (typeof a === 'number' ? a : 0))
    const receiptTotal = receiptAmounts.reduce((sum, a) => sum + a, 0)
    const totalAmount = typeof parsed.totalAmount === 'number' ? parsed.totalAmount : 0

    return {
      vendorNames: parsed.vendorNames ?? '',
      description: parsed.description ?? '',
      invoiceDate: parsed.invoiceDate ?? '',
      totalAmount,
      receiptAmounts,
      receiptTotal,
      amountMismatch: Math.abs(totalAmount - receiptTotal) > 0.01,
    }
  },
})
