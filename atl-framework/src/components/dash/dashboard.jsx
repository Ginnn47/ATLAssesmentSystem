import React from "react";
import Sidebar from "./sidebar";

export default function Dashboard() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={{ name: "Joko Wiryanto",
    role: "Guru / Evaluator", }} />

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary-hover text-[10px] font-bold uppercase tracking-widest">
                  Main Page / Dashboard
                </span>
                <h1 className="text-2xl font-black text-text-main-light dark:text-text-main-dark lg:text-3xl mt-2">
                  Dashboard Fuzzy-AHP Model
                </h1>
                <p className="text-text-sub-light dark:text-text-sub-dark text-sm">
                  Struktur hierarki kriteria dan status konsistensi model penilaian soft skill.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_20px_35px_rgba(234,179,8,0.25)]">
                  <span className="material-symbols-outlined text-lg">sync</span>
                  Update Bobot
                </button>
              </div>
            </div>

            {/* Top Cards */}
            <div className="grid gap-6 md:grid-cols-12">
              {/* Consistency Card */}
              <div className="relative overflow-hidden rounded-2xl border-2 border-primary/80 bg-surface-light p-6 shadow-[0_12px_28px_rgba(234,179,8,0.08)] transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-[0_24px_45px_rgba(234,179,8,0.16)] dark:bg-surface-dark md:col-span-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold uppercase tracking-wider text-primary">Status Konsistensi Model</span>
                  <span className="flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-bold text-green-600 transition-all duration-300 hover:scale-[1.03] hover:bg-green-500/15">
                    <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>
                    Valid
                  </span>
                </div>
                <div className="flex items-end gap-4 mb-4">
                  <h3 className="text-4xl font-black text-text-main-light dark:text-text-main-dark">0.082</h3>
                  <div className="pb-1">
                    <p className="text-xs font-bold text-text-sub-light dark:text-text-sub-dark uppercase">Consistency Ratio (CR)</p>
                    <p className="text-xs text-green-600 font-medium">Di bawah ambang batas 0.1</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-text-sub-light">Index Random (RI)</span>
                    <span className="text-text-main-light dark:text-text-main-dark">1.12 (n=5)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="bg-primary h-2 rounded-full" style={{width: "82%"}}></div>
                  </div>
                </div>
              </div>

              {/* User Distribution */}
              <div className="rounded-2xl border-2 border-stone-200/90 bg-surface-light p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_45px_rgba(15,23,42,0.08)] dark:border-border-dark dark:bg-surface-dark md:col-span-7">
                <h3 className="text-sm font-bold text-text-main-light dark:text-text-main-dark mb-4 uppercase tracking-wider">
                  Distribusi Peran User
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1 rounded-xl border-2 border-stone-200/80 bg-background-light p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_18px_34px_rgba(234,179,8,0.12)] dark:border-border-dark dark:bg-background-dark/50">
                    <span className="material-symbols-outlined text-primary text-xl">admin_panel_settings</span>
                    <span className="text-2xl font-bold">4</span>
                    <span className="text-[10px] font-bold text-text-sub-light uppercase">Administrator</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl border-2 border-stone-200/80 bg-background-light p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-[0_18px_34px_rgba(59,130,246,0.12)] dark:border-border-dark dark:bg-background-dark/50">
                    <span className="material-symbols-outlined text-blue-500 text-xl">psychology</span>
                    <span className="text-2xl font-bold">28</span>
                    <span className="text-[10px] font-bold text-text-sub-light uppercase">Evaluator / Guru</span>
                  </div>
                  <div className="flex flex-col gap-1 rounded-xl border-2 border-stone-200/80 bg-background-light p-3 shadow-[0_8px_18px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-green-400/50 hover:shadow-[0_18px_34px_rgba(34,197,94,0.12)] dark:border-border-dark dark:bg-background-dark/50">
                    <span className="material-symbols-outlined text-green-500 text-xl">school</span>
                    <span className="text-2xl font-bold">640</span>
                    <span className="text-[10px] font-bold text-text-sub-light uppercase">Siswa Terdaftar</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trend and Progress Cards */}
            <div className="overflow-hidden rounded-2xl border-2 border-stone-200/90 bg-surface-light p-8 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:border-primary/25 hover:shadow-[0_24px_45px_rgba(15,23,42,0.08)] dark:border-border-dark dark:bg-surface-dark">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Trend Chart */}
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-2">Tren Penilaian Mingguan</h3>
                  <p className="text-sm text-text-sub-light dark:text-text-sub-dark mb-4">Statistik penyelesaian laporan soft skill</p>
                  <div className="relative h-64 w-full rounded-2xl border-2 border-stone-200/80 bg-gradient-to-br from-white to-primary/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 hover:border-primary/35 hover:shadow-[0_18px_36px_rgba(234,179,8,0.10)]">
                    <svg className="h-full w-full" viewBox="0 0 400 200">
                      <line x1="0" y1="40" x2="400" y2="40" stroke="rgba(234,179,8,0.12)" strokeWidth="1.5" strokeDasharray="6 6" />
                      <line x1="0" y1="90" x2="400" y2="90" stroke="rgba(234,179,8,0.12)" strokeWidth="1.5" strokeDasharray="6 6" />
                      <line x1="0" y1="140" x2="400" y2="140" stroke="rgba(234,179,8,0.12)" strokeWidth="1.5" strokeDasharray="6 6" />
                      <path
                        d="M0 150 Q50 150 100 120 T200 130 T300 60 T400 90"
                        fill="none"
                        stroke="rgba(234,179,8,0.22)"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M0 150 Q50 150 100 120 T200 130 T300 60 T400 90"
                        fill="none"
                        stroke="#EAB308"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
                {/* Progress Cards */}
                <div className="flex flex-col gap-6">
                  <div className="relative overflow-hidden rounded-2xl border-2 border-white/25 bg-[#5C57F2] p-6 text-white shadow-[0_18px_40px_rgba(92,87,242,0.24)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-white/40 hover:shadow-[0_26px_55px_rgba(92,87,242,0.34)]">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-4">Progress Semester</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-4xl font-black">78%</h4>
                        <p className="mt-2 text-[10px] leading-tight opacity-90">
                          Penyelesaian data penilaian berjalan lebih cepat 15% dari semester lalu.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border-2 border-stone-200/90 bg-background-light/30 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.01] hover:border-primary/40 hover:shadow-[0_22px_45px_rgba(234,179,8,0.14)] dark:border-border-dark/90 dark:bg-background-dark/30">
                    <h4 className="text-[10px] font-bold text-text-sub-light dark:text-text-sub-dark uppercase tracking-widest mb-4">Progress Siswa Per Kelas</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/60 hover:shadow-[0_10px_24px_rgba(234,179,8,0.10)] dark:hover:bg-white/5">
                        <div className="flex items-center gap-3">
                          <div className="size-2 rounded-full bg-purple-500"></div>
                          <span className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Grade 5A</span>
                        </div>
                        <span className="text-xs font-bold text-text-sub-light">28 Students</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/60 hover:shadow-[0_10px_24px_rgba(234,179,8,0.10)] dark:hover:bg-white/5">
                        <div className="flex items-center gap-3">
                          <div className="size-2 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Grade 4B</span>
                        </div>
                        <span className="text-xs font-bold text-text-sub-light">24 Students</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-transparent px-3 py-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/60 hover:shadow-[0_10px_24px_rgba(234,179,8,0.10)] dark:hover:bg-white/5">
                        <div className="flex items-center gap-3">
                          <div className="size-2 rounded-full bg-orange-500"></div>
                          <span className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">Grade 6A</span>
                        </div>
                        <span className="text-xs font-bold text-text-sub-light">30 Students</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Cards */}
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6 shadow-[0_10px_24px_rgba(234,179,8,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_22px_40px_rgba(234,179,8,0.14)]">
                  <h4 className="font-bold text-text-main-light dark:text-text-main-dark mb-2">Catatan Model Terakhir</h4>
                  <p className="text-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                    Model Fuzzy-AHP telah diperbarui pada 12 Okt 2024 oleh <strong>Prasetyo Utomo</strong>. Bobot kriteria 'Thinking' memiliki pengaruh paling tinggi (0.32) berdasarkan input tim kurikulum Sekolah Cita Hati.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-2xl border-2 border-stone-200/90 bg-surface-light p-6 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_22px_40px_rgba(15,23,42,0.08)] dark:border-border-dark dark:bg-surface-dark">
                  <div>
                    <p className="text-xs font-bold text-text-sub-light dark:text-text-sub-dark uppercase tracking-widest mb-1">Total Kriteria</p>
                    <p className="text-3xl font-black text-text-main-light dark:text-text-main-dark">
                      19 <span className="text-sm font-medium text-text-sub-light">Sub-Kriteria</span>
                    </p>
                  </div>
                  <button className="rounded-lg border-2 border-primary px-4 py-2 text-sm font-bold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary hover:text-white hover:shadow-[0_16px_28px_rgba(234,179,8,0.22)]">
                    Lihat Detail Model
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
