import { useState } from "react";
import { useNavigate } from "react-router-dom";
import campusBuildingImage from "../../assets/Cita_Hati_High_School_East_Campus_Building.jpg";
import schoolLogo from "../../assets/Cita_Hati_Christian_School_Logo.jpeg";
import { loginUser } from "../../services/atlApi";


export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await loginUser({ username, password });
      navigate("/dashboard");
    } catch (loginError) {
      setError(loginError?.message || "Username atau password tidak valid.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-stone-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(234,179,8,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(157,158,3,0.18),_transparent_28%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl overflow-hidden rounded-[2rem] border border-primary/15 bg-white shadow-[0_30px_90px_rgba(133,119,60,0.18)]">
        <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-stone-950 px-10 py-12 text-white lg:flex">
          <div className="absolute inset-0 z-0">
            <img
              className="h-full w-full object-cover opacity-30 grayscale mix-blend-screen"
              src={campusBuildingImage}
              alt="School facade"
            />
            <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(24,24,27,0.9)_0%,rgba(24,24,27,0.72)_40%,rgba(234,179,8,0.16)_100%)]" />
          </div>

          <div className="relative z-10 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg backdrop-blur-md">
              <img
                className="h-12 w-12 object-contain"
                src={schoolLogo}
                alt="School crest"
              />
            </div>
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
                Ecosystem Member
              </p>
              <h1 className="font-headline text-2xl font-semibold tracking-tight text-white">
                Cita Hati Christian School
              </h1>
            </div>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="mb-5 inline-flex rounded-full border border-primary/25 bg-primary/10 px-4 py-2 font-label text-xs uppercase tracking-[0.26em] text-primary">
              ATL Assessment Portal
            </p>
            <h2 className="font-headline text-5xl font-semibold leading-[1.02] tracking-tight text-white">
              Assess.
              <br />
              <span className="text-primary">Evolve.</span>
              <br />
              Exceed.
            </h2>
            <p className="mt-6 max-w-sm text-justify text-sm leading-6 text-stone-400">
              The ATL Soft Skill Assessment is designed to measure the growth of
              self-management, social, and research skills based on International Baccalaureate's ATL framework
              using fuzzy-AHP algorithm for comprehensive evaluation.
            </p>
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex gap-2">
              <div className="h-2 w-8 rounded-full bg-primary" />
              <div className="h-2 w-2 rounded-full bg-secondary" />
              <div className="h-2 w-2 rounded-full bg-tertiary" />
            </div>
            <p className="font-label text-[11px] uppercase tracking-[0.24em] text-stone-400">
              Surabaya | East Java
            </p>
          </div>
        </div>

        <div className="flex w-full items-center justify-center bg-[linear-gradient(180deg,#fffdf3_0%,#ffffff_55%,#f7f2da_100%)] px-6 py-10 sm:px-10 lg:w-[54%] lg:px-16">
          <div className="w-full max-w-xl">
            <div className="mb-8 lg:hidden">
              <p className="font-label text-[11px] uppercase tracking-[0.22em] text-neutral/80">
                Portal Access
              </p>
              <h2 className="mt-2 font-headline text-3xl font-semibold tracking-tight text-stone-900">
                Cita Hati Christian School
              </h2>
            </div>

            <div className="mb-10">
              <p className="font-label text-[11px] uppercase tracking-[0.24em] text-neutral/80">
                Portal Access
              </p>
              <h3 className="mt-3 font-headline text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                ATL Soft Skill Assessment
              </h3>
              <p className="mt-4 max-w-lg text-sm leading-7 text-stone-600">
                Sign in to continue your progress review, assessment records,
                and student development insights in one secure dashboard.
              </p>
              <div className="mt-5 h-1.5 w-20 rounded-full bg-gradient-to-r from-primary via-secondary to-tertiary" />
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-6 rounded-[1.75rem] border border-primary/15 bg-white/90 p-6 shadow-[0_24px_60px_rgba(203,172,4,0.12)] backdrop-blur-sm sm:p-8">
                <div className="space-y-2">
                  <label className="ml-1 block font-label text-[11px] uppercase tracking-[0.22em] text-neutral">
                    Username / Email
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral/70 transition-colors group-focus-within:text-primary">
                      <span className="material-symbols-outlined text-[20px]">
                        person
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="Masukkan username, email, atau NIP"
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-4 pl-12 pr-4 font-body text-sm text-stone-900 outline-none transition duration-200 placeholder:text-stone-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <label className="font-label text-[11px] uppercase tracking-[0.22em] text-neutral">
                      Password
                    </label>
                    <span className="font-label text-[10px] uppercase tracking-[0.18em] text-tertiary">
                      Secure Login
                    </span>
                  </div>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-neutral/70 transition-colors group-focus-within:text-primary">
                      <span className="material-symbols-outlined text-[20px]">
                        lock
                      </span>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Masukkan password akun"
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50 py-4 pl-12 pr-14 font-body text-sm text-stone-900 outline-none transition duration-200 placeholder:text-stone-400 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/15"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-4 text-neutral/70 transition hover:text-primary"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="group flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral/40 text-primary focus:ring-primary/20"
                      checked={rememberMe}
                      onChange={() => setRememberMe(!rememberMe)}
                    />
                    <span className="font-body text-sm text-stone-600 transition group-hover:text-stone-900">
                      Ingat Saya
                    </span>
                  </label>
                  <a
                    href="#"
                    className="font-label text-[11px] uppercase tracking-[0.2em] text-secondary transition hover:text-tertiary"
                  >
                    Lupa Password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-body text-sm font-semibold text-stone-950 shadow-[0_18px_35px_rgba(234,179,8,0.3)] transition duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:shadow-[0_24px_40px_rgba(203,172,4,0.35)] active:translate-y-0"
                >
                  <span>{isSubmitting ? "Memproses..." : "Masuk"}</span>
                  <span className="material-symbols-outlined text-[18px] transition group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </button>
                {error && (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {error}
                  </p>
                )}
              </div>
            </form>

            <div className="mt-6 flex items-center gap-3 text-xs text-neutral/85">
              <div className="h-px flex-1 bg-neutral/20" />
              <span className="font-label uppercase tracking-[0.2em]">
                Trusted Academic Access
              </span>
              <div className="h-px flex-1 bg-neutral/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
