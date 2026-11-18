import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button, Spin, Result } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://api.daily-academic.com";

type Status = "loading" | "success" | "error" | "already";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      return;
    }

    axios
      .get(`${API_BASE}/mail-digests/unsubscribe`, { params: { token } })
      .then((res) => {
        setEmail(res.data?.email ?? "");
        setStatus("success");
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          setStatus("error");
        } else {
          setStatus("error");
        }
      });
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      {/* Header */}
      <div className="mb-8 flex items-center gap-2">
        <span className="font-bold text-2xl text-indigo-600 font-serif">Daily Academic</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
        {status === "loading" && (
          <div className="py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-500 text-sm">Processing your request…</p>
          </div>
        )}

        {status === "success" && (
          <Result
            icon={<CheckCircleOutlined className="text-green-500!" style={{ fontSize: 56 }} />}
            title={<span className="text-xl font-semibold text-gray-800">You&apos;ve been unsubscribed</span>}
            subTitle={
              <span className="text-gray-500 text-sm">
                {email ? (
                  <>
                    <strong>{email}</strong> will no longer receive the weekly research digest.
                  </>
                ) : (
                  "You will no longer receive the weekly research digest."
                )}
                <br />
                You can re-enable it anytime from{" "}
                <span className="text-indigo-600">Settings → Notifications</span>.
              </span>
            }
            extra={
              <div className="flex flex-col gap-3 mt-2">
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate("/Settings?tab=notifications")}
                  className="rounded-lg!"
                >
                  Manage preferences
                </Button>
                <Button
                  size="large"
                  onClick={() => navigate("/MainFeed")}
                  className="rounded-lg!"
                >
                  Back to app
                </Button>
              </div>
            }
          />
        )}

        {status === "error" && (
          <Result
            icon={<CloseCircleOutlined className="text-red-400!" style={{ fontSize: 56 }} />}
            title={<span className="text-xl font-semibold text-gray-800">Invalid link</span>}
            subTitle={
              <span className="text-gray-500 text-sm">
                This unsubscribe link is invalid or has already been used.
                <br />
                You can manage your email preferences from Settings.
              </span>
            }
            extra={
              <Button
                type="primary"
                size="large"
                onClick={() => navigate("/Settings?tab=notifications")}
                className="rounded-lg!"
              >
                Manage preferences
              </Button>
            }
          />
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        &copy; {new Date().getFullYear()} Daily Academic &mdash; daily-academic.com
      </p>
    </div>
  );
}
