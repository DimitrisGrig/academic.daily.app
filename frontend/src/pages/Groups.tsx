import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import Loading from "../components/misc/Loading";
import { Card, Tag, Button, Tooltip, message, Modal, Badge, Avatar, Input, Popconfirm, Dropdown, Space, Spin, Select, Drawer, Switch } from "antd";
import { MessageOutlined, BellOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import {
  TeamOutlined,
  UserOutlined,
  BookOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  UserDeleteOutlined,
  LogoutOutlined,
  SearchOutlined,
  ShareAltOutlined,
  LikeOutlined,
  CommentOutlined,
  EyeOutlined,
  LockOutlined,
  GlobalOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import { useUser } from "@clerk/clerk-react";
import { HiOutlineHashtag } from "react-icons/hi";
import { IoBookmarkOutline, IoBookmark } from "react-icons/io5";
import { CiRead } from "react-icons/ci";
import { FiAward } from "react-icons/fi";
import NewGroupModal from "../components/sidebar/NewGroupModal";
import ArticleDetailsModal from "../components/mainFeed/ArticleDetailsModal";
import SelectBookmarkFolderModal from "../components/mainFeed/SelectBookmarkFolderModal";
import AddToGroupModal from "../components/shared/AddToGroupModal";
import GroupCommentsPanel from "../components/shared/GroupCommentsPanel";
import type { Group, GroupMember } from "../types/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SharedArticle {
  id: number;
  title: string;
  abstract: string;
  journal: string;
  publication_date: string | null;
  authors_full: string[] | string;
  doi: string | null;
  pmid: string | null;
  is_open_access_unpaywall: boolean;
  graphical_abstract_path: string | null;
  upvotes: number;
  shared_by_user_id: string;
  shared_by_name: string;
  issn?: string | null;
  affiliations?: string | null;
  pmcid?: string | null;
  mesh_terms?: string | null;
  figures_urls?: string[] | string | null;
  unpaywall_status?: string | null;
  similarity_score?: number;
  user_has_upvoted?: boolean;
  user_has_read?: boolean;
  comments_count?: number;
  impact_factor?: number | null;
  wos_journal?: { journal_impact_factor: number | null; five_year_impact_factor: number | null; country: string | null } | null;
  scimagojr_rankings?: { publisher: string | null; categories: string | null; areas: string | null } | null;
  publication_type?: string | null;
  created_at?: string;
}

interface SearchResult {
  id: number;
  title: string;
  journal: string;
  publication_date: string | null;
  doi: string | null;
  pmid: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatAuthors = (authors: string[] | string) => {
  if (!authors) return "Unknown authors";
  const cleanAuthor = (a: string) => a.split(":")[0].trim();
  if (typeof authors === "string") {
    const arr = authors
      .split(";")
      .map(a => cleanAuthor(a))
      .filter(a => a.length > 0);
    if (arr.length <= 3) return arr.join(", ");
    return `${arr.slice(0, 3).join(", ")} et al.`;
  }
  if (!Array.isArray(authors) || authors.length === 0) return "Unknown authors";
  const cleaned = authors.map(cleanAuthor);
  if (cleaned.length <= 3) return cleaned.join(", ");
  return `${cleaned.slice(0, 3).join(", ")} et al.`;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return "No date";
  return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const truncateAbstract = (text: string, maxLength = 200) => {
  if (!text) return "No abstract available";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

const getFirstFigureUrl = (figuresUrls: string[] | string | null | undefined): string | null => {
  if (!figuresUrls) return null;
  if (Array.isArray(figuresUrls)) return figuresUrls.length > 0 ? figuresUrls[0] : null;
  if (typeof figuresUrls === "string") {
    const urls = figuresUrls
      .split(",")
      .map(u => u.trim())
      .filter(u => u.length > 0);
    return urls.length > 0 ? urls[0] : null;
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────

function Groups() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();
  const currentUserId = user?.id || "";
  const isMountedRef = useRef(true);
  const isUpvotingRef = useRef<Set<number>>(new Set());

  const groupKey = searchParams.get("group");

  // ─── Local UI state ───────────────────────────────────────────────────────

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareSearchOpen, setIsShareSearchOpen] = useState(false);
  const [shareSearchQuery, setShareSearchQuery] = useState("");
  const [shareSearchResults, setShareSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);

  // Article modal state
  const [selectedArticle, setSelectedArticle] = useState<SharedArticle | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);

  // Bookmark state
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [articleToBookmark, setArticleToBookmark] = useState<SharedArticle | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: number[] }>({});
  const [addToGroupArticleId, setAddToGroupArticleId] = useState<number | null>(null);

  // Local articles (supports optimistic upvote / comment count updates)
  const [localArticles, setLocalArticles] = useState<SharedArticle[]>([]);

  // Filter by sharer
  const [selectedSharers, setSelectedSharers] = useState<string[]>([]);

  // Mobile discussion drawer
  const [isMobileDiscussionOpen, setIsMobileDiscussionOpen] = useState(false);

  // Notification toggle
  const [isTogglingNotif, setIsTogglingNotif] = useState(false);

  const handleToggleNotifications = async (checked: boolean) => {
    if (!groupKey) return;
    setIsTogglingNotif(true);
    try {
      await axiosInstance.post("/groups/toggle_group_notifications", {
        group_key: groupKey,
        muted: !checked,
      });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      message.success(checked ? "Notifications enabled" : "Notifications muted");
    } catch {
      message.error("Failed to update notification preference");
    } finally {
      setIsTogglingNotif(false);
    }
  };

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const { data: groupsData, isLoading: isLoadingGroups } = useQuery<{ groups: Group[] }>({
    queryKey: ["groups"],
    queryFn: async () => (await axiosInstance.get("/groups/get_groups")).data,
  });

  const currentGroup = groupsData?.groups?.find(g => g.key === groupKey);
  const isOwner = currentGroup?.admin_user_id === currentUserId;
  const isAdmin = isOwner || (currentGroup?.members ?? []).some(m => m.user_id === currentUserId && m.role === "admin" && m.status === "active");
  const isNotificationsMuted = currentGroup?.notifications_muted?.includes(currentUserId) ?? false;

  const {
    data: articlesData,
    isLoading: isLoadingArticles,
    refetch: refetchArticles,
  } = useQuery<{ articles: SharedArticle[] }>({
    queryKey: ["groupSharedArticles", groupKey],
    queryFn: async () => {
      if (!groupKey) return { articles: [] };
      return (await axiosInstance.get(`/groups/get_shared_articles?group_key=${groupKey}`)).data;
    },
    enabled: !!groupKey,
  });

  useEffect(() => {
    if (articlesData?.articles) setLocalArticles(articlesData.articles);
  }, [articlesData]);

  // Reset sharer filter when switching groups
  useEffect(() => {
    setSelectedSharers([]);
  }, [groupKey]);

  const { data: bookmarkFolders } = useQuery({
    queryKey: ["bookmarkFolders"],
    queryFn: async () => (await axiosInstance.get("/bookmarks/get_folders")).data,
  });

  const availableFolders = useMemo(() => {
    const folders: { key: string; name: string }[] = [{ key: "quick_saves", name: "Quick Saves" }];
    if (bookmarkFolders && Array.isArray(bookmarkFolders?.folders)) {
      folders.push(
        ...bookmarkFolders.folders.map((f: any) => ({
          key: f.key ?? f.id ?? f.name,
          name: f.name ?? f.title ?? f.key ?? f.id,
        }))
      );
    }
    return folders;
  }, [bookmarkFolders]);

  useEffect(() => {
    const controller = new AbortController();
    axiosInstance
      .get("/bookmarks/get_user_bookmarks", { signal: controller.signal })
      .then(r => {
        if (isMountedRef.current && r.data.saved_bookmarks) setUserBookmarks(r.data.saved_bookmarks);
      })
      .catch(err => {
        if (err.name !== "CanceledError" && isMountedRef.current) setUserBookmarks({});
      });
    return () => controller.abort();
  }, []);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const deleteGroupMutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.post("/groups/delete_group", { key: groupKey });
    },
    onSuccess: () => {
      message.success("Group deleted");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      navigate("/MainFeed?loc=MainFeed");
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to delete group");
    },
  });

  const leaveGroupMutation = useMutation({
    mutationFn: async () => {
      await axiosInstance.post("/groups/leave_group", { group_key: groupKey });
    },
    onSuccess: () => {
      message.success("Left the group");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      navigate("/MainFeed?loc=MainFeed");
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to leave group");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await axiosInstance.post("/groups/remove_member", { group_key: groupKey, user_id: memberId });
    },
    onSuccess: () => {
      message.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to remove member");
    },
  });

  const removeArticleMutation = useMutation({
    mutationFn: async (articleId: number) => {
      await axiosInstance.post("/groups/remove_shared_article", { group_key: groupKey, article_id: articleId });
    },
    onSuccess: () => {
      message.success("Article removed from group");
      refetchArticles();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to remove article");
    },
  });

  const promoteToAdminMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await axiosInstance.post("/groups/promote_to_admin", { group_key: groupKey, user_id: memberId });
    },
    onSuccess: () => {
      message.success("Member promoted to admin");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to promote member");
    },
  });

  const demoteFromAdminMutation = useMutation({
    mutationFn: async (memberId: string) => {
      await axiosInstance.post("/groups/demote_from_admin", { group_key: groupKey, user_id: memberId });
    },
    onSuccess: () => {
      message.success("Admin role removed");
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.detail || "Failed to demote member");
    },
  });

  // ─── Article handlers ─────────────────────────────────────────────────────

  const handleOpenArticle = (article: SharedArticle) => {
    if (article.doi) window.open(`https://doi.org/${article.doi}`, "_blank");
    else if (article.pmid) window.open(`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`, "_blank");
  };

  const handleCardClick = (article: SharedArticle) => {
    const current = localArticles.find(a => a.id === article.id) || article;
    setSelectedArticle(current);
    setIsModalOpen(true);
    if (isMountedRef.current) setLocalArticles(prev => prev.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)));
    axiosInstance.post("/user_actions/article_click", { article_id: article.id }).catch(() => {});
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
    setIsAbstractExpanded(false);
  };

  const handleUpvote = async (article: SharedArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpvotingRef.current.has(article.id)) return;
    isUpvotingRef.current.add(article.id);

    const wasUpvoted = article.user_has_upvoted;
    const optimisticUpvotes = wasUpvoted ? Math.max(0, article.upvotes - 1) : article.upvotes + 1;

    // Optimistic update so UI responds instantly
    const applyUpdate = (upvotes: number, upvoted: boolean) => (a: SharedArticle) =>
      a.id === article.id ? { ...a, upvotes, user_has_upvoted: upvoted } : a;

    setLocalArticles(prev => prev.map(applyUpdate(optimisticUpvotes, !wasUpvoted)));
    if (selectedArticle?.id === article.id) setSelectedArticle(prev => (prev ? applyUpdate(optimisticUpvotes, !wasUpvoted)(prev) : null));

    try {
      const res = await axiosInstance.post("/user_actions/upvote", { article_id: article.id, undo: wasUpvoted });
      if (res.data.success && isMountedRef.current) {
        // Reconcile with authoritative server values
        setLocalArticles(prev => prev.map(applyUpdate(res.data.upvotes, res.data.user_has_upvoted)));
        if (selectedArticle?.id === article.id)
          setSelectedArticle(prev => (prev ? applyUpdate(res.data.upvotes, res.data.user_has_upvoted)(prev) : null));
        message.success(wasUpvoted ? "Upvote removed" : "Article upvoted!");
      }
    } catch {
      // Roll back optimistic update on failure
      if (isMountedRef.current) {
        setLocalArticles(prev => prev.map(applyUpdate(article.upvotes, !!wasUpvoted)));
        if (selectedArticle?.id === article.id) setSelectedArticle(prev => (prev ? applyUpdate(article.upvotes, !!wasUpvoted)(prev) : null));
        message.error("Failed to upvote article");
      }
    } finally {
      isUpvotingRef.current.delete(article.id);
    }
  };

  const isArticleBookmarked = (articleId: number) => Object.values(userBookmarks).some(ids => ids.includes(articleId));
  const getArticleBookmarkFolders = (articleId: number) => Object.keys(userBookmarks).filter(k => userBookmarks[k]?.includes(articleId));

  const handleBookmarkClick = (article: SharedArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    setArticleToBookmark(article);
    setSelectedFolder(null);
    setIsBookmarkModalOpen(true);
  };

  const handleSaveBookmark = () => {
    if (!articleToBookmark || !selectedFolder) {
      message.warning("Please select a folder");
      return;
    }
    const folderObj = availableFolders.find(f => f.key === selectedFolder) || { key: selectedFolder, name: selectedFolder };
    const articleId = articleToBookmark.id;
    const fk = folderObj.key;
    if (isMountedRef.current) {
      setUserBookmarks(prev => {
        const ex = prev[fk] || [];
        return ex.includes(articleId) ? prev : { ...prev, [fk]: [...ex, articleId] };
      });
      setIsBookmarkModalOpen(false);
      setArticleToBookmark(null);
      setSelectedFolder(null);
      setTimeout(() => {
        if (isMountedRef.current) message.success(`Article saved to ${folderObj.name}!`);
      }, 0);
    }
    axiosInstance
      .post("/bookmarks/save_bookmark", { article_id: articleId, folder_name: folderObj.name, folder_key: fk })
      .then(r => {
        if (r.data.saved_bookmarks && isMountedRef.current) setUserBookmarks(r.data.saved_bookmarks);
      })
      .catch(() => {
        if (isMountedRef.current) {
          setUserBookmarks(prev => ({ ...prev, [fk]: (prev[fk] || []).filter(id => id !== articleId) }));
          message.error("Failed to save bookmark");
        }
      });
  };

  const handleDeleteBookmark = (article: SharedArticle, e: React.MouseEvent) => {
    e.stopPropagation();
    const articleId = article.id;
    const folders = getArticleBookmarkFolders(articleId);
    if (!folders.length) {
      message.warning("Article is not bookmarked");
      return;
    }
    if (isMountedRef.current) {
      setUserBookmarks(prev => {
        const u = { ...prev };
        folders.forEach(f => {
          u[f] = u[f].filter(id => id !== articleId);
        });
        return u;
      });
      setTimeout(() => {
        if (isMountedRef.current) message.success("Bookmark removed from all folders");
      }, 0);
    }
    Promise.all(folders.map(f => axiosInstance.post("/bookmarks/delete_bookmark", { article_id: articleId, folder_key: f })))
      .then(rs => {
        const last = rs[rs.length - 1];
        if (last.data.saved_bookmarks && isMountedRef.current) setUserBookmarks(last.data.saved_bookmarks);
      })
      .catch(() => {
        if (isMountedRef.current) {
          setUserBookmarks(prev => {
            const u = { ...prev };
            folders.forEach(f => {
              if (!u[f]?.includes(articleId)) u[f] = [...(u[f] || []), articleId];
            });
            return u;
          });
          message.error("Failed to remove bookmark");
        }
      });
  };

  const handleShareArticle = (article: SharedArticle, platform?: "linkedin" | "twitter" | "facebook" | "copyLink") => {
    const url = article.doi ? `https://doi.org/${article.doi}` : article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : null;
    if (!url) {
      message.warning("No DOI or PMID available to share");
      return;
    }
    if (!platform || platform === "copyLink") {
      navigator.clipboard.writeText(url).then(() => message.success("Link copied!"));
    } else if (platform === "linkedin")
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, "_blank", "width=600,height=600");
    else if (platform === "twitter")
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(article.title)}`,
        "_blank",
        "width=600,height=600"
      );
    else if (platform === "facebook")
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "width=600,height=600");
  };

  const shareMenuItems = (article: SharedArticle): MenuProps["items"] => [
    { key: "copy", label: "Copy Link", icon: <ShareAltOutlined />, onClick: () => handleShareArticle(article) },
    { key: "linkedin", label: "Share on LinkedIn", onClick: () => handleShareArticle(article, "linkedin") },
    { key: "twitter", label: "Share on X (Twitter)", onClick: () => handleShareArticle(article, "twitter") },
    { key: "facebook", label: "Share on Facebook", onClick: () => handleShareArticle(article, "facebook") },
  ];

  const handleUpdateCommentCount = (articleId: number, newCount: number) => {
    if (!isMountedRef.current) return;
    setLocalArticles(prev => prev.map(a => (a.id === articleId ? { ...a, comments_count: newCount } : a)));
    if (selectedArticle?.id === articleId) setSelectedArticle(prev => (prev ? { ...prev, comments_count: newCount } : null));
  };

  // ─── Group search & share ──────────────────────────────────────────────────

  const handleShareSearch = async () => {
    if (!shareSearchQuery.trim()) return;
    setIsSearching(true);
    try {
      const r = await axiosInstance.get(`/search/global?query=${encodeURIComponent(shareSearchQuery)}&limit=15`);
      setShareSearchResults(r.data.articles || []);
    } catch {
      message.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleShareArticleToGroup = async (articleId: number) => {
    const sharedByName =
      user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.primaryEmailAddress?.emailAddress || "";
    try {
      await axiosInstance.post("/groups/share_article", { group_key: groupKey, article_id: articleId, shared_by_name: sharedByName });
      message.success("Article shared to group!");
      setIsShareSearchOpen(false);
      setShareSearchQuery("");
      setShareSearchResults([]);
      refetchArticles();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to share article");
    }
  };

  // ─── Derived article state (must be before any conditional returns) ────────

  // Sort by shared date descending (most recently added first)
  const sortedArticles = useMemo(() => [...localArticles].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")), [localArticles]);

  // Unique sharers for filter options
  const sharerOptions = useMemo(() => {
    const seen = new Map<string, string>();
    sortedArticles.forEach(a => {
      if (!seen.has(a.shared_by_user_id)) seen.set(a.shared_by_user_id, a.shared_by_name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [sortedArticles]);

  // Filtered articles
  const articles = useMemo(
    () => (selectedSharers.length === 0 ? sortedArticles : sortedArticles.filter(a => selectedSharers.includes(a.shared_by_user_id))),
    [sortedArticles, selectedSharers]
  );

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (!groupKey)
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <TeamOutlined className="text-5xl! text-gray-300! mb-4!" />
          <p className="text-gray-500 text-lg mb-2">Select a group to view shared articles</p>
          <p className="text-gray-400 text-sm mb-4">Or discover public groups and connect with other researchers</p>
          <Button icon={<GlobalOutlined />} onClick={() => navigate("/FindGroups")} className="border-sky-400! text-sky-500! hover:bg-sky-50!">
            Find groups
          </Button>
        </div>
      </div>
    );

  if (isLoadingGroups || isLoadingArticles) return <Loading />;

  if (!currentGroup)
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <p className="text-gray-500 text-lg">Group not found</p>
      </div>
    );

  const activeMembers = (currentGroup.members || []).filter(m => m.status === "active" && m.user_id !== currentUserId);
  const pendingMembers = (currentGroup.members || []).filter(m => m.status === "invited");
  const currentUserMember = (currentGroup.members || []).find(m => m.user_id === currentUserId);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span className="text-3xl">{currentGroup.icon}</span>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-700 leading-tight">{currentGroup.name}</h1>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Tooltip
                    title={
                      <div className="text-xs">
                        <p className="font-semibold mb-1">Active members ({currentGroup.member_count})</p>
                        <p className="text-gray-200">• You (admin/member)</p>
                        {activeMembers.map(m => (
                          <p key={m.user_id} className="text-gray-200">
                            • {m.email}
                          </p>
                        ))}
                        {pendingMembers.length > 0 && (
                          <>
                            <p className="font-semibold mt-2 mb-1 text-yellow-300">Pending invites ({pendingMembers.length})</p>
                            {pendingMembers.map(m => (
                              <p key={m.user_id} className="text-yellow-200">
                                • {m.email}
                              </p>
                            ))}
                          </>
                        )}
                      </div>
                    }
                    placement="bottom"
                  >
                    <button
                      className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-sky-600 cursor-pointer"
                      onClick={() => setIsMembersModalOpen(true)}
                    >
                      <TeamOutlined />
                      <span>
                        {currentGroup.member_count} member{currentGroup.member_count !== 1 ? "s" : ""}
                      </span>
                      {pendingMembers.length > 0 && <Badge count={pendingMembers.length} size="small" color="orange" />}
                    </button>
                  </Tooltip>
                  <Tooltip title={currentGroup.is_public ? "Public group. Anyone can discover it" : "Private group — invite only"}>
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                        currentGroup.is_public ? "bg-sky-50 border-sky-200 text-sky-600" : "bg-gray-50 border-gray-200 text-gray-500"
                      }`}
                    >
                      {currentGroup.is_public ? <GlobalOutlined /> : <LockOutlined />}
                      {currentGroup.is_public ? "Public" : "Private"}
                    </span>
                  </Tooltip>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                icon={<ShareAltOutlined />}
                type="primary"
                className="bg-sky-600! border-sky-600! hover:bg-sky-700!"
                onClick={() => setIsShareSearchOpen(true)}
              >
                Share article in group
              </Button>
              {isAdmin && (
                <>
                  <Button icon={<EditOutlined />} onClick={() => setIsEditModalOpen(true)}>
                    Edit group
                  </Button>
                  <Button icon={<TeamOutlined />} onClick={() => setIsMembersModalOpen(true)}>
                    Members
                  </Button>
                  <Popconfirm
                    title="Delete group"
                    description="Are you sure? This cannot be undone."
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                    onConfirm={() => deleteGroupMutation.mutate()}
                  >
                    <Button icon={<DeleteOutlined />} danger loading={deleteGroupMutation.isPending}>
                      Delete group
                    </Button>
                  </Popconfirm>
                </>
              )}
              {!isAdmin && (
                <>
                  <Button icon={<TeamOutlined />} onClick={() => setIsMembersModalOpen(true)}>
                    Members
                  </Button>
                  <Popconfirm
                    title="Leave group"
                    description="Are you sure you want to leave?"
                    okText="Leave"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancel"
                    onConfirm={() => leaveGroupMutation.mutate()}
                  >
                    <Button icon={<LogoutOutlined />} danger loading={leaveGroupMutation.isPending}>
                      Leave group
                    </Button>
                  </Popconfirm>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            <p className="text-sm text-gray-500 m-0">
              {articles.length} shared article{articles.length !== 1 ? "s" : ""}
            </p>
            {sharerOptions.length > 0 && (
              <Select
                mode="multiple"
                allowClear
                placeholder="Filter by member…"
                value={selectedSharers}
                onChange={setSelectedSharers}
                options={sharerOptions}
                maxTagCount="responsive"
                className="min-w-[200px] max-w-sm rounded-lg! border-gray-300! focus:border-sky-500! focus:ring-sky-500!"
                size="small"
              />
            )}
            <Tooltip
              title={isNotificationsMuted ? "You won't receive notifications when articles are shared" : "Get notified when articles are shared"}
            >
              <div className="flex items-center gap-1.5 ml-auto">
                <BellOutlined className={`text-sm ${isNotificationsMuted ? "text-gray-300" : "text-sky-500"}`} />
                <Switch size="small" checked={!isNotificationsMuted} onChange={handleToggleNotifications} loading={isTogglingNotif} />
                <span className="text-xs text-gray-400 hidden sm:inline">Notifications</span>
              </div>
            </Tooltip>
          </div>
          {currentGroup.tags && currentGroup.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {currentGroup.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Two-column layout: articles left, discussion right */}
        <div className="flex gap-4">
          {/* Left column — articles */}
          <div className="flex-1 min-w-0">
            {/* Empty state */}
            {articles.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShareAltOutlined className="text-5xl! text-gray-300! mb-4!" />
                <p className="text-gray-500 text-lg mb-2">No articles shared yet</p>
                <p className="text-gray-400 text-sm mb-4">Be the first to share an article with this group</p>
                <Button
                  type="primary"
                  icon={<ShareAltOutlined />}
                  className="bg-sky-600! border-sky-600! hover:bg-sky-700!"
                  onClick={() => setIsShareSearchOpen(true)}
                >
                  Share an article
                </Button>
              </div>
            )}

            {/* Articles grid — same card as MainFeed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {articles.map(article => (
                <Card
                  key={article.id}
                  hoverable
                  className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl!"
                  styles={{ body: { padding: "12px", display: "flex", flexDirection: "column", height: "100%" } }}
                  onClick={() => handleCardClick(article)}
                >
                  {/* Shared-by badge */}
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-gray-400">
                    <Avatar size={18} icon={<UserOutlined />} className="bg-sky-500!" />
                    <span>
                      Shared by <span className="font-medium text-sky-600">{article.shared_by_name}</span>
                    </span>
                    {article.created_at && <span className="text-gray-300">·</span>}
                    {article.created_at && <span className="text-gray-400">{formatDate(article.created_at)}</span>}
                  </div>

                  {/* Tags row */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1 flex flex-wrap gap-1">
                      {article.user_has_read && (
                        <Tag color="default" className="mr-1! border-gray-400! bg-gray-50!">
                          <span className="flex items-center gap-1 text-gray-600!">
                            <CiRead className="text-base!" /> Viewed
                          </span>
                        </Tag>
                      )}
                      {article.is_open_access_unpaywall && (
                        <Tag color="green" className="mr-1! text-lime-600!">
                          Open Access
                        </Tag>
                      )}
                      {article.publication_type && <Tag color="blue">{article.publication_type}</Tag>}
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-gray-900 mb-3 leading-tight">{article.title}</h3>

                  {/* Authors */}
                  <div className="flex items-start gap-2 mb-2 text-sm text-gray-600">
                    <UserOutlined className="mt-1 shrink-0" />
                    <span className="line-clamp-2">{formatAuthors(article.authors_full)}</span>
                  </div>

                  {/* Journal & dates */}
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <BookOutlined className="shrink-0" />
                      <span className="line-clamp-1">{article.journal || "Unknown journal"}</span>
                    </div>
                    {article.wos_journal?.journal_impact_factor && (
                      <div className="flex! justify-start! items-center! gap-2!">
                        <span className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                          <FiAward className="text-amber-700! w-3 h-3" />
                          <span className="text-amber-700!">Impact Factor: {article.wos_journal.journal_impact_factor.toFixed(1)}</span>
                        </span>
                      </div>
                    )}
                    {article.created_at && (
                      <div className="flex items-center gap-2 pt-1 border-t border-dashed border-gray-200">
                        <CalendarOutlined className="shrink-0 text-sky-600!" />
                        <span className="text-gray-500!">First online: {formatDate(article.created_at)}</span>
                      </div>
                    )}
                    {article.publication_date && (
                      <div className="flex items-center gap-2">
                        <CalendarOutlined className="shrink-0 text-sky-600!" />
                        <span className="text-gray-500">
                          Publication date: {new Date(article.publication_date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* MeSH Terms */}
                  {article.mesh_terms && article.mesh_terms.trim().length > 0 && (
                    <>
                      <hr className="text-gray-400 border-0.5 border-dashed! my-2" />
                      <p className="font-semibold text-xs! text-gray-600 mb-1! flex items-center gap-1!">
                        <HiOutlineHashtag className="text-orange-500!" /> Tags:
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mb-2">
                        {(() => {
                          const parsed = article
                            .mesh_terms!.split(";")
                            .map(t => t.trim())
                            .filter(t => t.length > 0)
                            .map(term => {
                              const main = term.split("/")[0].trim();
                              const hasAsterisk = main.includes("*");
                              return { display: hasAsterisk ? main.slice(0, -1).trim() : main, hasAsterisk };
                            });
                          const unique = Array.from(
                            parsed
                              .reduce((map, t) => {
                                const ex = map.get(t.display);
                                if (!ex || (!ex.hasAsterisk && t.hasAsterisk)) map.set(t.display, t);
                                return map;
                              }, new Map())
                              .values()
                          );
                          const sorted = unique.sort((a, b) => (a.hasAsterisk && !b.hasAsterisk ? -1 : !a.hasAsterisk && b.hasAsterisk ? 1 : 0));
                          const display = sorted.slice(0, 3);
                          const rest = sorted.length - 3;
                          return (
                            <>
                              {display.map((t, i) => (
                                <Tag
                                  key={i}
                                  className={`text-xs! m-0! ${t.hasAsterisk ? "text-gray-600! border-gray-200!" : "text-gray-700! border-gray-200!"}`}
                                >
                                  # {t.display}
                                </Tag>
                              ))}
                              {rest > 0 && (
                                <Tag className="text-xs! bg-gray-100! text-gray-600! border-gray-300! m-0! font-semibold!">+{rest} more</Tag>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </>
                  )}

                  {/* Divider */}
                  <div className="flex items-center w-full gap-2 px-2">
                    <hr className="grow border-t border-dashed border-gray-400" />
                    <span className="text-gray-500">•</span>
                    <hr className="grow border-t border-dashed border-gray-400" />
                  </div>

                  {/* Graphical abstract / figure / text abstract */}
                  {article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls) ? (
                    <div className="mb-2 grow flex items-center justify-center overflow-hidden">
                      <img
                        src={article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls) || ""}
                        alt={article.graphical_abstract_path ? "Graphical Abstract" : "Figure"}
                        className="w-full h-auto object-contain max-h-48"
                        // Block display if image fails to load or is too small, and show abstract text instead
                        onLoad={e => {
                          const img = e.currentTarget;
                          if (img.naturalWidth < 300 && img.naturalHeight < 200) {
                            img.style.display = "none";
                            const fallback = img.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "block";
                          }
                        }}
                        onError={e => {
                          e.currentTarget.style.display = "none";
                          const fb = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fb) fb.style.display = "block";
                        }}
                      />
                      <p className="text-sm text-gray-700 p-3 line-clamp-4 hidden">{truncateAbstract(article.abstract)}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 line-clamp-4 grow">{truncateAbstract(article.abstract)}</p>
                  )}

                  {/* Footer actions */}
                  <div className="mt-auto pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                    <div className="w-full flex justify-center mb-2">
                      <Space size="small">
                        <Button
                          type="default"
                          onClick={e => {
                            e.stopPropagation();
                            handleCardClick(article);
                          }}
                          className="h-8! px-2! bg-indigo-400! text-white! hover:shadow-md! transition-all! duration-200! border-gray-300! hover:border-sky-500! hover:text-sky-700! hover:bg-white!"
                        >
                          Read More <EyeOutlined className="text-md!" />
                        </Button>
                      </Space>
                    </div>

                    <div className="flex items-center justify-around w-full pt-2 border-t border-gray-100 gap-1">
                      <Tooltip title={article.user_has_upvoted ? "Remove upvote" : "Upvote"}>
                        <Button
                          type="text"
                          icon={<LikeOutlined className="text-base! sm:text-lg!" />}
                          onClick={e => handleUpvote(article, e)}
                          className={`rounded-md! px-2! min-w-0! ${article.user_has_upvoted ? "text-green-500! bg-green-50!" : "text-gray-500 hover:text-green-500! hover:bg-green-100!"}`}
                        >
                          <span className="text-xs ml-1">{article.upvotes || 0}</span>
                        </Button>
                      </Tooltip>
                      <Tooltip title="Comments">
                        <Button
                          type="text"
                          icon={<CommentOutlined className="text-base! sm:text-lg!" />}
                          onClick={e => {
                            e.stopPropagation();
                            handleCardClick(article);
                          }}
                          className="text-gray-500 hover:text-indigo-500! hover:bg-indigo-100! rounded-md! px-2! min-w-0!"
                        >
                          <span className="text-xs ml-1">{article.comments_count || 0}</span>
                        </Button>
                      </Tooltip>
                      <Tooltip title={isArticleBookmarked(article.id) ? "Remove from bookmarks" : "Save to bookmarks"}>
                        <Button
                          type="text"
                          icon={
                            isArticleBookmarked(article.id) ? (
                              <IoBookmark className="text-base! sm:text-lg!" />
                            ) : (
                              <IoBookmarkOutline className="text-base! sm:text-lg!" />
                            )
                          }
                          onClick={e => (isArticleBookmarked(article.id) ? handleDeleteBookmark(article, e) : handleBookmarkClick(article, e))}
                          className={`rounded-md! px-2! min-w-0! ${isArticleBookmarked(article.id) ? "text-orange-500! bg-orange-50!" : "text-gray-500 hover:text-orange-500! hover:bg-orange-100!"}`}
                        />
                      </Tooltip>
                      <Tooltip title="Share to Group">
                        <Button
                          type="text"
                          icon={<TeamOutlined className="text-base! sm:text-lg!" />}
                          onClick={e => {
                            e.stopPropagation();
                            setAddToGroupArticleId(article.id);
                          }}
                          className="text-gray-500 hover:text-sky-500! hover:bg-sky-100! rounded-md! px-2! min-w-0!"
                        />
                      </Tooltip>
                      <Dropdown menu={{ items: shareMenuItems(article) }} trigger={["click"]}>
                        <Tooltip title="Share">
                          <Button
                            type="text"
                            icon={<ShareAltOutlined className="text-base! sm:text-lg!" />}
                            onClick={e => e.stopPropagation()}
                            className="text-gray-500 hover:text-sky-500! hover:bg-sky-100! rounded-md! px-2! min-w-0!"
                          />
                        </Tooltip>
                      </Dropdown>
                    </div>

                    {/* Remove from group */}
                    {(isAdmin || article.shared_by_user_id === currentUserId) && (
                      <div className="mt-2 pt-2 border-t border-dashed border-gray-100 flex justify-end">
                        <Popconfirm
                          title="Remove article"
                          description="Remove this article from the group?"
                          okText="Remove"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                          onConfirm={e => {
                            e?.stopPropagation();
                            removeArticleMutation.mutate(article.id);
                          }}
                        >
                          <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}>
                            Remove
                          </Button>
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {removeArticleMutation.isPending && (
              <div className="flex justify-center py-4">
                <Spin />
              </div>
            )}
          </div>

          {/* Right column — Group Discussion (desktop) */}
          <div className="hidden lg:block w-[340px] xl:w-[380px] shrink-0 sticky top-4 self-start" style={{ maxHeight: "calc(100vh - 100px)" }}>
            <GroupCommentsPanel groupKey={groupKey} isAdmin={isAdmin} />
          </div>
        </div>
      </div>

      {/* Mobile floating button for group discussion */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<MessageOutlined className="text-lg!" />}
          onClick={() => setIsMobileDiscussionOpen(true)}
          className="w-14! h-14! bg-sky-500! border-sky-500! hover:bg-sky-600! shadow-lg! hover:shadow-xl! transition-all! duration-200! flex! items-center! justify-center!"
          style={{ boxShadow: "0 4px 20px rgba(14, 165, 233, 0.4)" }}
        />
      </div>

      {/* Mobile discussion drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <MessageOutlined className="text-sky-500!" />
            <span className="font-semibold text-gray-700">Group Discussion</span>
          </div>
        }
        placement="bottom"
        open={isMobileDiscussionOpen}
        onClose={() => setIsMobileDiscussionOpen(false)}
        height="85vh"
        className="rounded-t-2xl!"
        styles={{
          header: { borderBottom: "1px solid #f0f0f0", padding: "12px 16px" },
          body: { padding: 0, display: "flex", flexDirection: "column" as const },
        }}
      >
        <div className="flex-1 h-full">
          <GroupCommentsPanel groupKey={groupKey} isAdmin={isAdmin} embedded />
        </div>
      </Drawer>

      {/* Article Detail Modal */}
      <ArticleDetailsModal
        isOpen={isModalOpen}
        article={selectedArticle as any}
        isAbstractExpanded={isAbstractExpanded}
        userBookmarks={userBookmarks}
        availableFolders={availableFolders}
        onClose={handleCloseModal}
        onOpenArticle={handleOpenArticle as any}
        onUpvote={handleUpvote as any}
        onBookmarkClick={handleBookmarkClick as any}
        onDeleteBookmark={handleDeleteBookmark as any}
        onShareArticle={handleShareArticle as any}
        onSetAbstractExpanded={setIsAbstractExpanded}
        isArticleBookmarked={isArticleBookmarked}
        onUpdateCommentCount={handleUpdateCommentCount}
      />

      {/* Bookmark folder modal */}
      <SelectBookmarkFolderModal
        isBookmarkModalOpen={isBookmarkModalOpen}
        handleSaveBookmark={handleSaveBookmark}
        setIsBookmarkModalOpen={setIsBookmarkModalOpen}
        setArticleToBookmark={setArticleToBookmark as any}
        setSelectedFolder={setSelectedFolder}
        availableFolders={availableFolders}
        selectedFolder={selectedFolder}
        articleToBookmark={articleToBookmark}
      />

      {/* Add to group modal */}
      <AddToGroupModal articleId={addToGroupArticleId} isOpen={addToGroupArticleId !== null} onClose={() => setAddToGroupArticleId(null)} />

      {/* Edit group modal */}
      <NewGroupModal
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={() => {
          setIsEditModalOpen(false);
          queryClient.invalidateQueries({ queryKey: ["groups"] });
        }}
        editingGroup={currentGroup}
      />

      {/* Members modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <TeamOutlined /> Members of {currentGroup.name}
          </div>
        }
        open={isMembersModalOpen}
        onCancel={() => setIsMembersModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsMembersModalOpen(false)}>
            Close
          </Button>,
          isAdmin && (
            <Button
              key="invite"
              type="primary"
              onClick={() => {
                setIsMembersModalOpen(false);
                setIsEditModalOpen(true);
              }}
            >
              Invite more
            </Button>
          ),
        ]}
      >
        <div className="mt-3 space-y-2">
          {/* Owner/current-user row */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 border border-purple-100">
            <div className="flex items-center gap-2">
              <Avatar icon={<UserOutlined />} className="bg-purple-500!" size={28} />
              <div>
                <span className="text-sm font-medium">You</span>
                {isOwner ? (
                  <Tag color="purple" className="ml-2! text-xs!" icon={<CrownOutlined />}>
                    Owner
                  </Tag>
                ) : currentUserMember?.role === "admin" ? (
                  <Tag color="purple" className="ml-2! text-xs!" icon={<CrownOutlined />}>
                    Admin
                  </Tag>
                ) : (
                  <Tag color="blue" className="ml-2! text-xs!">
                    Member
                  </Tag>
                )}
              </div>
            </div>
          </div>
          {activeMembers.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Members ({activeMembers.length})</p>
              {activeMembers.map((m: GroupMember) => (
                <div key={m.user_id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Avatar icon={<UserOutlined />} className={m.role === "admin" ? "bg-purple-400!" : "bg-sky-500!"} size={28} />
                    <span className="text-sm text-gray-700">{m.email}</span>
                    {m.role === "admin" && (
                      <Tag color="purple" className="text-xs!" icon={<CrownOutlined />}>
                        Admin
                      </Tag>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isOwner &&
                      (m.role === "admin" ? (
                        <Popconfirm
                          title="Remove admin role"
                          description={`Remove admin privileges from ${m.email}?`}
                          okText="Remove"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                          onConfirm={() => demoteFromAdminMutation.mutate(m.user_id)}
                        >
                          <Button
                            size="small"
                            type="text"
                            className="text-orange-500!"
                            icon={<CrownOutlined />}
                            loading={demoteFromAdminMutation.isPending}
                            title="Remove admin role"
                          />
                        </Popconfirm>
                      ) : (
                        <Popconfirm
                          title="Promote to admin"
                          description={`Give ${m.email} admin privileges?`}
                          okText="Promote"
                          cancelText="Cancel"
                          onConfirm={() => promoteToAdminMutation.mutate(m.user_id)}
                        >
                          <Button
                            size="small"
                            type="text"
                            className="text-purple-500!"
                            icon={<CrownOutlined />}
                            loading={promoteToAdminMutation.isPending}
                            title="Promote to admin"
                          />
                        </Popconfirm>
                      ))}
                    {isAdmin && (
                      <Popconfirm
                        title="Remove member"
                        description={`Remove ${m.email}?`}
                        okText="Remove"
                        okButtonProps={{ danger: true }}
                        cancelText="Cancel"
                        onConfirm={() => removeMemberMutation.mutate(m.user_id)}
                      >
                        <Button size="small" danger type="text" icon={<UserDeleteOutlined />} loading={removeMemberMutation.isPending} />
                      </Popconfirm>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          {pendingMembers.length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-1">Pending invites ({pendingMembers.length})</p>
              {pendingMembers.map((m: GroupMember) => (
                <div key={m.user_id} className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-100">
                  <div className="flex items-center gap-2">
                    <Avatar icon={<UserOutlined />} className="bg-orange-400!" size={28} />
                    <span className="text-sm text-gray-600">{m.email}</span>
                    <Tag color="orange" className="text-xs!">
                      Invited
                    </Tag>
                  </div>
                  {isAdmin && (
                    <Popconfirm
                      title="Cancel invite"
                      description={`Cancel invite for ${m.email}?`}
                      okText="Cancel invite"
                      okButtonProps={{ danger: true }}
                      cancelText="Keep"
                      onConfirm={() => removeMemberMutation.mutate(m.user_id)}
                    >
                      <Button size="small" danger type="text" icon={<DeleteOutlined />} loading={removeMemberMutation.isPending} />
                    </Popconfirm>
                  )}
                </div>
              ))}
            </>
          )}
          {activeMembers.length === 0 && pendingMembers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No other members yet. Use "Invite more" to add members.</p>
          )}
        </div>
      </Modal>

      {/* Share article search modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <ShareAltOutlined /> Share an article to {currentGroup.name}
          </div>
        }
        open={isShareSearchOpen}
        onCancel={() => {
          setIsShareSearchOpen(false);
          setShareSearchQuery("");
          setShareSearchResults([]);
        }}
        footer={null}
        width={680}
      >
        <div className="mt-3">
          <Input.Search
            placeholder="Search for a paper by title, keyword, or author…"
            value={shareSearchQuery}
            onChange={e => setShareSearchQuery(e.target.value)}
            onSearch={handleShareSearch}
            onPressEnter={handleShareSearch}
            loading={isSearching}
            enterButton={<Button icon={<SearchOutlined />}>Search</Button>}
            className="mb-4"
          />
          {isSearching && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Spin size="large" />
              <p className="text-sm text-gray-400">Searching papers…</p>
            </div>
          )}
          {!isSearching && shareSearchResults.length > 0 && (
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {shareSearchResults.map(r => (
                <div
                  key={r.id}
                  className="p-3 border border-gray-200 rounded-lg hover:border-sky-400 hover:bg-sky-50 transition-all flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{r.journal}</p>
                    {r.publication_date && <p className="text-xs text-gray-400">{formatDate(r.publication_date)}</p>}
                  </div>
                  <Button
                    size="small"
                    type="primary"
                    className="shrink-0 bg-sky-600! border-sky-600! hover:bg-sky-700!"
                    onClick={() => handleShareArticleToGroup(r.id)}
                  >
                    Share
                  </Button>
                </div>
              ))}
            </div>
          )}
          {shareSearchResults.length === 0 && shareSearchQuery && !isSearching && <p className="text-center text-gray-400 py-6">No results found.</p>}
          {!shareSearchQuery && <p className="text-center text-gray-400 text-sm py-6">Search for a paper to share it with the group.</p>}
        </div>
      </Modal>
    </>
  );
}

export default Groups;
