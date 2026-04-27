import React, { useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "./sidebar";
import { allStudentsData } from "./dummyStudents"; // Import data siswa

export default function StudManage() {
  const currentUser = {
    name: "Joko Wiryanto",
    role: "Wali Kelas 3A",
  };

  const years = ["2024/2025", "2025/2026", "2026/2027"];
  const [selectedYear, setSelectedYear] = useState("2025/2026");
  const [selectedClassLabel, setSelectedClassLabel] = useState("3A - Primary"); // State untuk label kelas yang dipilih
  const [showClassInsight, setShowClassInsight] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const students = allStudentsData[selectedClassLabel] || []; // Ambil data siswa berdasarkan kelas yang dipilih

  const overallScores = students.map((student) => Number.parseInt(student.overall, 10));
  const averageOverall = Math.round(
    overallScores.reduce((total, score) => total + score, 0) / overallScores.length
  );

  const getLevelConfig = (score) => {
    if (score >= 80) {
      return {
        label: "Exceeding",
        range: "80-100",
        color: "#10b981",
        badgeClass: "bg-emerald-100 text-emerald-700",
      };
    }

    if (score >= 70) {
      return {
        label: "Meeting",
        range: "70-79",
        color: "#3b82f6",
        badgeClass: "bg-blue-100 text-blue-700",
      };
    }

    if (score >= 50) {
      return {
        label: "Developing",
        range: "50-69",
        color: "#f59e0b",
        badgeClass: "bg-amber-100 text-amber-700",
      };
    }

    return {
      label: "Emerging",
      range: "0-49",
      color: "#ef4444",
      badgeClass: "bg-rose-100 text-rose-700",
    };
  };

  const averageLevel = getLevelConfig(averageOverall);

  const distribution = [
    { key: "exceeding", label: "Exceeding", range: "80-100", color: "#10b981", count: 0 },
    { key: "meeting", label: "Meeting", range: "70-79", color: "#3b82f6", count: 0 },
    { key: "developing", label: "Developing", range: "50-69", color: "#f59e0b", count: 0 },
    { key: "emerging", label: "Emerging", range: "0-49", color: "#ef4444", count: 0 },
  ].map((item) => ({
    ...item,
    count: overallScores.filter((score) => {
      if (item.key === "exceeding") return score >= 80;
      if (item.key === "meeting") return score >= 70 && score <= 79;
      if (item.key === "developing") return score >= 50 && score <= 69;
      return score <= 49;
    }).length,
  }));

  const dominantCategory = distribution.reduce((top, item) => (item.count > top.count ? item : top), distribution[0]);
  const focusCounts = students.reduce((acc, student) => {
    acc[student.focus] = (acc[student.focus] || 0) + 1;
    return acc;
  }, {});
  const topFocus = Object.entries(focusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Communication";

  const totalStudents = students.length;
  const totalPages = Math.ceil(students.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStudents = students.slice(startIndex, endIndex);
  const pieSegments = distribution
    .map((item, index, array) => {
      const start = array
        .slice(0, index)
        .reduce((total, current) => total + (current.count / totalStudents) * 100, 0);
      const end = start + (item.count / totalStudents) * 100;

      return `${item.color} ${start}% ${end}%`;
    })
    .join(", ");
  const pieChartStyle = {
    background: `conic-gradient(${pieSegments || "#e7e5e4 0% 100%"})`,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <Sidebar active="students" user={currentUser} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-7xl flex-col gap-8">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="px-2 py-0.5 rounded bg-primary/20 text-primary-hover text-[10px] font-bold uppercase tracking-widest">
                  Main Page / Student Management
                </span>
                <h1 className="mt-3 text-3xl font-black text-text-main-light lg:text-4xl">
                  Student Management
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <h2 className="text-xl font-bold text-primary">Kelas</h2>
                  <select
                    value={selectedClassLabel}
                    onChange={(e) => setSelectedClassLabel(e.target.value)}
                    className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1 text-lg font-bold text-primary outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {Object.keys(allStudentsData).map((classLabel) => (
                      <option key={classLabel} value={classLabel}>
                        {classLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-3 max-w-2xl text-sm text-text-sub-light">
                  Kelola penilaian ATL siswa secara global dan pantau perkembangan mereka secara real time.
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-200/90 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-500">Pengaturan Filter</p>
                  <h2 className="mt-2 text-xl font-bold text-stone-900">Pilih Tahun Ajaran</h2>
                </div>
                <div className="rounded-3xl bg-stone-50 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Tahun Ajaran</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {years.map((year) => (
                      <button
                        key={year}
                        type="button"
                        onClick={() => setSelectedYear(year)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          selectedYear === year
                            ? "bg-primary text-white"
                            : "bg-white text-stone-700 ring-1 ring-stone-200 hover:border-primary/50"
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-1">
              <div className="rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
                <div className="flex min-h-[220px] flex-col gap-6 xl:flex-row xl:items-start xl:justify-between xl:gap-10">
                  <div className="min-w-0 xl:max-w-[55%]">
                    <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Assigned Classes</p>
                    <h2 className="mt-3 text-5xl font-black text-white">Grade {selectedClassLabel}</h2>
                    <p className="mt-4 text-sm leading-7 text-slate-300">
                      Ruang kelas utama untuk penilaian ATL. Data berikut merepresentasikan ringkasan nilai ATL siswa yang sudah tersedia di tabel, sehingga fokus tetap pada performa ATL.
                    </p>
                  </div>

                  <div className="min-w-[260px] rounded-[2rem] border border-amber-300/20 bg-[#111317] p-6 shadow-[0_30px_60px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-amber-300/80">Average Nilai ATL</p>
                        <p className="mt-5 text-5xl font-black text-white">{averageOverall}%</p>
                      </div>
                      <span className="h-12 w-12 rounded-full bg-amber-300/20 p-3 text-center text-2xl font-black text-amber-200 shadow-[0_10px_30px_rgba(245,158,11,0.22)]">
                        A
                      </span>
                    </div>
                    <div className="mt-5 h-1 w-full rounded-full bg-amber-300/20">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-400" style={{ width: `${averageOverall}%` }} />
                    </div>
                    <p className="mt-4 text-sm text-slate-400">Meningkat 4% dari periode lalu</p>
                  </div>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Total Siswa</p>
                    <p className="mt-3 text-3xl font-black text-white">{totalStudents}</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Dominan Level ATL</p>
                    <p className="mt-3 text-3xl font-black text-white">{dominantCategory.label}</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-300">Fokus Terbanyak</p>
                    <p className="mt-3 text-3xl font-black text-white">{topFocus}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.8rem] border-2 border-stone-200/90 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-xs uppercase tracking-[0.24em] text-stone-500">Daftar Siswa</span>
                  <h2 className="mt-2 text-2xl font-black text-stone-900">Kelola penilaian ATL siswa</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-2xl bg-stone-50 px-4 py-3 text-sm text-stone-600 ring-1 ring-stone-200"
                  >
                    <option value={5}>Tampilkan 5 per halaman</option>
                    <option value={10}>Tampilkan 10 per halaman</option>
                    <option value={15}>Tampilkan 15 per halaman</option>
                  </select>
                  <button className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-primary/50 hover:text-primary">
                    Reset Filter
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClassInsight((current) => !current)}
                    className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/10"
                  >
                    {showClassInsight ? "Sembunyikan Insight Kelas" : "Insight Kelas"}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-stone-200">
                  <thead className="bg-stone-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">No</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Siswa</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Overall ATL</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Strength</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Focus Area</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Trend</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200 bg-white">
                    {currentStudents.map((student, index) => (
                      <tr key={student.id} className="group transition-colors hover:bg-primary/5">
                        <td className="px-6 py-4 text-sm font-semibold text-stone-900">{String(startIndex + index + 1).padStart(2, "0")}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-4">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${student.avatarTone} text-xs font-bold text-stone-900 shadow-sm`}>
                              {student.initials}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-stone-900">{student.name}</div>
                              <div className="text-xs text-stone-500">{student.nis}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-stone-900">
                          <div className="flex items-center gap-2">
                            <span>{student.overall}</span>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getLevelConfig(Number.parseInt(student.overall, 10)).badgeClass}`}>
                              {getLevelConfig(Number.parseInt(student.overall, 10)).label}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-900">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                            <div>{student.strength}</div>
                          </div>
                          <div className="text-xs text-stone-500">{student.strengthValue}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-stone-600">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
                            {student.focus}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-emerald-600">{student.trendValue}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-md shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-secondary active:scale-95">
                            Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-stone-500">
                  Menampilkan {startIndex + 1} sampai {Math.min(endIndex, students.length)} dari {students.length} siswa
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                          currentPage === page
                            ? "bg-primary text-white"
                            : "border border-stone-200 bg-white text-stone-700 hover:border-primary/50 hover:text-primary"
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-2xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-primary/50 hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>

            {showClassInsight && (
              <div className="rounded-[1.8rem] border-2 border-stone-200/90 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <span className="text-xs uppercase tracking-[0.24em] text-stone-500">Insight Kelas</span>
                    <h2 className="mt-2 text-2xl font-black text-stone-900">
                      Ringkasan ATL {selectedClassLabel}
                    </h2>
                    <p className="mt-2 text-sm text-stone-500">Distribusi overall ATL siswa untuk tahun ajaran {selectedYear}.</p>
                  </div>
                  <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {totalStudents} siswa
                  </span>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Rata-rata ATL</p>
                        <p className="mt-2 text-3xl font-black text-stone-900">{averageOverall}%</p>
                        <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${averageLevel.badgeClass}`}>
                          {averageLevel.label}
                        </span>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Kategori Dominan</p>
                        <p className="mt-2 text-lg font-black text-stone-900">
                          {distribution.reduce((top, item) => (item.count > top.count ? item : top), distribution[0]).label}
                        </p>
                        <p className="mt-2 text-sm text-stone-500">
                          {distribution.reduce((top, item) => (item.count > top.count ? item : top), distribution[0]).count} siswa
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-500">Tahun Ajaran</p>
                        <p className="mt-2 text-lg font-black text-stone-900">{selectedYear}</p>
                        <p className="mt-2 text-sm text-stone-500">{selectedClassLabel}</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-stone-200">
                      <h3 className="text-lg font-bold text-stone-900">Distribusi ATL Skills</h3>
                      <div className="mt-5 space-y-4">
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-stone-700">Self-Management</span>
                            <span className="text-sm font-bold text-emerald-600">82%</span>
                          </div>
                          <div className="h-2 rounded-full bg-stone-200">
                            <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"></div>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-stone-700">Thinking Skills</span>
                            <span className="text-sm font-bold text-blue-600">78%</span>
                          </div>
                          <div className="h-2 rounded-full bg-stone-200">
                            <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-blue-400 to-blue-600"></div>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-stone-700">Communication</span>
                            <span className="text-sm font-bold text-purple-600">71%</span>
                          </div>
                          <div className="h-2 rounded-full bg-stone-200">
                            <div className="h-full w-[71%] rounded-full bg-gradient-to-r from-purple-400 to-purple-600"></div>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-stone-700">Social Skills</span>
                            <span className="text-sm font-bold text-amber-600">75%</span>
                          </div>
                          <div className="h-2 rounded-full bg-stone-200">
                            <div className="h-full w-[75%] rounded-full bg-gradient-to-r from-amber-400 to-amber-600"></div>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold text-stone-700">Research Skills</span>
                            <span className="text-sm font-bold text-rose-600">73%</span>
                          </div>
                          <div className="h-2 rounded-full bg-stone-200">
                            <div className="h-full w-[73%] rounded-full bg-gradient-to-r from-rose-400 to-rose-600"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                    <h3 className="text-lg font-bold text-stone-900">Distribusi Level ATL Kelas</h3>
                    <div className="mt-6 flex flex-col items-center gap-6">
                      <div className="relative flex h-52 w-52 items-center justify-center rounded-full" style={pieChartStyle}>
                        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Rata-rata</span>
                          <span className="mt-1 text-3xl font-black text-stone-900">{averageOverall}%</span>
                        </div>
                      </div>

                      <div className="w-full space-y-3">
                        {distribution.map((item) => {
                          const percentage = Math.round((item.count / totalStudents) * 100);

                          return (
                            <div key={item.key} className="flex items-start justify-between gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-stone-200">
                              <div className="flex items-start gap-3">
                                <span className="mt-1 inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                                <div>
                                  <p className="text-sm font-semibold text-stone-900">
                                    {item.label} ({item.range})
                                  </p>
                                  <p className="text-xs text-stone-500">{item.count} siswa</p>
                                </div>
                              </div>
                              <span className="text-sm font-bold text-stone-700">{percentage}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
