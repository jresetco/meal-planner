import { Sidebar } from '@/components/layout/sidebar'

// Every page under (app) calls auth() which hits Prisma. They must render per-request,
// not be prerendered at build time — otherwise `next build` fails when DATABASE_URL
// isn't present during the build phase.
export const dynamic = 'force-dynamic'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen print:block print:h-auto">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 print:overflow-visible print:bg-white">
        <div className="container mx-auto p-6 print:m-0 print:max-w-none print:p-0">
          {children}
        </div>
      </main>
    </div>
  )
}
