"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { BentoCard } from "@/components/ui/bento-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Skeleton, StatCardSkeleton, JobCardSkeleton, CardSkeleton } from "@/components/ui/skeleton"
import { BackgroundPaths } from "@/components/background-paths"
import { FloatingNavbar } from "@/components/floating-navbar"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/use-toast"
import { cachedApiClient } from "@/lib/cached-api-client"
import { 
  ArrowLeft, 
  Users, 
  Briefcase, 
  MapPin, 
  Calendar, 
  GraduationCap,
  FileText,
  Mail,
  Phone,
  Globe,
  CheckCircle,
  Clock,
  XCircle,
  Eye,
  Download
} from "lucide-react"

interface JobPost {
  id: string
  title: string
  type: string
  location: string
  applications: number
  status: string
  datePosted: string
  stipend?: number
}

interface Application {
  id: string
  status: string
  appliedAt: string
  student: {
    id: string
    firstName: string
    lastName: string
    college: string
    course: string
    year: string
    cgpa: number
    resumeUrl?: string
    skills?: string[]
    profilePic?: string
    email?: string
    phone?: string
  }
  job: {
    title: string
    type: string
    location: string
    stipend?: number
  }
}

interface StudentProfile {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  college: string
  course: string
  year: string
  cgpa: number
  skills?: string[]
  resumeUrl?: string
  profilePic?: string
  linkedinUrl?: string
  githubUrl?: string
  portfolioUrl?: string
}

export default function RecruiterApplicationsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [isLoading, setIsLoading] = useState(true)
  const [recruiterProfile, setRecruiterProfile] = useState<any>(null)
  const [jobs, setJobs] = useState<JobPost[]>([])
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null)
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null)
  const [view, setView] = useState<'jobs' | 'applications' | 'profile'>('jobs')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth')
      return
    }
    
    if (user && user.role !== 'RECRUITER' && user.role !== 'BOTH') {
      router.push('/user/dashboard')
      return
    }
    
    if (user) {
      fetchData()
    }
  }, [user, loading, router])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      
      // Get recruiter profile
      const profileResponse = await cachedApiClient.getRecruiterProfile(user?.id || '')
      setRecruiterProfile(profileResponse)
      
      const recruiterId = profileResponse.id
      
      // Fetch jobs with application counts
      const jobsResponse = await cachedApiClient.getRecruiterJobs(recruiterId)
      const recruiterJobs = jobsResponse || []
      
      // Transform jobs data
      const transformedJobs: JobPost[] = recruiterJobs.map((job: any) => ({
        id: job.id,
        title: job.title,
        type: job.type,
        location: job.location,
        applications: job._count?.applications || 0,
        status: job.status === 'ACTIVE' ? 'Active' : 'Inactive',
        datePosted: new Date(job.createdAt).toLocaleDateString(),
        stipend: job.stipend
      }))
      
      setJobs(transformedJobs)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to load data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchJobApplications = async (jobId: string) => {
    try {
      setIsLoading(true)
      
      // Fetch all applications for this recruiter, then filter by job
      const applicationsResponse = await cachedApiClient.getRecruiterApplications(recruiterProfile.id)
      const allApplications = applicationsResponse || []
      
      // Filter applications for the selected job
      const jobApplications = allApplications.filter((app: any) => app.job.id === jobId)
      
      // Transform applications data
      const transformedApplications: Application[] = jobApplications.map((app: any) => ({
        id: app.id,
        status: app.status,
        appliedAt: app.appliedAt,
        student: {
          id: app.student.id,
          firstName: app.student.firstName,
          lastName: app.student.lastName,
          college: app.student.college,
          course: app.student.course,
          year: app.student.year,
          cgpa: app.student.cgpa,
          resumeUrl: app.student.resumeUrl,
          skills: app.student.skills,
          profilePic: app.student.profilePic,
          email: app.student.user?.email,
          phone: app.student.phone
        },
        job: {
          title: app.job.title,
          type: app.job.type,
          location: app.job.location,
          stipend: app.job.stipend
        }
      }))
      
      setApplications(transformedApplications)
      setView('applications')
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast({
        title: "Error",
        description: "Failed to load applications. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStudentProfile = async (studentId: string) => {
    try {
      setIsLoading(true)
      
      // Find the student from current applications
      const student = applications.find(app => app.student.id === studentId)?.student
      if (student) {
        setSelectedStudent(student as StudentProfile)
        setView('profile')
      }
    } catch (error) {
      console.error('Error fetching student profile:', error)
      toast({
        title: "Error",
        description: "Failed to load student profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const updateApplicationStatus = async (applicationId: string, status: string) => {
    try {
      await cachedApiClient.updateApplicationStatus(applicationId, status)
      
      // Update local state
      setApplications(prev => prev.map(app => 
        app.id === applicationId ? { ...app, status } : app
      ))
      
      toast({
        title: "Success",
        description: `Application ${status.toLowerCase()} successfully.`,
      })
    } catch (error) {
      console.error('Error updating application status:', error)
      toast({
        title: "Error",
        description: "Failed to update application status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4" />
      case 'rejected':
        return <XCircle className="h-4 w-4" />
      case 'under_review':
        return <Clock className="h-4 w-4" />
      default:
        return <Eye className="h-4 w-4" />
    }
  }

  if (loading || isLoading) {
    return (
      <div className="min-h-screen">
        <BackgroundPaths />
        <FloatingNavbar userRole={user?.role} userName={user?.email || "User"} />
        <div className="container mx-auto px-4 py-24">
          <div className="mb-8">
            <Skeleton className="h-8 w-[200px] mb-2" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
            <JobCardSkeleton />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <BackgroundPaths />
      <FloatingNavbar userRole={user?.role} userName={user?.email || "User"} />
      
      <div className="container mx-auto px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              {view !== 'jobs' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (view === 'profile') {
                      setView('applications')
                      setSelectedStudent(null)
                    } else {
                      setView('jobs')
                      setSelectedJob(null)
                      setApplications([])
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              <div>
                <h1 className="text-3xl font-bold">
                  {view === 'jobs' && 'Job Applications'}
                  {view === 'applications' && `Applications for ${selectedJob?.title}`}
                  {view === 'profile' && `${selectedStudent?.firstName} ${selectedStudent?.lastName}`}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {view === 'jobs' && 'Manage applications for your job posts'}
                  {view === 'applications' && `${applications.length} applications received`}
                  {view === 'profile' && 'Candidate profile and details'}
                </p>
              </div>
            </div>
          </div>

          {/* Jobs View */}
          {view === 'jobs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <BentoCard
                  key={job.id}
                  title={job.title}
                  description={`${job.type} • ${job.location}`}
                  icon={<Briefcase className="h-5 w-5" />}
                  meta={`Posted ${job.datePosted}`}
                  onClick={() => {
                    setSelectedJob(job)
                    fetchJobApplications(job.id)
                  }}
                  className="cursor-pointer"
                >
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={job.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {job.status}
                      </Badge>
                      {job.stipend && (
                        <span className="text-sm font-medium text-muted-foreground">
                          ₹{job.stipend.toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-muted-foreground">
                        {job.applications} {job.applications === 1 ? 'application' : 'applications'}
                      </span>
                    </div>
                  </div>
                </BentoCard>
              ))}
            </div>
          )}

          {/* Applications View */}
          {view === 'applications' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {applications.map((application) => (
                <BentoCard
                  key={application.id}
                  title={`${application.student.firstName} ${application.student.lastName}`}
                  description={`${application.student.course} • ${application.student.college}`}
                  icon={
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={application.student.profilePic || ''} />
                      <AvatarFallback>
                        {application.student.firstName[0]}{application.student.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                  }
                  onClick={() => fetchStudentProfile(application.student.id)}
                  className="cursor-pointer"
                >
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge className={getStatusColor(application.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(application.status)}
                          {application.status.replace('_', ' ')}
                        </div>
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {new Date(application.appliedAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <GraduationCap className="h-4 w-4" />
                        Year {application.student.year}
                      </div>
                      <div className="flex items-center gap-1">
                        <span>CGPA: {application.student.cgpa}</span>
                      </div>
                    </div>
                    
                    {application.student.skills && application.student.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {application.student.skills.slice(0, 3).map((skill, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {application.student.skills.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{application.student.skills.length - 3} more
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      {application.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateApplicationStatus(application.id, 'ACCEPTED')
                            }}
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              updateApplicationStatus(application.id, 'REJECTED')
                            }}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {application.student.resumeUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(application.student.resumeUrl, '_blank')
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </BentoCard>
              ))}
            </div>
          )}

          {/* Student Profile View */}
          {view === 'profile' && selectedStudent && (
            <div className="max-w-4xl mx-auto">
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-6">
                  <div className="flex items-start gap-6">
                    <Avatar className="h-24 w-24">
                      <AvatarImage src={selectedStudent.profilePic || ''} />
                      <AvatarFallback className="text-lg">
                        {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">
                        {selectedStudent.firstName} {selectedStudent.lastName}
                      </CardTitle>
                      <div className="space-y-2 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" />
                          <span>{selectedStudent.course} • Year {selectedStudent.year}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{selectedStudent.college}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">CGPA: {selectedStudent.cgpa}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Contact Information */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{selectedStudent.email}</span>
                      </div>
                      {selectedStudent.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{selectedStudent.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Skills */}
                  {selectedStudent.skills && selectedStudent.skills.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedStudent.skills.map((skill, index) => (
                          <Badge key={index} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="flex gap-4 pt-4">
                    {selectedStudent.resumeUrl && (
                      <Button 
                        onClick={() => window.open(selectedStudent.resumeUrl, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        View Resume
                      </Button>
                    )}
                    
                    {selectedStudent.linkedinUrl && (
                      <Button 
                        variant="outline"
                        onClick={() => window.open(selectedStudent.linkedinUrl, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <Globe className="h-4 w-4" />
                        LinkedIn
                      </Button>
                    )}
                    
                    {selectedStudent.githubUrl && (
                      <Button 
                        variant="outline"
                        onClick={() => window.open(selectedStudent.githubUrl, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <Globe className="h-4 w-4" />
                        GitHub
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Empty States */}
          {view === 'jobs' && jobs.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No job posts yet
              </h3>
              <p className="text-muted-foreground mb-4">
                You haven't posted any jobs yet. Create your first job post to start receiving applications.
              </p>
              <Button onClick={() => router.push('/recruiter/post-job')}>
                Post Your First Job
              </Button>
            </div>
          )}
          
          {view === 'applications' && applications.length === 0 && !isLoading && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No applications yet
              </h3>
              <p className="text-muted-foreground">
                This job hasn't received any applications yet. Share your job post to get more visibility.
              </p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
