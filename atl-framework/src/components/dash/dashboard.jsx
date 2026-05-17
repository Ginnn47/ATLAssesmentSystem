import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "./sidebar";
import { dummyATL } from "./dummyATL";
import { allStudentsData } from "./dummyStudents";
import { getClassAnalytics, scoreCategory } from "./atlAnalytics";

export default function Dashboard() {
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    const syncData = () => {
      const saved = localStorage.getItem("atl_framework_data");
      if (saved) Object.assign(dummyATL, JSON.parse(saved));
      setDataVersion((version) => version + 1);
    };
    syncData();
    window.addEventListener("focus", syncData);
    window.addEventListener("storage", syncData);
    window.addEventListener("atl-data-updated", syncData);
    return () => {
      window.removeEventListener("focus", syncData);
      window.removeEventListener("storage", syncData);
      window.removeEventListener("atl-data-updated", syncData);
    };
  }, []);

  const classAnalytics = useMemo(
    () =>
      Object.entries(allStudentsData).map(([className, students]) => ({
        className,
        ...getClassAnalytics(students, dummyATL),
      })),
    [dataVersion]
  );
  const totalStudents = classAnalytics.reduce((sum, item) => sum + item.totalStudents, 0);
  const assessedStudents = classAnalytics.reduce((sum, item) => sum + item.assessedCount, 0);
  const weightedAverage =
    assessedStudents > 0
      ? Math.round(classAnalytics.reduce((sum, item) => sum + item.average * item.assessedCount, 0) / assessedStudents)
      : 0;
  const completion = totalStudents > 0 ? Math.round((assessedStudents / totalStudents) * 100) : 0;
  const weightedAverageLevel = assessedStudents > 0 ? scoreCategory(weightedAverage) : { label: "No Data", badgeClass: "bg-stone-100 text-stone-600" };
  const bestClass = classAnalytics.slice().sort((a, b) => b.average - a.average)[0];
  const topicCount = new Set(
    Object.values(dummyATL.savedAssessments || {}).flatMap((studentAssessments) => Object.keys(studentAssessments || {}))
  ).size;
  const totalCriteria = Object.keys(dummyATL)
    .filter((key) => Array.isArray(dummyATL[key]))
    .reduce((sum, key) => sum + dummyATL[key].length, 0);

  const points = classAnalytics.length > 0 ? classAnalytics : [{ className: "No Data", average: 0 }];
  const chartPoints = points.map((item, index) => {
    const x = points.length === 1 ? 200 : (index / (points.length - 1)) * 400;
    const y = 180 - (item.average / 100) * 150;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar user={{ name: "Joko Wiryanto", role: "Guru / Evaluator" }} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-stone-50">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-primary-hover">
                  Main Page / Dashboard
                </span>
                <h1 className="mt-2 text-2xl font-black text-text-main-light lg:text-3xl">
                  Dashboard ATL Assessment
                </h1>
                <p className="text-sm text-text-sub-light">
                  Grafik dan ringkasan diambil dari nilai ATL yang sudah tersimpan melalui detailed atau batch input.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("atl-data-updated"))}
                className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary-hover"
              >
                <span className="material-symbols-outlined text-lg">sync</span>
                Refresh Data
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-12">
              <div className="relative overflow-hidden rounded-2xl border-2 border-primary/80 bg-white p-6 shadow-[0_12px_28px_rgba(234,179,8,0.08)] md:col-span-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider text-primary">Rata-rata ATL Tersimpan</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${weightedAverageLevel.badgeClass}`}>
                    {weightedAverageLevel.label}
                  </span>
                </div>
                <div className="mb-4 flex items-end gap-4">
                  <h3 className="text-5xl font-black text-text-main-light">{weightedAverage}%</h3>
                  <div className="pb-1">
                    <p className="text-xs font-bold uppercase text-text-sub-light">Average from assessed students</p>
                    <p className="text-xs font-medium text-stone-500">{assessedStudents} dari {totalStudents} siswa sudah memiliki nilai</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-text-sub-light">Cakupan siswa ternilai</span>
                    <span className="text-text-main-light">{completion}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${completion}%` }} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-stone-200/90 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)] md:col-span-7">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-main-light">
                  Ringkasan Data Penilaian
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border-2 border-stone-200/80 bg-stone-50 p-3">
                    <span className="material-symbols-outlined text-primary text-xl">school</span>
                    <span className="block text-2xl font-bold">{totalStudents}</span>
                    <span className="text-[10px] font-bold uppercase text-text-sub-light">Siswa Terdaftar</span>
                  </div>
                  <div className="rounded-xl border-2 border-stone-200/80 bg-stone-50 p-3">
                    <span className="material-symbols-outlined text-blue-500 text-xl">fact_check</span>
                    <span className="block text-2xl font-bold">{assessedStudents}</span>
                    <span className="text-[10px] font-bold uppercase text-text-sub-light">Siswa Ternilai</span>
                  </div>
                  <div className="rounded-xl border-2 border-stone-200/80 bg-stone-50 p-3">
                    <span className="material-symbols-outlined text-emerald-500 text-xl">topic</span>
                    <span className="block text-2xl font-bold">{topicCount}</span>
                    <span className="text-[10px] font-bold uppercase text-text-sub-light">Topik Ternilai</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border-2 border-stone-200/90 bg-white p-8 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <h3 className="mb-2 text-lg font-bold text-text-main-light">Rata-rata ATL per Kelas</h3>
                  <p className="mb-4 text-sm text-text-sub-light">Grafik ini mengikuti nilai aktual yang telah diinput guru.</p>
                  <div className="relative h-64 w-full rounded-2xl border-2 border-stone-200/80 bg-gradient-to-br from-white to-primary/5 p-3">
                    <svg className="h-full w-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                      {[40, 90, 140].map((y) => (
                        <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(234,179,8,0.12)" strokeWidth="1.5" strokeDasharray="6 6" />
                      ))}
                      <polyline points={chartPoints} fill="none" stroke="rgba(234,179,8,0.22)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
                      <polyline points={chartPoints} fill="none" stroke="#EAB308" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((item, index) => {
                        const x = points.length === 1 ? 200 : (index / (points.length - 1)) * 400;
                        const y = 180 - (item.average / 100) * 150;
                        return <circle key={item.className} cx={x} cy={y} r="5" fill="#111827" />;
                      })}
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col gap-6">
                  <div className="rounded-2xl border-2 border-white/25 bg-[#5C57F2] p-6 text-white shadow-[0_18px_40px_rgba(92,87,242,0.24)]">
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-widest opacity-80">Progress Penilaian</p>
                    <h4 className="text-4xl font-black">{completion}%</h4>
                    <p className="mt-2 text-[10px] leading-tight opacity-90">
                      Berdasarkan jumlah siswa yang sudah memiliki minimal satu nilai ATL tersimpan.
                    </p>
                  </div>
                  <div className="rounded-2xl border-2 border-stone-200/90 bg-stone-50 p-6">
                    <h4 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-text-sub-light">Progress Siswa Per Kelas</h4>
                    <div className="space-y-4">
                      {classAnalytics.map((item, index) => (
                        <div key={item.className} className="rounded-xl border border-transparent px-3 py-2">
                          <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={["bg-purple-500", "bg-blue-500", "bg-orange-500", "bg-emerald-500"][index % 4] + " size-2 rounded-full"} />
                              <span className="text-sm font-semibold text-text-main-light">{item.className}</span>
                            </div>
                            <span className="text-xs font-bold text-text-sub-light">{item.assessedCount}/{item.totalStudents}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${item.totalStudents ? (item.assessedCount / item.totalStudents) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
                  <h4 className="mb-2 font-bold text-text-main-light">Catatan Data Terakhir</h4>
                  <p className="text-sm leading-relaxed text-text-sub-light">
                    Data dashboard membaca localStorage assessment. Siswa tanpa input belum dihitung dalam rata-rata kelas.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-2xl border-2 border-stone-200/90 bg-white p-6">
                  <div>
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-text-sub-light">Total Kriteria</p>
                    <p className="text-3xl font-black text-text-main-light">
                      {totalCriteria} <span className="text-sm font-medium text-text-sub-light">Rubric Items</span>
                    </p>
                  </div>
                  <span className="rounded-lg border-2 border-primary px-4 py-2 text-sm font-bold text-primary">
                    Best: {bestClass?.className || "-"}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
