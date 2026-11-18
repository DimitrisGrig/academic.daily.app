import { useSearchParams, useNavigate } from "react-router-dom";
import axiosInstance from "../lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Loading from "../components/misc/Loading";
import { Card, Tag, Button, Space, Tooltip, Dropdown, message, Modal } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  UserOutlined,
  LikeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  TrophyOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useState, useMemo, useEffect } from "react";
import type { MenuProps } from "antd";
import { HiOutlineHashtag } from "react-icons/hi";
import { IoBookmarkOutline, IoBookmark } from "react-icons/io5";
import SelectBookmarkFolderModal from "../components/mainFeed/SelectBookmarkFolderModal";
import AddToGroupModal from "../components/shared/AddToGroupModal";
import ArticleDetailsModal from "../components/mainFeed/ArticleDetailsModal";
import { TbFolderStar } from "react-icons/tb";
import { FaLocationDot } from "react-icons/fa6";
import { getLastAuthorCountry } from "../lib/authorCountries";
import NewBookmarkFolderModal from "../components/sidebar/NewBookmarkFolderModal";

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

function Bookmarks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const folderKey = searchParams.get("folder");

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [addToGroupArticleId, setAddToGroupArticleId] = useState<number | null>(null);
  const [articleToBookmark, setArticleToBookmark] = useState<Article | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: number[] }>({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Fetch bookmarked articles for the folder
  const { data: articles, isLoading: isLoadingArticles } = useQuery<Article[]>({
    queryKey: ["bookmarkedArticles", folderKey],
    queryFn: async () => {
      if (!folderKey) return [];
      const response = await axiosInstance.get(`/bookmarks/get_articles_by_folder?folder_key=${folderKey}`);
      return response.data;
    },
    enabled: !!folderKey,
  });

  // Fetch bookmark folders
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

  // Get current folder name
  const currentFolderName = useMemo(() => {
    const folder = availableFolders.find(f => f.key === folderKey);
    return folder?.name || "Unknown Folder";
  }, [availableFolders, folderKey]);

  // Get current folder object for editing
  const currentFolder = useMemo(() => {
    if (!bookmarkFolders?.folders || !folderKey) return null;
    return bookmarkFolders.folders.find((f: any) => f.key === folderKey) || null;
  }, [bookmarkFolders, folderKey]);

  // Fetch user's bookmarks on mount
  useEffect(() => {
    axiosInstance
      .get("/bookmarks/get_user_bookmarks")
      .then(response => {
        if (response.data.saved_bookmarks) {
          setUserBookmarks(response.data.saved_bookmarks);
        }
      })
      .catch(error => {
        console.error("Failed to fetch bookmarks:", error);
        setUserBookmarks({});
      });
  }, []);

  if (!folderKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 text-lg">Please select a folder to view bookmarks</p>
      </div>
    );
  }

  if (isLoadingArticles) {
    return <Loading />;
  }

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

  const handleOpenArticle = (article: Article) => {
    if (article.doi) {
      window.open(`https://doi.org/${article.doi}`, "_blank");
    } else if (article.pmid) {
      window.open(`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`, "_blank");
    }
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
    setSelectedArticle(article);
    setIsModalOpen(true);
    setSearchParams({ folder: folderKey!, article: article.id.toString() });

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
    setSearchParams({ folder: folderKey! });
  };

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

  const handleUpvote = async (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await axiosInstance.post("/user_actions/upvote", {
        article_id: article.id,
        undo: article.user_has_upvoted,
      });

      if (response.data.success) {
        // Refetch the articles to get updated data
        window.location.reload();
        message.success(article.user_has_upvoted ? "Upvote removed" : "Article upvoted!");
      }
    } catch (error) {
      message.error("Failed to upvote article");
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

    const folderObj = availableFolders.find((f: { key: string; name: string }) => f.key === selectedFolder) || {
      key: selectedFolder,
      name: selectedFolder,
    };

    const articleId = articleToBookmark.id;
    const folderKey = folderObj.key;

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

    setIsBookmarkModalOpen(false);
    setArticleToBookmark(null);
    setSelectedFolder(null);

    setTimeout(() => {
      message.success(`Article saved to ${folderObj.name}!`);
    }, 0);

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

  const isArticleBookmarked = (articleId: number): boolean => {
    return Object.values(userBookmarks).some(articleIds => articleIds.includes(articleId));
  };

  const getArticleBookmarkFolders = (articleId: number): string[] => {
    return Object.keys(userBookmarks).filter(folderKey => userBookmarks[folderKey]?.includes(articleId));
  };

  const handleUpdateCommentCount = (articleId: number, newCount: number) => {
    if (selectedArticle?.id === articleId) {
      setSelectedArticle(prev => (prev ? { ...prev, comments_count: newCount } : null));
    }
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
      foldersContainingArticle.forEach(folderKey => {
        updated[folderKey] = updated[folderKey].filter(id => id !== articleId);
      });
      return updated;
    });

    setTimeout(() => {
      message.success("Bookmark removed from all folders");
      // Refetch articles
      window.location.reload();
    }, 0);

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

  const handleEditFolder = () => {
    setIsEditModalOpen(true);
  };

  const handleDeleteFolder = () => {
    if (folderKey === "quick_saves") {
      message.warning("Cannot delete Quick Saves folder");
      return;
    }

    Modal.confirm({
      title: "Delete Folder",
      content: `Are you sure you want to delete "${currentFolderName}"? Bookmarks will be moved to "Quick saves".`,
      okText: "Delete",
      okType: "danger",
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await axiosInstance.post("/bookmarks/delete_folder", { key: folderKey });
          message.success("Folder deleted successfully");
          queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
          // Navigate back to Quick Saves
          navigate("/Bookmarks?folder=quick_saves");
        } catch (error: any) {
          console.error("Error deleting folder:", error);
          message.error(error?.response?.data?.detail || "Failed to delete folder. Please try again.");
        }
      },
    });
  };

  const handleEditModalOk = () => {
    setIsEditModalOpen(false);
    // Refetch folders
    queryClient.invalidateQueries({ queryKey: ["bookmarkFolders"] });
  };

  const handleEditModalCancel = () => {
    setIsEditModalOpen(false);
  };

  return (
    <>
      <div className="max-w-[1920px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <TbFolderStar className="text-xl! sm:text-2xl! text-sky-600! shrink-0!" />
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-600 truncate">
                <span className="hidden sm:inline">Bookmarks / </span>
                <span className="sm:hidden"> / </span>
                {currentFolderName}
              </h1>
            </div>
            {folderKey !== "quick_saves" && (
              <div className="flex gap-1 sm:gap-2 shrink-0">
                <Tooltip title="Edit folder">
                  <Button
                    type="default"
                    icon={<EditOutlined />}
                    onClick={handleEditFolder}
                    className="bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-blue-500! hover:text-blue-600! hover:bg-blue-50! shadow-sm! hover:shadow-md! transition-all! duration-200! px-2 sm:px-4!"
                  >
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </Tooltip>
                <Tooltip title="Delete folder">
                  <Button
                    type="default"
                    icon={<DeleteOutlined />}
                    onClick={handleDeleteFolder}
                    className="bg-white! text-gray-700! font-semibold! border-2! border-gray-300! hover:border-red-500! hover:text-red-600! hover:bg-red-50! shadow-sm! hover:shadow-md! transition-all! duration-200! px-2 sm:px-4!"
                  >
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
          <p className="text-sm sm:text-base text-gray-600">{articles?.length || 0} saved articles</p>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {articles?.map(article => (
            <Card
              key={article.id}
              hoverable
              className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl!"
              styles={{
                body: { padding: "16px", display: "flex", flexDirection: "column", height: "100%" },
              }}
              onClick={() => handleCardClick(article)}
            >
              {/* Header with Tags */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
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
                      onClick={e => handleUpvote(article, e)}
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
                      className={`rounded-md! ${
                        isArticleBookmarked(article.id)
                          ? "text-orange-500! bg-orange-50!"
                          : "text-gray-500 hover:text-orange-500! hover:bg-orange-100!"
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

        {/* Empty State */}
        {articles && articles.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No bookmarks in this folder yet.</p>
          </div>
        )}
      </div>

      {/* Article Detail Modal */}
      <ArticleDetailsModal
        isOpen={isModalOpen}
        // @ts-ignore
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

      {/* Edit Folder Modal */}
      <NewBookmarkFolderModal open={isEditModalOpen} onCancel={handleEditModalCancel} onOk={handleEditModalOk} editingFolder={currentFolder} />
    </>
  );
}

export default Bookmarks;
