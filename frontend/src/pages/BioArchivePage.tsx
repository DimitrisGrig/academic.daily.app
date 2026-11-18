import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, Tag, Button, Space, Tooltip, message, Typography } from "antd";
import { BookOutlined, CalendarOutlined, UserOutlined, LikeOutlined, CommentOutlined, LeftOutlined } from "@ant-design/icons";
import axiosInstance from "../lib/axios";
import BioArchiveDetailsModal from "../components/bioarchive/BioArchiveDetailsModal";
import type { BioArchiveArticle } from "../components/bioarchive/BioArchiveDetailsModal";
import Loading from "../components/misc/Loading";

const { Title, Text, Paragraph } = Typography;

function BioArchivePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const articleId = searchParams.get("article_id");

  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch the article by ID
  const {
    data: article,
    isLoading,
    error,
  } = useQuery<BioArchiveArticle>({
    queryKey: ["bioarchive_article", articleId],
    queryFn: async () => {
      if (!articleId) throw new Error("No article ID provided");
      const response = await axiosInstance.get(`/bioarchive/get_article/${articleId}`);
      return response.data;
    },
    enabled: !!articleId,
  });

  const handleUpvote = async (article: BioArchiveArticle, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await axiosInstance.post("/bioarchive/upvote", {
        article_id: article.id,
        undo: article.user_has_upvoted,
      });

      if (response.data.success) {
        queryClient.setQueryData(["bioarchive_article", articleId], (old: BioArchiveArticle | undefined) => {
          if (!old) return old;
          return {
            ...old,
            user_has_upvoted: response.data.user_has_upvoted,
            upvotes: response.data.upvotes,
          };
        });
        message.success(article.user_has_upvoted ? "Upvote removed" : "Article upvoted!");
      }
    } catch {
      message.error("Failed to upvote article");
    }
  };

  const formatAuthors = (authors: string | null): string => {
    if (!authors) return "Unknown authors";
    const parts = authors
      .split(";")
      .map(a => a.trim())
      .filter(a => a.length > 0);
    if (parts.length <= 3) return parts.join(", ");
    return `${parts.slice(0, 3).join(", ")} et al.`;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "No date";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!articleId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <Space direction="vertical" align="center" size="large">
            <Text type="secondary" className="text-lg">
              No article ID provided
            </Text>
            <Button type="primary" onClick={() => navigate("/BioArchive")}>
              Go to BioArchive
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
              <Button type="primary" onClick={() => navigate("/BioArchive")}>
                Go to BioArchive
              </Button>
            </Space>
          </Space>
        </Card>
      </div>
    );
  }

  const serverColor = article.server?.toLowerCase() === "biorxiv" ? "green" : "blue";
  const serverLabel =
    article.server?.toLowerCase() === "biorxiv" ? "bioRxiv" : article.server?.toLowerCase() === "medrxiv" ? "medRxiv" : article.server;

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
              {serverLabel && (
                <Tag icon={<BookOutlined />} color={serverColor} className="text-sm">
                  {serverLabel}
                </Tag>
              )}
              {article.category && (
                <Tag color="purple" className="text-sm">
                  {article.category}
                </Tag>
              )}
              <Tag icon={<CalendarOutlined />} className="text-sm">
                {formatDate(article.date_posted)}
              </Tag>
              <Tag icon={<LikeOutlined />} color="blue" className="text-sm">
                {article.upvotes} upvotes
              </Tag>
            </Space>

            {/* Authors */}
            <div>
              <Text strong>
                <UserOutlined className="mr-2" />
                Authors:
              </Text>
              <Text className="ml-2">{formatAuthors(article.authors)}</Text>
            </div>

            {/* Abstract */}
            <div>
              <Title level={4}>Abstract</Title>
              <Paragraph className="text-justify text-gray-700">{article.abstract || "No abstract available"}</Paragraph>
            </div>

            {/* Action Buttons */}
            <Space size="middle" wrap className="w-full justify-center pt-4 border-t">
              <Tooltip title="View preprint details">
                <Button type="primary" icon={<CommentOutlined />} onClick={() => setIsModalOpen(true)}>
                  Read more
                </Button>
              </Tooltip>
            </Space>
          </Space>
        </Card>
      </div>

      {/* BioArchive Details Modal */}
      <BioArchiveDetailsModal isOpen={isModalOpen} article={article} onClose={() => setIsModalOpen(false)} onUpvote={handleUpvote} />
    </div>
  );
}

export default BioArchivePage;
