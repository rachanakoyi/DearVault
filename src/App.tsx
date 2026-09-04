import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./lib/firebase";
import { LandingPage } from "./components/LandingPage";
import { Dashboard } from "./components/Dashboard";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center text-stone-600 font-sans">
        <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-50 flex items-center justify-center font-serif text-xl shadow-md mb-4 animate-pulse">
          D
        </div>
        <div className="text-xs font-medium text-stone-500">
          Connecting to private session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return <Dashboard user={user} />;
}
