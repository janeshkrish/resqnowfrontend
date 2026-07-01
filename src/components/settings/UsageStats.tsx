import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from "@/lib/api"
import { Loader2 } from "lucide-react"
import { format, subMonths, parseISO } from "date-fns"

const UsageStats = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    cancelled: 0
  })
  const [chartData, setChartData] = useState<any[]>([])

  useEffect(() => {
    let isMounted = true

    const fetchData = async (showLoading = false) => {
      if (showLoading) {
        setLoading(true)
      }
      try {
        const res = await apiFetch("/api/service-requests")
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            processData(Array.isArray(data) ? data : [])
          }
        }
      } catch (error) {
        console.error("Failed to fetch usage stats", error)
      } finally {
        if (isMounted && showLoading) {
          setLoading(false)
        }
      }
    }

    fetchData(true)
    const intervalId = window.setInterval(() => fetchData(false), 20000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const processData = (data: any[]) => {
    // 1. Calculate Summary Stats
    const total = data.length
    const completed = data.filter(r => ['completed', 'paid'].includes(String(r.status || '').toLowerCase())).length
    const cancelled = data.filter(r => ['cancelled', 'rejected'].includes(String(r.status || '').toLowerCase())).length
    const pending = total - completed - cancelled

    setStats({ total, completed, cancelled, pending })

    // 2. Calculate Chart Data (Last 6 months)
    const monthlyData = new Map()

    // Initialize last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i)
      const key = format(d, 'MMM')
      monthlyData.set(key, 0)
    }

    // Fill with actual data
    data.forEach(item => {
      if (!item?.created_at) return
      const date = parseISO(item.created_at)
      if (Number.isNaN(date.getTime())) return
      const key = format(date, 'MMM')
      if (monthlyData.has(key)) {
        monthlyData.set(key, monthlyData.get(key) + 1)
      }
    })

    const processedChartData = Array.from(monthlyData).map(([month, requests]) => ({
      month,
      requests
    }))

    setChartData(processedChartData)
  }

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Lifetime service requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully resolved</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending/Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{stats.cancelled}</div>
            <p className="text-xs text-muted-foreground">Terminated requests</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request History (Last 6 Months)</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }}
                  itemStyle={{ color: 'var(--foreground)' }}
                />
                <Bar dataKey="requests" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default UsageStats
