import { SignIn, SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axiosInstance from "./lib/axios";
import logo from "../public/logo.jpg";

function LoginPage() {
  const { user, isLoaded } = useUser();
  const navigate = useNavigate();

  // Auto-sync user to database and redirect when they log in
  useEffect(() => {
    const syncUser = async () => {
      if (isLoaded && user) {
        try {
          const userData = {
            email: user.emailAddresses[0]?.emailAddress || "",
            first_name: user.firstName || null,
            last_name: user.lastName || null,
          };

          await axiosInstance.post("/api/users/sync-with-data", userData);

          // PrivateRoute handles redirectAfterLogin from sessionStorage.
          // This fallback only fires if the user lands directly on /login while already signed in.
          navigate("/MainFeed?loc=MainFeed", { replace: true });
        } catch (error: any) {
          console.error("Failed to sync user:", error);
          console.error("Error details:", error.response?.data);
        }
      }
    };

    syncUser();
  }, [isLoaded, user, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white shadow-sm p-4 border-b">
        <div className="flex items-center gap-2 shrink-0 cursor-pointer" onClick={() => navigate("/MainFeed?loc=MainFeed")}>
          <div className="flex items-center justify-center w-40 h-12 rounded-xl overflow-hidden">
            <img src={logo} alt="Daily Academic Logo" className="w-full h-full object-contain" />
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        {!isLoaded && (
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2 text-gray-800">Loading...</h2>
            <p className="text-gray-600">Initializing Clerk authentication...</p>
          </div>
        )}

        <SignedOut>
          <div className="text-center max-w-md">
            {/* <h2 className="text-2xl font-bold mb-2 text-gray-800">Welcome to Daily Academic</h2> */}
            {/* <p className="text-gray-600 mb-8">Please sign in to continue</p> */}
            <SignIn />
          </div>
        </SignedOut>

        <SignedIn>
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-2 text-gray-800">Redirecting...</h2>
            <p className="text-gray-600">Taking you to the home page...</p>
          </div>
        </SignedIn>
      </main>
    </div>
  );
}

export default LoginPage;
