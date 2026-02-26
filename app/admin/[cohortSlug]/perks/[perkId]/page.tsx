'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Gift, Users } from 'lucide-react'
import type { Id } from '@/convex/_generated/dataModel'

export default function AdminPerkClaimsPage() {
  const params = useParams()
  const cohortSlug = params.cohortSlug as string
  const perkId = params.perkId as Id<'perks'>

  const perkData = useQuery(api.perks.getById, { id: perkId })

  if (perkData === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!perkData) {
    return (
      <EmptyState
        icon={<Gift className="h-6 w-6" />}
        title="Perk not found"
        description="The selected perk could not be found."
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <Link href={`/admin/${cohortSlug}/perks`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Perks
            </Button>
          </Link>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{perkData.title}</h1>
          {perkData.providerName && (
            <p className="text-muted-foreground">by {perkData.providerName}</p>
          )}
        </div>
      </div>

      {/* Perk details */}
      <Card>
        <CardHeader>
          <CardTitle>Perk Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{perkData.description}</p>
          {perkData.details && <p className="text-sm text-muted-foreground">{perkData.details}</p>}
          {perkData.url && (
            <p className="text-sm">
              <span className="text-muted-foreground">URL: </span>
              <a
                href={perkData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {perkData.url}
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Claims table */}
      <Card>
        <CardHeader>
          <CardTitle>Claims ({perkData.claims.length})</CardTitle>
          <CardDescription>Founders who have claimed this perk.</CardDescription>
        </CardHeader>
        <CardContent>
          {perkData.claims.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Founder Name</TableHead>
                  <TableHead>Startup Name</TableHead>
                  <TableHead>Claimed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perkData.claims.map((claim) => (
                  <TableRow key={claim._id}>
                    <TableCell className="font-medium">{claim.userName}</TableCell>
                    <TableCell>{claim.startupName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(claim.claimedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              noCard
              icon={<Users className="h-6 w-6" />}
              title="No claims yet"
              description="No founders have claimed this perk yet."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
