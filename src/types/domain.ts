export type UserRole = 'user' | 'admin';
export type PostStatus = 'draft' | 'published';
export type ModerationStatus = 'pending' | 'approved' | 'hidden';

export interface User {
  id: string;
  githubId: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  bio: string;
  role: UserRole;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  role: UserRole;
  csrfToken: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  parentId: string;
  sortOrder: number;
  postCount?: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  postCount?: number;
}

export interface PostSummary {
  id: string;
  title: string;
  slug: string;
  summary: string;
  coverImage: string;
  status: PostStatus;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  viewCount: number;
  wordCount: number;
  commentCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  categories: Category[];
  tags: Tag[];
}

export interface PostDetail extends PostSummary {
  content: string;
  renderedContent?: string;
  relatedPosts?: PostSummary[];
}

export interface CommentItem {
  id: string;
  postId: string;
  userId: string;
  parentId: string;
  content: string;
  status: ModerationStatus;
  userName: string;
  userAvatar: string;
  createdAt: string;
  replies?: CommentItem[];
}

export interface GuestbookItem {
  id: string;
  userId: string;
  parentId: string;
  name: string;
  website: string;
  avatarUrl: string;
  content: string;
  status: ModerationStatus;
  createdAt: string;
  replies?: GuestbookItem[];
}

export interface SiteProfile {
  name: string;
  bio: string;
  avatar: string;
  motto: string;
  announcement: string;
  about: string;
  icp: string;
  startedAt: string;
  socialLinks: Array<{ label: string; url: string }>;
}

export interface SiteSummary {
  postCount: number;
  commentCount: number;
  guestbookCount: number;
  totalWords: number;
  totalViews: number;
  runningDays: number;
}
