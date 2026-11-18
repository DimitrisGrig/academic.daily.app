import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Typography, Space, Spin, Empty, Tag, Button, message, Tooltip, Dropdown } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  UserOutlined,
  ArrowLeftOutlined,
  ExperimentOutlined,
  LikeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  EyeOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import axiosInstance from "../lib/axios";
import ArticleDetailsModal from "../components/mainFeed/ArticleDetailsModal";
import { BsFillJournalBookmarkFill } from "react-icons/bs";
import { HiOutlineHashtag } from "react-icons/hi";
import { IoBookmarkOutline, IoBookmark } from "react-icons/io5";
import { CiRead } from "react-icons/ci";
import SelectBookmarkFolderModal from "../components/mainFeed/SelectBookmarkFolderModal";
import type { MenuProps } from "antd";
import GeoDatasetTag from "../components/mainFeed/GeoDatasetTag";

const { Title, Text } = Typography;

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

interface JournalArticlesResponse {
  articles: Article[];
  journal_info: {
    journal_title: string;
    issn: string | null;
    eissn: string | null;
    wos_impact_factor: number | null;
    journal_icon_url?: string | null;
  };
  total_count: number;
}

function JournalArticles() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const journalId = searchParams.get("journalId");
  const journalTitle = searchParams.get("journalTitle");

  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: number[] }>({});
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [articleToBookmark, setArticleToBookmark] = useState<Article | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<Array<{ key: string; name: string }>>([]);
  const [displayedArticles, setDisplayedArticles] = useState<Article[]>([]);

  // Fetch articles for the journal
  const { data: articlesData, isLoading } = useQuery<JournalArticlesResponse>({
    queryKey: ["journalArticles", journalId],
    queryFn: async () => {
      if (!journalId) throw new Error("Journal ID is required");
      const response = await axiosInstance.get(`/source_journals/journal/${journalId}/articles`);
      return response.data;
    },
    enabled: !!journalId,
  });

  // Update displayed articles when data changes
  useEffect(() => {
    if (articlesData?.articles) {
      const sorted = [...articlesData.articles].sort(
        (a, b) => new Date(b.created_at ?? b.publication_date).getTime() - new Date(a.created_at ?? a.publication_date).getTime()
      );
      setDisplayedArticles(sorted);
    }
  }, [articlesData]);

  // Fetch user bookmarks
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const response = await axiosInstance.get("/bookmarks/get_user_bookmarks");
        const savedBookmarks = response.data.saved_bookmarks || {};
        setUserBookmarks(savedBookmarks);
      } catch (error) {
        console.error("Failed to fetch bookmarks:", error);
      }
    };

    const fetchFolders = async () => {
      try {
        const response = await axiosInstance.get("/bookmarks/get_folders");
        setAvailableFolders(response.data.folders || []);
      } catch (error) {
        console.error("Failed to fetch folders:", error);
      }
    };

    fetchBookmarks();
    fetchFolders();
  }, []);

  const formatAuthors = (authors: string[] | string) => {
    if (!authors) return "Unknown authors";
    const cleanAuthor = (a: string) => a.split(":")[0].trim();
    if (typeof authors === "string") {
      return authors
        .split(";")
        .map(a => cleanAuthor(a))
        .filter(a => a.length > 0)
        .join(", ");
    }
    if (!Array.isArray(authors) || authors.length === 0) return "Unknown authors";
    const cleaned = authors.map(cleanAuthor);
    if (cleaned.length <= 3) return cleaned.join(", ");
    return `${cleaned.slice(0, 3).join(", ")} et al.`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // const truncateAbstract = (text: string, maxLength: number = 200) => {
  //   if (!text) return "No abstract available";
  //   if (text.length <= maxLength) return text;
  //   return text.substring(0, maxLength) + "...";
  // };

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

  const handleArticleClick = (article: Article) => {
    const currentArticle = displayedArticles.find(a => a.id === article.id) || article;
    setSelectedArticle(currentArticle);
    setIsModalOpen(true);

    // Mark article as read immediately in the UI
    setDisplayedArticles(prev => prev.map(a => (a.id === article.id ? { ...a, user_has_read: true } : a)));

    // POST request to track article view
    axiosInstance
      .post("/user_actions/article_click", {
        article_id: article.id,
      })
      .then(response => {
        console.log("Article click tracked successfully:", response.data);
      })
      .catch(error => {
        console.error("Failed to track article view:", error);
        console.error("Article ID:", article.id);
        console.error("Error response:", error.response?.data);
      });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setIsAbstractExpanded(false);
  };

  const handleOpenArticle = (article: Article) => {
    if (article.doi) {
      window.open(`https://doi.org/${article.doi}`, "_blank");
    } else if (article.pmid) {
      window.open(`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`, "_blank");
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

        if (selectedArticle?.id === article.id) {
          setSelectedArticle(prev => (prev ? updateArticle(prev) : null));
        }

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
    const folderName = folderObj.name;

    axiosInstance
      .post("/bookmarks/save_bookmark", {
        article_id: articleId,
        folder_key: folderKey,
        folder_name: folderName,
      })
      .then(() => {
        setUserBookmarks(prev => {
          const updated = { ...prev };
          if (!updated[folderKey]) {
            updated[folderKey] = [];
          }
          if (!updated[folderKey].includes(articleId)) {
            updated[folderKey] = [...updated[folderKey], articleId];
          }
          return updated;
        });

        message.success(`Article bookmarked to "${folderObj.name}"!`);
        setIsBookmarkModalOpen(false);
        setArticleToBookmark(null);
        setSelectedFolder(null);
      })
      .catch(error => {
        console.error("Failed to bookmark article:", error);
        message.error("Failed to bookmark article");
      });
  };

  const handleDeleteBookmark = async (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Find which folder contains this article
      let folderKey = null;
      for (const [key, articleIds] of Object.entries(userBookmarks)) {
        if (articleIds.includes(article.id)) {
          folderKey = key;
          break;
        }
      }

      if (!folderKey) {
        message.error("Bookmark not found");
        return;
      }

      await axiosInstance.post("/bookmarks/delete_bookmark", {
        article_id: article.id,
        folder_key: folderKey,
      });

      setUserBookmarks(prev => {
        const updated = { ...prev };
        if (updated[folderKey]) {
          updated[folderKey] = updated[folderKey].filter(id => id !== article.id);
        }
        return updated;
      });

      message.success("Bookmark removed!");
    } catch (error) {
      message.error("Failed to remove bookmark");
    }
  };

  const handleShareArticle = (article: Article, platform?: "linkedin" | "twitter" | "facebook" | "copyLink") => {
    const articleUrl = article.doi ? `https://doi.org/${article.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
    const text = `Check out this article: ${article.title}`;

    if (platform === "copyLink") {
      navigator.clipboard.writeText(articleUrl);
      message.success("Link copied to clipboard!");
      return;
    }

    let shareUrl = "";
    if (platform === "twitter") {
      shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(articleUrl)}`;
    } else if (platform === "linkedin") {
      shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`;
    } else if (platform === "facebook") {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
    }

    if (shareUrl) {
      window.open(shareUrl, "_blank", "width=600,height=400");
    }
  };

  const isArticleBookmarked = (articleId: number) => {
    return Object.values(userBookmarks).some(bookmarkIds => bookmarkIds.includes(articleId));
  };

  const handleUpdateCommentCount = (articleId: number, newCount: number) => {
    setDisplayedArticles(prev => prev.map(article => (article.id === articleId ? { ...article, comments_count: newCount } : article)));

    if (selectedArticle?.id === articleId) {
      setSelectedArticle(prev => (prev ? { ...prev, comments_count: newCount } : null));
    }
  };

  const shareMenuItems = (article: Article): MenuProps["items"] => [
    {
      key: "copyLink",
      label: "Copy Link",
      onClick: () => handleShareArticle(article, "copyLink"),
    },
    {
      key: "twitter",
      label: "Share on Twitter",
      onClick: () => handleShareArticle(article, "twitter"),
    },
    {
      key: "linkedin",
      label: "Share on LinkedIn",
      onClick: () => handleShareArticle(article, "linkedin"),
    },
    {
      key: "facebook",
      label: "Share on Facebook",
      onClick: () => handleShareArticle(article, "facebook"),
    },
  ];

  if (!journalId) {
    return (
      <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
        <Empty description="No journal selected" />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header */}
        <div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/SourceJournals")} className="mb-4">
            Back to Journals
          </Button>
          <Title level={2} className="flex! items-center! gap-4!">
            {articlesData?.journal_info.journal_icon_url ? (
              <img
                src={articlesData.journal_info.journal_icon_url}
                alt=""
                className="w-8 h-8 shrink-0 rounded object-contain"
                onError={e => {
                  e.currentTarget.style.display = "none";
                  const next = e.currentTarget.nextElementSibling as HTMLElement;
                  if (next) next.style.display = "inline";
                }}
              />
            ) : null}
            <BsFillJournalBookmarkFill className={`text-green-800!${articlesData?.journal_info.journal_icon_url ? " hidden" : ""}`} />
            {articlesData?.journal_info.journal_title || journalTitle || "Journal Articles"}
          </Title>
          {articlesData?.journal_info && (
            <div className="flex gap-4 items-center mt-2">
              {articlesData.journal_info.wos_impact_factor && (
                <Tag icon={<ExperimentOutlined />} color="blue">
                  Impact Factor: {articlesData.journal_info.wos_impact_factor.toFixed(2)}
                </Tag>
              )}
              {articlesData.journal_info.issn && <Tag>ISSN: {articlesData.journal_info.issn}</Tag>}
              {articlesData.journal_info.eissn && <Tag>eISSN: {articlesData.journal_info.eissn}</Tag>}
            </div>
          )}
          <Text type="secondary" className="block mt-2">
            Showing the latest {articlesData?.articles.length || 0} articles from this journal
          </Text>
        </div>

        {/* Articles List */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "50px" }}>
            <Spin size="large" />
          </div>
        ) : displayedArticles && displayedArticles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {displayedArticles.map(article => (
              <Card
                key={article.id}
                hoverable
                className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-xl!"
                styles={{
                  body: { padding: "16px", display: "flex", flexDirection: "column", height: "100%" },
                }}
                onClick={() => handleArticleClick(article)}
              >
                {/* Header with Tags */}
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
                <h3 className="text-base font-semibold text-gray-900 mb-3 leading-tight">{article.title}</h3>

                {/* Authors */}
                <div className="flex items-start gap-2 mb-2 text-sm text-gray-600">
                  <UserOutlined className="mt-1 shrink-0" />
                  <span className="line-clamp-2">{formatAuthors(article.authors_full)}</span>
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
                          const next = e.currentTarget.nextElementSibling as HTMLElement;
                          if (next) next.style.display = "inline";
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
                                className={`text-xs! m-0! ${
                                  term.hasAsterisk ? "text-gray-600! border-gray-200!" : " text-gray-700! border-gray-200!"
                                }`}
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

                {/* Abstract or Graphical Abstract or First Figure */}
                {article.graphical_abstract_path || getFirstFigureUrl(article.figures_urls) ? (
                  <div className="mb-2 grow flex items-center justify-center overflow-hidden ">
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
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "block";
                      }}
                    />
                    {/* <p className="text-sm text-gray-700 p-3 line-clamp-4 hidden">{truncateAbstract(article.abstract)}</p> */}
                  </div>
                ) : (
                  // <p className="text-sm text-gray-700 line-clamp-4 grow">{truncateAbstract(article.abstract)}</p>
                  ""
                )}

                {/* Footer Actions */}
                <div className="mt-auto pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                  <div className="w-full flex justify-center mb-2">
                    <Space size="small">
                      <Button
                        type="default"
                        onClick={e => {
                          e.stopPropagation();
                          handleArticleClick(article);
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
                          handleArticleClick(article);
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
        ) : (
          <Empty description="No articles found for this journal" />
        )}
      </Space>

      {/* Article Details Modal */}
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

      {/* Bookmark Folder Modal */}
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
    </div>
  );
}

export default JournalArticles;
