import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Spin, Result, Button } from "antd";
import { completeZoteroAuth } from "../lib/exportToZotero";

/**
 * OAuth callback page for Zotero.
 * Zotero redirects here after the user authorizes.
 * Extracts oauth_token & oauth_verifier from the URL and completes the exchange.
 */
export default function ZoteroCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const oauthToken = searchParams.get("oauth_token");
    const oauthVerifier = searchParams.get("oauth_verifier");

    if (!oauthToken || !oauthVerifier) {
      setStatus("error");
      setErrorMsg("Missing authorization parameters from Zotero. Please try again.");
      return;
    }

    completeZoteroAuth(oauthToken, oauthVerifier)
      .then(() => setStatus("success"))
      .catch(err => {
        console.error("Zotero callback error:", err);
        const detail = err?.response?.data?.detail || "Failed to connect Zotero. Please try again.";
        setErrorMsg(detail);
        setStatus("error");
      });
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Spin size="large" />
          <p className="text-gray-600 text-lg">Connecting your Zotero account...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Result
          status="error"
          title="Connection Failed"
          subTitle={errorMsg}
          extra={
            <Button type="primary" onClick={() => navigate("/Settings")}>
              Go to Settings
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Result
        status="success"
        title="Zotero Connected!"
        subTitle="Your Zotero account is now linked. You can export articles directly to your Zotero library."
        extra={[
          <Button type="primary" key="feed" onClick={() => navigate("/MainFeed?loc=MainFeed")}>
            Back to Feed
          </Button>,
          <Button key="settings" onClick={() => navigate("/Settings")}>
            Go to Settings
          </Button>,
        ]}
      />
    </div>
  );
}
