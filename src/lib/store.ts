import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Types - Updated for PRD v2.0
export type UserRole = 'ADMIN' | 'MEMBER';
export type TaskPriority = 'CRITICAL' | 'STANDARD' | 'FLEXIBLE';
export type TaskStatus = 'PENDING' | 'SEEN' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
export type SubscriptionTier = 'FREE' | 'PRO' | 'UNLIMITED';
export type MediaType = 'AUDIO' | 'IMAGE' | 'DOCUMENT';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  businessId?: string;
  createdAt: string;
}

export interface Business {
  id: string;
  name: string;
  founderName: string;
  businessType: string;
  description?: string;
  workerCount: number;
  inviteCode: string;
  subscription: SubscriptionTier;
  taskLimit: number;
  tasksUsed: number;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  businessId: string;
  memberCount?: number;
}

export interface TaskMedia {
  id: string;
  taskId: string;
  type: MediaType;
  url: string;
  fileName?: string;
  fileSize?: number;
  duration?: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string;
  expiresAt: string;
  teamId?: string; // Keep for backward compatibility
  businessId?: string;
  creatorId: string;
  creator?: User;
  groupId?: string;
  group?: Group;
  media?: TaskMedia[];
  assignments?: Assignment[];
  createdAt: string;
}

export interface Assignment {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
  status: TaskStatus;
  seenAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Notification {
  id: string;
  taskId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  readAt?: string;
  expiresAt?: string;
  createdAt: string;
  task?: Task;
}

export interface JoinRequest {
  id: string;
  businessId: string;
  userId: string;
  user?: User;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

// Alarm State for Critical Tasks
interface AlarmState {
  isActive: boolean;
  taskId: string | null;
  taskTitle: string | null;
  startTime: number | null;
  acknowledged: boolean;
  audioElement: HTMLAudioElement | null;
  
  triggerAlarm: (taskId: string, taskTitle: string) => void;
  stopAlarm: () => void;
  acknowledgeAlarm: () => void;
}

export const useAlarmStore = create<AlarmState>()((set, get) => ({
  isActive: false,
  taskId: null,
  taskTitle: null,
  startTime: null,
  acknowledged: false,
  audioElement: null,
  
  triggerAlarm: (taskId, taskTitle) => {
    // Create audio element for alarm
    const audio = new Audio('/alarm.mp3');
    audio.loop = true;
    audio.volume = 1.0;
    
    // Try to play (will work if user has interacted with page)
    audio.play().catch(() => {
      console.log('Audio autoplay blocked - will play on user interaction');
    });
    
    set({
      isActive: true,
      taskId,
      taskTitle,
      startTime: Date.now(),
      acknowledged: false,
      audioElement: audio,
    });
    
    // Request notification permission and show notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 CRITICAL TASK', {
        body: taskTitle,
        tag: `critical-${taskId}`,
        requireInteraction: true,
        silent: false,
      });
    }
  },
  
  stopAlarm: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    set({
      isActive: false,
      taskId: null,
      taskTitle: null,
      startTime: null,
      audioElement: null,
    });
  },
  
  acknowledgeAlarm: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }
    set({
      isActive: false,
      acknowledged: true,
      audioElement: null,
    });
  },
}));

// Auth Store
interface AuthState {
  user: User | null;
  business: Business | null;
  team: Business | null; // Alias for backward compatibility
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  pendingApproval: boolean;
  pendingBusinessName: string | null;
  
  setUser: (user: User | null) => void;
  setBusiness: (business: Business | null) => void;
  setTeam: (team: Business | null) => void; // Alias
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setPendingApproval: (pending: boolean, businessName?: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      business: null,
      team: null,
      token: null,
      isLoading: true,
      isInitialized: false,
      pendingApproval: false,
      pendingBusinessName: null,
      
      setUser: (user) => set({ user }),
      setBusiness: (business) => set({ business, team: business }),
      setTeam: (team) => set({ team, business: team }),
      setToken: (token) => set({ token }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      setPendingApproval: (pendingApproval, pendingBusinessName = null) => set({ pendingApproval, pendingBusinessName }),
      logout: () => set({ user: null, business: null, team: null, token: null, pendingApproval: false, pendingBusinessName: null }),
    }),
    {
      name: 'novaluxe-auth',
      partialize: (state) => ({ 
        user: state.user, 
        business: state.business, 
        team: state.team, 
        token: state.token,
        pendingApproval: state.pendingApproval,
        pendingBusinessName: state.pendingBusinessName,
      }),
    }
  )
);

// Tasks Store with caching
interface TasksState {
  tasks: Task[];
  currentTask: Task | null;
  isLoading: boolean;
  lastSync: number | null;
  
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setCurrentTask: (task: Task | null) => void;
  setLoading: (loading: boolean) => void;
  setLastSync: (time: number) => void;
}

export const useTasksStore = create<TasksState>()((set) => ({
  tasks: [],
  currentTask: null,
  isLoading: false,
  lastSync: null,
  
  setTasks: (tasks) => set({ tasks, lastSync: Date.now() }),
  addTask: (task) => set((state) => ({ tasks: [task, ...state.tasks] })),
  updateTask: (id, updates) => set((state) => ({
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    currentTask: state.currentTask?.id === id ? { ...state.currentTask, ...updates } : state.currentTask,
  })),
  removeTask: (id) => set((state) => ({
    tasks: state.tasks.filter((t) => t.id !== id),
    currentTask: state.currentTask?.id === id ? null : state.currentTask,
  })),
  setCurrentTask: (task) => set({ currentTask: task }),
  setLoading: (isLoading) => set({ isLoading }),
  setLastSync: (lastSync) => set({ lastSync }),
}));

// Groups Store
interface GroupsState {
  groups: Group[];
  isLoading: boolean;
  
  setGroups: (groups: Group[]) => void;
  addGroup: (group: Group) => void;
  updateGroup: (id: string, updates: Partial<Group>) => void;
  removeGroup: (id: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useGroupsStore = create<GroupsState>()((set) => ({
  groups: [],
  isLoading: false,
  
  setGroups: (groups) => set({ groups }),
  addGroup: (group) => set((state) => ({ groups: [group, ...state.groups] })),
  updateGroup: (id, updates) => set((state) => ({
    groups: state.groups.map((g) => (g.id === id ? { ...g, ...updates } : g)),
  })),
  removeGroup: (id) => set((state) => ({
    groups: state.groups.filter((g) => g.id !== id),
  })),
  setLoading: (isLoading) => set({ isLoading }),
}));

// Notifications Store
interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  criticalCount: number;
  isLoading: boolean;
  
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setLoading: (loading: boolean) => void;
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  criticalCount: 0,
  isLoading: false,
  
  setNotifications: (notifications) => set({ 
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    criticalCount: notifications.filter((n) => !n.read && n.type.includes('CRITICAL')).length,
  }),
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: notification.read ? state.unreadCount : state.unreadCount + 1,
    criticalCount: notification.read ? state.criticalCount : 
      (notification.type.includes('CRITICAL') ? state.criticalCount + 1 : state.criticalCount),
  })),
  markAsRead: (id) => set((state) => {
    const notification = state.notifications.find((n) => n.id === id);
    return {
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
      criticalCount: notification?.type.includes('CRITICAL') ? 
        Math.max(0, state.criticalCount - 1) : state.criticalCount,
    };
  }),
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
    unreadCount: 0,
    criticalCount: 0,
  })),
  setLoading: (isLoading) => set({ isLoading }),
}));

// Join Requests Store (for admins)
interface JoinRequestsState {
  requests: JoinRequest[];
  isLoading: boolean;
  
  setRequests: (requests: JoinRequest[]) => void;
  addRequest: (request: JoinRequest) => void;
  updateRequest: (id: string, status: 'APPROVED' | 'REJECTED') => void;
  setLoading: (loading: boolean) => void;
}

export const useJoinRequestsStore = create<JoinRequestsState>()((set) => ({
  requests: [],
  isLoading: false,
  
  setRequests: (requests) => set({ requests }),
  addRequest: (request) => set((state) => ({ requests: [request, ...state.requests] })),
  updateRequest: (id, status) => set((state) => ({
    requests: state.requests.filter((r) => r.id !== id),
  })),
  setLoading: (isLoading) => set({ isLoading }),
}));

// UI Store
interface UIState {
  activeTab: string;
  isSidebarOpen: boolean;
  isCreateTaskOpen: boolean;
  isCreateGroupOpen: boolean;
  isNotificationsOpen: boolean;
  isAlarmModalOpen: boolean;
  editingTask: Task | null;
  
  setActiveTab: (tab: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setCreateTaskOpen: (open: boolean) => void;
  setCreateGroupOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  setAlarmModalOpen: (open: boolean) => void;
  setEditingTask: (task: Task | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  activeTab: 'dashboard',
  isSidebarOpen: true,
  isCreateTaskOpen: false,
  isCreateGroupOpen: false,
  isNotificationsOpen: false,
  isAlarmModalOpen: false,
  editingTask: null,
  
  setActiveTab: (activeTab) => set({ activeTab }),
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  setCreateTaskOpen: (isCreateTaskOpen) => set({ isCreateTaskOpen }),
  setCreateGroupOpen: (isCreateGroupOpen) => set({ isCreateGroupOpen }),
  setNotificationsOpen: (isNotificationsOpen) => set({ isNotificationsOpen }),
  setAlarmModalOpen: (isAlarmModalOpen) => set({ isAlarmModalOpen }),
  setEditingTask: (editingTask) => set({ editingTask }),
}));
