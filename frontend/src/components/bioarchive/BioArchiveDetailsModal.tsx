import { Tag, Button, Tooltip, Modal } from "antd";
import { CalendarOutlined, UserOutlined, CloseOutlined, TagOutlined, LikeOutlined } from "@ant-design/icons";
import { FiExternalLink } from "react-icons/fi";
import { BsCopy } from "react-icons/bs";
import { RiLinkedinBoxFill, RiTwitterXFill } from "react-icons/ri";
import { TiSocialFacebook } from "react-icons/ti";
import { message } from "antd";

export interface BioArchiveArticle {
  id: number;
  title: string;
  authors: string | null;
  author_corresponding: string | null;
  author_corresponding_institution: string | null;
  doi: string | null;
  date_posted: string | null;
  created_at: string;
  updated_at: string;
  version: number | null;
  publication_type: string | null;
  license: string | null;
  category: string | null;
  abstract: string | null;
  published: string | null;
  server: string | null;
  upvotes: number;
  user_has_upvoted: boolean;
  user_has_read: boolean;
  similarity_score: number;
}

interface BioArchiveDetailsModalProps {
  isOpen: boolean;
  article: BioArchiveArticle | null;
  onClose: () => void;
  onUpvote: (article: BioArchiveArticle, e: React.MouseEvent) => void;
}

const BioArchiveDetailsModal: React.FC<BioArchiveDetailsModalProps> = ({ isOpen, article, onClose, onUpvote }) => {
  if (!article) return null;

  const formatAuthors = (authors: string | null): string => {
    if (!authors) return "Unknown authors";
    return authors
      .split(";")
      .map(a => a.trim())
      .filter(a => a.length > 0)
      .join(", ");
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "Unknown date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const articleUrl = article.doi ? `https://doi.org/${article.doi}` : null;

  const renderTextWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s,;)\]]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:underline break-all"
          onClick={e => e.stopPropagation()}
        >
          {part}
        </a>
      ) : (
        part
      )
    );
  };

  // Known academic section headers — sorted longest-first so "Background & Aims"
  // is matched before "Background".
  const KNOWN_HEADERS = [
    "Background & Aims",
    "Background and Aims",
    "Background",
    "Introduction",
    "Objectives",
    "Objective",
    "Aims",
    "Aim",
    "Purpose",
    "Materials and Methods",
    "Materials & Methods",
    "Methods",
    "Results",
    "Findings",
    "Discussion",
    "Conclusions",
    "Conclusion",
    "Summary",
    "Significance Statement",
    "Motivation",
    "Implications",
    "Study Design",
    "Study Objectives",
    "Key Findings",
    "Motivation",
    "Availability",
    "Limitations",
    "Primary funding source",
    "Interpretation",
    "Availability and Implementation",
  ].sort((a, b) => b.length - a.length);

  const renderAbstract = (text: string) => {
    const escapedHeaders = KNOWN_HEADERS.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

    // Split mid-text headers onto their own lines so the per-line logic can bold them
    const headerSplitRegex = new RegExp(`\\s+(${escapedHeaders})(:)`, "gi");
    text = text.replace(headerSplitRegex, "\n$1$2");

    // Capture known header + optional trailing colon
    const knownHeaderRegex = new RegExp(`^(${escapedHeaders})(:?)`, "i");

    const lines = text.split("\n");
    const nodes: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      if (idx > 0) nodes.push("\n");
      if (!line) return;

      const knownMatch = line.match(knownHeaderRegex);
      if (knownMatch) {
        const hasColon = knownMatch[2] === ":";
        const charAfterMatch = line[knownMatch[0].length];
        // Only treat as header if followed by ":" OR immediately by a non-space character
        const isDirectlyFollowed = charAfterMatch !== undefined && charAfterMatch !== " " && charAfterMatch !== "\t";
        if (hasColon || isDirectlyFollowed) {
          const headerText = knownMatch[1] + knownMatch[2];
          const body = line.slice(knownMatch[0].length);
          nodes.push(
            <span key={`h-${idx}`} className="font-bold text-gray-900">
              {headerText}
            </span>
          );
          if (body) nodes.push(<span key={`b-${idx}`}> {renderTextWithLinks(body)}</span>);
          return;
        }
      }

      nodes.push(<span key={`l-${idx}`}>{renderTextWithLinks(line)}</span>);
    });

    return nodes;
  };

  const handleShare = (platform?: "linkedin" | "twitter" | "facebook" | "copy") => {
    if (!articleUrl) {
      message.warning("No DOI available to share");
      return;
    }
    if (platform === "copy" || !platform) {
      navigator.clipboard.writeText(articleUrl).then(() => message.success("Link copied to clipboard!"));
    } else if (platform === "linkedin") {
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`, "_blank", "width=600,height=600");
    } else if (platform === "twitter") {
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(articleUrl)}&text=${encodeURIComponent(article.title)}`,
        "_blank",
        "width=600,height=600"
      );
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`, "_blank", "width=600,height=600");
    }
  };

  return (
    <Modal open={isOpen} onCancel={onClose} footer={null} width={860} closeIcon={<CloseOutlined />} classNames="!p-0.5 max-h-[85vh] overflow-y-auto">
      <div className="pt-6">
        <hr className="mb-1 border-gray-300" />
        {/* Header Tags */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {article.server && (
            <Tag color={article.server.toLowerCase() === "biorxiv" ? "teal" : "geekblue"} className="text-sm! font-semibold!">
              {article.server.toLowerCase() === "biorxiv" ? "bioRxiv" : "medRxiv"}
            </Tag>
          )}
          {article.publication_type && <Tag color="blue">{article.publication_type}</Tag>}
          {article.category && <Tag color="orange">{article.category}</Tag>}
          {article.license && (
            <Tag color="default" className="text-xs! text-gray-500!">
              {article.license}
            </Tag>
          )}
          {articleUrl && (
            <Button
              type="primary"
              onClick={() => window.open(articleUrl, "_blank")}
              className="ml-auto bg-indigo-500! hover:bg-indigo-600! border-indigo-500! hover:border-indigo-600!"
            >
              View Preprint
              <FiExternalLink />
            </Button>
          )}
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-gray-900 mb-3 leading-snug">{article.title}</h2>

        {/* Authors */}
        <div className="flex items-start gap-2 mb-2 text-sm text-gray-600">
          <UserOutlined className="mt-0.5 shrink-0" />
          <span>{formatAuthors(article.authors)}</span>
        </div>

        {/* Corresponding author / institution */}
        {(article.author_corresponding || article.author_corresponding_institution) && (
          <div className="text-xs text-gray-500 mb-3 pl-5">
            {article.author_corresponding && <span className="font-medium">{article.author_corresponding}</span>}
            {article.author_corresponding && article.author_corresponding_institution && " — "}
            {article.author_corresponding_institution && <span>{article.author_corresponding_institution}</span>}
          </div>
        )}

        {/* Dates & Version */}
        <div className="flex flex-col gap-1 text-sm text-gray-500 mb-4">
          {article.date_posted && (
            <div className="flex items-center gap-1.5">
              <CalendarOutlined className="text-sky-600!" />
              <span>Posted: {formatDate(article.date_posted)}</span>
            </div>
          )}
          {article.version != null && (
            <div className="flex items-center gap-1.5">
              <TagOutlined className="shrink-0! text-gray-500!" />
              <span className="text-gray-400">Version {article.version}</span>
            </div>
          )}
        </div>

        <hr className="border-dashed border-gray-200 mb-4" />

        {/* Abstract */}
        <div className="mb-4">
          <h3 className="font-semibold text-gray-800 mb-2">Abstract</h3>
          {article.abstract ? (
            <p className="text-sm text-justify text-gray-700 leading-relaxed whitespace-pre-wrap">{renderAbstract(article.abstract)}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No abstract available</p>
          )}
        </div>

        {/* Action buttons */}
        <hr className="border-dashed border-gray-200 mb-4" />
        <div className="flex flex-wrap gap-2 items-center justify-between">
          {/* Upvote */}
          <div className="p-1 border rounded-xl shadow-md border-gray-300">
            <div className="flex items-center">
              <Tooltip title={article.user_has_upvoted ? "Remove upvote" : "Upvote this preprint"}>
                <Button
                  type="text"
                  icon={<LikeOutlined className="text-xl!" />}
                  onClick={e => onUpvote(article, e)}
                  className={`flex! flex-col! items-center! gap-0! h-auto! py-2! px-4! rounded-lg! ${
                    article.user_has_upvoted ? "text-green-500! bg-green-50!" : "text-gray-500! hover:text-green-500! hover:bg-green-50!"
                  }`}
                >
                  <span className="text-xs font-medium hidden sm:block">{article.user_has_upvoted ? "Upvoted" : "Upvote"}</span>
                  <span className="text-xs font-medium">{article.upvotes || 0}</span>
                </Button>
              </Tooltip>
            </div>
          </div>

          {/* Share */}
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-500 font-medium">Share:</span>
            <Tooltip title="Copy link">
              <Button
                type="text"
                size="small"
                icon={<BsCopy />}
                onClick={() => handleShare("copy")}
                className="text-gray-500 hover:text-indigo-600!"
              />
            </Tooltip>
            <Tooltip title="Share on LinkedIn">
              <Button
                type="text"
                size="small"
                icon={<RiLinkedinBoxFill className="text-lg!" />}
                onClick={() => handleShare("linkedin")}
                className="text-gray-500 hover:text-blue-700!"
              />
            </Tooltip>
            <Tooltip title="Share on X (Twitter)">
              <Button
                type="text"
                size="small"
                icon={<RiTwitterXFill className="text-lg!" />}
                onClick={() => handleShare("twitter")}
                className="text-gray-500 hover:text-gray-900!"
              />
            </Tooltip>
            <Tooltip title="Share on Facebook">
              <Button
                type="text"
                size="small"
                icon={<TiSocialFacebook className="text-lg!" />}
                onClick={() => handleShare("facebook")}
                className="text-gray-500 hover:text-blue-600!"
              />
            </Tooltip>
          </div>
        </div>

        {/* Close button */}
        <div className="flex justify-center mt-6">
          <Button onClick={onClose} className="px-8!">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BioArchiveDetailsModal;
