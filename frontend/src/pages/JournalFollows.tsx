import { useSearchParams, useNavigate } from "react-router-dom";
import axiosInstance from "../lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Loading from "../components/misc/Loading";
import { Card, Tag, Button, Space, Tooltip, Dropdown, message, Spin, Modal } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  UserOutlined,
  LikeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  CheckOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  TrophyOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useState, useEffect, useRef, useMemo } from "react";
import { BsSortDownAlt } from "react-icons/bs";
import { BsFillJournalBookmarkFill } from "react-icons/bs";
import type { MenuProps } from "antd";
import { HiOutlineHashtag } from "react-icons/hi";
import { IoBookmarkOutline, IoBookmark } from "react-icons/io5";
import SelectBookmarkFolderModal from "../components/mainFeed/SelectBookmarkFolderModal";
import AddToGroupModal from "../components/shared/AddToGroupModal";
import ArticleDetailsModal from "../components/mainFeed/ArticleDetailsModal";
import { CiRead } from "react-icons/ci";
import { FaLocationDot } from "react-icons/fa6";
import { getLastAuthorCountry } from "../lib/authorCountries";
import NewJournalFollowModal from "../components/sidebar/NewJournalFollowModal";
import { FiAward } from "react-icons/fi";
import GeoDatasetTag from "../components/mainFeed/GeoDatasetTag";

interface Article {
  id: number;
  publication_type: string | null;
  issn: string | null;
  title: string;
  abstract: string;
  journal: string;
  publication_date: string;
  created_at?: string;
  authors_full: string[] | string;
  affiliations: string | null;
  doi: string | null;
  pmcid: string | null;
  pmid: string | null;
  mesh_terms: string | null;
  figures_urls: string[] | string | null;
  unpaywall_status: string | null;
  is_open_access_unpaywall: boolean;
  graphical_abstract_path: string | null;
  similarity_score: number;
  upvotes: number;
  user_has_upvoted: boolean;
  user_has_read: boolean;
  comments_count?: number;
  impact_factor?: number | null;
  wos_journal?: {
    journal_impact_factor: number | null;
    five_year_impact_factor: number | null;
    country: string | null;
  } | null;
  scimagojr_rankings?: {
    publisher: string | null;
    categories: string | null;
    areas: string | null;
  } | null;
  journal_icon_url?: string | null;
}

function JournalFollows() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const followKey = searchParams.get("follow");

  const [displayedArticles, setDisplayedArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "upvotes" | "clicks">("date");
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [addToGroupArticleId, setAddToGroupArticleId] = useState<number | null>(null);
  const [articleToBookmark, setArticleToBookmark] = useState<Article | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: number[] }>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [ifFilter, setIfFilter] = useState<number | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 20;

  const { data: journalFollowsData } = useQuery({
    queryKey: ["journalFollows"],
    queryFn: async () => {
      const response = await axiosInstance.get("/customFeeds/get_journal_follows");
      return response.data;
    },
  });

  const currentFollowName = useMemo(() => {
    if (!journalFollowsData?.journal_follows || !followKey) return "Journal Follow";
    const follow = journalFollowsData.journal_follows.find((f: any) => f.key === followKey);
    return follow?.name || "Journal Follow";
  }, [journalFollowsData, followKey]);

  const currentFollow = useMemo(() => {
    if (!journalFollowsData?.journal_follows || !followKey) return null;
    return journalFollowsData.journal_follows.find((f: any) => f.key === followKey) || null;
  }, [journalFollowsData, followKey]);

  useEffect(() => {
    if (currentFollow?.default_sorting) {
      const sortMapping: { [key: string]: "date" | "upvotes" | "clicks" } = {
        date: "date",
        upvotes: "upvotes",
        clicks: "clicks",
        recommended: "date",
      };
      setSortBy(sortMapping[currentFollow.default_sorting] || "date");
    }
  }, [currentFollow?.default_sorting, followKey]);

  const { data: articles, isLoading: isLoadingArticles } = useQuery<Article[]>({
    queryKey: ["journalFollowArticles", followKey],
    queryFn: async () => {
      if (!followKey) return [];
      const response = await axiosInstance.get(`/customFeeds/get_recommended_by_faiss_feed?feed_key=${followKey}&k=1000`);
      return response.data;
    },
    enabled: !!followKey,
  });

  const { data: bookmarkFolders } = useQuery({
    queryKey: ["bookmarkFolders"],
    queryFn: async () => {
      const response = await axiosInstance.get("/bookmarks/get_folders");
      return response.data;
    },
  });

  const sortedArticles = useMemo(() => {
    if (!articles) return [];
    return [...articles].sort((a, b) => {
      if (sortBy === "date") {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : new Date(a.publication_date).getTime();
        const dateB = b.created_at ? new Date(b.created_at).getTime() : new Date(b.publication_date).getTime();
        return dateB - dateA;
      } else if (sortBy === "upvotes") {
        return b.upvotes - a.upvotes;
      } else if (sortBy === "clicks") {
        return (b as any).clicks || 0 - (a as any).clicks || 0;
      }
      return 0;
    });
  }, [articles, sortBy]);

  const filteredArticles = useMemo(() => {
    if (ifFilter === null) return sortedArticles;
    return sortedArticles.filter(a => {
      const jif = a.wos_journal?.journal_impact_factor ?? null;
      return jif !== null && jif >= ifFilter;
    });
  }, [sortedArticles, ifFilter]);

  const availableFolders = useMemo(() => {
    const folders: { key: string; name: string }[] = [{ key: "quick_saves", name: "Quick Saves" }];
    if (bookmarkFolders && Array.isArray(bookmarkFolders?.folders)) {
      const mapped = bookmarkFolders.folders.map((folder: any) => ({
        key: folder.key ?? folder.id ?? folder.name,
        name: folder.name ?? folder.title ?? folder.key ?? folder.id,
      }));
      folders.push(...mapped);
    }
    return folders;
  }, [bookmarkFolders]);

  useEffect(() => {
    axiosInstance
      .get("/bookmarks/get_user_bookmarks")
      .then(response => {
        if (response.data.saved_bookmarks) {
          setUserBookmarks(response.data.saved_bookmarks);
        }
      })
      .catch(() => setUserBookmarks({}));
  }, []);

  useEffect(() => {
    if (filteredArticles && filteredArticles.length > 0) {
      setDisplayedArticles(filteredArticles.slice(0, ITEMS_PER_PAGE));
      setHasMore(filteredArticles.length > ITEMS_PER_PAGE);
      setPage(1);
    } else if (filteredArticles && filteredArticles.length === 0) {
      setDisplayedArticles([]);
      setHasMore(false);
    }
  }, [filteredArticles]);

  useEffect(() => {
    const articleId = searchParams.get("article");
    if (articleId && displayedArticles.length > 0) {
      let article = displayedArticles.find(a => a.id === parseInt(articleId));
      if (!article && filteredArticles) {
        article = filteredArticles.find(a => a.id === parseInt(articleId));
      }
      if (article) {
        setSelectedArticle(article);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, filteredArticles, displayedArticles]);

  const loadMoreArticles = () => {
    if (!filteredArticles || !hasMore) return;
    const nextPage = page + 1;
    const startIndex = page * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newArticles = filteredArticles.slice(startIndex, endIndex);
    if (newArticles.length > 0) {
      setDisplayedArticles(prev => [...prev, ...newArticles]);
      setPage(nextPage);
      setHasMore(endIndex < filteredArticles.length);
    } else {
      setHasMore(false);
    }
  };

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoadingArticles) loadMoreArticles();
      },
      { threshold: 0.1 }
    );
    const currentLoader = loaderRef.current;
    observer.observe(currentLoader);
    return () => {
      if (currentLoader) observer.unobserve(currentLoader);
    };
  }, [hasMore, isLoadingArticles, page]);

  if (!followKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 text-lg">Please select a journal follow to view articles</p>
      </div>
    );
  }

  if (isLoadingArticles) return <Loading />;

  const formatAuthors = (authors: string[] | string) => {
    if (!authors) return "Unknown authors";
    const cleanAuthor = (a: string) => a.split(":")[0].trim();
    let cleaned: string[];
    if (typeof authors === "string") {
      cleaned = authors
        .split(";")
        .map(a => cleanAuthor(a))
        .filter(a => a.length > 0);
    } else if (!Array.isArray(authors) || authors.length === 0) {
      return "Unknown authors";
    } else {
      cleaned = authors.map(cleanAuthor);
    }
    if (cleaned.length === 0) return "Unknown authors";
    if (cleaned.length <= 2) return cleaned.join(", ");
    return `${cleaned[0]}, ... ${cleaned[cleaned.length - 1]}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const handleOpenArticle = (article: Article) => {
    if (article.doi) {
      window.open(`https://doi.org/${article.doi}`, "_blank");
    } else if (article.pmid) {
      window.open(`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`, "_blank");
    }
  };

  const getFirstFigureUrl = (figuresUrls: string[] | string | null): string | null => {
    if (!figuresUrls) return null;
    if (Array.isArray(figuresUrls)) return figuresUrls.length > 0 ? figuresUrls[0] : null;
    if (typeof figuresUrls === "string") {
      const urls = figuresUrls
        .split(",")
        .map((url: string) => url.trim())
        .filter((url: string) => url.length > 0);
      return urls.length > 0 ? urls[0] : null;
    }
    return null;
  };

  const handleCardClick = (article: Article) => {
    const currentArticle = displayedArticles.find(a => a.id === article.id) || article;
    setSelectedArticle(currentArticle);
    setIsModalOpen(true);
    setSearchParams({ follow: followKey!, article: article.id.toString() });
    setDisplayedArticles(prev => prev.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)));
    axiosInstance.post("/user_actions/article_click", { article_id: article.id }).catch(console.error);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
    setIsAbstractExpanded(false);
    setSearchParams({ follow: followKey! });
  };

  const handleShareArticle = (article: Article, platform?: "linkedin" | "twitter" | "facebook" | "copyLink") => {
    const doiUrl = article.doi ? `https://doi.org/${article.doi}` : article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : null;
    if (!doiUrl) {
      message.warning("No DOI or PMID available to share");
      return;
    }
    if (platform === "copyLink" || !platform) {
      navigator.clipboard.writeText(doiUrl).then(() => message.success("Link copied to clipboard!"));
    } else if (platform === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(doiUrl)}`, "_blank", "width=600,height=600");
    } else if (platform === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(doiUrl)}&text=${encodeURIComponent(article.title)}`,
        "_blank",
        "width=600,height=600"
      );
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(doiUrl)}`, "_blank", "width=600,height=600");
    }
  };

  const handleUpvote = async (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await axiosInstance.post("/user_actions/upvote", { article_id: article.id, undo: article.user_has_upvoted });
      if (response.data.success) {
        const updateArticle = (art: Article) =>
          art.id === article.id ? { ...art, upvotes: response.data.upvotes, user_has_upvoted: response.data.user_has_upvoted } : art;
        setDisplayedArticles(prev => prev.map(updateArticle));
        if (selectedArticle?.id === article.id) setSelectedArticle(prev => (prev ? updateArticle(prev) : null));
        message.success(article.user_has_upvoted ? "Upvote removed" : "Article upvoted!");
      }
    } catch {
      message.error("Failed to upvote article");
    }
  };

  const handleBookmarkClick = (article: Article, e: React.MouseEvent) => {
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
    const folderObj = availableFolders.find((f: { key: string; name: string }) => f.key === selectedFolder) || {
      key: selectedFolder,
      name: selectedFolder,
    };
    const articleId = articleToBookmark.id;
    const folderKey = folderObj.key;
    setUserBookmarks(prev => {
      const folderArticles = prev[folderKey] || [];
      if (!folderArticles.includes(articleId)) return { ...prev, [folderKey]: [...folderArticles, articleId] };
      return prev;
    });
    setIsBookmarkModalOpen(false);
    setArticleToBookmark(null);
    setSelectedFolder(null);
    setTimeout(() => message.success(`Article saved to ${folderObj.name}!`), 0);
    axiosInstance
      .post("/bookmarks/save_bookmark", { article_id: articleId, folder_name: folderObj.name, folder_key: folderKey })
      .then(response => {
        if (response.data.saved_bookmarks) setUserBookmarks(response.data.saved_bookmarks);
      })
      .catch(() => {
        setUserBookmarks(prev => {
          const folderArticles = prev[folderKey] || [];
          return { ...prev, [folderKey]: folderArticles.filter(id => id !== articleId) };
        });
        message.error("Failed to save bookmark");
      });
  };

  const isArticleBookmarked = (articleId: number) => Object.values(userBookmarks).some(ids => ids.includes(articleId));

  const getArticleBookmarkFolders = (articleId: number) => Object.keys(userBookmarks).filter(fk => userBookmarks[fk]?.includes(articleId));

  const handleUpdateCommentCount = (articleId: number, newCount: number) => {
    setDisplayedArticles(prev => prev.map(article => (article.id === articleId ? { ...article, comments_count: newCount } : article)));
    if (selectedArticle?.id === articleId) setSelectedArticle(prev => (prev ? { ...prev, comments_count: newCount } : null));
  };

  const handleDeleteBookmark = (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();
    const articleId = article.id;
    const foldersContainingArticle = getArticleBookmarkFolders(articleId);
    if (foldersContainingArticle.length === 0) {
      message.warning("Article is not bookmarked");
      return;
    }
    setUserBookmarks(prev => {
      const updated = { ...prev };
      foldersContainingArticle.forEach(fk => {
        updated[fk] = updated[fk].filter(id => id !== articleId);
      });
      return updated;
    });
    setTimeout(() => message.success("Bookmark removed from all folders"), 0);
    Promise.all(foldersContainingArticle.map(fk => axiosInstance.post("/bookmarks/delete_bookmark", { article_id: articleId, folder_key: fk })))
      .then(responses => {
        const last = responses[responses.length - 1];
        if (last.data.saved_bookmarks) setUserBookmarks(last.data.saved_bookmarks);
      })
      .catch(() => {
        setUserBookmarks(prev => {
          const updated = { ...prev };
          foldersContainingArticle.forEach(fk => {
            if (!updated[fk]?.includes(articleId)) updated[fk] = [...(updated[fk] || []), articleId];
          });
          return updated;
        });
        message.error("Failed to remove bookmark");
      });
  };

  const shareMenuItems = (article: Article): MenuProps["items"] => [
    { key: "copy", label: "Copy Link", icon: <ShareAltOutlined />, onClick: () => handleShareArticle(article) },
    { key: "linkedin", label: "Share on LinkedIn", onClick: () => handleShareArticle(article, "linkedin") },
    { key: "twitter", label: "Share on X (Twitter)", onClick: () => handleShareArticle(article, "twitter") },
    { key: "facebook", label: "Share on Facebook", onClick: () => handleShareArticle(article, "facebook") },
  ];

  const handleDeleteFollow = () => {
    Modal.confirm({
      title: "Delete Journal Follow",
      content: `Are you sure you want to delete "${currentFollowName}"? This action cannot be undone.`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await axiosInstance.post("/customFeeds/delete_feed", { key: followKey });
          message.success("Journal follow deleted successfully");
          queryClient.invalidateQueries({ queryKey: ["journalFollows"] });
          navigate("/MainFeed");
        } catch (error: any) {
          message.error(error?.response?.data?.detail || "Failed to delete. Please try again.");
        }
      },
    });
  };

  const handleEditModalOk = () => {
    setIsEditModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["journalFollows"] });
    queryClient.invalidateQueries({ queryKey: ["journalFollowArticles"] });
  };

  const sortMenuItems: MenuProps["items"] = [
    {
      key: "date",
      label: (
        <div className="flex items-center justify-between gap-3">
          <span>By Date (Newest)</span>
          {sortBy === "date" && <CheckOutlined className="text-blue-600!" />}
        </div>
      ),
      onClick: () => setSortBy("date"),
    },
    {
      key: "upvotes",
      label: (
        <div className="flex items-center justify-between gap-3">
          <span>By Upvotes</span>
          {sortBy === "upvotes" && <CheckOutlined className="text-blue-600!" />}
        </div>
      ),
      onClick: () => setSortBy("upvotes"),
    },
    {
      key: "clicks",
      label: (
        <div className="flex items-center justify-between gap-3">
          <span>By Clicks</span>
          {sortBy === "clicks" && <CheckOutlined className="text-blue-600!" />}
        </div>
      ),
      onClick: () => setSortBy("clicks"),
    },
  ];

  return (
    <>
      <div className="max-w-[1920px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BsFillJournalBookmarkFill className="text-xl! sm:text-2xl! text-sky-600! shrink-0!" />
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-600 truncate">
                <span className="hidden sm:inline">Follow Journals / </span>
                <span className="sm:hidden"> / </span>
                {currentFollowName}
              </h1>
            </div>
            <div className="flex gap-1 sm:gap-2 shrink-0">
              <Tooltip title="Edit journal follow">
                <Button
                  type="default"
                  icon={<EditOutlined />}
                  onClick={() => setIsEditModalOpen(true)}
                  className="bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-blue-500! hover:text-blue-600! hover:bg-blue-50! shadow-sm! hover:shadow-md! transition-all! duration-200! px-2 sm:px-4!"
                >
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </Tooltip>
              <Tooltip title="Delete journal follow">
                <Button
                  type="default"
                  icon={<DeleteOutlined />}
                  onClick={handleDeleteFollow}
                  className="bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-red-500! hover:text-red-600! hover:bg-red-50! shadow-sm! hover:shadow-md! transition-all! duration-200! px-2 sm:px-4!"
                >
                  <span className="hidden sm:inline">Delete</span>
                </Button>
              </Tooltip>
              <Dropdown menu={{ items: sortMenuItems }} trigger={["click"]}>
                <Button
                  type="default"
                  icon={<BsSortDownAlt className="text-lg!" />}
                  className="bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-purple-500! hover:text-purple-600! hover:bg-purple-50! shadow-sm! hover:shadow-md! transition-all! duration-200! px-2 sm:px-4!"
                >
                  <span className="hidden sm:inline">Sort</span>
                </Button>
              </Dropdown>
            </div>
          </div>
          <p className="text-sm sm:text-base text-gray-600">
            {ifFilter !== null ? `${filteredArticles.length} of ${sortedArticles.length}` : articles?.length || 0} articles
          </p>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-xs font-semibold text-gray-500 tracking-wide shrink-0 flex items-center gap-1">
              <FiAward className="text-sm text-amber-700" />
              Impact Factor:
            </span>
            <div className="flex items-center flex-wrap gap-1.5">
              {([null, 5, 10, 20, 30] as (number | null)[]).map(val => (
                <button
                  key={val ?? "all"}
                  onClick={() => setIfFilter(val)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-150 cursor-pointer ${
                    ifFilter === val
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                  }`}
                >
                  {val === null ? "All" : `≥ ${val}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-4">
          {displayedArticles?.map(article => (
            <Card
              key={article.id}
              hoverable
              className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl!"
              styles={{ body: { padding: "16px", display: "flex", flexDirection: "column", height: "100%" } }}
              onClick={() => handleCardClick(article)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 flex flex-wrap gap-1">
                  {article.user_has_read && (
                    <Tag color="default" className="mr-1! border-gray-400! bg-gray-50!">
                      <span className="flex items-center gap-1 text-gray-600!">
                        <CiRead className="text-base!" />
                        Viewed
                      </span>
                    </Tag>
                  )}
                  {article.is_open_access_unpaywall && (
                    <Tag color="green" className="mr-1! text-lime-600!">
                      Open Access
                    </Tag>
                  )}
                  {article.publication_type && <Tag color="blue">{article.publication_type}</Tag>}
                  <GeoDatasetTag pmid={article.pmid} />
                </div>
              </div>

              <h3 className="text-base font-semibold text-gray-900 mb-3 leading-tight">{article.title}</h3>

              <div className="flex items-start gap-2 mb-2 text-sm text-gray-600">
                <UserOutlined className="mt-1 shrink-0" />
                <div className="min-w-0">
                  <span className="line-clamp-2">{formatAuthors(article.authors_full)}</span>
                  {(() => {
                    const country = getLastAuthorCountry(article.authors_full, article.affiliations);
                    if (!country) return null;
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Tag
                          color="default"
                          className="text-xs! m-0! px-1.5! py-0! leading-5! border-gray-300! flex! items-center! gap-0.5! inline-flex!"
                        >
                          <FaLocationDot className="text-gray-500! shrink-0 mr-0.5!" />
                          <span>{country}</span>
                        </Tag>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  {article.journal_icon_url ? (
                    <img
                      src={article.journal_icon_url}
                      alt=""
                      className="w-4 h-4 shrink-0 rounded-sm object-contain"
                      onError={e => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <BookOutlined className="shrink-0" />
                  )}
                  <span className="line-clamp-1">{article.journal || "Unknown journal"}</span>
                </div>
                {article.wos_journal?.journal_impact_factor && (
                  <div className="flex! justify-start! items-center! gap-2!">
                    <span className="text-xs font-semibold text-slate-400 py-0.5 rounded-md! flex items-center gap-1 border-1 px-1! border-slate-300! bg-yellow-50!">
                      <TrophyOutlined className="text-yellow-600!" />
                      <span className="px-2">Impact Factor: {article.wos_journal.journal_impact_factor.toFixed(1)}</span>
                    </span>
                  </div>
                )}
                {article.created_at && (
                  <div className="flex items-center gap-2 pt-1 border-t border-dashed border-gray-200">
                    <CalendarOutlined className="shrink-0 text-sky-600!" />
                    <span className="text-gray-500!">First online: {formatDate(article.created_at)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <CalendarOutlined className="shrink-0 text-sky-600!" />
                  <span className="text-gray-500!">
                    Publication date: {new Date(article.publication_date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                  </span>
                </div>
              </div>

              {article?.mesh_terms && article.mesh_terms.trim().length > 0 && (
                <>
                  <hr className="text-gray-400 border-0.5 border-dashed! my-2" />
                  <p className="font-semibold text-xs! text-gray-600 mb-1! flex items-center gap-1!">
                    <HiOutlineHashtag className="text-orange-500!" />
                    Tags:
                  </p>
                  <div className="flex flex-wrap items-center gap-1 mb-2">
                    {(() => {
                      const parsedTerms = article.mesh_terms
                        .split(";")
                        .map(t => t.trim())
                        .filter(t => t.length > 0)
                        .map(term => {
                          const mainTerm = term.split("/")[0].trim();
                          const hasAsterisk = mainTerm.includes("*");
                          const displayTerm = hasAsterisk ? mainTerm.slice(0, -1).trim() : mainTerm;
                          return { display: displayTerm, hasAsterisk };
                        });
                      const uniqueTerms = Array.from(
                        parsedTerms
                          .reduce((map, term) => {
                            const existing = map.get(term.display);
                            if (!existing || (!existing.hasAsterisk && term.hasAsterisk)) map.set(term.display, term);
                            return map;
                          }, new Map())
                          .values()
                      );
                      const sortedTerms = uniqueTerms.sort((a, b) => {
                        if (a.hasAsterisk && !b.hasAsterisk) return -1;
                        if (!a.hasAsterisk && b.hasAsterisk) return 1;
                        return 0;
                      });
                      const displayTerms = sortedTerms.slice(0, 3);
                      const remainingCount = sortedTerms.length - 3;
                      return (
                        <>
                          {displayTerms.map((term, index) => (
                            <Tag key={index} className="text-xs! m-0! text-gray-600! border-gray-200!">
                              # {term.display}
                            </Tag>
                          ))}
                          {remainingCount > 0 && (
                            <Tag className="text-xs! bg-gray-100! text-gray-600! border-gray-300! m-0! font-semibold!">+{remainingCount} more</Tag>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </>
              )}

              <div className="flex items-center w-full gap-2 px-2">
                <hr className="grow border-t border-dashed border-gray-400" />
                <span className="text-gray-500">•</span>
                <hr className="grow border-t border-dashed border-gray-400" />
              </div>

              {(article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls)) && (
                <div className="mb-2 grow flex items-center justify-center overflow-hidden">
                  <img
                    src={article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls) || ""}
                    alt={article.graphical_abstract_path ? "Graphical Abstract" : "Figure"}
                    className="w-full h-auto object-contain max-h-48"
                    onLoad={e => {
                      const img = e.currentTarget;
                      if (img.naturalWidth < 300 && img.naturalHeight < 200) img.style.display = "none";
                    }}
                    onError={e => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}

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
                <div className="flex items-center justify-around w-full pt-2 border-t border-gray-100">
                  <Tooltip title={article.user_has_upvoted ? "Remove upvote" : "Upvote"}>
                    <Button
                      type="text"
                      icon={<LikeOutlined className="text-lg!" />}
                      onClick={e => handleUpvote(article, e)}
                      className={`rounded-md! ${article.user_has_upvoted ? "text-green-500! bg-green-50!" : "text-gray-500 hover:text-green-500! hover:bg-green-100!"}`}
                    >
                      <span className="text-xs ml-1">{article.upvotes || 0}</span>
                    </Button>
                  </Tooltip>
                  <Tooltip title="Comments">
                    <Button
                      type="text"
                      icon={<CommentOutlined className="text-lg!" />}
                      onClick={e => {
                        e.stopPropagation();
                        handleCardClick(article);
                      }}
                      className="text-gray-500 hover:text-indigo-500! hover:bg-indigo-100! rounded-md!"
                    >
                      <span className="text-xs ml-1">{article.comments_count || 0}</span>
                    </Button>
                  </Tooltip>
                  <Tooltip title={isArticleBookmarked(article.id) ? "Remove from bookmarks" : "Save to bookmarks"}>
                    <Button
                      type="text"
                      icon={isArticleBookmarked(article.id) ? <IoBookmark className="text-lg!" /> : <IoBookmarkOutline className="text-lg!" />}
                      onClick={e => (isArticleBookmarked(article.id) ? handleDeleteBookmark(article, e) : handleBookmarkClick(article, e))}
                      className={`rounded-md! ${isArticleBookmarked(article.id) ? "text-orange-500! bg-orange-50!" : "text-gray-500 hover:text-orange-500! hover:bg-orange-100!"}`}
                    />
                  </Tooltip>
                  <Tooltip title="Share to Group">
                    <Button
                      type="text"
                      icon={<TeamOutlined className="text-lg!" />}
                      onClick={e => {
                        e.stopPropagation();
                        setAddToGroupArticleId(article.id);
                      }}
                      className="text-gray-500 hover:text-sky-500! hover:bg-sky-100! rounded-md!"
                    />
                  </Tooltip>
                  <Dropdown menu={{ items: shareMenuItems(article) }} trigger={["click"]}>
                    <Tooltip title="Share">
                      <Button
                        type="text"
                        icon={<ShareAltOutlined className="text-lg!" />}
                        onClick={e => e.stopPropagation()}
                        className="text-gray-500 hover:text-sky-500! hover:bg-sky-100! rounded-md!"
                      />
                    </Tooltip>
                  </Dropdown>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {hasMore && (
          <div ref={loaderRef} className="col-span-full flex justify-center py-8">
            <Spin size="large" />
          </div>
        )}

        {!hasMore && displayedArticles.length > 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-gray-500">You've reached the end of your feed</p>
          </div>
        )}

        {articles && articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No articles found. Try adjusting your journal selection or filters.</p>
          </div>
        )}

        {articles && articles.length > 0 && filteredArticles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No articles match the selected impact factor filter.</p>
            <button onClick={() => setIfFilter(null)} className="mt-2 text-sm text-indigo-600 hover:underline cursor-pointer">
              Clear filter
            </button>
          </div>
        )}
      </div>

      <ArticleDetailsModal
        isOpen={isModalOpen}
        article={selectedArticle}
        isAbstractExpanded={isAbstractExpanded}
        userBookmarks={userBookmarks}
        availableFolders={availableFolders}
        onClose={handleCloseModal}
        onOpenArticle={handleOpenArticle}
        onUpvote={handleUpvote}
        onBookmarkClick={handleBookmarkClick}
        onDeleteBookmark={handleDeleteBookmark}
        onShareArticle={handleShareArticle}
        onSetAbstractExpanded={setIsAbstractExpanded}
        isArticleBookmarked={isArticleBookmarked}
        onUpdateCommentCount={handleUpdateCommentCount}
      />

      <AddToGroupModal articleId={addToGroupArticleId} isOpen={addToGroupArticleId !== null} onClose={() => setAddToGroupArticleId(null)} />

      <SelectBookmarkFolderModal
        isBookmarkModalOpen={isBookmarkModalOpen}
        handleSaveBookmark={handleSaveBookmark}
        setIsBookmarkModalOpen={setIsBookmarkModalOpen}
        setArticleToBookmark={setArticleToBookmark}
        setSelectedFolder={setSelectedFolder}
        availableFolders={availableFolders}
        selectedFolder={selectedFolder}
        articleToBookmark={articleToBookmark}
      />

      <NewJournalFollowModal
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        onOk={handleEditModalOk}
        editingFollow={currentFollow}
      />
    </>
  );
}

export default JournalFollows;
