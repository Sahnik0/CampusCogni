"use client"

import { useState, useEffect, lazy, Suspense } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BentoCard } from "@/components/ui/bento-card"
import { BentoGrid } from "@/components/ui/bento-grid"
import { Skeleton, StatCardSkeleton, JobCardSkeleton, CardSkeleton } from "@/components/ui/skeleton"
import { BackgroundPaths } from "@/components/background-paths"
import { FloatingNavbar } from "@/components/floating-navbar"

// Lazy load heavy components that aren't immediately needed
const CachedAvatar = lazy(() => import("@/components/cached-avatar").then(m => ({ default: m.CachedAvatar })))
const RoutePreloader = lazy(() => import("@/components/route-preloader").then(m => ({ default: m.RoutePreloader })))
const PerformanceMonitor = lazy(() => import("@/components/performance-monitor").then(m => ({ default: m.PerformanceMonitor })))

import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { useUserProfile, useDashboardStats, useJobs, useUserApplications } from "@/hooks/use-cached-data"
import { cachedApiClient } from "@/lib/cached-api-client"
import { 
  Briefcase, 
  MapPin, 
  Clock,
  Building,
  Star,
  Heart,
  TrendingUp,
  Users,
  BookOpen,
  Search,
  ArrowLeftRight
} from "lucide-react"

interface Job {
  id: string
  title: string
  company: string
  location: string
  type: string
  stipend: string
  description: string
  requirements: string
  postedDate: string
  saved: boolean
  applied: boolean
  ownJob?: boolean
}

export default function UserDashboard() {
  const { user, loading, upgradeToRecruiter } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  // Use cached hooks for data fetching with proper guards
  const { data: userProfile, loading: profileLoading } = useUserProfile(user?.id || '', { enabled: !!user?.id })
  const { data: stats, loading: statsLoading } = useDashboardStats(user?.id || '', user?.role || '', { 
    enabled: !!user?.id && !!user?.role 
  })
  const { data: jobsData, loading: jobsLoading, refresh: refreshJobs } = useJobs(1, undefined, { enabled: !!user })
  const { data: applications, loading: applicationsLoading } = useUserApplications(user?.id || '', { 
    enabled: !!user?.id 
  })
  
  const isLoading = profileLoading || statsLoading || jobsLoading || applicationsLoading
  
  // Provide fallback stats to prevent null reference errors
  const dashboardStats = stats || {
    totalApplications: 0,
    savedJobs: 0,
    interviewsScheduled: 0
  }
  
  // Process jobs data to include applied status
  const jobs = jobsData?.jobs?.map((job: any) => ({
    id: job.id,
    title: job.title,
    company: job.recruiter?.company || 'Unknown Company',
    location: job.location,
    type: job.type,
    stipend: job.stipend,
    description: job.description,
    requirements: job.requirements || '',
    postedDate: new Date(job.createdAt).toISOString().split('T')[0],
    saved: false, // TODO: Implement saved jobs functionality
    applied: applications?.some((app: any) => app.job?.id === job.id) || false,
    ownJob: job.recruiter && job.recruiter.userId && user?.id && job.recruiter.userId === user.id
  })) || []

  useEffect(() => {
    console.log('User dashboard - Current user:', user)
    console.log('User dashboard - User role:', user?.role)
    
    if (!loading && !user) {
      router.push('/auth')
      return
    }
    
    // Allow RECRUITER role users to access user dashboard if they have both profiles
    if (user && user.role === 'RECRUITER') {
      console.log('User dashboard - RECRUITER trying to access user dashboard, checking for dual profiles...')
      checkAndUpdateUserRole()
      return
    }
    
    if (user && (user.role !== 'USER' && user.role !== 'BOTH' && user.role !== 'RECRUITER')) {
      console.log('User dashboard - Redirecting to recruiter dashboard, user role:', user.role)
      router.push('/recruiter/dashboard')
      return
    }
  }, [user, loading, router])

  const checkAndUpdateUserRole = async () => {
    try {
      console.log('Checking and updating user role for dual profiles...')
      const roleUpdateResponse = await cachedApiClient.updateUserRole(user!.id, user!.role)
      
      if (roleUpdateResponse.roleUpdated && roleUpdateResponse.newRole === 'BOTH') {
        console.log('Role updated from', roleUpdateResponse.oldRole, 'to', roleUpdateResponse.newRole)
        
        // Update the user in context and localStorage
        const updatedUser = { ...user!, role: 'BOTH' }
        localStorage.setItem('userData', JSON.stringify(updatedUser))
      } else if (roleUpdateResponse.newRole === 'RECRUITER') {
        // User only has recruiter profile, redirect to recruiter dashboard
        console.log('User only has recruiter profile, redirecting...')
        router.push('/recruiter/dashboard')
      }
      // Data will be automatically fetched by cached hooks
    } catch (error) {
      console.error('Failed to check/update user role:', error)
    }
  }

  const handleApplyToJob = async (jobId: string) => {
    try {
      await cachedApiClient.applyToJob(jobId, user!.id)
      
      // Refresh applications data to update UI
      await refreshJobs() // This will trigger a refresh of jobs and applications
      
      toast({
        title: "Application Submitted",
        description: "Your application has been submitted successfully!",
      })
    } catch (error) {
      console.error('Failed to apply to job:', error)
      toast({
        title: "Error",
        description: "Failed to submit application. Please try again.",
        variant: "destructive"
      })
    }
  }

  const handleSaveJob = (jobId: string) => {
    // TODO: Implement save job functionality with caching
    toast({
      title: "Job Saved",
      description: "Job has been saved to your list!",
    })
  }

  const handleBecomeRecruiter = () => {
    // If user already has recruiter access, go to recruiter dashboard
    if (user?.role === 'RECRUITER' || user?.role === 'BOTH') {
      router.push('/recruiter/dashboard')
    } else {
      // Otherwise, go to recruiter registration
      router.push('/recruiter/register')
    }
  }

  // Show loading only for authentication, not data
  if (loading) {
    return (
      <div className="min-h-screen">
        <BackgroundPaths />
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <CardSkeleton className="h-32" />
              <JobCardSkeleton />
              <JobCardSkeleton />
            </div>
            <div className="space-y-6">
              <CardSkeleton className="h-48" />
              <CardSkeleton className="h-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <BackgroundPaths />
      <FloatingNavbar userRole={user?.role} userName={user?.email || "User"} />
      
      {/* Preload common routes and data for better performance */}
      <Suspense fallback={null}>
        <RoutePreloader userId={user?.id} userRole={user?.role} />
        
        {/* Monitor performance for optimization */}
        <PerformanceMonitor 
          pageName="User Dashboard" 
          onLoadComplete={(time) => console.log(`Dashboard loaded in ${time}ms`)} 
        />
      </Suspense>

      <div className="container mx-auto px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, <span className="text-primary">{userProfile?.firstName || user?.email?.split('@')[0] || 'User'}!</span>
            </h1>
            <p className="text-muted-foreground">Discover amazing career opportunities and track your applications.</p>
          </div>

          {/* Stats Cards - Bento Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {statsLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <BentoCard
                  title="Total Applications"
                  description="Track your job application progress"
                  icon={<Briefcase className="h-4 w-4 text-blue-500" />}
                  status="Active"
                  meta={`${dashboardStats.totalApplications || applications?.length || 0} sent`}
                  cta="View All →"
                  onClick={() => router.push('/user/applications')}
                >
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {dashboardStats.totalApplications || applications?.length || 0}
                  </div>
                </BentoCard>

                <BentoCard
                  title="Saved Jobs"
                  description="Your bookmarked opportunities"
                  icon={<Heart className="h-4 w-4 text-red-500" />}
                  status="Updated"
                  meta={`${dashboardStats.savedJobs || 0} saved`}
                  cta="Browse →"
                >
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {dashboardStats.savedJobs || 0}
                  </div>
                </BentoCard>

                <BentoCard
                  title="Interviews"
                  description="Upcoming interview schedule"
                  icon={<Users className="h-4 w-4 text-green-500" />}
                  status="Scheduled"
                  meta={`${dashboardStats.interviewsScheduled || 0} upcoming`}
                  cta="Schedule →"
                >
                  <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {dashboardStats.interviewsScheduled || 0}
                  </div>
                </BentoCard>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Latest Jobs
                </h3>
                <Button asChild variant="outline">
                  <a href="/jobs">View All Jobs</a>
                </Button>
              </div>

                  {/* Job Listings - Enhanced Bento Cards */}
                  <div className="space-y-4">
                    {jobsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <JobCardSkeleton key={i} />
                      ))
                    ) : jobs.length > 0 ? (
                      jobs.slice(0, 5).map((job: Job) => (
                        <BentoCard
                          key={job.id}
                          variant="large"
                          title={job.title}
                          description={job.company}
                          icon={<Building className="h-4 w-4 text-purple-500" />}
                          status={job.applied ? 'Applied' : 'Not Applied'}
                          meta={`${job.stipend ? `₹${job.stipend.toLocaleString()}` : 'Stipend not disclosed'} • ${job.location}`}
                          cta={job.applied ? "View Application →" : "Apply Now →"}
                          onClick={() => {
                            if (job.applied) {
                              // Navigate to applications page with this job highlighted
                              window.open(`/user/applications`, '_blank');
                            } else {
                              // Navigate to job details to apply
                              window.open(`/jobs/${job.id}`, '_blank');
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </div>
                        </BentoCard>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No jobs available at the moment.</p>
                        <Button asChild variant="outline" className="mt-4">
                          <a href="/jobs">Browse All Jobs</a>
                        </Button>
                      </div>
                    )}
                  </div>
            </div>            {/* Sidebar */}
            <div className="space-y-4">
              {/* Quick Actions - Bento Style */}
              <BentoCard
                title="Quick Actions"
                description="Navigate to key features"
                icon={<Star className="h-4 w-4 text-yellow-500" />}
                status="Ready"
              >
                <div className="space-y-2">
                  <Button asChild variant="outline" className="w-full justify-start text-sm">
                    <a href="/user/applications">
                      <Briefcase className="h-4 w-4 mr-2" />
                      View My Applications
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start text-sm">
                    <a href="/user/profile">
                      <Users className="h-4 w-4 mr-2" />
                      Update Profile
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start text-sm">
                    <a href="/user/cv-builder">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Build CV
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start text-sm">
                    <a href="https://ats-k2nm.onrender.com">
                      <Search className="h-4 w-4 mr-2" />
                      Check your ats score
                    </a>
                  </Button>
                </div>
              </BentoCard>

              {/* Recruiter Access CTA - Bento Style */}
              <BentoCard
                title={user?.role === 'RECRUITER' || user?.role === 'BOTH' ? 'Recruiting' : 'Hiring?'}
                description={user?.role === 'RECRUITER' || user?.role === 'BOTH' 
                  ? 'Access your recruiter dashboard and manage jobs'
                  : 'Switch to recruiting mode and start posting jobs'
                }
                icon={user?.role === 'RECRUITER' || user?.role === 'BOTH' 
                  ? <ArrowLeftRight className="h-4 w-4 text-blue-500" />
                  : <TrendingUp className="h-4 w-4 text-purple-500" />
                }
                status={user?.role === 'RECRUITER' || user?.role === 'BOTH' ? 'Active' : 'Available'}
                tags={user?.role === 'RECRUITER' || user?.role === 'BOTH' ? ["Dashboard", "Active"] : ["Upgrade", "Opportunity"]}
                cta="Get Started →"
                hasPersistentHover={user?.role !== 'RECRUITER' && user?.role !== 'BOTH'}
                onClick={handleBecomeRecruiter}
              >
                <Button onClick={handleBecomeRecruiter} className="w-full mt-3">
                  {user?.role === 'RECRUITER' || user?.role === 'BOTH' 
                    ? <><ArrowLeftRight className="h-4 w-4 mr-2" />Switch to Recruiter Dashboard</>
                    : <><TrendingUp className="h-4 w-4 mr-2" />Become a Recruiter</>
                  }
                </Button>
              </BentoCard>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
