import { useState } from "react";
import { Eye, EyeOff, LockKeyhole, UserRound, Check, LoaderCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { login } from "./auth";
import logo from "./assets/bashkimtours_logo.png";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [exiting, setExiting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username.trim(), password);
      setExiting(true);
      await new Promise((resolve) => window.setTimeout(resolve, 560));
      sessionStorage.setItem("bt_login_transition", "1");
      navigate("/students", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={`bt-login-page ${exiting ? "is-exiting" : ""}`}>
      <section className="bt-login-brand" aria-label="Bashkim Tours">
        <div className="bt-brand-copy">
          <span className="bt-eyebrow">Mirë se vini</span>
          <h1>Udhëtimi juaj fillon këtu.</h1>
          <p>Menaxhoni shërbimet dhe informacionet e Bashkim Tours në një hapësirë të vetme.</p>
        </div>
      </section>

      <section className="bt-login-panel">
        <form className="bt-login-card" onSubmit={handleSubmit}>
          <img className="bt-login-logo" src={logo} alt="Bashkim Tours" />
          <div className="bt-form-heading">
            <h2>Kyçu në llogari</h2>
            <p>Vendosni të dhënat tuaja për të vazhduar.</p>
          </div>

          <label className="bt-field">
            <span>Përdoruesi</span>
            <span className="bt-input-wrap">
              <UserRound size={19} aria-hidden="true" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="Emri i përdoruesit" required />
            </span>
          </label>

          <label className="bt-field">
            <span>Fjalëkalimi</span>
            <span className="bt-input-wrap">
              <LockKeyhole size={19} aria-hidden="true" />
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Fjalëkalimi" required />
              <button className="bt-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Fshih fjalëkalimin" : "Shfaq fjalëkalimin"}>
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>

          {error && <p className="bt-error" role="alert">{error}</p>}
          <button className="bt-submit" type="submit" disabled={loading} aria-busy={loading}>
            <span className="bt-pwa-login-feedback" aria-hidden="true">{exiting ? <Check size={20} /> : loading ? <LoaderCircle size={20} className="bt-pwa-login-spinner" /> : null}</span>
            {loading ? "Duke u kyçur…" : "Kyçu"}
          </button>
          <p className="bt-help">Për ndihmë me llogarinë, kontaktoni administratorin.</p>
        </form>
      </section>
    </main>
  );
}
