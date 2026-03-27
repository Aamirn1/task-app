'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, CheckCircle2, Clock, AlertTriangle, Zap, Users,
  LogOut, Plus, Search, Filter, Menu, X, Volume2,
  Calendar, Target, Briefcase, Building2, UserPlus, Copy,
  Check, Trash2, Play, Loader2, Crown, Shield,
  Timer, CheckCircle, Circle, Mic, MicOff, Eye,
  Archive, ClockAlert, AlarmClock, BellRing, VolumeX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  useAuthStore,
  useTasksStore,
  useGroupsStore,
  useNotificationsStore,
  useJoinRequestsStore,
  useUIStore,
  useAlarmStore,
  type Task,
  type Group,
  type User,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/store';

// API helper
const api = async (endpoint: string, options: RequestInit = {}) => {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`/api${endpoint}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
};

// Animated Button Component with press effect
const AnimatedButton = ({ children, className = '', onClick, disabled, variant, size, type }: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: string;
  size?: string;
  type?: 'button' | 'submit';
}) => (
  <Button
    type={type}
    variant={variant as "default" | "outline" | "ghost" | "secondary" | "destructive" | "link" | null | undefined}
    size={size as "default" | "sm" | "lg" | "icon" | null | undefined}
    className={`transition-all duration-150 active:scale-95 active:brightness-110 ${className}`}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
);

// Priority Badge Component
const PriorityBadge = ({ priority }: { priority: TaskPriority }) => {
  const config = {
    CRITICAL: { label: 'Critical', className: 'bg-red-500/20 text-red-400 border-red-500/50 neon-glow-critical', icon: AlertTriangle },
    STANDARD: { label: 'Standard', className: 'bg-amber-500/20 text-amber-400 border-amber-500/50 neon-glow-normal', icon: Clock },
    FLEXIBLE: { label: 'Flexible', className: 'bg-green-500/20 text-green-400 border-green-500/50 neon-glow-flexible', icon: Zap },
  };
  const { label, className, icon: Icon } = config[priority];
  return (
    <Badge variant="outline" className={`${className} border font-medium`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
};

// Status Badge Component
const StatusBadge = ({ status }: { status: TaskStatus }) => {
  const config = {
    PENDING: { label: 'Pending', className: 'bg-gray-500/20 text-gray-400', icon: Circle },
    SEEN: { label: 'Seen', className: 'bg-blue-500/20 text-blue-400', icon: Eye },
    IN_PROGRESS: { label: 'In Progress', className: 'bg-purple-500/20 text-purple-400', icon: Play },
    COMPLETED: { label: 'Completed', className: 'bg-green-500/20 text-green-400', icon: CheckCircle },
    EXPIRED: { label: 'Expired', className: 'bg-red-500/20 text-red-400', icon: ClockAlert },
  };
  const { label, className, icon: Icon } = config[status];
  return (
    <Badge variant="secondary" className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
};

// Read Receipts Component
const ReadReceipts = ({ receipts }: { receipts: { total: number; seen: number; inProgress: number; completed: number } }) => {
  if (!receipts || receipts.total === 0) return null;
  const percentage = Math.round((receipts.seen / receipts.total) * 100);
  
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1">
        <Eye className="w-3 h-3 text-blue-400" />
        <span>{receipts.seen}/{receipts.total} seen</span>
      </div>
      <div className="w-16 h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

// Critical Alarm Modal
const CriticalAlarmModal = () => {
  const { isActive, taskId, taskTitle, stopAlarm, acknowledgeAlarm, startTime } = useAlarmStore();
  const [elapsed, setElapsed] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (isActive && startTime) {
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive, startTime]);

  const handleAcknowledge = async () => {
    if (taskId) {
      try {
        await api('/tasks', { method: 'PATCH', body: JSON.stringify({ taskId, status: 'SEEN' }) });
        acknowledgeAlarm();
        toast({ title: 'Task acknowledged' });
      } catch {
        stopAlarm();
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isActive} onOpenChange={() => {}}>
      <DialogContent className="glass-card border-red-500/50 neon-glow-critical max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="text-center py-6">
          <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }} className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlarmClock className="w-12 h-12 text-red-400" />
          </motion.div>
          <h2 className="text-2xl font-bold text-red-400 mb-2">🚨 CRITICAL TASK</h2>
          <p className="text-lg mb-4">{taskTitle}</p>
          <div className="text-3xl font-mono text-muted-foreground mb-6">{formatTime(elapsed)}</div>
          <div className="flex gap-3 justify-center">
            <AnimatedButton variant="outline" onClick={stopAlarm} className="border-muted-foreground/30">Silence</AnimatedButton>
            <AnimatedButton onClick={handleAcknowledge} className="bg-gradient-to-r from-red-500 to-orange-500">
              <Check className="w-4 h-4 mr-2" />Acknowledge
            </AnimatedButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Voice Recording Hook
const useVoiceRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((t) => {
          if (t >= 30) { stopRecording(); return 30; }
          return t + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        setAudioBlob(new Blob(chunks, { type: 'audio/webm' }));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
    } catch {
      toast({ title: 'Microphone access denied', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const clearRecording = () => { setAudioBlob(null); setRecordingTime(0); };

  return { isRecording, recordingTime, audioBlob, startRecording, stopRecording, clearRecording };
};

// Back Button Component
const BackButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    onClick={onClick}
    className="p-0 h-auto text-muted-foreground hover:text-foreground mr-2 transition-transform active:scale-90"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
  </Button>
);

// Auth Page
const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'register' | 'register-admin'>('login');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { setUser, setBusiness, setToken, setPendingApproval } = useAuthStore();
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', inviteCode: '' });
  const [adminData, setAdminData] = useState({ name: '', email: '', password: '', confirmPassword: '', phone: '', teamName: '', founderName: '', businessType: '', workerCount: 0 });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, business, token } = await api('/auth/login', { method: 'POST', body: JSON.stringify(loginData) });
      setUser(user); setBusiness(business); setToken(token);
      toast({ title: 'Welcome back!', description: `Logged in as ${user.name}` });
    } catch (error: unknown) {
      toast({ title: 'Login failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent, isAdmin: boolean) => {
    e.preventDefault();
    const data = isAdmin ? adminData : registerData;
    if (data.password !== data.confirmPassword) { toast({ title: 'Passwords do not match', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const res = await api('/auth/register', { method: 'POST', body: JSON.stringify({ ...data, role: isAdmin ? 'ADMIN' : 'MEMBER' }) });
      setUser(res.user); setBusiness(res.business); setToken(res.token);
      
      if (res.pendingApproval) {
        setPendingApproval(true, res.pendingBusinessName);
        toast({ title: 'Request submitted!', description: 'Waiting for admin approval to join the team.' });
      } else {
        toast({ title: 'Account created!' });
      }
    } catch (error: unknown) {
      toast({ title: 'Registration failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 gradient-dark">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      </div>
      <div className="w-full max-w-md relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2"><span className="neon-text-purple">Nova</span><span className="neon-text-blue">Luxe</span></h1>
          <p className="text-muted-foreground text-sm">Premium Task Management</p>
        </motion.div>
        <Card className="glass-card neon-glow-purple">
          <CardHeader className="pb-2">
            <div className="grid w-full grid-cols-3 gap-1 bg-muted/30 rounded-lg p-1">
              {['login', 'register', 'register-admin'].map((m) => (
                <AnimatedButton key={m} variant="ghost" size="sm" onClick={() => setMode(m as typeof mode)} className={mode === m ? 'bg-primary/20' : ''}>
                  {m === 'login' ? 'Login' : m === 'register' ? 'Join Team' : 'Create Team'}
                </AnimatedButton>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {mode === 'login' && (
                <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="your@email.com" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} className="bg-muted/30 border-primary/20" required /></div>
                  <div className="space-y-2"><Label>Password</Label><Input type="password" placeholder="••••••••" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} className="bg-muted/30 border-primary/20" required /></div>
                  <AnimatedButton type="submit" className="w-full gradient-purple-blue" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Sign In</AnimatedButton>
                </motion.form>
              )}
              {mode === 'register' && (
                <motion.form key="register" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={(e) => handleRegister(e, false)} className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <BackButton onClick={() => setMode('login')} />
                      <Label className="text-base">Full Name</Label>
                    </div>
                    <Input placeholder="John Doe" value={registerData.name} onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })} className="bg-muted/30 border-primary/20" required />
                  </div>
                  <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="your@email.com" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} className="bg-muted/30 border-primary/20" required /></div>
                  <div className="space-y-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <Label className="text-primary font-medium">Invite Code *</Label>
                    <Input placeholder="XXXXXX" value={registerData.inviteCode} onChange={(e) => setRegisterData({ ...registerData, inviteCode: e.target.value.toUpperCase() })} maxLength={6} className="bg-muted/30 border-primary/30 font-mono tracking-widest text-center text-xl h-12" required />
                    <p className="text-xs text-muted-foreground text-center">Get this 6-character code from your team admin</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Password</Label><Input type="password" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} className="bg-muted/30 border-primary/20" required /></div>
                    <div className="space-y-2"><Label>Confirm</Label><Input type="password" value={registerData.confirmPassword} onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })} className="bg-muted/30 border-primary/20" required /></div>
                  </div>
                  <AnimatedButton type="submit" className="w-full gradient-purple-blue" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Join Team</AnimatedButton>
                </motion.form>
              )}
              {mode === 'register-admin' && (
                <motion.form key="admin" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={(e) => handleRegister(e, true)} className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <BackButton onClick={() => setMode('login')} />
                      <Label className="text-xs">Your Name</Label>
                    </div>
                    <Input placeholder="John Doe" value={adminData.name} onChange={(e) => setAdminData({ ...adminData, name: e.target.value })} className="bg-muted/30 border-primary/20 h-9" required />
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Team/Business Name</Label><Input placeholder="Acme Corp" value={adminData.teamName} onChange={(e) => setAdminData({ ...adminData, teamName: e.target.value })} className="bg-muted/30 border-primary/20 h-9" required /></div>
                  <div className="space-y-1"><Label className="text-xs">Business Type</Label>
                    <Select value={adminData.businessType} onValueChange={(v) => setAdminData({ ...adminData, businessType: v })}>
                      <SelectTrigger className="bg-muted/30 border-primary/20 h-9 w-full"><SelectValue placeholder="Business" /></SelectTrigger>
                      <SelectContent><SelectItem value="company">Company</SelectItem><SelectItem value="school">School</SelectItem><SelectItem value="team">Team</SelectItem><SelectItem value="organization">Organization</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Founder Name</Label><Input placeholder="Company Founder" value={adminData.founderName} onChange={(e) => setAdminData({ ...adminData, founderName: e.target.value })} className="bg-muted/30 border-primary/20 h-9" required /></div>
                    <div className="space-y-1"><Label className="text-xs">Workers</Label><Input type="number" placeholder="10" value={adminData.workerCount || ''} onChange={(e) => setAdminData({ ...adminData, workerCount: parseInt(e.target.value) || 0 })} className="bg-muted/30 border-primary/20 h-9" /></div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" placeholder="admin@company.com" value={adminData.email} onChange={(e) => setAdminData({ ...adminData, email: e.target.value })} className="bg-muted/30 border-primary/20 h-9" required /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label className="text-xs">Password</Label><Input type="password" value={adminData.password} onChange={(e) => setAdminData({ ...adminData, password: e.target.value })} className="bg-muted/30 border-primary/20 h-9" required /></div>
                    <div className="space-y-1"><Label className="text-xs">Confirm</Label><Input type="password" value={adminData.confirmPassword} onChange={(e) => setAdminData({ ...adminData, confirmPassword: e.target.value })} className="bg-muted/30 border-primary/20 h-9" required /></div>
                  </div>
                  <AnimatedButton type="submit" className="w-full gradient-purple-blue" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}<Crown className="w-4 h-4 mr-2" />Create Team</AnimatedButton>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Join Requests Modal
const JoinRequestsModal = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [requests, setRequests] = useState<Array<{ id: string; user: User; status: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { requests: storeRequests, setRequests: setStoreRequests } = useJoinRequestsStore();

  useEffect(() => {
    if (open) loadRequests();
  }, [open]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await api('/teams/requests');
      setRequests(res.requests || []);
      setStoreRequests(res.requests || []);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await api('/teams/requests', { method: 'PATCH', body: JSON.stringify({ requestId, action: 'approve' }) });
      toast({ title: 'Request approved!' });
      loadRequests();
    } catch (error: unknown) {
      toast({ title: 'Failed to approve', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await api('/teams/requests', { method: 'PATCH', body: JSON.stringify({ requestId, action: 'reject' }) });
      toast({ title: 'Request rejected' });
      loadRequests();
    } catch (error: unknown) {
      toast({ title: 'Failed to reject', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card neon-glow-purple max-w-md">
        <DialogHeader><DialogTitle className="neon-text-purple">Join Requests</DialogTitle></DialogHeader>
        <div className="pt-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No pending requests</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-primary/10">
                    <div>
                      <p className="font-medium">{req.user?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{req.user?.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <AnimatedButton size="sm" onClick={() => handleApprove(req.id)} className="bg-green-600 hover:bg-green-700">
                        <Check className="w-4 h-4" />
                      </AnimatedButton>
                      <AnimatedButton size="sm" variant="outline" onClick={() => handleReject(req.id)} className="border-red-500/50 text-red-400">
                        <X className="w-4 h-4" />
                      </AnimatedButton>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Notifications Dropdown
const NotificationsDropdown = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const [notifications, setNotifications] = useState<Array<{ id: string; title: string; message: string; type: string; read: boolean; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const { unreadCount } = useNotificationsStore();

  useEffect(() => {
    if (open) loadNotifications();
  }, [open]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await api('/notifications');
      setNotifications(res.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api('/notifications', { method: 'PATCH', body: JSON.stringify({ id }) });
      loadNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 w-80 glass-card rounded-xl border border-primary/20 shadow-xl z-50"
    >
      <div className="p-3 border-b border-primary/10 flex items-center justify-between">
        <h3 className="font-semibold neon-text-purple">Notifications</h3>
        {unreadCount > 0 && (
          <Badge className="bg-primary/20 text-primary">{unreadCount} new</Badge>
        )}
      </div>
      <ScrollArea className="max-h-80">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-primary/10">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 cursor-pointer hover:bg-primary/5 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                onClick={() => markAsRead(n.id)}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="font-medium text-sm">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </motion.div>
  );
};

// Create Task Modal
const CreateTaskModal = ({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [formData, setFormData] = useState({ 
    title: '', 
    description: '', 
    priority: 'STANDARD' as TaskPriority, 
    deadline: '', 
    assigneeIds: [] as string[], 
    groupId: '',
    enableAlarm: false,
    alarmTone: 'critical' as 'critical' | 'standard' | 'flexible'
  });
  const { toast } = useToast();
  const { business } = useAuthStore();
  const { isRecording, recordingTime, audioBlob, startRecording, stopRecording, clearRecording } = useVoiceRecording();

  useEffect(() => { if (open) loadMembersAndGroups(); }, [open]);

  const loadMembersAndGroups = async () => {
    try {
      const [membersRes, groupsRes] = await Promise.all([api('/users'), api('/groups')]);
      setMembers(membersRes.members); setGroups(groupsRes.groups);
    } catch (error) { console.error('Failed to load data:', error); }
  };

  const transcribeAudio = async () => {
    if (!audioBlob) return;
    setTranscribing(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await api('/voice', { method: 'POST', body: JSON.stringify({ audioBase64: base64 }) });
        if (result.transcription) {
          setFormData((prev) => ({ ...prev, description: prev.description ? `${prev.description}\n\n[Voice]: ${result.transcription}` : `[Voice]: ${result.transcription}` }));
          toast({ title: 'Voice transcribed!' });
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error: unknown) {
      toast({ title: 'Transcription failed', variant: 'destructive' });
    } finally { setTranscribing(false); }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const mediaFiles = [];
      if (audioBlob) {
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        await new Promise((resolve) => { reader.onload = () => resolve(true); });
        mediaFiles.push({ type: 'AUDIO', url: reader.result as string, fileName: 'voice.webm', fileSize: audioBlob.size, duration: recordingTime });
      }
      await api('/tasks', { method: 'POST', body: JSON.stringify({ 
        ...formData, 
        deadline: formData.deadline || null, 
        groupId: formData.groupId || null, 
        mediaFiles,
        hasAlarm: formData.enableAlarm,
        alarmTone: formData.enableAlarm ? formData.alarmTone : null
      }) });
      toast({ title: 'Task created!' });
      setFormData({ title: '', description: '', priority: 'STANDARD', deadline: '', assigneeIds: [], groupId: '', enableAlarm: false, alarmTone: 'critical' });
      clearRecording(); onCreated(); onClose();
    } catch (error: unknown) {
      toast({ title: 'Failed to create task', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const toggleAssignee = (id: string) => setFormData((prev) => ({ ...prev, assigneeIds: prev.assigneeIds.includes(id) ? prev.assigneeIds.filter((i) => i !== id) : [...prev.assigneeIds, id] }));

  const getAlarmToneInfo = (tone: string) => {
    switch (tone) {
      case 'critical': return { label: 'Critical Alarm', color: 'text-red-400', icon: AlarmClock };
      case 'standard': return { label: 'Standard Alert', color: 'text-amber-400', icon: BellRing };
      case 'flexible': return { label: 'Gentle Reminder', color: 'text-green-400', icon: Volume2 };
      default: return { label: 'Alarm', color: 'text-primary', icon: AlarmClock };
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card neon-glow-purple max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="neon-text-purple">Create New Task</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          {/* Task Title and Priority in same row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Task Title *</Label><Input placeholder="Enter task title..." value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="bg-muted/30 border-primary/20" /></div>
            <div className="space-y-2"><Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as TaskPriority })}>
                <SelectTrigger className="bg-muted/30 border-primary/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICAL"><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" />Critical (Alarm)</div></SelectItem>
                  <SelectItem value="STANDARD"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" />Standard</div></SelectItem>
                  <SelectItem value="FLEXIBLE"><div className="flex items-center gap-2"><Zap className="w-4 h-4 text-green-500" />Flexible</div></SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between"><Label>Description</Label>
              <div className="flex gap-2">
                <AnimatedButton variant="outline" size="sm" onClick={isRecording ? stopRecording : startRecording} className={isRecording ? 'bg-red-500/20 border-red-500/50 text-red-400' : ''}>
                  {isRecording ? <><MicOff className="w-4 h-4 mr-2" />Stop ({30 - recordingTime}s)</> : <><Mic className="w-4 h-4 mr-2" />Record</>}
                </AnimatedButton>
                {audioBlob && !isRecording && (
                  <><AnimatedButton variant="outline" size="sm" onClick={transcribeAudio} disabled={transcribing}>{transcribing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Volume2 className="w-4 h-4 mr-2" />}Transcribe</AnimatedButton><AnimatedButton variant="ghost" size="sm" onClick={clearRecording}><X className="w-4 h-4" /></AnimatedButton></>
                )}
              </div>
            </div>
            <Textarea placeholder="Add details..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-muted/30 border-primary/20 min-h-[80px]" />
          </div>
          
          {/* Deadline and Assign to Group in same row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deadline (optional)</Label>
              <Input type="datetime-local" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} className="bg-muted/30 border-primary/20" />
              <p className="text-xs text-muted-foreground">
                {formData.deadline 
                  ? `Task will be deleted after the deadline` 
                  : `Task will be auto-deleted after 7 days if no deadline is set`}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Assign to Group</Label>
              <Select value={formData.groupId || "none"} onValueChange={(v) => setFormData({ ...formData, groupId: v === "none" ? "" : v, assigneeIds: [] })}>
                <SelectTrigger className="bg-muted/30 border-primary/20"><SelectValue placeholder="Select a group" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No group</SelectItem>
                  {groups.map((g) => (<SelectItem key={g.id} value={g.id}>{g.name} ({g.memberCount} members)</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Alarm Settings for all priorities */}
          <div className="p-4 rounded-lg bg-muted/20 border border-primary/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellRing className="w-4 h-4 text-primary" />
                <Label className="text-sm font-medium">Enable Alarm/Reminder</Label>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enableAlarm}
                  onChange={(e) => setFormData({ ...formData, enableAlarm: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </label>
            </div>
            
            {formData.enableAlarm && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2">
                <Label className="text-xs text-muted-foreground">Select Alarm Tone</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['critical', 'standard', 'flexible'].map((tone) => {
                    const info = getAlarmToneInfo(tone);
                    const Icon = info.icon;
                    return (
                      <div
                        key={tone}
                        onClick={() => setFormData({ ...formData, alarmTone: tone as typeof formData.alarmTone })}
                        className={`p-3 rounded-lg border cursor-pointer transition-all active:scale-95 ${
                          formData.alarmTone === tone 
                            ? 'border-primary bg-primary/20' 
                            : 'border-primary/20 hover:border-primary/50'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Icon className={`w-5 h-5 ${info.color}`} />
                          <span className="text-xs">{info.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.alarmTone === 'critical' && '🔴 Urgent alarm with persistent notification sound'}
                  {formData.alarmTone === 'standard' && '🟡 Standard alert with moderate notification'}
                  {formData.alarmTone === 'flexible' && '🟢 Gentle reminder with soft notification'}
                </p>
              </motion.div>
            )}
          </div>

          <div className="space-y-2"><Label>Assign to Members</Label>
            <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/20 border border-primary/10 max-h-32 overflow-y-auto">
              {members.filter((m) => m.role !== 'ADMIN').map((member) => (
                <Badge key={member.id} variant={formData.assigneeIds.includes(member.id) ? 'default' : 'outline'} className={`cursor-pointer transition-all active:scale-95 ${formData.assigneeIds.includes(member.id) ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/20'}`} onClick={() => toggleAssignee(member.id)}>{member.name}</Badge>
              ))}
              {members.filter((m) => m.role !== 'ADMIN').length === 0 && <span className="text-sm text-muted-foreground">No members available</span>}
            </div>
          </div>
          {business && <div className="flex items-center justify-between text-sm text-muted-foreground p-2 rounded bg-muted/20"><span>Tasks: {business.tasksUsed} / {business.taskLimit}</span><Badge variant="outline">{business.subscription}</Badge></div>}
          <div className="flex gap-2 pt-2"><AnimatedButton variant="outline" onClick={onClose} className="flex-1">Cancel</AnimatedButton><AnimatedButton onClick={handleCreate} className="flex-1 gradient-purple-blue" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}<Plus className="w-4 h-4 mr-2" />Create</AnimatedButton></div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Members Tab Component
const MembersTab = () => {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await api('/users');
      setMembers(res.members || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    setDeleting(true);
    try {
      await api('/users', { 
        method: 'DELETE', 
        body: JSON.stringify({ userId: memberId }) 
      });
      toast({ title: 'Member removed', description: 'The member has been removed from the team and notified.' });
      setMembers(members.filter(m => m.id !== memberId));
      setDeleteConfirm(null);
    } catch (error: unknown) {
      toast({ 
        title: 'Failed to remove member', 
        description: error instanceof Error ? error.message : 'Unknown error', 
        variant: 'destructive' 
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Team Members ({members.length})
          </CardTitle>
          <CardDescription>Manage your team members. Removed members will be notified and can rejoin other teams.</CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid gap-3">
        {members.map((member) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-sm text-muted-foreground">{member.email}</p>
              </div>
              <Badge variant={member.role === 'ADMIN' ? 'default' : 'secondary'} className={member.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400' : ''}>
                {member.role === 'ADMIN' ? <Crown className="w-3 h-3 mr-1" /> : null}
                {member.role}
              </Badge>
            </div>
            
            {member.role !== 'ADMIN' && (
              <div className="flex items-center gap-2">
                {deleteConfirm === member.id ? (
                  <>
                    <AnimatedButton 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setDeleteConfirm(null)}
                      disabled={deleting}
                    >
                      Cancel
                    </AnimatedButton>
                    <AnimatedButton 
                      size="sm" 
                      className="bg-red-500 hover:bg-red-600"
                      onClick={() => handleDeleteMember(member.id)}
                      disabled={deleting}
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                    </AnimatedButton>
                  </>
                ) : (
                  <AnimatedButton 
                    size="sm" 
                    variant="outline" 
                    className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                    onClick={() => setDeleteConfirm(member.id)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />Remove
                  </AnimatedButton>
                )}
              </div>
            )}
          </motion.div>
        ))}
        
        {members.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No members yet</p>
            <p className="text-sm">Share your invite code to add members</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Group Modal (Create/Edit)
const GroupModal = ({ open, onClose, onSaved, group }: { open: boolean; onClose: () => void; onSaved: () => void; group?: Group & { members?: Array<{ userId: string }> } }) => {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [formData, setFormData] = useState({ name: '', description: '', memberIds: [] as string[] });
  const { toast } = useToast();
  const isEditing = !!group;

  useEffect(() => { 
    if (open) {
      api('/users').then((res) => setMembers(res.members));
      if (group) {
        setFormData({
          name: group.name,
          description: group.description || '',
          memberIds: group.members?.map(m => m.userId) || []
        });
      } else {
        setFormData({ name: '', description: '', memberIds: [] });
      }
    }
  }, [open, group]);

  const handleSave = async () => {
    if (!formData.name.trim()) { toast({ title: 'Group name required', variant: 'destructive' }); return; }
    setLoading(true);
    try {
      if (isEditing) {
        await api('/groups', { method: 'PATCH', body: JSON.stringify({ groupId: group.id, ...formData }) });
        toast({ title: 'Group updated!' });
      } else {
        await api('/groups', { method: 'POST', body: JSON.stringify(formData) });
        toast({ title: 'Group created!' });
      }
      setFormData({ name: '', description: '', memberIds: [] }); onSaved(); onClose();
    } catch { toast({ title: 'Failed', variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const toggleMember = (id: string) => setFormData((prev) => ({ ...prev, memberIds: prev.memberIds.includes(id) ? prev.memberIds.filter((i) => i !== id) : [...prev.memberIds, id] }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card neon-glow-purple">
        <DialogHeader><DialogTitle className="neon-text-purple">{isEditing ? 'Edit Group' : 'Create Group'}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2"><Label>Group Name *</Label><Input placeholder="e.g., Shift A" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="bg-muted/30 border-primary/20" /></div>
          <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-muted/30 border-primary/20" /></div>
          <div className="space-y-2"><Label>Members ({formData.memberIds.length})</Label>
            <ScrollArea className="h-32 rounded-lg bg-muted/20 border border-primary/10 p-2">
              <div className="flex flex-wrap gap-2">{members.filter((m) => m.role !== 'ADMIN').map((m) => (<Badge key={m.id} variant={formData.memberIds.includes(m.id) ? 'default' : 'outline'} className="cursor-pointer transition-all active:scale-95" onClick={() => toggleMember(m.id)}>{m.name}</Badge>))}</div>
            </ScrollArea>
          </div>
          <div className="flex gap-2"><AnimatedButton variant="outline" onClick={onClose} className="flex-1">Cancel</AnimatedButton><AnimatedButton onClick={handleSave} className="flex-1 gradient-purple-blue" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}<Users className="w-4 h-4 mr-2" />{isEditing ? 'Update' : 'Create'}</AnimatedButton></div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Delete Confirmation Dialog
const DeleteGroupDialog = ({ open, onClose, onDeleted, group }: { open: boolean; onClose: () => void; onDeleted: () => void; group?: Group }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!group) return;
    setLoading(true);
    try {
      await api(`/groups?id=${group.id}`, { method: 'DELETE' });
      toast({ title: 'Group deleted!' });
      onDeleted(); onClose();
    } catch {
      toast({ title: 'Failed to delete group', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-card border-red-500/50 max-w-sm">
        <DialogHeader><DialogTitle className="text-red-400">Delete Group</DialogTitle></DialogHeader>
        <div className="py-4">
          <p className="text-muted-foreground">Are you sure you want to delete <strong className="text-foreground">{group?.name}</strong>?</p>
          <p className="text-sm text-muted-foreground mt-2">This action cannot be undone.</p>
        </div>
        <div className="flex gap-2">
          <AnimatedButton variant="outline" onClick={onClose} className="flex-1">Cancel</AnimatedButton>
          <AnimatedButton onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600" disabled={loading}>{loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}<Trash2 className="w-4 h-4 mr-2" />Delete</AnimatedButton>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Task Card Component
const TaskCard = ({ task, isMember, onUpdate }: { task: Task & { receipts?: { total: number; seen: number } }; isMember: boolean; onUpdate: () => void }) => {
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const handleStatus = async (status: TaskStatus) => {
    setUpdating(true);
    try { await api('/tasks', { method: 'PATCH', body: JSON.stringify({ taskId: task.id, status, assignmentId: task.assignments?.[0]?.id }) }); onUpdate(); } catch { toast({ title: 'Failed', variant: 'destructive' }); }
    finally { setUpdating(false); }
  };

  const handleDelete = async () => {
    try { await api(`/tasks?id=${task.id}`, { method: 'DELETE' }); toast({ title: 'Task deleted' }); onUpdate(); } catch { toast({ title: 'Failed', variant: 'destructive' }); }
  };

  const timeLeft = () => {
    const diff = new Date(task.expiresAt).getTime() - Date.now();
    if (diff <= 0) return { text: 'Expired', urgent: true };
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    if (days > 0) return { text: `${days}d ${hours}h left`, urgent: days <= 1 };
    return { text: `${hours}h left`, urgent: true };
  };
  const time = timeLeft();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`glass-card rounded-xl p-4 card-3d relative ${task.priority === 'CRITICAL' ? 'border-red-500/30' : task.priority === 'STANDARD' ? 'border-amber-500/20' : 'border-green-500/20'}`}>
      {time.urgent && task.status !== 'COMPLETED' && <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-red-500 to-orange-500" />}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1 flex-wrap"><PriorityBadge priority={task.priority} /><StatusBadge status={task.status} /></div>
          <h3 className="font-semibold text-lg">{task.title}</h3>
        </div>
        {!isMember && <AnimatedButton variant="ghost" size="icon" onClick={handleDelete} className="text-red-400"><Trash2 className="w-4 h-4" /></AnimatedButton>}
      </div>
      {task.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
        <span className={`flex items-center gap-1 ${time.urgent ? 'text-red-400' : ''}`}><Timer className="w-3 h-3" />{time.text}</span>
        {task.deadline && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(task.deadline).toLocaleDateString()}</span>}
      </div>
      {task.assignments && task.assignments.length > 0 && !isMember && <div className="mb-3"><div className="flex flex-wrap gap-1">{task.assignments.map((a) => (<Badge key={a.id} variant="outline" className="text-xs">{a.user?.name || 'Unknown'}{a.seenAt && <Eye className="w-3 h-3 ml-1 text-blue-400" />}</Badge>))}</div>{task.receipts && <ReadReceipts receipts={task.receipts} />}</div>}
      {isMember && (
        <div className="flex flex-wrap gap-2">
          {task.status === 'PENDING' && <AnimatedButton size="sm" onClick={() => handleStatus('SEEN')} disabled={updating} className="gradient-purple-blue"><Eye className="w-4 h-4 mr-1" />Mark as Seen</AnimatedButton>}
          {task.status === 'SEEN' && <AnimatedButton size="sm" onClick={() => handleStatus('IN_PROGRESS')} disabled={updating}><Play className="w-4 h-4 mr-1" />Start</AnimatedButton>}
          {task.status === 'IN_PROGRESS' && <AnimatedButton size="sm" className="bg-green-600" onClick={() => handleStatus('COMPLETED')} disabled={updating}><CheckCircle2 className="w-4 h-4 mr-1" />Complete</AnimatedButton>}
        </div>
      )}
    </motion.div>
  );
};

// Main Dashboard
const Dashboard = () => {
  const { user, business, logout, pendingApproval, pendingBusinessName, setPendingApproval } = useAuthStore();
  const { tasks, setTasks } = useTasksStore();
  const { groups, setGroups } = useGroupsStore();
  const { unreadCount } = useNotificationsStore();
  const { activeTab, setActiveTab, isCreateTaskOpen, setCreateTaskOpen, isCreateGroupOpen, setCreateGroupOpen } = useUIStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [joinRequestsOpen, setJoinRequestsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [isEditGroupOpen, setEditGroupOpen] = useState(false);
  const [isDeleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | undefined>();
  const [deletingGroup, setDeletingGroup] = useState<Group | undefined>();
  const { toast } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const hasBusiness = !!business;
  const notifRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (!hasBusiness) { setLoading(false); return; }
    setLoading(true);
    try { const [tRes, gRes] = await Promise.all([api('/tasks'), api('/groups')]); setTasks(tRes.tasks); setGroups(gRes.groups); } catch { }
    finally { setLoading(false); }
  }, [hasBusiness, setTasks, setGroups]);

  useEffect(() => { loadData(); }, [loadData]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if approval status has changed
  const checkApprovalStatus = async () => {
    setCheckingApproval(true);
    try {
      const res = await api('/auth/me');
      if (res.business) {
        // Approved! Update state
        setPendingApproval(false);
        window.location.reload();
      }
    } catch {
      // Ignore errors
    } finally {
      setCheckingApproval(false);
    }
  };

  const filteredTasks = tasks.filter((t) => (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description?.toLowerCase().includes(searchQuery.toLowerCase())) && (priorityFilter === 'all' || t.priority === priorityFilter));

  // Show waiting for approval screen
  if (pendingApproval && !hasBusiness) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 gradient-dark">
        <Card className="glass-card neon-glow-purple max-w-md text-center p-8">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-4"
          >
            <Clock className="w-16 h-16 text-primary" />
          </motion.div>
          <h2 className="text-2xl font-bold neon-text-purple">Waiting for Approval</h2>
          <p className="text-muted-foreground mt-2">Your request to join <strong className="text-foreground">{pendingBusinessName}</strong> is pending.</p>
          <p className="text-sm text-muted-foreground mt-4">The team admin will review and approve your request. You&apos;ll be notified once approved.</p>
          <div className="flex flex-col gap-3 mt-6">
            <AnimatedButton onClick={checkApprovalStatus} disabled={checkingApproval} className="gradient-purple-blue">
              {checkingApproval ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Check for Approval
            </AnimatedButton>
            <AnimatedButton variant="outline" onClick={() => { logout(); }} className="w-full">
              <LogOut className="w-4 h-4 mr-2" />Logout
            </AnimatedButton>
          </div>
        </Card>
      </div>
    );
  }

  if (!hasBusiness && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 gradient-dark">
        <Card className="glass-card neon-glow-purple max-w-md text-center p-8">
          <Building2 className="w-16 h-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold neon-text-purple">No Team Yet</h2>
          <p className="text-muted-foreground mt-2">You need an invite code to join a team.</p>
          <p className="text-sm text-muted-foreground mt-4">Register with your team&apos;s invite code on the registration form to request joining.</p>
          <AnimatedButton onClick={() => { logout(); }} className="w-full gradient-purple-blue mt-6"><LogOut className="w-4 h-4 mr-2" />Back to Registration</AnimatedButton>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex gradient-dark">
      <motion.aside initial={false} animate={{ width: sidebarOpen ? 256 : 72 }} className="fixed left-0 top-0 h-full glass-dark border-r border-primary/10 flex flex-col z-40">
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold neon-text-purple">NovaLuxe</h1>}
          <AnimatedButton variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu className="w-5 h-5" /></AnimatedButton>
        </div>
        <Separator className="bg-primary/10" />
        <nav className="flex-1 p-2">
          {[
            { id: 'dashboard', icon: Target, label: 'Dashboard' }, 
            { id: 'tasks', icon: CheckCircle, label: 'Tasks' }, 
            { id: 'groups', icon: Users, label: 'Groups', adminOnly: true },
            { id: 'members', icon: Shield, label: 'Members', adminOnly: true }
          ].map((item) =>
            (item.adminOnly && !isAdmin) ? null : (
              <AnimatedButton key={item.id} variant={activeTab === item.id ? 'secondary' : 'ghost'} className={`w-full justify-start mb-1 ${activeTab === item.id ? 'bg-primary/20 text-primary' : ''}`} onClick={() => setActiveTab(item.id)}>
                <item.icon className="w-5 h-5" />{sidebarOpen && <span className="ml-3">{item.label}</span>}
              </AnimatedButton>
            )
          )}
        </nav>
        <Separator className="bg-primary/10" />
        {business && sidebarOpen && (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2"><Building2 className="w-4 h-4 text-primary" /><span className="font-medium truncate">{business.name}</span></div>
            {isAdmin && <code className="text-xs px-2 py-1 rounded bg-muted/30 font-mono">{business.inviteCode}</code>}
          </div>
        )}
        <div className="p-2">
          {isAdmin && <AnimatedButton variant="ghost" className="w-full justify-start text-amber-400" onClick={() => setJoinRequestsOpen(true)}><UserPlus className="w-5 h-5" />{sidebarOpen && <span className="ml-3">Requests</span>}</AnimatedButton>}
          <AnimatedButton variant="ghost" className="w-full justify-start" onClick={() => { logout(); toast({ title: 'Logged out' }); }}><LogOut className="w-5 h-5" />{sidebarOpen && <span className="ml-3">Logout</span>}</AnimatedButton>
        </div>
      </motion.aside>

      <main className="flex-1 ml-[72px] lg:ml-[256px] transition-all duration-300 p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold neon-text-purple">{activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'tasks' ? 'Tasks' : activeTab === 'groups' ? 'Groups' : 'Members'}</h1>
            <p className="text-muted-foreground text-sm">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications Button */}
            <div className="relative" ref={notifRef}>
              <AnimatedButton variant="outline" size="icon" className="relative" onClick={() => setNotificationsOpen(!notificationsOpen)}>
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">{unreadCount}</span>
                )}
              </AnimatedButton>
              <AnimatePresence>
                {notificationsOpen && (
                  <NotificationsDropdown open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
                )}
              </AnimatePresence>
            </div>
            {isAdmin && (
              <AnimatedButton className="gradient-purple-blue" onClick={() => setCreateTaskOpen(true)}><Plus className="w-4 h-4 mr-2" />New Task</AnimatedButton>
            )}
          </div>
        </header>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Tasks', value: tasks.length, icon: Target, color: 'text-primary' },
                    { label: 'Pending', value: tasks.filter(t => t.status === 'PENDING').length, icon: Clock, color: 'text-amber-400' },
                    { label: 'In Progress', value: tasks.filter(t => t.status === 'IN_PROGRESS').length, icon: Play, color: 'text-purple-400' },
                    { label: 'Completed', value: tasks.filter(t => t.status === 'COMPLETED').length, icon: CheckCircle2, color: 'text-green-400' },
                  ].map((stat) => (
                    <Card key={stat.label} className="glass-card">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className={`p-3 rounded-lg bg-primary/10 ${stat.color}`}><stat.icon className="w-6 h-6" /></div>
                        <div><p className="text-2xl font-bold">{stat.value}</p><p className="text-sm text-muted-foreground">{stat.label}</p></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Recent Tasks */}
                <Card className="glass-card">
                  <CardHeader><CardTitle>Recent Tasks</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {filteredTasks.slice(0, 5).map((task) => (
                        <TaskCard key={task.id} task={task} isMember={!isAdmin} onUpdate={loadData} />
                      ))}
                      {filteredTasks.length === 0 && <p className="text-center text-muted-foreground py-8">No tasks found</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'tasks' && (
              <div className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]"><Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-muted/30 border-primary/20" /></div>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger className="w-40 bg-muted/30 border-primary/20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="CRITICAL">Critical</SelectItem>
                      <SelectItem value="STANDARD">Standard</SelectItem>
                      <SelectItem value="FLEXIBLE">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4">
                  {filteredTasks.map((task) => (
                    <TaskCard key={task.id} task={task} isMember={!isAdmin} onUpdate={loadData} />
                  ))}
                  {filteredTasks.length === 0 && <p className="text-center text-muted-foreground py-8">No tasks found</p>}
                </div>
              </div>
            )}

            {activeTab === 'groups' && isAdmin && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <AnimatedButton className="gradient-purple-blue" onClick={() => setCreateGroupOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Group</AnimatedButton>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {groups.map((group) => (
                    <Card key={group.id} className="glass-card">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />{group.name}</CardTitle>
                          <div className="flex gap-2">
                            <AnimatedButton variant="ghost" size="icon" onClick={() => { setEditingGroup(group); setEditGroupOpen(true); }} className="text-primary hover:bg-primary/20"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></AnimatedButton>
                            <AnimatedButton variant="ghost" size="icon" onClick={() => { setDeletingGroup(group); setDeleteGroupOpen(true); }} className="text-red-400 hover:bg-red-500/20"><Trash2 className="w-4 h-4" /></AnimatedButton>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {group.description && <p className="text-sm text-muted-foreground mb-2">{group.description}</p>}
                        <p className="text-sm text-muted-foreground">{group.memberCount || 0} members</p>
                      </CardContent>
                    </Card>
                  ))}
                  {groups.length === 0 && <p className="text-center text-muted-foreground py-8 col-span-2">No groups yet</p>}
                </div>
              </div>
            )}

            {activeTab === 'members' && isAdmin && (
              <MembersTab />
            )}
          </>
        )}
      </main>

      <CreateTaskModal open={isCreateTaskOpen} onClose={() => setCreateTaskOpen(false)} onCreated={loadData} />
      <GroupModal open={isCreateGroupOpen} onClose={() => setCreateGroupOpen(false)} onSaved={loadData} />
      <GroupModal open={isEditGroupOpen} onClose={() => { setEditGroupOpen(false); setEditingGroup(undefined); }} onSaved={loadData} group={editingGroup} />
      <DeleteGroupDialog open={isDeleteGroupOpen} onClose={() => { setDeleteGroupOpen(false); setDeletingGroup(undefined); }} onDeleted={loadData} group={deletingGroup} />
      <JoinRequestsModal open={joinRequestsOpen} onClose={() => setJoinRequestsOpen(false)} />
    </div>
  );
};

// Main App
export default function Home() {
  const { user, setBusiness, setPendingApproval } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await api('/auth/me');
        setBusiness(res.business);
        if (res.pendingApproval) {
          setPendingApproval(true, res.pendingBusinessName);
        } else {
          setPendingApproval(false);
        }
      } catch {
        useAuthStore.getState().logout();
      } finally {
        setChecking(false);
      }
    };
    checkAuth();
  }, [setBusiness, setPendingApproval]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-dark">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <CriticalAlarmModal />
      {user ? <Dashboard /> : <AuthPage />}
    </>
  );
}
