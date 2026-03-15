import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Incorrect username or password");
        setIsLoading(false);
      } else {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setTimeout(() => navigate("/dashboard"), 1500);
      }
    } catch (err) {
      setError("An error occurred during login");
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 via-gray-900 to-black relative py-8">
      <div className="absolute inset-0 bg-[url('/images/navotas.jpg')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-4xl flex h-120">
        {/* Left - Login Form */}
        <div className="w-1/2 p-12 flex flex-col justify-center">
          <form
            onSubmit={handleLogin}
            className="flex flex-col items-center justify-center text-center"
          >
            <h1 className="font-bold text-3xl mb-2">Login</h1>
            <span className="text-xs text-gray-600 mb-6">
              Use your account credentials
            </span>

            <div className="w-full">
              <input
                type="email"
                placeholder="Email"
                value={loginEmail}
                onChange={(e) => {
                  setLoginEmail(e.target.value);
                  setError("");
                }}
                className={`w-full px-4 py-3 my-2 rounded transition-colors ${
                  error
                    ? "bg-red-50 border-2 border-red-500 focus:outline-none focus:border-red-600"
                    : "bg-gray-100 border-none"
                }`}
                required
                disabled={isLoading}
              />
            </div>

            <div className="w-full">
              <input
                type="password"
                placeholder="Password"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setError("");
                }}
                className={`w-full px-4 py-3 my-2 rounded transition-colors ${
                  error
                    ? "bg-red-50 border-2 border-red-500 focus:outline-none focus:border-red-600"
                    : "bg-gray-100 border-none"
                }`}
                required
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="w-full text-left mt-2 mb-2">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="rounded-full border border-red-700 bg-red-600 text-white text-xs font-bold px-11 py-3 uppercase tracking-wider mt-4 transition-transform active:scale-95 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Signing In...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Right - Branding */}
        <div className="w-1/2 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white flex items-center justify-center flex-col p-10">
          <img
            src="/images/logtell1.png"
            alt="E-Telly Logo"
            className="w-37 h-40 mb-4"
          />
          <h1 className="font-bold text-3xl mb-2">E-TELLY</h1>
          <p className="text-sm leading-5 tracking-wide text-center">
            Disaster preparedness and community resource sharing
          </p>
        </div>
      </div>
    </div>
  );
}
