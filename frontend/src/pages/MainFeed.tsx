import { useUser } from "@clerk/clerk-react";
import axiosInstance from "../lib/axios";
import { useQuery } from "@tanstack/react-query";
import Loading from "../components/misc/Loading";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Tag, Button, Space, Tooltip, Spin, Dropdown, Badge, message } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  UserOutlined,
  CheckOutlined,
  LikeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  FireOutlined,
  EyeOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { IoMdSettings } from "react-icons/io";
import { BsSortDownAlt } from "react-icons/bs";
import type { MenuProps } from "antd";
import { HiOutlineHashtag } from "react-icons/hi";
import { IoBookmarkOutline, IoBookmark, IoHome } from "react-icons/io5";
import SelectBookmarkFolderModal from "../components/mainFeed/SelectBookmarkFolderModal";
import AddToGroupModal from "../components/shared/AddToGroupModal";
import ArticleDetailsModal from "../components/mainFeed/ArticleDetailsModal";
import YouMightMissThis from "../components/mainFeed/YouMightMissThis";
import { CiRead } from "react-icons/ci";
import { FiAward } from "react-icons/fi";
import { getLastAuthorCountry } from "../lib/authorCountries";
import { FaLocationDot } from "react-icons/fa6";
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

function MainFeed() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  useUser();

  const [displayedArticles, setDisplayedArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<"smart_shuffle" | "similarity" | "date">("date");
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [addToGroupArticleId, setAddToGroupArticleId] = useState<number | null>(null);
  const [articleToBookmark, setArticleToBookmark] = useState<Article | null>(null);
  // selectedFolder stores the folder_key (or quick_saves for the hardcoded folder)
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  // Track user's saved bookmarks: { folder_key: [article_id1, article_id2, ...], ... }
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: number[] }>({});
  // IF filter: null = all, number = minimum impact factor
  const [ifFilter, setIfFilter] = useState<number | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef<boolean>(true); // Track if component is mounted
  const ITEMS_PER_PAGE = 20;

  // Check if user is already onboarded
  // prettier-ignore
  const {data: isOnBoard, isLoading: isCheckingOnBoard} = useQuery({
    queryKey: ["isOnBoarded"],
    queryFn: async () => {
      const response = await axiosInstance.get("/mainFeed/is_onboarded");
      return response.data.onBoard;
    },
  });

  // Redirect to OnBoarding if user is not onboarded
  useEffect(() => {
    if (isOnBoard === false) {
      navigate("/OnBoarding");
    }
  }, [isOnBoard, navigate]);

  // prettier-ignore
  const {data: articles, isLoading: isLoadingArticles} = useQuery<Article[]>({
    queryKey: ["mainFeed", sortBy],
    queryFn: async () => {
      const response = await axiosInstance.get(`/mainFeed/get_recommended_by_faiss?k=1000&sort_mode=${sortBy}`);
      return response.data;
    },
  });

  // prettier-ignore
  const {data: bookmarkFolders} = useQuery({
    queryKey: ["bookmarkFolders"],
    queryFn: async () => {
      const response = await axiosInstance.get("/bookmarks/get_folders");
      return response.data;
    },
  });

  // Backend now handles all sorting, so we just use the articles as-is
  const sortedArticles = useMemo(() => {
    if (!articles) return [];
    return articles; // Backend already sorted based on sort_mode
  }, [articles]);

  // Apply impact factor filter on top of sorted articles
  const filteredArticles = useMemo(() => {
    if (ifFilter === null) return sortedArticles;
    return sortedArticles.filter(a => {
      const jif = a.wos_journal?.journal_impact_factor ?? null;
      return jif !== null && jif >= ifFilter;
    });
  }, [sortedArticles, ifFilter]);

  // Memoize folder list to avoid recalculation on every render
  const availableFolders = useMemo(() => {
    // Always include a hard-coded Quick Saves folder with a stable key
    const folders: { key: string; name: string }[] = [{ key: "quick_saves", name: "Quick Saves" }];
    if (bookmarkFolders && Array.isArray(bookmarkFolders?.folders)) {
      // Expecting bookmarkFolders.folders to be an array of objects with at least a `name` and `key` (or `id`)
      const mapped = bookmarkFolders.folders.map((folder: any) => {
        return {
          key: folder.key ?? folder.id ?? folder.name,
          name: folder.name ?? folder.title ?? folder.key ?? folder.id,
        };
      });
      folders.push(...mapped);
    }
    return folders;
  }, [bookmarkFolders]);

  // Fetch user's bookmarks on mount
  useEffect(() => {
    const controller = new AbortController();

    axiosInstance
      .get("/bookmarks/get_user_bookmarks", { signal: controller.signal })
      .then(response => {
        if (isMountedRef.current && response.data.saved_bookmarks) {
          setUserBookmarks(response.data.saved_bookmarks);
        }
      })
      .catch(error => {
        if (error.name !== "CanceledError") {
          console.error("Failed to fetch bookmarks:", error);
          if (isMountedRef.current) {
            setUserBookmarks({});
          }
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  // Initialize displayed articles when data loads or sort/filter changes
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

  // Handle URL parameter for article modal
  useEffect(() => {
    const articleId = searchParams.get("article");
    if (articleId && displayedArticles.length > 0) {
      // First try to find in displayedArticles for most up-to-date state
      let article = displayedArticles.find(a => a.id === parseInt(articleId));
      // Fallback to filteredArticles if not yet displayed (edge case)
      if (!article && filteredArticles) {
        article = filteredArticles.find(a => a.id === parseInt(articleId));
      }
      if (article) {
        setSelectedArticle(article);
        setIsModalOpen(true);
      }
    }
  }, [searchParams, filteredArticles, displayedArticles]);

  // Load more articles when scrolling - memoized to prevent unnecessary recreations
  const loadMoreArticles = useCallback(() => {
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
  }, [filteredArticles, hasMore, page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !hasMore || isLoadingArticles) return;

    const observer = new IntersectionObserver(
      entries => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoadingArticles) {
          loadMoreArticles();
        }
      },
      { threshold: 0.1 }
    );

    const currentLoader = loaderRef.current;
    observer.observe(currentLoader);

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader);
      }
      observer.disconnect();
    };
  }, [hasMore, isLoadingArticles, loadMoreArticles]); // Use loadMoreArticles which includes all dependencies

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  if (isCheckingOnBoard) {
    return <Loading />;
  }

  if (isLoadingArticles) {
    return <Loading />;
  }

  const formatAuthors = (authors: string[] | string) => {
    if (!authors) return "Unknown authors";

    // Helper to strip the ":number" affiliation suffix from a single author string
    const cleanAuthor = (a: string) => a.split(":")[0].trim();

    // Handle if authors is a string (e.g. already joined)
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
    // Show only first and last author
    return `${cleaned[0]}, ... ${cleaned[cleaned.length - 1]}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

    // If it's an array, return first element
    if (Array.isArray(figuresUrls)) {
      return figuresUrls.length > 0 ? figuresUrls[0] : null;
    }

    // If it's a string with comma-separated URLs
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
    // Find the most up-to-date version of the article from displayedArticles
    const currentArticle = displayedArticles.find(a => a.id === article.id) || article;
    setSelectedArticle(currentArticle);
    setIsModalOpen(true);
    setSearchParams({ article: article.id.toString() });

    // Mark article as read immediately in the UI
    if (isMountedRef.current) {
      setDisplayedArticles(prev => prev.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)));
    }

    // POST request to track article view
    axiosInstance
      .post("/user_actions/article_click", {
        article_id: article.id,
      })
      .catch(error => {
        console.error("Failed to track article view:", error);
      });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
    setIsAbstractExpanded(false);
    setSearchParams({});
  };

  const handleShareArticle = (article: Article, platform?: "linkedin" | "twitter" | "facebook" | "copyLink") => {
    const doiUrl = article.doi ? `https://doi.org/${article.doi}` : article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : null;

    if (!doiUrl) {
      message.warning("No DOI or PMID available to share");
      return;
    }

    // Handle different platforms
    if (platform === "copyLink" || !platform) {
      // Copy to clipboard
      navigator.clipboard.writeText(doiUrl).then(() => {
        message.success("Link copied to clipboard!");
      });
    } else if (platform === "linkedin") {
      const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(doiUrl)}`;
      window.open(linkedinUrl, "_blank", "width=600,height=600");
    } else if (platform === "twitter") {
      const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(doiUrl)}&text=${encodeURIComponent(article.title)}`;
      window.open(twitterUrl, "_blank", "width=600,height=600");
    } else if (platform === "facebook") {
      const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(doiUrl)}`;
      window.open(facebookUrl, "_blank", "width=600,height=600");
    }
  };

  const handleUpvote = async (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await axiosInstance.post("/user_actions/upvote", {
        article_id: article.id,
        undo: article.user_has_upvoted,
      });

      if (response.data.success && isMountedRef.current) {
        // Update the article in both displayedArticles and articles
        const updateArticle = (art: Article) => {
          if (art.id === article.id) {
            return {
              ...art,
              upvotes: response.data.upvotes,
              user_has_upvoted: response.data.user_has_upvoted,
            };
          }
          return art;
        };

        setDisplayedArticles(prev => prev.map(updateArticle));

        // Update selected article if it's the one being upvoted
        if (selectedArticle?.id === article.id) {
          setSelectedArticle(prev => (prev ? updateArticle(prev) : null));
        }

        message.success(article.user_has_upvoted ? "Upvote removed" : "Article upvoted!");
      }
    } catch (error) {
      if (isMountedRef.current) {
        message.error("Failed to upvote article");
      }
      console.error("Upvote error:", error);
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

    // find the human-readable folder name for feedback; fallback to key
    const folderObj = availableFolders.find((f: { key: string; name: string }) => f.key === selectedFolder) || {
      key: selectedFolder,
      name: selectedFolder,
    };

    const articleId = articleToBookmark.id;
    const folderKey = folderObj.key;

    // Optimistic UI update: immediately add bookmark to state
    if (isMountedRef.current) {
      setUserBookmarks(prev => {
        const folderArticles = prev[folderKey] || [];
        if (!folderArticles.includes(articleId)) {
          return {
            ...prev,
            [folderKey]: [...folderArticles, articleId],
          };
        }
        return prev;
      });

      // Close modal immediately for responsive UI (non-blocking)
      setIsBookmarkModalOpen(false);
      setArticleToBookmark(null);
      setSelectedFolder(null);

      // Show success message immediately
      setTimeout(() => {
        if (isMountedRef.current) {
          message.success(`Article saved to ${folderObj.name}!`);
        }
      }, 0);
    }

    // Fire API call in background (don't await in handler)
    axiosInstance
      .post("/bookmarks/save_bookmark", {
        article_id: articleId,
        folder_name: folderObj.name,
        folder_key: folderKey,
      })
      .then(response => {
        if (response.data.saved_bookmarks && isMountedRef.current) {
          // Update with server response to ensure consistency
          setUserBookmarks(response.data.saved_bookmarks);
        }
      })
      .catch(error => {
        // Rollback optimistic update on error
        if (isMountedRef.current) {
          setUserBookmarks(prev => {
            const folderArticles = prev[folderKey] || [];
            return {
              ...prev,
              [folderKey]: folderArticles.filter(id => id !== articleId),
            };
          });
          message.error("Failed to save bookmark");
        }
        console.error("Bookmark error:", error);
      });
  };

  // Helper function to check if article is bookmarked in ANY folder
  const isArticleBookmarked = (articleId: number): boolean => {
    // Check all folders to see if article is bookmarked anywhere
    return Object.values(userBookmarks).some(articleIds => articleIds.includes(articleId));
  };

  // Helper function to get all folders an article is bookmarked in
  const getArticleBookmarkFolders = (articleId: number): string[] => {
    return Object.keys(userBookmarks).filter(folderKey => userBookmarks[folderKey]?.includes(articleId));
  };

  // Update comment count for an article
  const handleUpdateCommentCount = (articleId: number, newCount: number) => {
    if (!isMountedRef.current) return;

    // Update in displayedArticles
    setDisplayedArticles(prev => prev.map(article => (article.id === articleId ? { ...article, comments_count: newCount } : article)));

    // Update selected article if it's the one being updated
    if (selectedArticle?.id === articleId) {
      setSelectedArticle(prev => (prev ? { ...prev, comments_count: newCount } : null));
    }
  };

  // Delete bookmark from all folders
  const handleDeleteBookmark = (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();

    const articleId = article.id;
    const foldersContainingArticle = getArticleBookmarkFolders(articleId);

    if (foldersContainingArticle.length === 0) {
      message.warning("Article is not bookmarked");
      return;
    }

    // Optimistic UI update: immediately remove bookmark from all folders
    if (isMountedRef.current) {
      setUserBookmarks(prev => {
        const updated = { ...prev };
        foldersContainingArticle.forEach(folderKey => {
          updated[folderKey] = updated[folderKey].filter(id => id !== articleId);
        });
        return updated;
      });

      // Show success message immediately
      setTimeout(() => {
        if (isMountedRef.current) {
          message.success("Bookmark removed from all folders");
        }
      }, 0);
    }

    // Fire API calls for each folder in background
    const deletePromises = foldersContainingArticle.map(folderKey =>
      axiosInstance.post("/bookmarks/delete_bookmark", {
        article_id: articleId,
        folder_key: folderKey,
      })
    );

    Promise.all(deletePromises)
      .then(responses => {
        // Use the last response to update state (should all be the same)
        const lastResponse = responses[responses.length - 1];
        if (lastResponse.data.saved_bookmarks && isMountedRef.current) {
          setUserBookmarks(lastResponse.data.saved_bookmarks);
        }
      })
      .catch(error => {
        // Rollback optimistic update on error
        if (isMountedRef.current) {
          setUserBookmarks(prev => {
            const updated = { ...prev };
            foldersContainingArticle.forEach(folderKey => {
              if (!updated[folderKey]?.includes(articleId)) {
                updated[folderKey] = [...(updated[folderKey] || []), articleId];
              }
            });
            return updated;
          });
          message.error("Failed to remove bookmark");
        }
        console.error("Delete bookmark error:", error);
      });
  };

  const shareMenuItems = (article: Article): MenuProps["items"] => [
    {
      key: "copy",
      label: "Copy Link",
      icon: <ShareAltOutlined />,
      onClick: () => handleShareArticle(article),
    },
    {
      key: "linkedin",
      label: "Share on LinkedIn",
      onClick: () => handleShareArticle(article, "linkedin"),
    },
    {
      key: "twitter",
      label: "Share on X (Twitter)",
      onClick: () => handleShareArticle(article, "twitter"),
    },
    {
      key: "facebook",
      label: "Share on Facebook",
      onClick: () => handleShareArticle(article, "facebook"),
    },
  ];

  const sortMenuItems: MenuProps["items"] = [
    // {
    //   key: "smart_shuffle",
    //   label: (
    //     <div className="flex items-center justify-between gap-3">
    //       <span>Smart Feed</span>
    //       {sortBy === "smart_shuffle" && <CheckOutlined className="text-blue-600" />}
    //     </div>
    //   ),
    //   onClick: () => setSortBy("smart_shuffle"),
    // },
    {
      key: "similarity",
      label: (
        <div className="flex items-center justify-between gap-3">
          <span>By Relevance</span>
          {sortBy === "similarity" && <CheckOutlined className="text-blue-600" />}
        </div>
      ),
      onClick: () => setSortBy("similarity"),
    },
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
  ];

  return (
    <>
      <div className="max-w-[1920px] mx-auto px-2 sm:px-0">
        {/* Header */}
        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Page Title + Subtitle */}
          <div>
            <div className="flex items-center gap-2">
              <IoHome className="text-xl sm:text-2xl shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-800">/ Main Feed</h1>
            </div>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">Personalized feed based on your interests</p>
          </div>
          {/* Actions */}
          <div className="flex gap-2 self-start sm:self-auto">
            <Button
              type="default"
              className="bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-blue-500! hover:text-blue-600! hover:bg-blue-50! shadow-sm! hover:shadow-md! transition-all! duration-200!"
              onClick={() => navigate("/Settings?tab=feed-settings")}
            >
              <IoMdSettings className="text-lg!" />
              <span className="hidden xs:inline">Feed Settings</span>
              <span className="xs:hidden">Settings</span>
            </Button>
            <Dropdown menu={{ items: sortMenuItems }} trigger={["click"]}>
              <Button
                type="default"
                className="bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-purple-500! hover:text-purple-600! hover:bg-purple-50! shadow-sm! hover:shadow-md! transition-all! duration-200!"
              >
                <BsSortDownAlt className="text-lg!" />
                Sort
              </Button>
            </Dropdown>
          </div>
        </div>

        {/* Divider */}
        <div className="mb-3 sm:mb-4 h-px bg-gray-300!" />

        {/* Impact Factor Filter */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
          <span className="text-xs font-semibold text-gray-500 tracking-wide shrink-0 flex items-center gap-1">
            <FiAward className="text-sm text-amber-700" />
            Impact Factor filter:
          </span>
          <div className="flex justify-center items-center flex-wrap gap-1 mt-2 sm:mt-0">
            {([null, 5, 10, 15, 20, 30] as (number | null)[]).map(val => (
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
            {ifFilter !== null && (
              <span className="text-xs text-gray-400 ml-1">
                {filteredArticles.length} of {sortedArticles.length} articles
              </span>
            )}
          </div>
        </div>

        {/* ── Mobile-only: horizontal "Don't Miss" strip above the grid ── */}
        <div className="lg:hidden">
          <YouMightMissThis onCardClick={handleCardClick} layout="horizontal" />
        </div>

        {/* ── Desktop: side-by-side layout — articles grid + sidebar ── */}
        <div className="flex gap-5 items-start">
          {/* Articles Grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))] gap-3 sm:gap-4">
              {displayedArticles?.map(article => (
                <Badge.Ribbon
                  key={article.id}
                  text={
                    <>
                      <Tooltip title="Recommended for you">
                        <FireOutlined />
                      </Tooltip>
                    </>
                  }
                  color="pink"
                  style={{ display: article.similarity_score > 0.65 ? "block" : "none" }}
                >
                  <Card
                    hoverable
                    className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl!"
                    styles={{
                      body: { padding: "12px", display: "flex", flexDirection: "column", height: "100%" },
                    }}
                    onClick={() => handleCardClick(article)}
                  >
                    {/* Header with Free Badge */}
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
                    {/* Title */}
                    <h3 className="text-base font-semibold text-gray-900 mb-3  leading-tight">{article.title}</h3>
                    {/* Authors */}
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
                    {/* Journal & Date */}
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        {article.journal_icon_url ? (
                          <img
                            src={article.journal_icon_url}
                            alt=""
                            className="w-4 h-4 shrink-0 rounded-sm object-contain"
                            onError={e => {
                              e.currentTarget.style.display = "none";
                              e.currentTarget.nextElementSibling && ((e.currentTarget.nextElementSibling as HTMLElement).style.display = "inline");
                            }}
                          />
                        ) : (
                          <BookOutlined className={`shrink-0${article.journal_icon_url ? " hidden" : ""}`} />
                        )}
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
                        <div className="flex items-center gap-2  pt-1 border-t border-dashed border-gray-200">
                          <CalendarOutlined className="shrink-0 text-sky-600!" />
                          <span className="text-gray-500!">First online: {formatDate(article.created_at)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <CalendarOutlined className="shrink-0 text-sky-600!" />
                        <span className="text-gray-500">
                          Publication date: {new Date(article.publication_date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                        </span>
                      </div>
                    </div>

                    {/* MeSH Terms */}
                    {article?.mesh_terms && article.mesh_terms.trim().length > 0 && (
                      <>
                        <hr className="text-gray-400 border-0.5 border-dashed! my-2" />
                        <p className="font-semibold text-xs! text-gray-600 mb-1! flex items-center gap-1!">
                          <HiOutlineHashtag className="text-orange-500!" />
                          Tags:
                        </p>
                        <div className="flex flex-wrap items-center gap-1 mb-2">
                          {(() => {
                            // Parse and process MeSH terms
                            const parsedTerms = article.mesh_terms
                              .split(";")
                              .map(t => t.trim())
                              .filter(t => t.length > 0)
                              .map(term => {
                                // Split on / and keep only the first part
                                const mainTerm = term.split("/")[0].trim();
                                // Check if term has * at the end
                                const hasAsterisk = mainTerm.includes("*");
                                // Remove the asterisk for display
                                const displayTerm = hasAsterisk ? mainTerm.slice(0, -1).trim() : mainTerm;
                                return { display: displayTerm, hasAsterisk };
                              });

                            // Remove duplicates - keep the one with asterisk if both exist
                            const uniqueTerms = Array.from(
                              parsedTerms
                                .reduce((map, term) => {
                                  const existing = map.get(term.display);
                                  // Keep the term with asterisk if duplicate exists
                                  if (!existing || (!existing.hasAsterisk && term.hasAsterisk)) {
                                    map.set(term.display, term);
                                  }
                                  return map;
                                }, new Map())
                                .values()
                            );

                            // Sort: terms with asterisk first, then others
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
                                  <Tag
                                    key={index}
                                    className={`text-xs! m-0! ${
                                      term.hasAsterisk ? "text-gray-600! border-gray-200!" : " text-gray-700! border-gray-200!"
                                    }`}
                                  >
                                    # {term.display}
                                  </Tag>
                                ))}
                                {remainingCount > 0 && (
                                  <Tag className="text-xs! bg-gray-100! text-gray-600! border-gray-300! m-0! font-semibold!">
                                    +{remainingCount} more
                                  </Tag>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}
                    {/* END -> MeSH Terms */}
                    <div className="flex items-center w-full gap-2 px-2">
                      <hr className="grow border-t border-dashed border-gray-400" />
                      <span className="text-gray-500">•</span>
                      <hr className="grow border-t border-dashed border-gray-400" />
                    </div>
                    {/* Graphical Abstract or First Figure (no text abstract on cards) */}
                    {(article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls)) && (
                      <div className="mb-2 grow flex items-center justify-center overflow-hidden ">
                        <img
                          src={article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls) || ""}
                          alt={article.graphical_abstract_path ? "Graphical Abstract" : "Figure"}
                          className="w-full h-auto object-contain max-h-48"
                          onLoad={e => {
                            const img = e.currentTarget;
                            if (img.naturalWidth < 300 && img.naturalHeight < 200) {
                              img.style.display = "none";
                            }
                          }}
                          onError={e => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    )}
                    {/* Footer Actions */}
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
                            Read More
                            <EyeOutlined className="text-md!" />
                          </Button>
                        </Space>
                      </div>

                      {/* Interaction Footer */}
                      <div className="flex items-center justify-around w-full pt-2 border-t border-gray-100 gap-1">
                        <Tooltip title={article.user_has_upvoted ? "Remove upvote" : "Upvote"}>
                          <Button
                            type="text"
                            icon={<LikeOutlined className="text-base! sm:text-lg!" />}
                            onClick={e => handleUpvote(article, e)}
                            className={`rounded-md! px-2! min-w-0! ${
                              article.user_has_upvoted ? "text-green-500! bg-green-50!" : "text-gray-500 hover:text-green-500! hover:bg-green-100!"
                            }`}
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
                            className={`rounded-md! px-2! min-w-0! ${
                              isArticleBookmarked(article.id)
                                ? "text-orange-500! bg-orange-50!"
                                : "text-gray-500 hover:text-orange-500! hover:bg-orange-100!"
                            }`}
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
                    </div>
                  </Card>
                </Badge.Ribbon>
              ))}
            </div>
            {/* Loading Indicator */}
            {hasMore && (
              <div ref={loaderRef} className="col-span-full flex justify-center py-8">
                <Spin size="large" />
              </div>
            )}
            {/* End of Results */}
            {!hasMore && displayedArticles.length > 0 && (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-500">You've reached the end of your feed</p>
              </div>
            )}
            {/* Empty State — no articles at all */}
            {articles && articles.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No articles found. Try adjusting your interests in settings.</p>
              </div>
            )}
            {/* Empty State — filter too strict */}
            {articles && articles.length > 0 && filteredArticles.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No articles match the selected impact factor filter.</p>
                <button onClick={() => setIfFilter(null)} className="mt-2 text-sm text-indigo-600 hover:underline cursor-pointer">
                  Clear filter
                </button>
              </div>
            )}
          </div>
          {/* end flex-1 articles column */}

          {/* ── Desktop-only: vertical "Don't Miss" sidebar ── */}
          <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0 sticky top-4" style={{ height: "calc(100vh - 6rem)", maxHeight: "900px" }}>
            <YouMightMissThis onCardClick={handleCardClick} layout="vertical" />
          </div>
        </div>
        {/* end flex gap-5 */}
      </div>

      {/* Article Detail Modal */}
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

      {/* Bookmark Folder Selection Modal */}
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
    </>
  );
}

export default MainFeed;
