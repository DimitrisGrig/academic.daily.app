import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input, Table, Card, Statistic, Typography, Space, Tag, List, Empty, Spin, Modal, Button, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined, BookOutlined, PlusOutlined, LinkOutlined } from "@ant-design/icons";
import axiosInstance from "../lib/axios";
import { FaTemperatureEmpty, FaTemperatureFull, FaTemperatureHalf } from "react-icons/fa6";

const { Text } = Typography;

interface Journal {
  id: number;
  journal_title: string;
  issn: string | null;
  eissn: string | null;
  wos_impact_factor: number;
  is_active_by_user: boolean;
  journal_icon_url?: string | null;
}

interface JournalsResponse {
  journals: Journal[];
}

interface ThresholdResponse {
  impact_factor_threshold: number;
}

function SourceJournals() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isSmallMobile, setIsSmallMobile] = useState(window.innerWidth < 400);
  const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
  const [journalSuggestion, setJournalSuggestion] = useState("");

  const suggestJournalMutation = useMutation({
    mutationFn: async (journalNameOrIssn: string) => {
      const response = await axiosInstance.post("/source_journals/suggest_new_journal", {
        journal_name_or_issn: journalNameOrIssn,
      });
      return response.data;
    },
    onSuccess: () => {
      message.success("Journal suggestion submitted successfully!");
      setIsSuggestModalOpen(false);
      setJournalSuggestion("");
    },
    onError: () => {
      message.error("Failed to submit suggestion. Please try again.");
    },
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsSmallMobile(window.innerWidth < 400);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fetch impact factor threshold
  const { data: thresholdData } = useQuery<ThresholdResponse>({
    queryKey: ["impactFactorThreshold"],
    queryFn: async () => {
      const response = await axiosInstance.get("/source_journals/impact-factor-threshold");
      return response.data;
    },
  });

  const threshold = thresholdData?.impact_factor_threshold || 3;

  // Fetch journals
  const { data: journalsData, isLoading } = useQuery<JournalsResponse>({
    queryKey: ["sourceJournals", searchTerm],
    queryFn: async () => {
      const response = await axiosInstance.get("/source_journals/journals", {
        params: {
          ...(searchTerm && { search: searchTerm }),
        },
      });
      return response.data;
    },
  });

  const columns: ColumnsType<Journal> = [
    {
      title: "Journal Title",
      dataIndex: "journal_title",
      key: "journal_title",
      width: "auto",
      ellipsis: true,
      sorter: (a: Journal, b: Journal) => a.journal_title.localeCompare(b.journal_title),
      render: (text: string, record: Journal) => (
        <Space direction="vertical" size="small" className="w-full">
          <div className="flex items-center gap-2">
            {record.journal_icon_url ? (
              <img
                src={record.journal_icon_url}
                alt=""
                className="w-5 h-5 shrink-0 rounded-sm object-contain"
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <BookOutlined className="text-gray-400 shrink-0" />
            )}
            <Text strong className="cursor-pointer! hover:text-blue-600! text-xs sm:text-sm!" onClick={() => handleJournalClick(record)}>
              {text}
            </Text>
          </div>
          <div className="flex gap-1 flex-wrap">
            {record.is_active_by_user && record.wos_impact_factor >= threshold ? (
              <Tag color="green" className="text-xs m-0">
                Active
              </Tag>
            ) : (
              <Tag color="orange" className="text-xs m-0">
                Not active
              </Tag>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: "Impact Factor",
      dataIndex: "wos_impact_factor",
      key: "wos_impact_factor",
      width: 110,
      sorter: (a: Journal, b: Journal) => (a.wos_impact_factor || 0) - (b.wos_impact_factor || 0),
      defaultSortOrder: "descend" as const,
      render: (value: number | null) => (
        <Tag color={value && value >= 10 ? "red" : value && value >= 5 ? "orange" : "blue"} className="text-xs">
          {value ? value.toFixed(2) : "N/A"}
        </Tag>
      ),
    },
    {
      title: "ISSN",
      dataIndex: "issn",
      key: "issn",
      width: 120,
      responsive: ["md" as const],
      render: (text: string | null) => <span className="text-xs sm:text-sm">{text || "N/A"}</span>,
    },
    {
      title: "eISSN",
      dataIndex: "eissn",
      key: "eissn",
      width: 120,
      responsive: ["md" as const],
      render: (text: string | null) => <span className="text-xs sm:text-sm">{text || "N/A"}</span>,
    },
  ];

  const totalJournals = journalsData?.journals.length || 0;
  const avgImpactFactor =
    (journalsData?.journals.reduce((sum, journal) => sum + (journal.wos_impact_factor || 0), 0) || 0) /
    (journalsData?.journals.filter(j => j.wos_impact_factor).length || 1);
  const highImpactCount = journalsData?.journals.filter(j => j.wos_impact_factor && j.wos_impact_factor >= 10).length || 0;
  const midImpactCount =
    journalsData?.journals.filter(j => j.wos_impact_factor && j.wos_impact_factor < 10 && j.wos_impact_factor >= threshold).length || 0;
  const lowImpactCount = journalsData?.journals.filter(j => j.wos_impact_factor && j.wos_impact_factor < threshold).length || 0;

  const handleJournalClick = (journal: Journal) => {
    navigate(`/JournalArticles?journalId=${journal.id}&journalTitle=${encodeURIComponent(journal.journal_title)}`);
  };

  return (
    <div className="p-2 sm:p-3 md:p-6 max-w-7xl mx-auto">
      <Space direction="vertical" size={isMobile ? "middle" : "large"} style={{ width: "100%" }}>
        {/* Header */}
        <div className="px-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold text-gray-900 mb-1 sm:mb-2 flex items-center gap-2">
                {/* <BsFillJournalBookmarkFill className="text-green-700! text-lg sm:text-xl md:text-2xl" /> */}
                Source Journals
              </h1>
              <Text type="secondary" className="text-xs sm:text-sm! block">
                All journals tracked by the app. Journals marked as "Active" are currently being monitored for new articles.
              </Text>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsSuggestModalOpen(true)} className="shrink-0 mt-1">
              {isMobile ? "Suggest" : "Suggest a Journal"}
            </Button>
          </div>
        </div>

        {/* Suggest a Journal Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <BookOutlined className="text-green-700" />
              <span>Suggest a new journal</span>
            </div>
          }
          open={isSuggestModalOpen}
          onCancel={() => {
            setIsSuggestModalOpen(false);
            setJournalSuggestion("");
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setIsSuggestModalOpen(false);
                setJournalSuggestion("");
              }}
            >
              Cancel
            </Button>,
            <Button
              key="submit"
              type="primary"
              disabled={!journalSuggestion.trim()}
              loading={suggestJournalMutation.isPending}
              onClick={() => {
                suggestJournalMutation.mutate(journalSuggestion.trim());
              }}
            >
              Submit
            </Button>,
          ]}
          width={480}
        >
          <div className="py-2">
            <Text type="secondary" className="text-sm! text-gray-600! block! mb-4!">
              Have a journal you'd like us to track? Enter its name or ISSN below and we'll review your suggestion.
            </Text>
            <Input
              placeholder="Journal name, link or ISSN / eISSN"
              prefix={<LinkOutlined className="text-gray-700!" />}
              value={journalSuggestion}
              onChange={e => setJournalSuggestion(e.target.value)}
              size="large"
              allowClear
            />
          </div>
        </Modal>

        {/* Statistics */}
        <Card className="overflow-hidden">
          <div className={`grid gap-2 sm:gap-3 md:gap-4 ${isSmallMobile ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"}`}>
            <Statistic
              title={<span className="text-xs sm:text-sm whitespace-nowrap">Total Journals</span>}
              value={totalJournals}
              // prefix={<BookOutlined className="text-green-700!" />}
              loading={isLoading}
              valueStyle={{ fontSize: isSmallMobile ? "1.5rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
            <Statistic
              title={<span className="text-xs sm:text-sm whitespace-nowrap">Avg. Impact Factor</span>}
              value={avgImpactFactor.toFixed(2)}
              // prefix={<ExperimentOutlined className="text-indigo-600!" />}
              loading={isLoading}
              valueStyle={{ fontSize: isSmallMobile ? "1.5rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
            <Statistic
              title={<span className="text-xs sm:text-sm whitespace-nowrap">High Impact (≥10)</span>}
              value={highImpactCount}
              prefix={<FaTemperatureFull className="text-pink-600!" />}
              loading={isLoading}
              valueStyle={{ fontSize: isSmallMobile ? "1.5rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />

            <Statistic
              title={<span className="text-xs sm:text-sm whitespace-nowrap">Mid Impact ({threshold}-10)</span>}
              value={midImpactCount}
              prefix={<FaTemperatureHalf className="text-yellow-600!" />}
              loading={isLoading}
              valueStyle={{ fontSize: isSmallMobile ? "1.5rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />

            <Statistic
              title={<span className="text-xs sm:text-sm whitespace-nowrap">Low Impact (&lt;{threshold})</span>}
              value={lowImpactCount}
              prefix={<FaTemperatureEmpty className="text-sky-600!" />}
              loading={isLoading}
              valueStyle={{ fontSize: isSmallMobile ? "1.5rem" : "clamp(1.25rem, 4vw, 1.5rem)" }}
            />
          </div>
        </Card>

        {/* Search */}
        <Card className="overflow-hidden">
          <Input
            placeholder="Search journals..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            size={isSmallMobile ? "middle" : "large"}
            allowClear
            className="text-xs sm:text-sm md:text-base"
          />
        </Card>

        {/* Journals Table */}
        <Card className="overflow-hidden">
          {isMobile ? (
            // Mobile View - List Layout
            isLoading ? (
              <div className="text-center py-8 sm:py-12">
                <Spin size="large" />
                <p className="text-gray-500 mt-3 sm:mt-4 text-xs sm:text-sm">Loading journals...</p>
              </div>
            ) : !journalsData?.journals || journalsData.journals.length === 0 ? (
              <Empty description="No journals available" />
            ) : (
              <List
                dataSource={journalsData.journals}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: false,
                  simple: true,
                  style: { textAlign: "center", marginTop: "12px" },
                }}
                renderItem={(journal: Journal) => (
                  <List.Item
                    key={journal.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors py-2 sm:py-3!"
                    onClick={() => handleJournalClick(journal)}
                    style={{ padding: isSmallMobile ? "12px 8px" : "12px 16px" }}
                  >
                    <div className="w-full">
                      <div className="mb-1.5 sm:mb-2">
                        <Text strong className="text-xs sm:text-sm text-gray-900 block leading-tight" style={{ lineHeight: "1.3" }}>
                          {journal.journal_title}
                        </Text>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        {journal.is_active_by_user && journal.wos_impact_factor >= threshold ? (
                          <Tag color="green" className="text-xs m-0 px-1.5 py-0">
                            Active
                          </Tag>
                        ) : (
                          <Tag color="orange" className="text-xs m-0 px-1.5 py-0">
                            Not active
                          </Tag>
                        )}
                        <Tag
                          color={journal.wos_impact_factor >= 10 ? "red" : journal.wos_impact_factor >= 5 ? "orange" : "blue"}
                          className="text-xs m-0 px-1.5 py-0"
                        >
                          IF: {journal.wos_impact_factor ? journal.wos_impact_factor.toFixed(2) : "N/A"}
                        </Tag>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            )
          ) : (
            // Desktop View - Table Layout
            <Table
              columns={columns}
              dataSource={journalsData?.journals || []}
              rowKey="id"
              loading={isLoading}
              scroll={{ x: 600 }}
              pagination={{
                pageSize: 50,
                showSizeChanger: true,
                pageSizeOptions: ["20", "50", "100", "200"],
                showTotal: (total, range) => <span className="text-sm">{`${range[0]}-${range[1]} of ${total} journals`}</span>,
                responsive: true,
              }}
              size="middle"
            />
          )}
        </Card>
      </Space>
    </div>
  );
}

export default SourceJournals;
