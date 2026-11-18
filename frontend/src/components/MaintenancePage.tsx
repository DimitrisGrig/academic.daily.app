import { useClerk } from "@clerk/clerk-react";

/*
 * Full-screen maintenance / migration page shown to blocked users.
 * Designed to look like a genuine platform-wide outage so the user
 * believes the entire service is temporarily offline.
 */
const MaintenancePage = () => {
  const { signOut } = useClerk();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Animated maintenance icon */}
        <div className="flex justify-center">
          <div className="relative">
            <svg className="w-24 h-24 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.42 15.17l-5.1-5.1a2.121 2.121 0 113-3l5.1 5.1m0 0l5.1 5.1a2.121 2.121 0 01-3 3l-5.1-5.1m0 0L8.34 18.25m3.08-3.08L14.5 12.1"
              />
            </svg>
            {/* Small spinning gear */}
            <svg
              className="w-8 h-8 text-slate-400 absolute -bottom-1 -right-1 animate-spin"
              style={{ animationDuration: "3s" }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93s.844.126 1.197-.094l.758-.474a1.12 1.12 0 011.37.166l.773.773a1.12 1.12 0 01.166 1.37l-.474.758c-.22.353-.253.81-.094 1.197s.506.71.93.78l.894.15c.542.09.94.56.94 1.109v1.094c0 .55-.398 1.02-.94 1.11l-.894.149c-.424.07-.764.384-.93.78s-.126.844.094 1.197l.474.758a1.12 1.12 0 01-.166 1.37l-.773.773a1.12 1.12 0 01-1.37.166l-.758-.474c-.353-.22-.81-.253-1.197-.094s-.71.506-.78.93l-.15.894c-.09.542-.56.94-1.109.94h-1.094c-.55 0-1.02-.398-1.11-.94l-.149-.894c-.07-.424-.384-.764-.78-.93s-.844-.126-1.197.094l-.758.474a1.12 1.12 0 01-1.37-.166l-.773-.773a1.12 1.12 0 01-.166-1.37l.474-.758c.22-.353.253-.81.094-1.197s-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78s.126-.844-.094-1.197l-.474-.758a1.12 1.12 0 01.166-1.37l.773-.773a1.12 1.12 0 011.37-.166l.758.474c.353.22.81.253 1.197.094s.71-.506.78-.93l.15-.894z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>

        {/* Main heading */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">We're Upgrading Our Systems</h1>
          <p className="text-lg text-slate-500">Scheduled Infrastructure Migration</p>
        </div>

        {/* Description */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4 text-left">
          <p className="text-slate-600 leading-relaxed">
            Daily Academic is currently undergoing a planned migration to new facility servers to improve performance and reliability for all users.
          </p>
          <p className="text-slate-600 leading-relaxed">
            During this period, the platform is temporarily unavailable. All your data — saved articles, feeds, and preferences — is safe and will be
            fully restored once the migration is complete.
          </p>

          {/* Timeline */}
          <div className="flex items-center gap-3 bg-blue-50 rounded-lg p-4 mt-2">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-700">
              <span className="font-semibold">Estimated completion:</span> We expect to be back online within a few days. Thank you for your patience.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Questions? Reach us at{" "}
            <a href="mailto:support@daily-academic.com" className="text-blue-500 hover:underline">
              support@daily-academic.com
            </a>
          </p>
          <button onClick={() => signOut()} className="text-sm text-slate-400 hover:text-slate-600 underline cursor-pointer transition-colors">
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
