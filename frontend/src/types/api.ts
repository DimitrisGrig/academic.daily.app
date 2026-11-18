export interface User {
    user_id: string
    email: string
    session_id: string
}

export interface ProtectedResponse {
    message: string
    user: User
}

export interface PublicResponse {
    message: string
}

export interface OptionalAuthResponse {
    message: string
    authenticated: boolean
    user_id?: string
}

export interface ApiError {
    detail: string
}

export interface Feed {
    key: string
    name: string
    icon: string
    tags: string[]
}

export interface FeedsResponse {
    feeds: Feed[]
}

export interface JournalFollow {
    key: string
    name: string
    icon: string
    journals?: string[]
    default_sorting?: string
    time_range?: string
    publication_types?: string[]
    graphical_abstract_only?: boolean
    open_access_only?: boolean
}

export interface JournalFollowsResponse {
    journal_follows: JournalFollow[]
}

export interface BookmarkFolder {
    key: string
    name: string
    icon: string
}

export interface BookmarkFoldersResponse {
    folders: BookmarkFolder[]
}

export interface GroupMember {
    user_id: string
    email: string
    status: "invited" | "active"
    role?: "member" | "admin"
}

export interface Group {
    key: string
    name: string
    icon: string
    admin_user_id: string
    is_admin: boolean
    member_count: number
    members: GroupMember[]
    is_public?: boolean
    tags?: string[]
    notifications_muted?: string[]
    created_at?: string
}

export interface GroupsResponse {
    groups: Group[]
}

export interface GroupInvite {
    key: string
    name: string
    icon: string
    admin_user_id: string
}

export interface GroupInvitesResponse {
    invites: GroupInvite[]
}
