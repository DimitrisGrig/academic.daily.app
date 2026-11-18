import { Tag, Button, Tooltip, Modal, Collapse, Input, List, Avatar, Popconfirm, message } from "antd";
import {
  BookOutlined,
  CalendarOutlined,
  UserOutlined,
  CloseOutlined,
  LikeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  InfoCircleOutlined,
  SendOutlined,
  DeleteOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { BsCopy } from "react-icons/bs";
import { FiExternalLink } from "react-icons/fi";
import { RiLinkedinBoxFill, RiTwitterXFill } from "react-icons/ri";
import { TiSocialFacebook } from "react-icons/ti";
import { HiOutlineHashtag } from "react-icons/hi";
import { PiMagnifyingGlassBold } from "react-icons/pi";
import { IoBookmarkOutline, IoBookmark } from "react-icons/io5";
import { FiFileText } from "react-icons/fi";
import { getLastAuthorCountry } from "../../lib/authorCountries";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { Spin } from "antd";
import axiosInstance from "../../lib/axios";
import { fetchGseIds } from "../../lib/geoApi";
import AddToGroupModal from "../shared/AddToGroupModal";
import { FaLocationDot } from "react-icons/fa6";
import { SiZotero } from "react-icons/si";
import { getZoteroStatus, initZoteroAuth, exportToZotero, getZoteroExportedArticles } from "../../lib/exportToZotero";

interface RelatedArticle {
  id: number;
  title: string;
  journal: string | null;
  publication_date: string | null;
  impact_factor: number | null;
  doi: string | null;
  pmid: string | null;
}

interface Article {
  id: number;
  publication_type: string | null;
  issn: string | null;
  title: string;
  abstract: string;
  journal: string;
  publication_date: string;
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
  // @ts-ignore
  user_has_read: boolean;
  comments_count?: number;
  impact_factor?: number | null;
  journal_icon_url?: string | null;
  created_at?: string;
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
}

interface Comment {
  id: number;
  article_id: number;
  user_id: string;
  first_name: string;
  last_name: string;
  comment_text: string;
  created_at: string;
}

interface ArticleDetailsModalProps {
  isOpen: boolean;
  article: Article | null;
  isAbstractExpanded: boolean;
  userBookmarks: { [key: string]: number[] };
  availableFolders: Array<{ key: string; name: string }>;
  onClose: () => void;
  onOpenArticle: (article: Article) => void;
  onUpvote: (article: Article, e: React.MouseEvent) => void;
  onBookmarkClick: (article: Article, e: React.MouseEvent) => void;
  onDeleteBookmark: (article: Article, e: React.MouseEvent) => void;
  onShareArticle: (article: Article, platform?: "linkedin" | "twitter" | "facebook" | "copyLink") => void;
  onSetAbstractExpanded: (expanded: boolean) => void;
  isArticleBookmarked: (articleId: number) => boolean;
  onUpdateCommentCount?: (articleId: number, newCount: number) => void;
}

function ArticleDetailsModal({
  isOpen,
  article: selectedArticle,
  // isAbstractExpanded,
  onClose: handleCloseModal,
  onOpenArticle: handleOpenArticle,
  onUpvote: handleUpvote,
  onBookmarkClick: handleBookmarkClick,
  onDeleteBookmark: handleDeleteBookmark,
  onShareArticle: handleShareArticle,
  // onSetAbstractExpanded: setIsAbstractExpanded,
  isArticleBookmarked,
  onUpdateCommentCount,
}: ArticleDetailsModalProps) {
  const { user } = useUser();
  const { TextArea } = Input;

  // Related articles state
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Comment state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isAddToGroupOpen, setIsAddToGroupOpen] = useState(false);
  const [showAllAuthors, setShowAllAuthors] = useState(false);
  const [showAllAffiliations, setShowAllAffiliations] = useState(false);

  // GEO dataset IDs state
  const [gseIds, setGseIds] = useState<string[]>([]);
  const [isLoadingGse, setIsLoadingGse] = useState(false);

  // Zotero integration state
  const [isZoteroConnected, setIsZoteroConnected] = useState(false);
  const [isZoteroExporting, setIsZoteroExporting] = useState(false);
  const [isZoteroLoading, setIsZoteroLoading] = useState(true);
  const [isZoteroExported, setIsZoteroExported] = useState(false);

  // Fetch Zotero connection status on mount
  useEffect(() => {
    getZoteroStatus()
      .then(connected => setIsZoteroConnected(connected))
      .catch(() => setIsZoteroConnected(false))
      .finally(() => setIsZoteroLoading(false));
  }, []);

  // Check if current article was already exported to Zotero
  useEffect(() => {
    if (selectedArticle && isOpen && isZoteroConnected) {
      setIsZoteroExported(false);
      getZoteroExportedArticles([selectedArticle.id])
        .then(ids => setIsZoteroExported(ids.includes(selectedArticle.id)))
        .catch(() => {});
    } else {
      setIsZoteroExported(false);
    }
  }, [selectedArticle?.id, isOpen, isZoteroConnected]);

  // Fetch related articles when article changes and modal is open
  useEffect(() => {
    if (selectedArticle && isOpen) {
      setRelatedArticles([]);
      setIsLoadingRelated(true);
      axiosInstance
        .get(`/mainFeed/related_articles/${selectedArticle.id}?k=4`)
        .then(res => setRelatedArticles(res.data || []))
        .catch(err => console.error("Failed to fetch related articles:", err))
        .finally(() => setIsLoadingRelated(false));
    }
  }, [selectedArticle?.id, isOpen]);

  // Fetch GEO dataset IDs (non-blocking, after modal renders)
  useEffect(() => {
    if (selectedArticle?.pmid && isOpen) {
      setGseIds([]);
      setIsLoadingGse(true);
      fetchGseIds(selectedArticle.pmid)
        .then(ids => setGseIds(ids))
        .finally(() => setIsLoadingGse(false));
    } else {
      setGseIds([]);
    }
  }, [selectedArticle?.pmid, isOpen]);

  // Fetch comments when article changes and modal is open
  useEffect(() => {
    if (selectedArticle && isOpen) {
      fetchComments();
    }
  }, [selectedArticle?.id, isOpen]);

  // Show comments section by default if there are comments
  //   useEffect(() => {
  //     if (comments.length > 0) {
  //       setShowComments(true);
  //     }
  //   }, [comments.length]);

  const fetchComments = async () => {
    if (!selectedArticle) return;

    setIsLoadingComments(true);
    try {
      const response = await axiosInstance.get(`/comments/get_comments/${selectedArticle.id}`);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      message.error("Failed to load comments");
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !selectedArticle) {
      message.warning("Please enter a comment");
      return;
    }

    setIsSubmittingComment(true);
    try {
      const response = await axiosInstance.post("/comments/add_comment", {
        article_id: selectedArticle.id,
        comment_text: newComment.trim(),
      });

      if (response.data.success) {
        setComments([response.data.comment, ...comments]);
        setNewComment("");
        message.success("Comment added successfully!");
        // Update comment count in parent component
        if (response.data.comments_count !== undefined && onUpdateCommentCount) {
          onUpdateCommentCount(selectedArticle.id, response.data.comments_count);
        } else if (onUpdateCommentCount) {
          // Fallback: increment by 1 if server doesn't return count
          onUpdateCommentCount(selectedArticle.id, (selectedArticle.comments_count || 0) + 1);
        }
      }
    } catch (error) {
      console.error("Failed to add comment:", error);
      message.error("Failed to add comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    try {
      const response = await axiosInstance.delete(`/comments/delete_comment/${commentId}`);

      if (response.data.success) {
        setComments(comments.filter(c => c.id !== commentId));
        message.success("Comment deleted successfully!");
        // Update comment count in parent component
        if (response.data.comments_count !== undefined && onUpdateCommentCount && selectedArticle) {
          onUpdateCommentCount(selectedArticle.id, response.data.comments_count);
        } else if (onUpdateCommentCount && selectedArticle) {
          // Fallback: decrement by 1 if server doesn't return count
          onUpdateCommentCount(selectedArticle.id, Math.max(0, (selectedArticle.comments_count || 0) - 1));
        }
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
      message.error("Failed to delete comment");
    }
  };

  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Reset expand states when article changes
  useEffect(() => {
    setShowAllAuthors(false);
    setShowAllAffiliations(false);
  }, [selectedArticle?.id]);

  // Helper: parse authors into structured array
  const parseAuthors = (authors: string[] | string): { name: string; affiliations: string[] }[] => {
    if (!authors) return [];
    if (typeof authors === "string") {
      return authors
        .split(";")
        .map(a => a.trim())
        .filter(a => a.length > 0)
        .map(a => {
          const match = a.match(/^(.+?):(\d+(?:,\d+)*)$/);
          if (match) {
            return { name: match[1].trim(), affiliations: match[2].split(",").map(n => n.trim()) };
          }
          return { name: a.split(":")[0].trim().replace(/:$/, ""), affiliations: [] };
        });
    }
    if (!Array.isArray(authors) || authors.length === 0) return [];
    return authors.map(a => ({ name: a.split(":")[0].trim().replace(/:$/, ""), affiliations: [] }));
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

  const handleZoteroExport = async (force = false) => {
    if (!selectedArticle) return;
    if (!isZoteroConnected) {
      try {
        const authorizeUrl = await initZoteroAuth();
        window.location.href = authorizeUrl;
      } catch {
        message.error("Failed to start Zotero connection. Please try again.");
      }
      return;
    }
    setIsZoteroExporting(true);
    try {
      const articleUrl = selectedArticle.doi
        ? `https://doi.org/${selectedArticle.doi}`
        : selectedArticle.pmid
          ? `https://pubmed.ncbi.nlm.nih.gov/${selectedArticle.pmid}/`
          : "";
      const msg = await exportToZotero(
        {
          article_id: selectedArticle.id,
          title: selectedArticle.title,
          abstract: selectedArticle.abstract,
          journal: selectedArticle.journal,
          publication_date: selectedArticle.publication_date,
          authors_full: selectedArticle.authors_full,
          doi: selectedArticle.doi,
          pmid: selectedArticle.pmid,
          pmcid: selectedArticle.pmcid,
          issn: selectedArticle.issn,
          mesh_terms: selectedArticle.mesh_terms,
          url: articleUrl,
        },
        force
      );
      message.success(msg);
      setIsZoteroExported(true);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || "Failed to export to Zotero.";
      if (status === 403) {
        setIsZoteroConnected(false);
      } else if (status === 409) {
        setIsZoteroExported(true);
      }
      message.error(detail);
    } finally {
      setIsZoteroExporting(false);
    }
  };

  return (
    <>
      <Modal
        open={isOpen}
        onCancel={handleCloseModal}
        footer={null}
        width="100%"
        style={{
          top: 10,
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 8px",
        }}
        closeIcon={false}
        className="article-modal"
      >
        <div className="flex justify-end mb-2! border-b! border-gray-400!">
          <Button
            className="text-gray-600! mb-1! border-0! hover:bg-orange-100! hover:border-orange-400! hover:text-orange-600!"
            onClick={handleCloseModal}
          >
            <CloseOutlined className="text-xl!" />
          </Button>
        </div>
        {selectedArticle && (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Main Content */}
            <div className="flex-1 space-y-4 lg:space-y-6 order-2 lg:order-1">
              {/* Header */}
              <div>
                <div className="flex gap-2 mb-3 justify-between items-start">
                  <div className="flex gap-2">
                    {selectedArticle.is_open_access_unpaywall && (
                      <Tag color="green" className="text-lime-600! tracking-wide! font-semibold!">
                        Open Access
                      </Tag>
                    )}
                    {selectedArticle.publication_type && <Tag color="blue">{selectedArticle.publication_type}</Tag>}
                  </div>
                  <Button
                    type="default"
                    onClick={() => handleOpenArticle(selectedArticle)}
                    disabled={!selectedArticle.doi && !selectedArticle.pmid}
                    // className="font-semibold! shadow-sm! hover:shadow-md! transition-all! duration-200! border-gray-300! hover:border-blue-500! hover:text-blue-600! hover:bg-blue-50!"
                    className="h-7! px-2! bg-indigo-500! text-white! hover:shadow-md! transition-all! duration-200! border-gray-300! hover:border-blue-500! hover:text-blue-600! hover:bg-blue-50!"
                  >
                    Read Full Article
                    <FiExternalLink className="text-lg!" />
                  </Button>
                </div>
                <h2 className="text-lg lg:text-2xl font-semibold text-gray-900 mb-3 lg:mb-4 leading-snug">{selectedArticle.title}</h2>
              </div>

              {/* Authors */}
              <div className="border-b pb-3">
                <div className="flex items-start gap-2 text-gray-700">
                  <UserOutlined className="mt-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-500 mb-1">Authors</p>
                    <div className="text-sm lg:text-base">
                      {(() => {
                        const allAuthors = parseAuthors(selectedArticle.authors_full);
                        if (allAuthors.length === 0) return <span>Unknown authors</span>;

                        const renderAuthor = (author: { name: string; affiliations: string[] }, idx: number, isLast: boolean) => (
                          <span key={idx}>
                            {author.name}
                            {author.affiliations.map((affNum, affIdx) => (
                              <sup key={affIdx} className="text-blue-600 ml-0.5">
                                {affNum}
                              </sup>
                            ))}
                            {!isLast && ", "}
                          </span>
                        );

                        if (allAuthors.length <= 2 || showAllAuthors) {
                          return allAuthors.map((a, i) => renderAuthor(a, i, i === allAuthors.length - 1));
                        }

                        // Show first and last author only
                        const first = allAuthors[0];
                        const last = allAuthors[allAuthors.length - 1];
                        return (
                          <>
                            {renderAuthor(first, 0, false)}
                            <span className="text-gray-400 mx-0.5">... </span>
                            {renderAuthor(last, allAuthors.length - 1, true)}
                          </>
                        );
                      })()}
                    </div>
                    {(() => {
                      const allAuthors = parseAuthors(selectedArticle.authors_full);
                      if (allAuthors.length <= 2) return null;
                      return (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setShowAllAuthors(!showAllAuthors)}
                          className="p-0! h-auto! text-blue-600! hover:text-blue-800! text-xs! mt-1!"
                        >
                          {showAllAuthors ? "Show less" : `Show all ${allAuthors.length} authors`}
                        </Button>
                      );
                    })()}
                    {/* Author Country Tag */}
                    {(() => {
                      const country = getLastAuthorCountry(selectedArticle.authors_full, selectedArticle.affiliations);
                      if (!country) return null;
                      return (
                        <div className="flex gap-1 mt-2 overflow-x-auto">
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
              </div>

              {/* Journal & Date */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 border-b pb-3 lg:pb-4">
                <div className="flex items-start gap-2 text-gray-700">
                  <BookOutlined className="mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-gray-500 mb-1">Journal</p>
                    <p className="text-base">{selectedArticle.journal || "Unknown journal"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-gray-700">
                  <CalendarOutlined className="mt-1 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-gray-500 mb-1">Publication Date</p>
                    <p className="text-base">
                      {new Date(selectedArticle.publication_date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                    </p>
                  </div>
                </div>
                {selectedArticle.created_at && (
                  <div className="flex items-start gap-2 text-gray-700">
                    <CalendarOutlined className="mt-1 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm text-gray-500 mb-1">First online</p>
                      <p className="text-base">{formatDate(selectedArticle.created_at)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Graphical Abstract or First Figure */}
              {(selectedArticle.graphical_abstract_path || getFirstFigureUrl(selectedArticle.figures_urls)) && (
                <div className="border-b pb-4!">
                  <p className="font-semibold text-sm text-gray-500 mb-3!">
                    {selectedArticle.graphical_abstract_path ? "Graphical Abstract" : "Figure"}
                  </p>
                  <div className="flex justify-center rounded-lg">
                    <a
                      href={selectedArticle.graphical_abstract_path || getFirstFigureUrl(selectedArticle.figures_urls) || ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={selectedArticle.graphical_abstract_path || getFirstFigureUrl(selectedArticle.figures_urls) || ""}
                        alt={selectedArticle.graphical_abstract_path ? "Graphical Abstract" : "Figure"}
                        className="max-w-full h-auto max-h-84 object-contain rounded-lg"
                      />
                    </a>
                  </div>
                </div>
              )}

              {/* Abstract */}
              <div className="border-b pb-2!">
                <p className="font-semibold text-sm text-gray-500 mb-3!">Abstract</p>
                <div className="text-sm lg:text-base text-justify text-gray-700 leading-relaxed">
                  {selectedArticle.abstract ? (
                    <>
                      {(() => {
                        const text = selectedArticle.abstract;
                        // Split on known structured abstract section labels immediately followed by ":"
                        // Use non-capturing group (?:...) inside the lookahead to avoid artefact elements in the split result
                        const sectionLabels = [
                          "Background",
                          "Objectives?",
                          "Purpose",
                          "Methods?",
                          "Results",
                          "Conclusions?",
                          "Discussion",
                          "Introduction",
                          "Summary",
                          "Importance",
                          "Keywords?",
                          "Findings",
                          "Significance",
                          "Context",
                          "Design",
                          "Setting",
                          "Participants",
                          "Interventions",
                          "Main Outcomes?(?:\\s+and\\s+Measures?)?",
                          "Measures?",
                          "Data Sources?",
                          "Study Design",
                          "Limitations?",
                          "Interpretation",
                          "Evidence Review",
                          "Meaning",
                          "Unstructured",
                        ];
                        // (?=(?:Label):) — lookahead with NON-capturing group, colon is required
                        // Case-insensitive so we catch e.g. "BACKGROUND:" or "background:"
                        const sectionRegex = new RegExp(`(?=(?:${sectionLabels.join("|")}):\\s)`, "i");
                        const parts = text.split(sectionRegex).filter(p => p.trim().length > 0);
                        // Helper: turn URLs in text into clickable links
                        const linkify = (str: string) => {
                          const urlPattern = /(https?:\/\/[^\s,;)>"']+)/g;
                          const segments = str.split(urlPattern);
                          if (segments.length === 1) return str;
                          return segments.map((seg, idx) =>
                            /^https?:\/\//.test(seg) ? (
                              <a
                                key={idx}
                                href={seg.replace(/\.$/, "")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {seg.replace(/\.$/, "")}
                              </a>
                            ) : (
                              <span key={idx}>{seg}</span>
                            )
                          );
                        };
                        if (parts.length <= 1) {
                          return <p>{linkify(text)}</p>;
                        }
                        return (
                          <div className="space-y-2">
                            {parts.map((part, i) => {
                              // Match "Label:" strictly at the very start of the chunk
                              const labelMatch = part.match(/^([A-Za-z][A-Za-z\s]*):\s*/);
                              if (labelMatch) {
                                // Normalize: first letter uppercase, rest lowercase
                                const rawLabel = labelMatch[1].trimEnd();
                                const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase();
                                const rest = part.slice(labelMatch[0].length);
                                // Keywords section: render each keyword as a tag
                                if (/^keywords?$/i.test(label)) {
                                  const keywords = rest
                                    .split(";")
                                    .map(k => k.trim().replace(/\.$/, ""))
                                    .filter(k => k.length > 0);
                                  return (
                                    // Keywords
                                    <div key={i}>
                                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                                        <span className="font-semibold text-gray-900">{label}:</span>
                                        {keywords.map((kw, j) => (
                                          <span
                                            key={j}
                                            className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-md border border-gray-200"
                                          >
                                            {kw}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }
                                return (
                                  <p key={i}>
                                    <span className="font-semibold text-gray-900">{label}:</span> {linkify(rest)}
                                  </p>
                                );
                              }
                              return <p key={i}>{linkify(part)}</p>;
                            })}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p>No abstract available</p>
                  )}
                </div>
              </div>

              {/* Affiliations */}
              {selectedArticle.affiliations &&
                (() => {
                  const allAffiliations = selectedArticle.affiliations
                    .split(";")
                    .map(a => a.trim())
                    .filter(a => /^\d+\s*/.test(a));
                  if (allAffiliations.length === 0) return null;
                  const COLLAPSED_COUNT = 2;
                  const visible = showAllAffiliations ? allAffiliations : allAffiliations.slice(0, COLLAPSED_COUNT);
                  return (
                    <div>
                      <p className="font-semibold text-sm! text-gray-500! mb-2!">Affiliations</p>
                      <div className="text-gray-700 space-y-1.5">
                        {visible.map((affiliation, index) => {
                          const match = affiliation.match(/^(\d+)\s*(.+)$/);
                          const number = match ? match[1] : "";
                          const text = match ? match[2] : affiliation;
                          return (
                            <div key={index} className="flex gap-2 text-xs lg:text-sm">
                              <span className="shrink-0 font-medium min-w-5 text-right text-gray-400">{number}.</span>
                              <span className="flex-1">{text}</span>
                            </div>
                          );
                        })}
                      </div>
                      {allAffiliations.length > COLLAPSED_COUNT && (
                        <Button
                          type="link"
                          size="small"
                          onClick={() => setShowAllAffiliations(!showAllAffiliations)}
                          className="p-0! h-auto! text-blue-600! hover:text-blue-800! text-xs! mt-1!"
                        >
                          {showAllAffiliations ? "Show less" : `Show all ${allAffiliations.length} affiliations`}
                        </Button>
                      )}
                    </div>
                  );
                })()}

              {/* Footer Actions */}
              <div className="items-center pt-2! border-t">
                {/* Article Interactions */}
                <div className="p-1 border rounded-xl shadow-md border-gray-300">
                  <div className="flex items-center justify-around w-full">
                    <Tooltip title={selectedArticle.user_has_upvoted ? "Remove upvote" : "Upvote this article"}>
                      <Button
                        type="text"
                        icon={<LikeOutlined className="text-xl!" />}
                        onClick={e => handleUpvote(selectedArticle, e)}
                        className={`flex! flex-col! items-center! gap-0! h-auto! py-2! px-4! rounded-lg! ${
                          selectedArticle.user_has_upvoted
                            ? "text-green-500! bg-green-50!"
                            : "text-gray-500! hover:text-green-500! hover:bg-green-50!"
                        }`}
                      >
                        <span className="text-xs font-medium hidden sm:block">{selectedArticle.user_has_upvoted ? "Upvoted" : "Upvote"}</span>
                        <span className="text-xs font-medium">{selectedArticle.upvotes || 0}</span>
                      </Button>
                    </Tooltip>
                    <Tooltip title="View and add comments">
                      <Button
                        type="text"
                        icon={<CommentOutlined className="text-xl!" />}
                        onClick={e => {
                          e.stopPropagation();
                          setShowComments(!showComments);
                        }}
                        className={`flex! flex-col! items-center! gap-0! h-auto! py-2! px-4! rounded-lg! ${
                          showComments ? "text-indigo-500! bg-indigo-50!" : "text-gray-500! hover:text-indigo-500! hover:bg-indigo-50!"
                        }`}
                      >
                        <span className="text-xs font-medium hidden sm:block">Comment</span>
                        <span className="text-xs font-medium">{comments.length}</span>
                      </Button>
                    </Tooltip>
                    <Tooltip title={selectedArticle && isArticleBookmarked(selectedArticle.id) ? "Remove from bookmarks" : "Bookmark this article"}>
                      <Button
                        type="text"
                        icon={
                          selectedArticle && isArticleBookmarked(selectedArticle.id) ? (
                            <IoBookmark className="text-xl!" />
                          ) : (
                            <IoBookmarkOutline className="text-xl!" />
                          )
                        }
                        onClick={e =>
                          selectedArticle &&
                          (isArticleBookmarked(selectedArticle.id)
                            ? handleDeleteBookmark(selectedArticle, e)
                            : handleBookmarkClick(selectedArticle, e))
                        }
                        className={`flex! flex-col! items-center! gap-0! h-auto! py-2! px-4! rounded-lg! ${
                          selectedArticle && isArticleBookmarked(selectedArticle.id)
                            ? "text-orange-500! bg-orange-50!"
                            : "text-gray-500! hover:text-orange-500! hover:bg-orange-50!"
                        }`}
                      >
                        <span className="text-xs font-medium hidden sm:block">
                          {selectedArticle && isArticleBookmarked(selectedArticle.id) ? "Bookmarked" : "Bookmark"}
                        </span>
                      </Button>
                    </Tooltip>
                    <Tooltip title="Share to Group">
                      <Button
                        type="text"
                        icon={<TeamOutlined className="text-xl!" />}
                        onClick={e => {
                          e.stopPropagation();
                          setIsAddToGroupOpen(true);
                        }}
                        className="flex! flex-col! items-center! gap-0! h-auto! py-2! px-4! rounded-lg! text-gray-500! hover:text-sky-500! hover:bg-sky-50!"
                      >
                        <span className="text-xs font-medium hidden sm:block">Share</span>
                      </Button>
                    </Tooltip>
                    <Tooltip title="Close">
                      <Button
                        type="text"
                        icon={<CloseOutlined className="text-xl!" />}
                        onClick={e => {
                          e.stopPropagation();
                          handleCloseModal();
                        }}
                        className="flex! flex-col! items-center! gap-0! h-auto! py-2! px-4! text-gray-500! hover:text-red-500! hover:bg-red-50! rounded-lg!"
                      >
                        <span className="text-xs font-medium hidden sm:block">Close</span>
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                {/* END -> Article Interactions */}
              </div>

              {/* Comments Section */}
              {showComments && (
                <div className="border-t pt-4!">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CommentOutlined className="text-indigo-500!" />
                    Comments ({comments.length})
                  </h3>

                  {/* Add Comment */}
                  <div className="mb-4">
                    <TextArea
                      rows={3}
                      placeholder="Write your comment here..."
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      className="mb-2"
                      maxLength={500}
                    />
                    <div className="flex justify-between items-center">
                      <span className="text-xs! text-gray-500!">{newComment.length}/500 characters</span>
                      <Button
                        type="default"
                        icon={<SendOutlined />}
                        onClick={handleSubmitComment}
                        loading={isSubmittingComment}
                        disabled={!newComment.trim()}
                        className="mt-2! hover:text-blue-600 transition-colors duration-200! hover:bg-blue-50 border-gray-300"
                      >
                        Post Comment
                      </Button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {isLoadingComments ? (
                      <div className="text-center py-4">
                        <span className="text-gray-500">Loading comments...</span>
                      </div>
                    ) : comments.length === 0 ? (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <CommentOutlined className="text-4xl! text-gray-300! mb-2!" />
                        <p className="text-gray-500">No comments yet. Be the first to comment!</p>
                      </div>
                    ) : (
                      <List
                        dataSource={comments}
                        renderItem={comment => (
                          <List.Item
                            key={comment.id}
                            className="border! border-gray-200! rounded-lg! p-3! mb-3! bg-white! hover:shadow-sm! transition-shadow!"
                          >
                            <div className="w-full">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Avatar className="bg-indigo-500!">{comment.first_name?.[0]?.toUpperCase() || "U"}</Avatar>
                                  <div>
                                    <p className="font-semibold! text-gray-900! text-sm!">
                                      {comment.first_name} {comment.last_name}
                                    </p>
                                    <p className="text-xs! text-gray-500!">{formatCommentDate(comment.created_at)}</p>
                                  </div>
                                </div>
                                {user?.id === comment.user_id && (
                                  <Popconfirm
                                    title="Delete comment"
                                    description="Are you sure you want to delete this comment?"
                                    onConfirm={() => handleDeleteComment(comment.id)}
                                    okText="Yes"
                                    cancelText="No"
                                  >
                                    <Button
                                      type="text"
                                      danger
                                      size="small"
                                      icon={<DeleteOutlined />}
                                      className="text-gray-400! hover:text-red-500!"
                                    />
                                  </Popconfirm>
                                )}
                              </div>
                              <p className="text-gray-700 text-sm whitespace-pre-wrap!">{comment.comment_text}</p>
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Copyright Notice — desktop only (inside main column) */}
              <div className="hidden lg:block border-t pt-2 mt-6">
                <div className="bg-gray-100 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-gray-600 leading-relaxed">
                    <span className="font-semibold">Copyright Notice:</span> All rights to this article, including the title, abstract, content, and
                    associated materials, are reserved by <span className="font-medium">{selectedArticle.journal || "the original publisher"}</span>{" "}
                    and the original authors. This information is provided for informational and educational purposes only. For full access and usage
                    rights, please refer to the original publication.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="w-full lg:w-80 space-y-4 order-3 lg:order-2">
              {/* Journal Info Card - Desktop */}
              <div className="hidden lg:block border border-gray-400! rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  {/* <BookOutlined className="text-xl! text-gray-500!" /> */}
                  <h3 className="flex-1 font-semibold text-gray-800 text-base">Journal Information</h3>
                  <Tooltip title="Metrics and details about this journal">
                    <InfoCircleOutlined className="text-gray-400! hover:text-gray-600! cursor-help!" />
                  </Tooltip>
                </div>

                <div className="space-y-4">
                  {/* Journal Name */}
                  <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
                    <div className="flex items-center gap-2">
                      {selectedArticle.journal_icon_url && (
                        <img
                          src={selectedArticle.journal_icon_url}
                          alt=""
                          className="w-5 h-5 shrink-0 rounded-sm object-contain"
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <h4 className="font-semibold text-gray-900 text-sm leading-snug">
                        {selectedArticle.journal.split("=")[0].trim() || "Unknown Journal"}
                      </h4>
                    </div>
                    {selectedArticle.issn && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        ISSN: <span className="font-medium">{selectedArticle.issn}</span>
                      </p>
                    )}
                  </div>

                  {selectedArticle?.wos_journal && (
                    <>
                      {/* Impact Factors */}
                      <div className="space-y-2">
                        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">Impact Factor</span>
                            <span className="text-lg font-semibold text-amber-700">{selectedArticle.wos_journal.journal_impact_factor || "N/A"}</span>
                          </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-600 font-medium">5-Year Impact Factor</span>
                            <span className="text-lg font-semibold text-amber-700">
                              {selectedArticle?.wos_journal?.five_year_impact_factor || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Publisher & Country */}
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 space-y-2">
                        {selectedArticle?.scimagojr_rankings?.publisher && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 font-medium min-w-[70px]">Publisher:</span>
                            <span className="text-xs text-gray-800 font-semibold flex-1">{selectedArticle.scimagojr_rankings.publisher}</span>
                          </div>
                        )}
                        {selectedArticle?.wos_journal?.country && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-gray-500 font-medium min-w-[70px]">Country:</span>
                            <span className="text-xs text-gray-800 font-semibold flex-1">
                              {selectedArticle.wos_journal.country.charAt(0).toUpperCase() +
                                selectedArticle.wos_journal.country.slice(1).toLowerCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Categories */}
                      {selectedArticle?.scimagojr_rankings?.categories && (
                        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <span className="w-1 h-4 bg-orange-400 rounded-full"></span>
                            Categories
                          </p>
                          <div className="space-y-1.5 ml-2">
                            {selectedArticle.scimagojr_rankings.categories
                              .split(";")
                              .map(cat => cat.trim())
                              .filter(cat => cat.length > 0)
                              .map((cat, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-orange-500 text-xs -mt-0.5!">•</span>
                                  <span className="text-xs text-gray-700 leading-tight">{cat}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Areas */}
                      {selectedArticle?.scimagojr_rankings?.areas && (
                        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                          <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <span className="w-1 h-4 bg-cyan-400 rounded-full"></span>
                            Areas
                          </p>
                          <div className="space-y-1.5 ml-2">
                            {selectedArticle.scimagojr_rankings.areas
                              .split(";")
                              .map(area => area.trim())
                              .filter(area => area.length > 0)
                              .map((area, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-cyan-500 text-xs -mt-0.5!">•</span>
                                  <span className="text-xs text-gray-700 leading-tight">{area}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Related Articles */}
              <div className="border border-gray-400! rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3! flex items-center gap-2">
                  <FiFileText className="text-lg! text-indigo-600!" />
                  Related Articles
                </p>
                {isLoadingRelated ? (
                  <div className="flex justify-center py-4">
                    <Spin size="small" />
                  </div>
                ) : relatedArticles.length > 0 ? (
                  <div className="space-y-2.5">
                    {relatedArticles.map(ra => (
                      <a
                        key={ra.id}
                        href={`/Article?article_id=${ra.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200 cursor-pointer no-underline!"
                      >
                        <h4 className="text-xs font-semibold text-gray-900 leading-snug mb-1.5 line-clamp-2">{ra.title}</h4>
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                          {ra.journal && <span className="text-[11px] text-gray-500 truncate max-w-[160px]">{ra.journal}</span>}
                          {ra.impact_factor !== null && (
                            <Tag className="text-[10px]! px-1.5! py-0! m-0! border-amber-200! text-amber-700! bg-amber-50! leading-4!">
                              IF {ra.impact_factor.toFixed(1)}
                            </Tag>
                          )}
                          {ra.publication_date && (
                            <span className="text-[11px] text-gray-400 ml-auto">
                              {new Date(ra.publication_date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-2">No related articles found</p>
                )}
              </div>

              {/* Article Identifiers - Desktop & Mobile */}
              {(selectedArticle.doi || selectedArticle.pmid || selectedArticle.pmcid) && (
                <div className="border border-gray-400! rounded-xl p-4">
                  <p className="text-sm! font-semibold! text-gray-800 mb-3! flex items-center gap-2">
                    <PiMagnifyingGlassBold className="text-lg! text-gray-400!" />
                    Article Identifiers
                  </p>
                  <div className="space-y-3">
                    {selectedArticle.doi && (
                      <div className="bg-white rounded-lg p-1.5 shadow-sm border border-gray-200">
                        <p className=" text-xs! font-semibold! text-gray-500! mb-1!">DOI</p>
                        <a
                          href={`https://doi.org/${selectedArticle.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex text-sm text-blue-600 hover:text-blue-800 hover:underline break-all"
                        >
                          {selectedArticle.doi}
                          <FiExternalLink className="text-md! mt-0.5! ml-2!" />
                        </a>
                      </div>
                    )}
                    {selectedArticle.pmid && (
                      <div className="bg-white rounded-lg p-1.5 shadow-sm border border-gray-200">
                        <p className="text-xs! font-semibold! text-gray-500! mb-1!">PMID</p>
                        <a
                          href={`https://pubmed.ncbi.nlm.nih.gov/${selectedArticle.pmid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {selectedArticle.pmid}
                          <FiExternalLink className="text-md! mt-0.5! ml-2!" />
                        </a>
                      </div>
                    )}
                    {selectedArticle.pmcid && (
                      <div className="bg-white rounded-lg p-1.5 shadow-sm border border-gray-200">
                        <p className="text-xs! font-semibold! text-gray-500! mb-1!">PMCID</p>
                        <a
                          href={`https://pmc.ncbi.nlm.nih.gov/articles/${selectedArticle.pmcid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {selectedArticle.pmcid}
                          <FiExternalLink className="text-md! mt-0.5! ml-2!" />
                        </a>
                      </div>
                    )}
                    {/* GEO Dataset IDs */}
                    {isLoadingGse ? (
                      <div className="bg-white rounded-lg p-1.5 shadow-sm border border-gray-200">
                        <p className="text-xs! font-semibold! text-gray-500! mb-1!">GEO Datasets</p>
                        <div className="flex items-center gap-2 py-1">
                          <Spin size="small" />
                          <span className="text-xs text-gray-400">Loading datasets…</span>
                        </div>
                      </div>
                    ) : gseIds.length > 0 ? (
                      <div className="bg-white rounded-lg p-1.5 shadow-sm border border-gray-200">
                        <p className="text-xs! font-semibold! text-gray-500! mb-1!">GEO Datasets</p>
                        <div className="flex flex-wrap gap-1.5">
                          {gseIds.map(gseId => (
                            <a
                              key={gseId}
                              href={`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${gseId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {gseId}
                              <FiExternalLink className="text-xs!" />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Share Article - Mobile + Desktop */}
              <div className="border border-gray-400! rounded-xl p-4">
                <p className="text-sm font-semibold text-gray-800 mb-3! flex items-center gap-2!">
                  <ShareAltOutlined className="text-lg! text-blue-600!" />
                  Share Article
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button icon={<BsCopy />} className="w-full! hover:text-blue-600!" onClick={() => handleShareArticle(selectedArticle, "copyLink")}>
                    Copy Link
                  </Button>
                  <Button
                    icon={<RiTwitterXFill className="text-lg!" />}
                    className="w-full! hover:text-blue-600!"
                    onClick={() => handleShareArticle(selectedArticle, "twitter")}
                  >
                    Twitter
                  </Button>
                  <Button
                    icon={<RiLinkedinBoxFill className="text-xl!" />}
                    className="w-full! hover:text-blue-600!"
                    onClick={() => handleShareArticle(selectedArticle, "linkedin")}
                  >
                    LinkedIn
                  </Button>
                  <Button
                    icon={<TiSocialFacebook className="text-xl!" />}
                    className="w-full! hover:text-blue-600!"
                    onClick={() => handleShareArticle(selectedArticle, "facebook")}
                  >
                    Facebook
                  </Button>
                  <Popconfirm
                    title="Already exported"
                    description="You have already exported this article to Zotero. Export again?"
                    onConfirm={() => handleZoteroExport(true)}
                    okText="Export Again"
                    cancelText="Cancel"
                    disabled={!isZoteroExported}
                  >
                    <Button
                      icon={<SiZotero className="text-lg!" />}
                      className={`w-full! col-span-2! ${isZoteroExported ? "text-green-600! border-green-300! bg-green-50!" : "hover:text-red-600!"}`}
                      loading={isZoteroExporting || isZoteroLoading}
                      onClick={!isZoteroExported ? () => handleZoteroExport() : undefined}
                    >
                      {isZoteroExported ? "Exported" : isZoteroConnected ? "Export to Zotero" : "Connect Zotero"}
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              {/* Mobile Sections - Collapsible */}
              <div className="lg:hidden space-y-4!">
                {/* Journal Info - Mobile */}
                <Collapse
                  items={[
                    {
                      key: "journal-info",
                      label: (
                        <div className="flex items-center gap-2">
                          <BookOutlined className="text-lg! text-green-600!" />
                          <span className="font-semibold! text-gray-800!">Journal Information</span>
                        </div>
                      ),
                      children: (
                        <div className="space-y-4">
                          {/* Journal Name */}
                          <div className="bg-white rounded-lg p-3 shadow-sm border border-blue-100">
                            <div className="flex items-center gap-2">
                              {selectedArticle.journal_icon_url && (
                                <img
                                  src={selectedArticle.journal_icon_url}
                                  alt=""
                                  className="w-5 h-5 shrink-0 rounded-sm object-contain"
                                  onError={e => {
                                    (e.currentTarget as HTMLImageElement).style.display = "none";
                                  }}
                                />
                              )}
                              <h4 className="font-semibold text-gray-900 text-sm leading-snug">
                                {selectedArticle.journal.split("=")[0].trim() || "Unknown Journal"}
                              </h4>
                            </div>
                            {selectedArticle.issn && (
                              <p className="text-xs text-gray-500 mt-1.5">
                                ISSN: <span className="font-medium">{selectedArticle.issn}</span>
                              </p>
                            )}
                          </div>

                          {selectedArticle?.wos_journal && (
                            <>
                              {/* Impact Factors */}
                              <div className="space-y-2">
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600 font-medium">Impact Factor</span>
                                    <span className="text-lg font-bold text-green-600">
                                      {selectedArticle.wos_journal.journal_impact_factor || "N/A"}
                                    </span>
                                  </div>
                                </div>
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-gray-600 font-medium">5-Year Impact Factor</span>
                                    <span className="text-lg font-bold text-purple-600">
                                      {selectedArticle?.wos_journal?.five_year_impact_factor || "N/A"}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Publisher & Country */}
                              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 space-y-2">
                                {selectedArticle?.scimagojr_rankings?.publisher && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 font-medium min-w-[70px]">Publisher:</span>
                                    <span className="text-xs text-gray-800 font-semibold flex-1">{selectedArticle.scimagojr_rankings.publisher}</span>
                                  </div>
                                )}
                                {selectedArticle?.wos_journal?.country && (
                                  <div className="flex items-start gap-2">
                                    <span className="text-xs text-gray-500 font-medium min-w-[70px]">Country:</span>
                                    <span className="text-xs text-gray-800 font-semibold flex-1">
                                      {selectedArticle.wos_journal.country.charAt(0).toUpperCase() +
                                        selectedArticle.wos_journal.country.slice(1).toLowerCase()}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Categories */}
                              {selectedArticle?.scimagojr_rankings?.categories && (
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-orange-400 rounded-full"></span>
                                    Categories
                                  </p>
                                  <div className="space-y-1.5 ml-2">
                                    {selectedArticle.scimagojr_rankings.categories
                                      .split(";")
                                      .map(cat => cat.trim())
                                      .filter(cat => cat.length > 0)
                                      .map((cat, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-orange-500 text-xs -mt-0.5!">•</span>
                                          <span className="text-xs text-gray-700 leading-tight">{cat}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Areas */}
                              {selectedArticle?.scimagojr_rankings?.areas && (
                                <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                                  <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-cyan-400 rounded-full"></span>
                                    Areas
                                  </p>
                                  <div className="space-y-1.5 ml-2">
                                    {selectedArticle.scimagojr_rankings.areas
                                      .split(";")
                                      .map(area => area.trim())
                                      .filter(area => area.length > 0)
                                      .map((area, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                          <span className="text-cyan-500 text-xs -mt-0.5!">•</span>
                                          <span className="text-xs text-gray-700 leading-tight">{area}</span>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ),
                    },
                  ]}
                  className="border border-gray-400! rounded-xl!"
                  expandIconPlacement="end"
                />

                {/* MeSH Terms - Mobile */}
                {selectedArticle?.mesh_terms && selectedArticle.mesh_terms.trim().length > 0 && (
                  <Collapse
                    items={[
                      {
                        key: "mesh-terms",
                        label: (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800 flex items-center gap-1">
                              <HiOutlineHashtag className="text-lg! text-orange-600!" />
                              Tags
                            </span>
                            <span className="text-xs text-gray-500 ml-auto">
                              ({selectedArticle.mesh_terms.split(";").filter((t: string) => t.trim().length > 0).length} terms)
                            </span>
                          </div>
                        ),
                        children: (() => {
                          const parsed = selectedArticle.mesh_terms
                            .split(";")
                            .map((t: string) => t.trim())
                            .filter((t: string) => t.length > 0)
                            .map((term: string) => {
                              const isMajor = term.includes("*");
                              const display = term.replace(/\*/g, "").trim();
                              return { display, isMajor };
                            });
                          const sorted = [...parsed].sort((a, b) => (b.isMajor ? 1 : 0) - (a.isMajor ? 1 : 0));
                          const majorTerms = sorted.filter(t => t.isMajor);
                          const otherTerms = sorted.filter(t => !t.isMajor);
                          return (
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                              {majorTerms.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 mb-1.5 flex items-center gap-1">
                                    Major Topics
                                  </p>
                                  <div className="space-y-1">
                                    {majorTerms.map((term, i) => (
                                      <div
                                        key={i}
                                        className="text-sm py-1.5 px-3 rounded-md bg-amber-50 border border-amber-200 font-semibold text-gray-900"
                                      >
                                        {term.display}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {otherTerms.length > 0 && (
                                <div>
                                  {majorTerms.length > 0 && (
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Other Terms</p>
                                  )}
                                  <div className="space-y-1">
                                    {otherTerms.map((term, i) => (
                                      <div key={i} className="text-sm py-1.5 px-3 rounded bg-gray-50 border border-gray-200 text-gray-700">
                                        {term.display}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })(),
                      },
                    ]}
                    className="border border-gray-400! rounded-xl!"
                    expandIconPlacement="end"
                  />
                )}
              </div>

              {/* MeSH Terms - Desktop */}
              {selectedArticle?.mesh_terms && selectedArticle.mesh_terms.trim().length > 0 && (
                <div className="hidden lg:block border border-gray-400 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">
                    <HiOutlineHashtag className="text-lg! text-orange-600!" />
                    Tags
                  </h3>
                  {(() => {
                    const parsed = selectedArticle.mesh_terms
                      .split(";")
                      .map((t: string) => t.trim())
                      .filter((t: string) => t.length > 0)
                      .map((term: string) => {
                        const isMajor = term.includes("*");
                        const display = term.replace(/\*/g, "").trim();
                        return { display, isMajor };
                      });
                    const majorTerms = parsed.filter(t => t.isMajor);
                    const otherTerms = parsed.filter(t => !t.isMajor);
                    return (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {majorTerms.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 mb-1.5 flex items-center gap-1">
                              Major Topics
                            </p>
                            <div className="space-y-1">
                              {majorTerms.map((term, i) => (
                                <div
                                  key={i}
                                  className="text-xs py-1.5 px-2 rounded-md bg-amber-50 border border-amber-200 font-semibold text-gray-900"
                                >
                                  {term.display}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {otherTerms.length > 0 && (
                          <div>
                            {majorTerms.length > 0 && (
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Other Terms</p>
                            )}
                            <div className="space-y-1">
                              {otherTerms.map((term, i) => (
                                <div key={i} className="text-xs py-1.5 px-2 rounded-md bg-gray-50 border border-gray-200 text-gray-700">
                                  {term.display}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Copyright Notice — mobile/small screens only (pinned to bottom of modal) */}
        {selectedArticle && (
          <div className="lg:hidden mt-4 border-t pt-2">
            <div className="bg-gray-100 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-600 leading-relaxed">
                <span className="font-semibold">Copyright Notice:</span> All rights to this article, including the title, abstract, content, and
                associated materials, are reserved by <span className="font-medium">{selectedArticle.journal || "the original publisher"}</span> and
                the original authors. This information is provided for informational and educational purposes only. For full access and usage rights,
                please refer to the original publication.
              </p>
            </div>
          </div>
        )}
      </Modal>
      <AddToGroupModal articleId={selectedArticle?.id ?? null} isOpen={isAddToGroupOpen} onClose={() => setIsAddToGroupOpen(false)} />
    </>
  );
}

export default ArticleDetailsModal;
