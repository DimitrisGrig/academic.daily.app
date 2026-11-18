import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Tag, Button, Space, Tooltip, message, Typography } from "antd";
import { BookOutlined, CalendarOutlined, UserOutlined, LikeOutlined, CommentOutlined, LeftOutlined } from "@ant-design/icons";
import { HiOutlineHashtag } from "react-icons/hi";
import axiosInstance from "../lib/axios";
import ArticleDetailsModal from "../components/mainFeed/ArticleDetailsModal";
import SelectBookmarkFolderModal from "../components/mainFeed/SelectBookmarkFolderModal";
import Loading from "../components/misc/Loading";

const { Title, Text, Paragraph } = Typography;

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
}

function Article() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const articleId = searchParams.get("article_id");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [articleToBookmark, setArticleToBookmark] = useState<Article | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [userBookmarks, setUserBookmarks] = useState<{ [key: string]: number[] }>({});

  // Fetch the article by ID
  const {
    data: article,
    isLoading,
    error,
  } = useQuery<Article>({
    queryKey: ["article", articleId],
    queryFn: async () => {
      if (!articleId) throw new Error("No article ID provided");
      const response = await axiosInstance.get(`/mainFeed/get_article/${articleId}`);
      return response.data;
    },
    enabled: !!articleId,
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
      const mapped = bookmarkFolders.folders.map((folder: any) => ({
        key: folder.key ?? folder.id ?? folder.name,
        name: folder.name,
      }));
      folders.push(...mapped);
    }
    return folders;
  }, [bookmarkFolders]);

  // Fetch user's bookmarks
  useEffect(() => {
    const fetchBookmarks = async () => {
      try {
        const response = await axiosInstance.get("/bookmarks/get_folders");
        const folders = response.data?.folders || [];
        const bookmarkMap: { [key: string]: number[] } = { quick_saves: [] };

        const quickSavesResponse = await axiosInstance.get("/bookmarks/get_articles_by_folder?folder_key=quick_saves");
        bookmarkMap.quick_saves = quickSavesResponse.data.map((article: any) => article.id);

        for (const folder of folders) {
          const folderKey = folder.key ?? folder.id ?? folder.name;
          const articlesResponse = await axiosInstance.get(`/bookmarks/get_articles_by_folder?folder_key=${folderKey}`);
          bookmarkMap[folderKey] = articlesResponse.data.map((article: any) => article.id);
        }

        setUserBookmarks(bookmarkMap);
      } catch (error) {
        console.error("Failed to fetch bookmarks:", error);
      }
    };

    fetchBookmarks();
  }, []);

  const handleOpenArticle = (article: Article) => {
    if (article.doi) {
      window.open(`https://doi.org/${article.doi}`, "_blank");
      axiosInstance.post("/user_actions/article_click", { article_id: article.id }).catch(error => {
        console.error("Failed to track article view:", error);
      });
    } else {
      message.warning("No DOI available for this article");
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
        // Update the article in cache
        queryClient.setQueryData(["article", articleId], (oldData: Article | undefined) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            user_has_upvoted: response.data.user_has_upvoted,
            upvotes: response.data.upvotes,
          };
        });

        message.success(article.user_has_upvoted ? "Upvote removed" : "Article upvoted!");
      }
    } catch (error) {
      console.error("Upvote failed:", error);
      message.error("Failed to upvote article");
    }
  };

  const handleBookmark = (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();

    // Check if article is already bookmarked
    const isCurrentlyBookmarked = Object.values(userBookmarks).some(ids => ids.includes(article.id));

    if (isCurrentlyBookmarked) {
      // If bookmarked, remove it
      handleDeleteBookmark(article, e);
    } else {
      // If not bookmarked, open modal to select folder
      setArticleToBookmark(article);
      setIsBookmarkModalOpen(true);
    }
  };

  const handleBookmarkConfirm = async () => {
    if (!articleToBookmark || !selectedFolder) {
      message.warning("Please select a folder");
      return;
    }

    try {
      // Find the folder name for the selected folder key
      const folder = availableFolders.find(f => f.key === selectedFolder);
      const folderName = folder?.name || selectedFolder;

      await axiosInstance.post("/bookmarks/save_bookmark", {
        article_id: articleToBookmark.id,
        folder_key: selectedFolder,
        folder_name: folderName,
      });

      setUserBookmarks(prev => ({
        ...prev,
        [selectedFolder]: [...(prev[selectedFolder] || []), articleToBookmark.id],
      }));

      message.success("Article bookmarked!");
      setIsBookmarkModalOpen(false);
      setArticleToBookmark(null);
      setSelectedFolder(null);
    } catch (error) {
      console.error("Bookmark failed:", error);
      message.error("Failed to bookmark article");
    }
  };

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

  const parseMeshTerms = (meshTerms: string | null) => {
    if (!meshTerms) return [];
    try {
      const parsed = JSON.parse(meshTerms);
      if (Array.isArray(parsed)) return parsed.slice(0, 10);
      return [];
    } catch {
      return [];
    }
  };

  if (!articleId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <Space direction="vertical" align="center" size="large">
            <Text type="secondary" className="text-lg">
              No article ID provided
            </Text>
            <Button type="primary" onClick={() => navigate("/MainFeed")}>
              Go to Main Feed
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <Loading />;
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <Space direction="vertical" align="center" size="large" className="w-full">
            <Text type="danger" className="text-lg">
              Article not found
            </Text>
            <Text type="secondary">The article you're looking for doesn't exist or has been removed.</Text>
            <Space>
              <Button onClick={() => navigate(-1)} icon={<LeftOutlined />}>
                Go Back
              </Button>
              <Button type="primary" onClick={() => navigate("/MainFeed")}>
                Go to Main Feed
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    );
  }

  const isArticleBookmarked = (articleId: number) => {
    return Object.values(userBookmarks).some(ids => ids.includes(articleId));
  };

  const handleDeleteBookmark = async (article: Article, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      // Find all folders that contain this article
      const foldersWithArticle = Object.entries(userBookmarks)
        .filter(([_, articleIds]) => articleIds.includes(article.id))
        .map(([folderKey]) => folderKey);

      if (foldersWithArticle.length === 0) {
        message.warning("Article is not bookmarked");
        return;
      }

      // Remove article from all folders
      const deletePromises = foldersWithArticle.map(folderKey =>
        axiosInstance.post("/bookmarks/delete_bookmark", {
          article_id: article.id,
          folder_key: folderKey,
        })
      );

      await Promise.all(deletePromises);

      // Update local state
      setUserBookmarks(prev => {
        const updated = { ...prev };
        foldersWithArticle.forEach(folderKey => {
          updated[folderKey] = updated[folderKey].filter(id => id !== article.id);
        });
        return updated;
      });

      message.success("Bookmark removed!");
    } catch (error) {
      console.error("Delete bookmark failed:", error);
      message.error("Failed to remove bookmark");
    }
  };

  const meshTerms = parseMeshTerms(article.mesh_terms);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        {/* Back Button */}
        <Button icon={<LeftOutlined />} onClick={() => navigate(-1)} className="mb-4">
          Back
        </Button>

        {/* Article Card */}
        <Card className="shadow-lg">
          <Space direction="vertical" size="large" className="w-full">
            {/* Title */}
            <Title level={2} className="mb-0">
              {article.title}
            </Title>

            {/* Metadata Row */}
            <Space size={[8, 8]} wrap>
              <Tag icon={<BookOutlined />} color="blue" className="text-sm">
                {article.journal}
              </Tag>
              {article.wos_journal?.journal_impact_factor && (
                <Tag color="green" className="text-sm">
                  IF: {article.wos_journal.journal_impact_factor.toFixed(2)}
                </Tag>
              )}
              <Tag icon={<CalendarOutlined />} className="text-sm">
                {formatDate(article.publication_date)}
              </Tag>
              <Tag icon={<LikeOutlined />} color="blue" className="text-sm">
                {article.upvotes} upvotes
              </Tag>
              {article.comments_count !== undefined && article.comments_count > 0 && (
                <Tag icon={<CommentOutlined />} color="purple" className="text-sm">
                  {article.comments_count} comments
                </Tag>
              )}
            </Space>

            {/* Authors */}
            <div>
              <Text strong>
                <UserOutlined className="mr-2" />
                Authors:
              </Text>
              <Text className="ml-2">{formatAuthors(article.authors_full)}</Text>
            </div>

            {/* Abstract */}
            <div>
              <Title level={4}>Abstract</Title>
              <Paragraph className="text-justify text-gray-700">{article.abstract || "No abstract available"}</Paragraph>
            </div>

            {/* MeSH Terms */}
            {meshTerms.length > 0 && (
              <div>
                <Title level={5}>
                  <HiOutlineHashtag className="inline mr-2" />
                  Research Topics
                </Title>
                <Space size={[8, 8]} wrap>
                  {meshTerms.map((term, index) => (
                    <Tag key={index} color="purple">
                      {term}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            {/* Action Buttons */}
            <Space size="middle" wrap className="w-full justify-center pt-4 border-t">
              <Tooltip title="View article details">
                <Button type="primary" icon={<CommentOutlined />} onClick={() => setIsModalOpen(true)}>
                  Read more
                </Button>
              </Tooltip>
            </Space>
          </Space>
        </Card>
      </div>

      {/* Article Details Modal for Comments */}
      <ArticleDetailsModal
        isOpen={isModalOpen}
        article={article}
        isAbstractExpanded={isAbstractExpanded}
        userBookmarks={userBookmarks}
        availableFolders={availableFolders}
        onClose={() => {
          setIsModalOpen(false);
          setIsAbstractExpanded(false);
        }}
        onOpenArticle={handleOpenArticle}
        onUpvote={handleUpvote}
        onBookmarkClick={handleBookmark}
        onDeleteBookmark={handleDeleteBookmark}
        onShareArticle={() => {}}
        onSetAbstractExpanded={setIsAbstractExpanded}
        isArticleBookmarked={isArticleBookmarked}
      />

      {/* Bookmark Modal */}
      <SelectBookmarkFolderModal
        isBookmarkModalOpen={isBookmarkModalOpen}
        handleSaveBookmark={handleBookmarkConfirm}
        setIsBookmarkModalOpen={setIsBookmarkModalOpen}
        setArticleToBookmark={setArticleToBookmark}
        availableFolders={availableFolders}
        selectedFolder={selectedFolder}
        setSelectedFolder={setSelectedFolder}
        articleToBookmark={null}
      />
    </div>
  );
}

export default Article;
