export interface User {
  id: string;
  name: string;
  email: string;
  role: 'parent' | 'child';
}

export interface FamilyMember extends User {
  dateOfBirth?: string;
  avatar?: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  participants: string[]; // User IDs
  location?: string;
  category?: 'school' | 'sports' | 'medical' | 'social' | 'other';
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  completed: boolean;
  assignedTo: string[]; // User IDs
  priority: 'low' | 'medium' | 'high';
} 