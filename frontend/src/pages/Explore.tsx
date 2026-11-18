import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import axiosInstance from "../lib/axios";
import { Card, Tag, Button, Space, message, Tooltip, Spin, Dropdown, Alert } from "antd";
import type { MenuProps } from "antd";
import {
  BookOutlined,
  LikeOutlined,
  CommentOutlined,
  FireOutlined,
  UserOutlined,
  CalendarOutlined,
  ShareAltOutlined,
  EyeOutlined,
  TrophyOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { IoBookmarkOutline, IoBookmark, IoHome } from "react-icons/io5";
import { HiOutlineHashtag } from "react-icons/hi";
import { CiRead } from "react-icons/ci";
import { FaLocationDot } from "react-icons/fa6";
import Loading from "../components/misc/Loading";
import SelectBookmarkFolderModal from "../components/mainFeed/SelectBookmarkFolderModal";
import AddToGroupModal from "../components/shared/AddToGroupModal";
import ArticleDetailsModal from "../components/mainFeed/ArticleDetailsModal";
import { getLastAuthorCountry } from "../lib/authorCountries";

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
  upvotes: number;
  clicks: number;
  user_has_upvoted: boolean;
  user_has_read: boolean;
  comments_count?: number;
  similarity_score: number;
  is_diverse?: boolean;
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

type SortType = "clicks" | "upvotes" | "comments" | "date";

function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const topic = searchParams.get("topic");
  const [sortBy, setSortBy] = useState<SortType>("clicks");
  const [displayedArticles, setDisplayedArticles] = useState<Article[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [addToGroupArticleId, setAddToGroupArticleId] = useState<number | null>(null);
  const [articleToBookmark, setArticleToBookmark] = useState<Article | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: number[] }>({});
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 20;

  // Fetch articles based on sort criteria and optional topic
  const { data: articles, isLoading } = useQuery<Article[]>({
    queryKey: ["explore", sortBy, topic],
    queryFn: async () => {
      const params = new URLSearchParams({ sort_by: sortBy, limit: "100" });
      if (topic) {
        params.append("topic", topic);
      }
      const response = await axiosInstance.get(`/explore/explore_feed?${params.toString()}`);
      return response.data;
    },
  }); // Fetch bookmark folders
  const { data: bookmarkFolders } = useQuery({
    queryKey: ["bookmarkFolders"],
    queryFn: async () => {
      const response = await axiosInstance.get("/bookmarks/get_folders");
      return response.data;
    },
  });

  // Memoize folder list
  const availableFolders = useMemo(() => {
    const folders: { key: string; name: string }[] = [{ key: "quick_saves", name: "Quick Saves" }];
    if (bookmarkFolders && Array.isArray(bookmarkFolders?.folders)) {
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

  // Fetch user's bookmarks
  useEffect(() => {
    axiosInstance
      .get("/bookmarks/get_user_bookmarks")
      .then(res => {
        const bookmarksData = res.data?.bookmarks || {};
        setUserBookmarks(bookmarksData);
      })
      .catch(error => {
        console.error("Failed to fetch user bookmarks:", error);
      });
  }, []);

  // Reset pagination when sort changes
  useEffect(() => {
    setPage(1);
    setDisplayedArticles([]);
    setHasMore(true);
  }, [sortBy]);

  // Update displayed articles based on pagination
  useEffect(() => {
    if (articles) {
      const startIndex = 0;
      const endIndex = page * ITEMS_PER_PAGE;
      const newDisplayed = articles.slice(startIndex, endIndex);
      setDisplayedArticles(newDisplayed);
      setHasMore(endIndex < articles.length);
    }
  }, [articles, page]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // Handle upvote
  const handleUpvote = async (article: Article) => {
    const undo = article.user_has_upvoted;

    try {
      const response = await axiosInstance.post("/user_actions/upvote", {
        article_id: article.id,
        undo: undo,
      });

      if (response.data.success) {
        setDisplayedArticles(prev =>
          prev.map(a =>
            a.id === article.id
              ? {
                  ...a,
                  upvotes: undo ? a.upvotes - 1 : a.upvotes + 1,
                  user_has_upvoted: !undo,
                }
              : a
          )
        );
      }
    } catch (error) {
      message.error("Failed to update upvote");
      console.error("Upvote error:", error);
    }
  };

  // Handle bookmark
  const handleBookmarkClick = (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();
    setArticleToBookmark(article);
    setIsBookmarkModalOpen(true);
  };

  const handleSaveBookmark = () => {
    if (!articleToBookmark || !selectedFolder) {
      message.error("Please select a folder");
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
      message.success(`Article saved to ${folderObj.name}!`);
    }, 0);

    // Fire API call in background
    axiosInstance
      .post("/bookmarks/save_bookmark", {
        article_id: articleId,
        folder_name: folderObj.name,
        folder_key: folderKey,
      })
      .then(response => {
        if (response.data.saved_bookmarks) {
          setUserBookmarks(response.data.saved_bookmarks);
        }
      })
      .catch(error => {
        // Rollback optimistic update on error
        setUserBookmarks(prev => {
          const folderArticles = prev[folderKey] || [];
          return {
            ...prev,
            [folderKey]: folderArticles.filter(id => id !== articleId),
          };
        });
        message.error("Failed to save bookmark");
        console.error("Bookmark error:", error);
      });
  };

  // Check if article is bookmarked
  const isArticleBookmarked = (articleId: number): boolean => {
    return Object.values(userBookmarks).some(bookmarks => bookmarks.includes(articleId));
  };

  // Helper function to get all folders an article is bookmarked in
  const getArticleBookmarkFolders = (articleId: number): string[] => {
    return Object.keys(userBookmarks).filter(folderKey => userBookmarks[folderKey]?.includes(articleId));
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
    setUserBookmarks(prev => {
      const updated = { ...prev };
      foldersContainingArticle.forEach(folderKey => {
        updated[folderKey] = updated[folderKey].filter(id => id !== articleId);
      });
      return updated;
    });

    // Show success message immediately
    setTimeout(() => {
      message.success("Bookmark removed from all folders");
    }, 0);

    // Fire API calls for each folder in background
    const deletePromises = foldersContainingArticle.map(folderKey =>
      axiosInstance.post("/bookmarks/delete_bookmark", {
        article_id: articleId,
        folder_key: folderKey,
      })
    );

    Promise.all(deletePromises)
      .then(responses => {
        const lastResponse = responses[responses.length - 1];
        if (lastResponse.data.saved_bookmarks) {
          setUserBookmarks(lastResponse.data.saved_bookmarks);
        }
      })
      .catch(error => {
        // Rollback optimistic update on error
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
        console.error("Delete bookmark error:", error);
      });
  };

  // Handle share
  const handleShareArticle = (article: Article, platform?: "linkedin" | "twitter" | "facebook" | "copyLink") => {
    const doiUrl = article.doi ? `https://doi.org/${article.doi}` : article.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : null;

    if (!doiUrl) {
      message.warning("No DOI or PMID available to share");
      return;
    }

    if (platform === "copyLink" || !platform) {
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

  // Update comment count for an article
  const handleUpdateCommentCount = (articleId: number, newCount: number) => {
    setDisplayedArticles(prev => prev.map(article => (article.id === articleId ? { ...article, comments_count: newCount } : article)));

    if (selectedArticle?.id === articleId) {
      setSelectedArticle(prev => (prev ? { ...prev, comments_count: newCount } : null));
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
    setIsAbstractExpanded(false);
  };

  // Helper functions
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

  const getFirstFigureUrl = (figuresUrls: string[] | string | null): string | null => {
    if (!figuresUrls) return null;
    if (Array.isArray(figuresUrls)) {
      return figuresUrls.length > 0 ? figuresUrls[0] : null;
    }
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

    // Mark article as read immediately in the UI
    setDisplayedArticles(prev => prev.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)));

    // Track click
    axiosInstance
      .post("/user_actions/article_click", { article_id: article.id })
      .then(response => {
        console.log("Article click tracked successfully:", response.data);
      })
      .catch(error => {
        console.error("Failed to track click:", error);
        console.error("Article ID:", article.id);
        console.error("Error response:", error.response?.data);
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

  if (isLoading && displayedArticles.length === 0) {
    return <Loading />;
  }

  return (
    <div className="max-w-[1920px] mx-auto">
      {/* Page Title */}
      <div className="mb-2 flex items-center gap-2 text-2xl">
        <IoHome />
        <h1 className="flex text-3xl font-semibold text-gray-800">/ Explore</h1>
      </div>
      <p className="text-gray-600 mb-4!">Discover high-impact research personalized to your interests</p>

      {/* Header with sort buttons */}
      <div className="mb-6 flex items-center gap-2 border-b border-gray-300! pb-1">
        <button
          onClick={() => setSortBy("clicks")}
          className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            sortBy === "clicks"
              ? "bg-sky-800 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-950 hover:bg-gray-300 border border-transparent hover:border-gray-200"
          }`}
        >
          Popular
        </button>
        <button
          onClick={() => setSortBy("upvotes")}
          className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            sortBy === "upvotes"
              ? "bg-sky-800 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-950 hover:bg-gray-300 border border-transparent hover:border-gray-200"
          }`}
        >
          By upvotes
        </button>
        <button
          onClick={() => setSortBy("comments")}
          className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            sortBy === "comments"
              ? "bg-sky-800 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-950 hover:bg-gray-300 border border-transparent hover:border-gray-200"
          }`}
        >
          By comments
        </button>
        <button
          onClick={() => setSortBy("date")}
          className={`px-2 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            sortBy === "date"
              ? "bg-sky-800 text-white shadow-sm"
              : "text-gray-600 hover:text-gray-950 hover:bg-gray-300 border border-transparent hover:border-gray-200"
          }`}
        >
          By date
        </button>
      </div>

      {/* Topic Filter Banner */}
      {topic && (
        <Alert
          message={
            <Space>
              <HiOutlineHashtag className="text-lg!" />
              <span className="font-semibold!">Exploring Topic:</span>
              <span>{topic}</span>
            </Space>
          }
          type="info"
          showIcon={false}
          closable
          onClose={() => {
            setSearchParams({});
          }}
          className="mb-4!"
          icon={null}
        />
      )}

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {displayedArticles.map(article => (
          <Card
            key={article.id}
            hoverable
            className="h-full! flex! flex-col! shadow-sm! hover:shadow-md! transition-shadow! cursor-pointer! rounded-xl!"
            styles={{
              body: { padding: "16px", display: "flex", flexDirection: "column", height: "100%" },
            }}
            onClick={() => handleCardClick(article)}
          >
            {/* Header with Badges */}
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

                {/* Similarity Badge - Show for high similarity personalized articles */}
                {!article.is_diverse && article.similarity_score >= 0.1 && (
                  <Tag color="red" className="font-semibold!">
                    <FireOutlined /> Hot
                  </Tag>
                )}

                {/* Diverse/Trending Badge */}
                {article.is_diverse && (
                  <Tag color="purple" className="font-semibold!">
                    🔥 Trending
                  </Tag>
                )}
              </div>
            </div>

            {/* Title */}
            <h3 className="text-base font-semibold text-gray-900 mb-3 leading-tight">{article.title}</h3>

            {/* Authors */}
            <div className="flex items-start gap-2 mb-2 text-sm text-gray-600">
              <UserOutlined className="mt-1! shrink-0!" />
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
                  <BookOutlined className={`shrink-0!${article.journal_icon_url ? " hidden" : ""}`} />
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
                          if (!existing || (!existing.hasAsterisk && term.hasAsterisk)) {
                            map.set(term.display, term);
                          }
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
                          <Tag
                            key={index}
                            className={`text-xs! m-0! ${term.hasAsterisk ? "text-gray-600! border-gray-200!" : " text-gray-700! border-gray-200!"}`}
                          >
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
              <div className="flex items-center justify-around w-full pt-2 border-t border-gray-100">
                <Tooltip title={article.user_has_upvoted ? "Remove upvote" : "Upvote"}>
                  <Button
                    type="text"
                    icon={<LikeOutlined className="text-lg!" />}
                    onClick={e => {
                      e.stopPropagation();
                      handleUpvote(article);
                    }}
                    className={`rounded-md! ${
                      article.user_has_upvoted ? "text-green-500! bg-green-50!" : "text-gray-500 hover:text-green-500! hover:bg-green-100!"
                    }`}
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
                    className="text-gray-500! hover:text-indigo-500! hover:bg-indigo-100! rounded-md!"
                  >
                    <span className="text-xs ml-1">{article.comments_count || 0}</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Clicks">
                  <Button
                    type="text"
                    icon={<FireOutlined className="text-lg!" />}
                    className="text-gray-500! hover:text-red-500! hover:bg-red-100! rounded-md!"
                  >
                    <span className="text-xs ml-1">{article.clicks || 0}</span>
                  </Button>
                </Tooltip>
                <Tooltip title={isArticleBookmarked(article.id) ? "Remove from bookmarks" : "Save to bookmarks"}>
                  <Button
                    type="text"
                    icon={isArticleBookmarked(article.id) ? <IoBookmark className="text-lg!" /> : <IoBookmarkOutline className="text-lg!" />}
                    onClick={e => (isArticleBookmarked(article.id) ? handleDeleteBookmark(article, e) : handleBookmarkClick(article, e))}
                    className={`rounded-md! ${
                      isArticleBookmarked(article.id) ? "text-orange-500! bg-orange-50!" : "text-gray-500 hover:text-orange-500! hover:bg-orange-100!"
                    }`}
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

      {/* Loading Indicator */}
      {hasMore && (
        <div ref={loaderRef} className="col-span-full flex justify-center py-8">
          <Spin size="large" />
        </div>
      )}

      {/* End of Results */}
      {!hasMore && displayedArticles.length > 0 && (
        <div className="col-span-full text-center py-8">
          <p className="text-gray-500">You've reached the end of the explore feed</p>
        </div>
      )}

      {/* Empty State */}
      {articles && articles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No articles found.</p>
        </div>
      )}

      {/* Modals */}
      <AddToGroupModal articleId={addToGroupArticleId} isOpen={addToGroupArticleId !== null} onClose={() => setAddToGroupArticleId(null)} />
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

      {selectedArticle && (
        <ArticleDetailsModal
          article={selectedArticle as any}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          isAbstractExpanded={isAbstractExpanded}
          onSetAbstractExpanded={setIsAbstractExpanded}
          userBookmarks={userBookmarks}
          availableFolders={availableFolders}
          onOpenArticle={handleCardClick as any}
          onUpvote={handleUpvote as any}
          onBookmarkClick={handleBookmarkClick as any}
          onDeleteBookmark={handleDeleteBookmark as any}
          onShareArticle={handleShareArticle as any}
          isArticleBookmarked={isArticleBookmarked}
          onUpdateCommentCount={handleUpdateCommentCount}
        />
      )}
    </div>
  );
}

export default Explore;
